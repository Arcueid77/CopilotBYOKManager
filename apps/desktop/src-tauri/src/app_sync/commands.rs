use super::command_error::CommandFailure;
use super::*;
use crate::{
    deployment::PlanContext,
    domain::{ApplyResult, DeploymentPlan, DeploymentPurpose},
};
use serde::Serialize;
use std::{collections::BTreeSet, time::Duration};
use tauri::State;

async fn native<T: Send + 'static>(
    task: impl FnOnce() -> AppResult<T> + Send + 'static,
) -> Result<T, CommandFailure> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|_| CommandFailure::worker_failure())?
        .map_err(CommandFailure::from)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSummary {
    id: String,
    name: String,
    endpoint: String,
    protocol: String,
    model_count: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnablePreview {
    pub(super) id: String,
    database_path: String,
    app_version: String,
    risk_version: u32,
    providers: Vec<ProviderSummary>,
    expires_at: DateTime<Utc>,
}

#[tauri::command]
pub async fn get_app_sync_status(state: State<'_, ManagedState>) -> Result<Status, CommandFailure> {
    let state = state.inner().clone();
    native(move || state.app_sync.status(&state)).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn check_app_sync_compatibility() -> Result<(), CommandFailure> {
    native(|| sqlite::target::review().map(|_| ())).await
}

#[tauri::command]
pub async fn enable_app_sync_waiting(
    state: State<'_, ManagedState>,
) -> Result<Status, CommandFailure> {
    let state = state.inner().clone();
    let epoch = state.app_sync.settings_epoch.load(Ordering::Acquire);
    native(move || enable_waiting(&state, epoch, sqlite::target::installation_version)).await
}

/// Record the switch without granting App database access. Common publication
/// reviews and confirms individual providers.
pub(super) fn enable_waiting(
    state: &ManagedState,
    epoch: u64,
    inspect_build: impl FnOnce() -> AppResult<String>,
) -> AppResult<Status> {
    let version = inspect_build()?;
    let _write = state.writes.try_lock().map_err(|_| AppError::Busy)?;
    let mut store = state.store()?;
    store.ensure_writable()?;
    let _lease = crate::write_lock::WriteLock::acquire(store.path())?;
    crate::deployment::ensure_no_pending_journal(store.path())?;
    let mut settings = state.app_sync.mode.lock().map_err(|_| AppError::Lock)?;
    let mut mode = settings.snapshot()?;
    if state.app_sync.settings_epoch.load(Ordering::Acquire) != epoch
        || mode.owner_id != store.installation_owner_id()
        || mode.has_scope()
    {
        return Err(AppError::PlanChanged);
    }
    if !mode.waiting_for_providers() {
        store.persist_owner_if_new()?;
        mode.enabled = true;
        mode.scopes.clear();
        mode.granted_at = None;
        mode.nonce = uuid::Uuid::new_v4().to_string();
        settings.save(mode)?;
    }
    drop(settings);
    drop(store);
    state.app_sync.status_for_installation(state, Ok(version))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn preview_app_sync_enable(
    state: State<'_, ManagedState>,
    connection_ids: Vec<String>,
) -> Result<EnablePreview, CommandFailure> {
    let state = state.inner().clone();
    native(move || preview_enable(&state, connection_ids, sqlite::target::review)).await
}

pub(super) fn preview_enable(
    state: &ManagedState,
    connection_ids: Vec<String>,
    review: impl FnOnce() -> AppResult<Target>,
) -> AppResult<EnablePreview> {
    let epoch = state.app_sync.settings_epoch.load(Ordering::Acquire);
    if connection_ids.is_empty()
        || connection_ids.len() > consent::MAX_SELECTED
        || connection_ids.iter().collect::<BTreeSet<_>>().len() != connection_ids.len()
    {
        return Err(AppError::InvalidInput(
            "Select distinct saved providers within the configuration limit".into(),
        ));
    }
    let mode = state.app_sync.snapshot()?;
    if mode.has_scope() {
        return Err(AppError::InvalidInput(
            "Turn App sync off before reviewing a different scope".into(),
        ));
    }
    let (owner, state_revision, connections) = {
        let store = state.store()?;
        store.ensure_writable()?;
        crate::deployment::ensure_no_pending_journal(store.path())?;
        let values = connection_ids
            .iter()
            .map(|id| {
                let c = store.connection(id)?;
                if !c.enabled {
                    return Err(AppError::InvalidInput(
                        "Allow publishing for every selected provider first".into(),
                    ));
                }
                sqlite::validate_input(&c)?;
                Ok(c)
            })
            .collect::<AppResult<Vec<_>>>()?;
        (
            store.installation_owner_id().to_string(),
            store.revision()?,
            values,
        )
    };
    let target = review()?;
    let mut value = consent::Consent::disabled(&owner);
    value.enabled = true;
    value.target = Some(target.clone());
    value.granted_at = Some(Utc::now());
    value.nonce = uuid::Uuid::new_v4().to_string();
    if mode
        .target
        .as_ref()
        .is_some_and(|old| old.same_store(&target))
    {
        value.recovery_ids = mode.recovery_ids.clone();
    }
    for connection in &connections {
        value
            .scopes
            .insert(connection.id.clone(), consent::destination(connection)?);
        value.recovery_ids.insert(connection.id.clone());
    }
    value.validate(&owner)?;
    let providers = connections
        .iter()
        .map(|c| ProviderSummary {
            id: c.id.clone(),
            name: c.name.clone(),
            endpoint: c.base_url.clone(),
            protocol: c.protocol.as_str().into(),
            model_count: c.models.iter().filter(|m| m.enabled).count(),
        })
        .collect();
    let id = uuid::Uuid::new_v4().to_string();
    let now = Instant::now();
    let mut plans = state.app_sync.plans.lock().map_err(|_| AppError::Lock)?;
    plans.retain(|_, p| p.expires > now);
    if plans.len() >= 16 {
        return Err(AppError::PlanUnavailable);
    }
    plans.insert(
        id.clone(),
        EnablePlan {
            consent: value,
            state_revision,
            mode_revision: mode.revision()?,
            epoch,
            expires: now + Duration::from_secs(900),
        },
    );
    Ok(EnablePreview {
        id,
        database_path: target.database.to_string_lossy().into_owned(),
        app_version: target.version,
        risk_version: consent::RISK_VERSION,
        providers,
        expires_at: Utc::now() + chrono::Duration::minutes(15),
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn enable_app_sync(
    state: State<'_, ManagedState>,
    plan_id: String,
    confirmed: bool,
) -> Result<Status, CommandFailure> {
    let state = state.inner().clone();
    native(move || enable(&state, plan_id, confirmed, sqlite::target::review)).await
}

pub(super) fn enable(
    state: &ManagedState,
    plan_id: String,
    confirmed: bool,
    review: impl FnOnce() -> AppResult<Target>,
) -> AppResult<Status> {
    let mut plan = state
        .app_sync
        .plans
        .lock()
        .map_err(|_| AppError::Lock)?
        .remove(&plan_id)
        .ok_or(AppError::PlanUnavailable)?;
    if !confirmed || plan.expires <= Instant::now() {
        return Err(AppError::PlanUnavailable);
    }
    let _write = state.writes.try_lock().map_err(|_| AppError::Busy)?;
    let store = state.store()?;
    store.ensure_writable()?;
    crate::deployment::ensure_no_pending_journal(store.path())?;
    let _lease = crate::write_lock::WriteLock::acquire(store.path())?;
    if store.revision()? != plan.state_revision
        || store.installation_owner_id() != plan.consent.owner_id
    {
        return Err(AppError::PlanChanged);
    }
    drop(store);
    let target = review()?;
    if plan.consent.target.as_ref() != Some(&target) {
        return Err(AppError::PlanChanged);
    }
    let mut mode = state.app_sync.mode.lock().map_err(|_| AppError::Lock)?;
    let current = mode.snapshot()?;
    if current.has_scope()
        || current.revision()? != plan.mode_revision
        || state.app_sync.settings_epoch.load(Ordering::Acquire) != plan.epoch
    {
        return Err(AppError::PlanChanged);
    }
    // Clear cancellation before persistence; a concurrent disable always sets it afterward.
    state.app_sync.cancelled.store(false, Ordering::Release);
    if state.app_sync.settings_epoch.load(Ordering::Acquire) != plan.epoch {
        state.app_sync.cancelled.store(true, Ordering::Release);
        return Err(AppError::PlanChanged);
    }
    plan.consent.granted_at = Some(Utc::now());
    plan.consent.nonce = uuid::Uuid::new_v4().to_string();
    if let Err(error) = mode.save(plan.consent) {
        state.app_sync.cancelled.store(true, Ordering::Release);
        return Err(error);
    }
    drop(mode);
    state.app_sync.halted.store(false, Ordering::Release);
    state
        .app_sync
        .attempts
        .lock()
        .map_err(|_| AppError::Lock)?
        .clear();
    state.app_sync.set_phase(Phase::PendingSync, None);
    state.app_sync.wake();
    state.app_sync.status(state)
}

#[tauri::command]
pub async fn disable_app_sync(state: State<'_, ManagedState>) -> Result<Status, CommandFailure> {
    let state = state.inner().clone();
    state.app_sync.settings_epoch.fetch_add(1, Ordering::AcqRel);
    state.app_sync.cancelled.store(true, Ordering::Release);
    native(move || {
        state
            .app_sync
            .mode
            .lock()
            .map_err(|_| AppError::Lock)?
            .disable()?;
        state.app_sync.set_phase(Phase::Disabled, None);
        state.app_sync.wake();
        state.app_sync.status(&state)
    })
    .await
}

#[tauri::command]
pub async fn retry_app_sync(state: State<'_, ManagedState>) -> Result<Status, CommandFailure> {
    let state = state.inner().clone();
    native(move || {
        let epoch = state.app_sync.settings_epoch.load(Ordering::Acquire);
        let mode = state.app_sync.snapshot()?;
        if !mode.has_scope() {
            return Err(AppError::Unsupported(
                "Enable the reviewed App synchronization scope first".into(),
            ));
        }
        let target = mode
            .target
            .as_ref()
            .ok_or(AppError::PlanChanged)?
            .refreshed()?;
        let store = state.store()?;
        store.ensure_writable()?;
        crate::deployment::ensure_no_pending_journal(store.path())?;
        for id in mode.scopes.keys() {
            let connection = store.connection(id)?;
            mode.approve(&connection, &target)?;
            sqlite::check_owned(
                &target,
                store.installation_owner_id(),
                id,
                store.ownership(),
            )?;
        }
        drop(store);
        let guard = state.app_sync.mode.lock().map_err(|_| AppError::Lock)?;
        if guard.snapshot()?.revision()? != mode.revision()?
            || epoch != state.app_sync.settings_epoch.load(Ordering::Acquire)
        {
            return Err(AppError::PlanChanged);
        }
        state.app_sync.cancelled.store(false, Ordering::Release);
        if epoch != state.app_sync.settings_epoch.load(Ordering::Acquire) {
            state.app_sync.cancelled.store(true, Ordering::Release);
            return Err(AppError::PlanChanged);
        }
        drop(guard);
        state.app_sync.halted.store(false, Ordering::Release);
        state
            .app_sync
            .attempts
            .lock()
            .map_err(|_| AppError::Lock)?
            .clear();
        state.app_sync.set_phase(Phase::PendingSync, None);
        state.app_sync.wake();
        state.app_sync.status(&state)
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn preview_app_sync_revoke(
    state: State<'_, ManagedState>,
    connection_id: String,
) -> Result<DeploymentPlan, CommandFailure> {
    let state = state.inner().clone();
    native(move || {
        let store = state.store()?;
        store.ensure_writable()?;
        crate::deployment::ensure_no_pending_journal(store.path())?;
        let connection = store.connection(&connection_id)?;
        let approval = state
            .app_sync
            .approval(&connection, true)?
            .ok_or(AppError::PlanUnavailable)?;
        let targets = super::targets(&state);
        let mut plan =
            crate::adapters::preview_revoke_resolved(&connection, &[TARGET_ID.into()], &targets)?;
        plan.purpose = DeploymentPurpose::RevokeApp;
        let context = PlanContext::new(store.installation_owner_id(), store.revision()?, None)
            .with_ownership(store.ownership())
            .with_app(Some(approval));
        drop(store);
        state
            .plans()?
            .insert(&connection, None, plan, &targets, context)
    })
    .await
}

pub(crate) fn synchronize(state: &ManagedState, connection_id: &str) -> AppResult<ApplyResult> {
    let connection = state.store()?.connection(connection_id)?;
    let approval = state
        .app_sync
        .approval(&connection, false)?
        .ok_or(AppError::PlanUnavailable)?;
    let (secret, context) = {
        let store = state.store()?;
        store.ensure_writable()?;
        crate::deployment::ensure_no_pending_journal(store.path())?;
        if store.connection(connection_id)? != connection {
            return Err(AppError::PlanChanged);
        }
        let secret = store.secret_for(&connection)?;
        let context = PlanContext::new(
            store.installation_owner_id(),
            store.revision()?,
            secret.as_deref(),
        )
        .with_ownership(store.ownership())
        .with_app(Some(approval));
        (secret, context)
    };
    let targets = super::targets(state);
    let plan = crate::adapters::preview_resolved(&connection, &[TARGET_ID.into()], &targets)?;
    let plan = state
        .plans()?
        .insert(&connection, secret.as_deref(), plan, &targets, context)?;
    let stored = state.plans()?.consume(&plan.id)?;
    if !stored.plan.app_model_removals.is_empty() {
        state.app_sync.halt(
            Phase::ReviewRequired,
            Some("Review model removals in the publication preview".into()),
        );
        return Err(AppError::Unsupported("Model removals need a reviewed publication after switching active/default models in Copilot App".into()));
    }
    crate::commands::execute_stored_plan(state, stored, Default::default())
}

pub(crate) fn approval_for_plan(
    state: &ManagedState,
    connection: &Connection,
    plan: &DeploymentPlan,
    review_new_scope: bool,
) -> AppResult<Option<Approval>> {
    if !plan
        .operations
        .iter()
        .any(|o| o.target_kind == ClientKind::GithubCopilotApp && o.supported)
    {
        return Ok(None);
    }
    if !plan.purpose.is_revocation() && review_new_scope {
        return state.app_sync.publication_approval(connection).map(Some);
    }
    state
        .app_sync
        .approval(connection, plan.purpose.is_revocation())
}

pub(crate) fn review_publication_approval(
    state: &ManagedState,
    connection: &Connection,
    plan: &mut DeploymentPlan,
) -> AppResult<Option<Approval>> {
    use crate::domain::DeploymentBlocker;
    match approval_for_plan(state, connection, plan, true) {
        Ok(approval) => Ok(approval),
        Err(error) => {
            let blocker = match error {
                AppError::AppRunning | AppError::AppExitUnverified => {
                    DeploymentBlocker::ClientRunning
                }
                AppError::UnsafeAppPermissions => DeploymentBlocker::UnsafeClientPermissions,
                AppError::AppCompatibility(_) => DeploymentBlocker::UnsupportedClientFormat,
                _ => return Err(error),
            };
            for operation in plan
                .operations
                .iter_mut()
                .filter(|operation| operation.target_kind == ClientKind::GithubCopilotApp)
            {
                operation.supported = false;
                operation.blocker = Some(blocker);
                operation.requires_restart = false;
                operation.description = crate::redact::redact_text(&error.to_string());
                operation.changes.clear();
            }
            Ok(None)
        }
    }
}
