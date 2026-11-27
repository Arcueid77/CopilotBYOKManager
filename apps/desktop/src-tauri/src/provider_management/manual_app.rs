use super::{job, Failure};
use crate::{
    adapters::github_app::sqlite::{manual, target},
    commands::ManagedState,
    deployment,
    error::{AppError, AppResult},
    transaction::{Resource, Transaction},
};
use std::time::{Duration, Instant};
use tauri::State;

pub(super) struct Plan {
    pub(super) id: String,
    expires: Instant,
    state_revision: String,
    consent_revision: String,
    epoch: u64,
    resource: manual::ManualProvider,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeletePreview {
    plan_id: String,
    origin: Option<String>,
}

#[tauri::command(rename_all = "camelCase")]
pub(crate) async fn preview_app_provider_delete(
    state: State<'_, ManagedState>,
    selection: String,
) -> Result<DeletePreview, Failure> {
    job(state.inner().clone(), move |state| {
        preview(state, &selection, target::review)
    })
    .await
}

fn preview(
    state: &ManagedState,
    selection: &str,
    review_target: impl FnOnce() -> AppResult<target::Target>,
) -> AppResult<DeletePreview> {
    let (consent, epoch) = state.app_sync.manual_deletion_consent()?;
    let state_revision = {
        let store = state.store()?;
        store.ensure_writable()?;
        deployment::ensure_no_pending_journal(store.path())?;
        if store.installation_owner_id() != consent.owner_id {
            return Err(AppError::PlanChanged);
        }
        store.revision()?
    };
    let target = match &consent.target {
        Some(saved) => saved.refreshed()?,
        None => review_target()?,
    };
    let (resource, origin) = manual::review(&target, selection)?;
    let id = uuid::Uuid::new_v4().to_string();
    let plan = Plan {
        id: id.clone(),
        expires: Instant::now() + Duration::from_secs(300),
        state_revision,
        consent_revision: consent.revision()?,
        epoch,
        resource,
    };
    plan.authorize(state)?;
    state
        .existing_provider_plans
        .lock()
        .map_err(|_| AppError::Lock)?
        .manual_app = Some(plan);
    Ok(DeletePreview {
        plan_id: id,
        origin,
    })
}

impl Plan {
    fn authorize(&self, state: &ManagedState) -> AppResult<()> {
        let (consent, epoch) = state.app_sync.manual_deletion_consent()?;
        if epoch != self.epoch || consent.revision()? != self.consent_revision {
            return Err(AppError::PlanChanged);
        }
        Ok(())
    }
}

#[tauri::command(rename_all = "camelCase")]
pub(crate) async fn apply_app_provider_delete(
    state: State<'_, ManagedState>,
    plan_id: String,
    confirmed: bool,
) -> Result<(), Failure> {
    job(state.inner().clone(), move |state| {
        apply(state, &plan_id, confirmed)
    })
    .await
}

fn apply(state: &ManagedState, id: &str, confirmed: bool) -> AppResult<()> {
    let plan = {
        let mut plans = state
            .existing_provider_plans
            .lock()
            .map_err(|_| AppError::Lock)?;
        if plans.manual_app.as_ref().is_none_or(|plan| plan.id != id) {
            return Err(AppError::PlanUnavailable);
        }
        plans.manual_app.take().ok_or(AppError::PlanUnavailable)?
    };
    if !confirmed || plan.expires <= Instant::now() {
        return Err(AppError::PlanUnavailable);
    }
    let _activity = state.app_sync.activity();
    let _write = state.writes.try_lock().map_err(|_| AppError::Busy)?;
    let store = state.store()?;
    store.ensure_writable()?;
    let _lease = crate::write_lock::WriteLock::acquire(store.path())?;
    deployment::ensure_no_pending_journal(store.path())?;
    if store.revision()? != plan.state_revision {
        return Err(AppError::PlanChanged);
    }
    let path = deployment::journal_path(store.path());
    plan.authorize(state)?;
    let write = plan.resource.deletion()?;
    let mut tx = Transaction::begin(path, &plan.id, vec![write])?;
    let result = tx.permit_manual_undo().and_then(|()| {
        tx.apply_checked(true, &|resource| {
            if !matches!(resource, Resource::AppManualProvider(row) if row.as_ref() == &plan.resource) {
                return Err(AppError::PlanChanged);
            }
            plan.authorize(state)
        })
    });
    if let Err(error) = result {
        tx.rollback()?;
        tx.clear()?;
        return Err(error);
    }
    tx.complete()
}

#[cfg(test)]
mod tests;
