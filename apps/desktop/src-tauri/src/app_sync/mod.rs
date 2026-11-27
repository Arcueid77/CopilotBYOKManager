//! Default-off, destination-scoped synchronization of saved providers into App SQLite.
mod command_error;
pub mod commands;
pub mod consent;
mod publication;
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
    pub grant_epoch: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Disabled,
    WaitingForProviders,
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
    pub review_supported: bool,
    pub compatibility_issue: Option<crate::error::AppCompatibilityIssue>,
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
            review_supported: false,
            compatibility_issue: None,
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
        let initial = mode.snapshot().ok();
        let enabled = initial.as_ref().is_some_and(|r| r.enabled);
        let active = initial.as_ref().is_some_and(|r| r.has_scope());
        Self {
            mode: Mutex::new(mode),
            plans: Mutex::new(HashMap::new()),
            status: Mutex::new(Status {
                enabled,
                phase: if active {
                    Phase::PendingSync
                } else if enabled {
                    Phase::WaitingForProviders
                } else {
                    Phase::Disabled
                },
                ..Status::default()
            }),
            attempts: Mutex::new(BTreeMap::new()),
            signal: (Mutex::new(active), Condvar::new()),
            cancelled: AtomicBool::new(!active),
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
        #[cfg(not(test))]
        let installed = sqlite::target::installation_version();
        #[cfg(test)]
        let installed = self
            .snapshot()
            .ok()
            .and_then(|m| m.target.map(|t| t.version))
            .ok_or_else(|| AppError::from(crate::error::AppCompatibilityIssue::NotInstalled));
        self.status_for_installation(state, installed)
    }
    fn status_for_installation(
        &self,
        state: &ManagedState,
        installed: AppResult<String>,
    ) -> AppResult<Status> {
        let mut status = self.status.lock().map_err(|_| AppError::Lock)?.clone();
        status.review_supported = installed.is_ok();
        status.app_version = installed.as_ref().ok().cloned();
        status.compatibility_issue = installed.err().map(|error| match error {
            AppError::AppCompatibility(issue) => issue,
            _ => crate::error::AppCompatibilityIssue::Identity,
        });
        match self.snapshot() {
            Ok(mode) => {
                status.enabled = mode.enabled;
                status.database_path = mode
                    .target
                    .as_ref()
                    .map(|t| t.database.to_string_lossy().into_owned());
                status.selected_connection_ids = mode.scopes.keys().cloned().collect();
                if !mode.enabled {
                    status.phase = Phase::Disabled;
                } else if mode.waiting_for_providers() {
                    status.phase = Phase::WaitingForProviders;
                    status.diagnostic = None;
                    status.results.clear();
                } else if !status.review_supported {
                    status.phase = Phase::UnsupportedSchema;
                } else if let Some(target) = mode.target.as_ref() {
                    if status.app_version.as_deref() != Some(&target.version) {
                        if let Err(error) = target.refreshed() {
                            status.phase = match error {
                                AppError::AppScopeChanged => Phase::ConsentRequired,
                                AppError::AppRunning | AppError::AppExitUnverified => {
                                    Phase::PendingAppExit
                                }
                                _ => Phase::UnsupportedSchema,
                            };
                            status.diagnostic =
                                Some(crate::redact::redact_text(&error.to_string()));
                        }
                    }
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
                    grant_epoch: None,
                }));
            }
            return Ok(Some(Approval {
                target: sqlite::target::review()?,
                consent_revision: "0".repeat(64),
                revoke: true,
                grant_epoch: None,
            }));
        }
        let mode = self.snapshot()?;
        if !mode.has_scope() {
            return Ok(None);
        }
        let target = mode.target.as_ref().ok_or(AppError::PlanChanged)?;
        mode.approve(connection, target)?;
        let target = target.refreshed()?;
        Ok(Some(Approval {
            target,
            consent_revision: mode.revision()?,
            revoke: false,
            grant_epoch: None,
        }))
    }
    pub fn decorate(&self, targets: &mut [ClientTarget]) {
        if !cfg!(any(test, all(windows, target_arch = "x86_64")))
            || !self.snapshot().is_ok_and(|mode| mode.enabled)
        {
            return;
        }
        if let Some(target) = targets
            .iter_mut()
            .find(|t| t.kind == ClientKind::GithubCopilotApp && t.detected)
        {
            target.supports_write = true;
            target.status = crate::domain::ClientStatus::Available;
            target.diagnostic = None;
            target.detail = "Publish provider and model settings".into();
        }
    }
    pub fn authorize(
        &self,
        connection: &Connection,
        resource: &crate::transaction::Resource,
    ) -> AppResult<()> {
        if matches!(resource, crate::transaction::Resource::AppManualProvider(_)) {
            return Err(AppError::PlanUnavailable);
        }
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
    pub(crate) fn manual_deletion_consent(&self) -> AppResult<(consent::Consent, u64)> {
        let epoch = self.settings_epoch.load(Ordering::Acquire);
        let mode = self.snapshot()?;
        if !mode.enabled
            || self.stopping.load(Ordering::Acquire)
            || self.settings_epoch.load(Ordering::Acquire) != epoch
        {
            return Err(AppError::PlanChanged);
        }
        Ok((mode, epoch))
    }
    pub fn observe(
        &self,
        state: &ManagedState,
        configurations: &mut [crate::deployment::publication::ClientConfiguration],
    ) {
        use crate::deployment::{
            ownership,
            publication::{ConfigurationIssue, ConfigurationState},
        };
        let Ok(mode) = self.snapshot() else { return };
        if !mode.enabled && mode.target.is_none() {
            return;
        }
        let Some(configuration) = configurations.iter_mut().find(|c| c.target_id == TARGET_ID)
        else {
            return;
        };
        let observed = (|| {
            let target = match mode.target {
                Some(target) => target.refreshed()?,
                None => sqlite::target::review()?,
            };
            let proofs = state.store()?.ownership().to_vec();
            let mut owned = BTreeMap::new();
            for proof in proofs
                .iter()
                .filter(|proof| proof.target_kind == ClientKind::GithubCopilotApp)
            {
                let resource = sqlite::resource(
                    &target,
                    &mode.owner_id,
                    &proof.connection_id,
                    "0".repeat(64),
                    false,
                )?;
                if proof.resource_id
                    == ownership::resource_id(&crate::transaction::Resource::AppSqlite(Box::new(
                        resource.clone(),
                    )))
                {
                    owned.insert(resource.provider_id, proof.connection_id.clone());
                }
            }
            sqlite::import::observed_catalog(&target, &owned)
        })();
        match observed {
            Ok(sources) => {
                configuration.sources = sources;
                configuration.state = ConfigurationState::Available;
            }
            Err(error) => {
                configuration.sources.clear();
                configuration.issue =
                    matches!(error, AppError::AppRunning | AppError::AppExitUnverified)
                        .then_some(ConfigurationIssue::ClientRunning);
                configuration.state = match error {
                    AppError::Unsupported(_) | AppError::AppCompatibility(_) => {
                        ConfigurationState::Unsupported
                    }
                    _ => ConfigurationState::Unavailable,
                };
            }
        }
    }
    pub fn stop_scope_for_revoke(&self, connection_id: &str, target: &Target) -> AppResult<()> {
        let mut mode = self.mode.lock().map_err(|_| AppError::Lock)?;
        let mut value = mode.snapshot()?;
        if value
            .target
            .as_ref()
            .is_some_and(|old| !old.same_store(target))
        {
            return Err(AppError::PlanChanged);
        }
        value.scopes.remove(connection_id);
        if value.scopes.is_empty() || !value.enabled {
            value.target = Some(target.clone());
        }
        value.recovery_ids.insert(connection_id.into());
        if value.scopes.is_empty() {
            value.granted_at = None;
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
        if !self.halted.load(Ordering::Acquire) && self.snapshot().is_ok_and(|c| c.has_scope()) {
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
    pub(crate) fn resume_after_publication(&self) {
        self.halted.store(false, Ordering::Release);
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

pub(crate) fn qualify_json_targets(
    state: &ManagedState,
    targets: &mut [ClientTarget],
    selected: &[String],
) {
    #[cfg(test)]
    if state.test_targets.is_some() {
        return;
    }
    let _ = state;
    crate::adapters::json_support::qualify(targets, selected);
}

pub fn publication_targets(state: &ManagedState, selected: &[String]) -> Vec<ClientTarget> {
    let mut values = targets(state);
    qualify_json_targets(state, &mut values, selected);
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
