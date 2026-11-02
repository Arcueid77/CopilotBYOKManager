//! Default-off, destination-scoped synchronization of saved providers into App SQLite.
pub mod commands;
pub mod consent;
#[cfg(test)]
mod tests;
mod worker;

use crate::{
    adapters::github_app::sqlite::{self, target::Target},
    commands::ManagedState,
    domain::{ClientKind, ClientTarget, Connection, DeploymentPurpose},
    error::{AppError, AppResult},
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::{
    collections::{BTreeMap, HashMap},
    path::Path,
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        Arc, Condvar, Mutex,
    },
    time::Instant,
};

pub const TARGET_ID: &str = "github-copilot-app:local";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Approval {
    pub target: Target,
    pub consent_revision: String,
    pub revoke: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Disabled,
    ConsentRequired,
    UnsupportedSchema,
    ReviewRequired,
    PendingAppExit,
    PendingSync,
    Paused,
    Synchronizing,
    SyncedConfiguration,
    Conflict,
    Failed,
    RecoveryRequired,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderResult {
    pub connection_id: String,
    pub name: String,
    pub phase: Phase,
    pub model_count: Option<usize>,
    pub observed_at: DateTime<Utc>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub enabled: bool,
    pub phase: Phase,
    pub database_path: Option<String>,
    pub app_version: Option<String>,
    pub selected_connection_ids: Vec<String>,
    pub owned_connection_ids: Vec<String>,
    pub results: Vec<ProviderResult>,
    pub diagnostic: Option<String>,
    pub has_owned_configuration: bool,
}
impl Default for Status {
    fn default() -> Self {
        Self {
            enabled: false,
            phase: Phase::Disabled,
            database_path: None,
            app_version: None,
            selected_connection_ids: Vec::new(),
            owned_connection_ids: Vec::new(),
            results: Vec::new(),
            diagnostic: None,
            has_owned_configuration: false,
        }
    }
}

pub(super) struct EnablePlan {
    pub consent: consent::Consent,
    pub state_revision: String,
    pub mode_revision: String,
    pub epoch: u64,
    pub expires: Instant,
}

pub struct Jobs {
    pub(super) mode: Mutex<consent::Store>,
    pub(super) plans: Mutex<HashMap<String, EnablePlan>>,
    pub(super) status: Mutex<Status>,
    pub(super) attempts: Mutex<BTreeMap<String, String>>,
    signal: (Mutex<bool>, Condvar),
    pub(super) cancelled: AtomicBool,
    pub(super) halted: AtomicBool,
    pub(super) stopping: AtomicBool,
    active: AtomicUsize,
    started: AtomicBool,
    pub(super) settings_epoch: AtomicU64,
    owner: String,
}

impl Jobs {
    pub fn new(state_path: &Path, owner: &str) -> Self {
        let mode = consent::Store::open(state_path, owner);
        let enabled = mode.snapshot().is_ok_and(|r| r.enabled);
        Self {
            mode: Mutex::new(mode),
            plans: Mutex::new(HashMap::new()),
            status: Mutex::new(Status {
                enabled,
                phase: if enabled {
                    Phase::PendingSync
                } else {
                    Phase::Disabled
                },
                ..Status::default()
            }),
            attempts: Mutex::new(BTreeMap::new()),
            signal: (Mutex::new(enabled), Condvar::new()),
            cancelled: AtomicBool::new(!enabled),
            halted: AtomicBool::new(false),
            stopping: AtomicBool::new(false),
            active: AtomicUsize::new(0),
            started: AtomicBool::new(false),
            settings_epoch: AtomicU64::new(0),
            owner: owner.into(),
        }
    }
    pub fn snapshot(&self) -> AppResult<consent::Consent> {
        self.mode.lock().map_err(|_| AppError::Lock)?.snapshot()
    }
    pub fn status(&self, state: &ManagedState) -> AppResult<Status> {
        let mut status = self.status.lock().map_err(|_| AppError::Lock)?.clone();
        match self.snapshot() {
            Ok(mode) => {
                status.enabled = mode.enabled;
                status.database_path = mode
                    .target
                    .as_ref()
                    .map(|t| t.database.to_string_lossy().into_owned());
                status.app_version = mode.target.as_ref().map(|t| t.version.clone());
                status.selected_connection_ids = mode.scopes.keys().cloned().collect();
                if !mode.enabled {
                    status.phase = Phase::Disabled;
                }
                let store = state.store()?;
                status.owned_connection_ids = store
                    .ownership()
                    .iter()
                    .filter(|p| p.target_kind == ClientKind::GithubCopilotApp)
                    .map(|p| p.connection_id.clone())
                    .collect();
                status.has_owned_configuration = store
                    .ownership()
                    .iter()
                    .any(|p| p.target_kind == ClientKind::GithubCopilotApp);
                if mode.enabled
                    && (mode.owner_id != store.installation_owner_id()
                        || mode.scopes.iter().any(|(id, hash)| {
                            store
                                .connection(id)
                                .ok()
                                .and_then(|c| consent::destination(&c).ok())
                                .as_ref()
                                != Some(hash)
                        }))
                {
                    status.phase = Phase::ConsentRequired;
                }
                if (mode.enabled || status.has_owned_configuration)
                    && crate::deployment::recovery_required(store.path())
                {
                    status.phase = Phase::RecoveryRequired;
                }
            }
            Err(error) => {
                status.enabled = false;
                status.phase = Phase::RecoveryRequired;
                status.diagnostic = Some(crate::redact::redact_text(&error.to_string()));
            }
        }
        Ok(status)
    }
    pub fn approval(&self, connection: &Connection, revoke: bool) -> AppResult<Option<Approval>> {
        if revoke {
            #[cfg(test)]
            if let Some(target) = self
                .snapshot()?
                .target
                .filter(|t| t.binary.as_os_str().is_empty())
            {
                target.verify()?;
                return Ok(Some(Approval {
                    target,
                    consent_revision: "0".repeat(64),
                    revoke: true,
                }));
            }
            return Ok(Some(Approval {
                target: sqlite::target::review()?,
                consent_revision: "0".repeat(64),
                revoke: true,
            }));
        }
        let mode = self.snapshot()?;
        if !mode.enabled {
            return Ok(None);
        }
        let target = mode.target.as_ref().ok_or(AppError::PlanChanged)?;
        mode.approve(connection, target)?;
        Ok(Some(Approval {
            target: target.clone(),
            consent_revision: mode.revision()?,
            revoke: false,
        }))
    }
    pub fn decorate(&self, targets: &mut [ClientTarget]) {
        let enabled = self.snapshot().is_ok_and(|v| v.enabled);
        if !enabled {
            return;
        }
        if let Some(target) = targets
            .iter_mut()
            .find(|t| t.kind == ClientKind::GithubCopilotApp && t.detected)
        {
            target.supports_write = true;
            target.status = crate::domain::ClientStatus::Available;
            target.diagnostic = None;
            target.detail="Experimental provider synchronization; the App must be closed before SQLite writes".into();
        }
    }
    pub fn authorize(
        &self,
        connection: &Connection,
        resource: &crate::transaction::Resource,
    ) -> AppResult<()> {
        let crate::transaction::Resource::AppSqlite(resource) = resource else {
            return Ok(());
        };
        if self.stopping.load(Ordering::Acquire)
            || resource.owner_id != self.owner
            || resource.connection_id != connection.id
        {
            return Err(AppError::PlanChanged);
        }
        if resource.revoke {
            return Ok(());
        }
        if self.cancelled.load(Ordering::Acquire) {
            return Err(AppError::PlanChanged);
        }
        let mode = self.snapshot()?;
        mode.approve(connection, &resource.target)?;
        if mode.revision()? != resource.consent_revision {
            return Err(AppError::PlanChanged);
        }
        Ok(())
    }
    pub fn observe(
        &self,
        state: &ManagedState,
        configurations: &mut [crate::deployment::publication::ClientConfiguration],
    ) {
        let Ok(mode) = self.snapshot() else {
            return;
        };
        if !mode.enabled {
            return;
        }
        let Some(target) = mode.target.as_ref() else {
            return;
        };
        let Some(configuration) = configurations.iter_mut().find(|c| c.target_id == TARGET_ID)
        else {
            return;
        };
        let Ok(store) = state.store() else {
            return;
        };
        let observed = (|| -> AppResult<Vec<crate::deployment::publication::ConfiguredSource>> {
            let mut sources = Vec::new();
            for proof in store
                .ownership()
                .iter()
                .filter(|p| p.target_kind == ClientKind::GithubCopilotApp)
            {
                let resource = sqlite::resource(
                    target,
                    &mode.owner_id,
                    &proof.connection_id,
                    "0".repeat(64),
                    false,
                )?;
                if proof.resource_id
                    != crate::deployment::ownership::resource_id(
                        &crate::transaction::Resource::AppSqlite(Box::new(resource.clone())),
                    )
                {
                    continue;
                }
                if let Some((name, count)) = sqlite::observed_source(&resource)? {
                    sources.push(crate::deployment::publication::ConfiguredSource::new(
                        &name,
                        Some(&proof.connection_id),
                        count,
                    )?);
                }
            }
            Ok(sources)
        })();
        if let Ok(sources) = observed {
            configuration.sources = sources;
            configuration.state = crate::deployment::publication::ConfigurationState::Available;
        }
    }
    pub fn stop_scope_for_revoke(&self, connection_id: &str, target: &Target) -> AppResult<()> {
        let mut mode = self.mode.lock().map_err(|_| AppError::Lock)?;
        let mut value = mode.snapshot()?;
        if value.target.as_ref().is_some_and(|old| old != target) {
            return Err(AppError::PlanChanged);
        }
        value.target = Some(target.clone());
        value.scopes.remove(connection_id);
        value.recovery_ids.insert(connection_id.into());
        if value.scopes.is_empty() {
            value.enabled = false;
            self.cancelled.store(true, Ordering::Release);
        }
        value.nonce = uuid::Uuid::new_v4().to_string();
        mode.save(value)
    }
    pub fn recovery_resources(&self) -> AppResult<Vec<crate::transaction::Resource>> {
        let mode = self.snapshot()?;
        let Some(target) = &mode.target else {
            return Ok(Vec::new());
        };
        mode.recovery_ids
            .iter()
            .map(|id| {
                sqlite::resource(target, &mode.owner_id, id, "0".repeat(64), false)
                    .map(|resource| crate::transaction::Resource::AppSqlite(Box::new(resource)))
            })
            .collect()
    }
    pub fn schedule(&self) {
        if self.stopping.load(Ordering::Acquire) {
            return;
        }
        if !self.halted.load(Ordering::Acquire) && self.snapshot().is_ok_and(|c| c.enabled) {
            self.set_phase(Phase::PendingSync, None);
            self.wake();
        }
    }
    pub fn wake(&self) {
        if let Ok(mut pending) = self.signal.0.lock() {
            *pending = true;
            self.signal.1.notify_one();
        }
    }
    pub fn set_phase(&self, phase: Phase, diagnostic: Option<String>) {
        if let Ok(mut status) = self.status.lock() {
            status.phase = phase;
            status.diagnostic = diagnostic.map(|s| crate::redact::redact_text(&s));
        }
    }
    pub fn halt(&self, phase: Phase, diagnostic: Option<String>) {
        self.halted.store(true, Ordering::Release);
        self.set_phase(phase, diagnostic);
    }
    pub fn active(&self) -> bool {
        self.active.load(Ordering::Acquire) != 0
    }
    pub fn activity(self: &Arc<Self>) -> Activity {
        self.active.fetch_add(1, Ordering::AcqRel);
        Activity(self.clone())
    }
    pub fn notify_result(
        &self,
        connection: &Connection,
        purpose: DeploymentPurpose,
        phase: Phase,
        count: Option<usize>,
    ) {
        let _ = purpose;
        if let Ok(mut status) = self.status.lock() {
            status.results.retain(|r| r.connection_id != connection.id);
            status.results.push(ProviderResult {
                connection_id: connection.id.clone(),
                name: connection.name.clone(),
                phase,
                model_count: count,
                observed_at: Utc::now(),
            });
            if !self.halted.load(Ordering::Acquire) {
                status.phase = phase;
            }
        }
    }
    pub fn start(self: &Arc<Self>, state: ManagedState, app: tauri::AppHandle) {
        if self.started.swap(true, Ordering::AcqRel) {
            return;
        }
        let jobs = self.clone();
        std::thread::spawn(move || worker::run(jobs, state, app));
    }
}
pub struct Activity(Arc<Jobs>);
impl Drop for Activity {
    fn drop(&mut self) {
        self.0.active.fetch_sub(1, Ordering::AcqRel);
    }
}

pub fn targets(state: &ManagedState) -> Vec<ClientTarget> {
    #[cfg(test)]
    if let Some(mut targets) = state.test_targets.clone() {
        state.app_sync.decorate(&mut targets);
        return targets;
    }
    let mut targets = crate::adapters::discover_all();
    state.app_sync.decorate(&mut targets);
    targets
}

pub fn targets_for_connection(state: &ManagedState, connection: &Connection) -> Vec<ClientTarget> {
    let mut values = targets(state);
    let approved = state.app_sync.snapshot().is_ok_and(|mode| {
        mode.target
            .as_ref()
            .is_some_and(|target| mode.approve(connection, target).is_ok())
    });
    if !approved {
        if let Some(app) = values
            .iter_mut()
            .find(|t| t.kind == ClientKind::GithubCopilotApp)
        {
            app.supports_write = false;
            app.status = if app.detected {
                crate::domain::ClientStatus::ReadOnly
            } else {
                crate::domain::ClientStatus::NotInstalled
            };
            app.detail = "Manual provider setup".into();
        }
    }
    values
}

pub fn lifecycle() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    use tauri::Manager;
    tauri::plugin::Builder::new("copilot-app-sync")
        .on_event(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if let Some(state) = app.try_state::<ManagedState>() {
                    let already = state.app_sync.stopping.swap(true, Ordering::AcqRel);
                    state.app_sync.cancelled.store(true, Ordering::Release);
                    state.app_sync.wake();
                    if !already && state.app_sync.active() {
                        api.prevent_exit();
                        let app = app.clone();
                        let jobs = state.app_sync.clone();
                        std::thread::spawn(move || {
                            let until = Instant::now() + std::time::Duration::from_secs(6);
                            while jobs.active() && Instant::now() < until {
                                std::thread::sleep(std::time::Duration::from_millis(50));
                            }
                            app.exit(0);
                        });
                    }
                }
            }
        })
        .build()
}
