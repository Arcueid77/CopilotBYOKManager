use super::*;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::Emitter;

pub(super) fn run(jobs: Arc<Jobs>, state: ManagedState, app: tauri::AppHandle) {
    while !jobs.stopping.load(Ordering::Acquire) {
        let Ok(pending) = jobs.signal.0.lock() else {
            break;
        };
        let Ok((mut pending, _)) =
            jobs.signal
                .1
                .wait_timeout_while(pending, Duration::from_secs(2), |flag| {
                    !*flag && !jobs.stopping.load(Ordering::Acquire)
                })
        else {
            break;
        };
        let retry_exit = jobs
            .status
            .lock()
            .is_ok_and(|s| s.phase == Phase::PendingAppExit);
        if !*pending && !retry_exit {
            continue;
        }
        *pending = false;
        drop(pending);
        if jobs.stopping.load(Ordering::Acquire) {
            break;
        }
        std::thread::sleep(Duration::from_millis(150));
        if let Ok(mut flag) = jobs.signal.0.lock() {
            *flag = false;
        }
        let _active = jobs.activity();
        if let Err(error) = run_once(&jobs, &state) {
            jobs.halt(Phase::Failed, Some(error.to_string()));
        }
        if let Ok(status) = jobs.status(&state) {
            let _ = app.emit("copilot-byok-manager:app-sync-status", status);
        }
    }
}

pub(super) fn run_once(jobs: &Jobs, state: &ManagedState) -> AppResult<()> {
    let mode = jobs.snapshot()?;
    if !mode.enabled || jobs.cancelled.load(Ordering::Acquire) {
        jobs.set_phase(Phase::Disabled, None);
        return Ok(());
    }
    if jobs.halted.load(Ordering::Acquire) {
        return Ok(());
    }
    let (connections, owner) = {
        let store = state.store()?;
        store.ensure_writable()?;
        crate::deployment::ensure_no_pending_journal(store.path())?;
        (
            store.connections().to_vec(),
            store.installation_owner_id().to_string(),
        )
    };
    if mode.owner_id != owner {
        return Err(AppError::PlanChanged);
    }
    let target = mode.target.as_ref().ok_or(AppError::PlanChanged)?;
    if let Err(error) = sqlite::target::ensure_closed(&target.binary) {
        jobs.set_phase(
            if matches!(error, AppError::AppRunning | AppError::AppExitUnverified) {
                Phase::PendingAppExit
            } else {
                Phase::UnsupportedSchema
            },
            Some(error.to_string()),
        );
        return Ok(());
    }
    for id in mode.scopes.keys() {
        let Some(connection) = connections.iter().find(|c| &c.id == id) else {
            jobs.set_phase(
                Phase::ConsentRequired,
                Some("A selected provider was removed; review the synchronization scope".into()),
            );
            return Ok(());
        };
        if mode.approve(connection, target).is_err() {
            jobs.set_phase(Phase::ConsentRequired,Some("Provider destination or configuration scope changed; disable sync and review enablement again".into()));
            return Ok(());
        }
    }
    if !connections
        .iter()
        .any(|c| mode.scopes.contains_key(&c.id) && c.enabled)
    {
        jobs.set_phase(Phase::Paused, None);
        return Ok(());
    }
    jobs.set_phase(Phase::Synchronizing, None);
    for id in mode.scopes.keys() {
        if jobs.cancelled.load(Ordering::Acquire) || jobs.stopping.load(Ordering::Acquire) {
            break;
        }
        let connection = connections
            .iter()
            .find(|c| &c.id == id)
            .ok_or(AppError::PlanChanged)?;
        if !connection.enabled {
            continue;
        }
        let revision = crate::fingerprint::json("app-saved-connection-v1", connection)?;
        if jobs.attempts.lock().map_err(|_| AppError::Lock)?.get(id) == Some(&revision) {
            continue;
        }
        match super::commands::synchronize(state, id) {
            Ok(result)
                if result
                    .records
                    .iter()
                    .all(|r| r.status == crate::domain::DeploymentStatus::Applied) =>
            {
                jobs.attempts
                    .lock()
                    .map_err(|_| AppError::Lock)?
                    .insert(id.clone(), revision);
            }
            Ok(_) => {
                jobs.halt(Phase::Failed,Some("Copilot App synchronization did not complete; review its recorded result before retrying".into()));
                return Ok(());
            }
            Err(error) => {
                if jobs.status.lock().map_err(|_| AppError::Lock)?.phase == Phase::ReviewRequired {
                    return Ok(());
                }
                if !matches!(error, AppError::AppRunning | AppError::AppExitUnverified) {
                    jobs.halted.store(true, Ordering::Release);
                }
                jobs.set_phase(
                    if matches!(error, AppError::AppRunning | AppError::AppExitUnverified) {
                        Phase::PendingAppExit
                    } else if matches!(error, AppError::Unsupported(_)) {
                        Phase::UnsupportedSchema
                    } else {
                        Phase::Conflict
                    },
                    Some(error.to_string()),
                );
                return Ok(());
            }
        }
    }
    if !jobs.cancelled.load(Ordering::Acquire) {
        jobs.set_phase(Phase::SyncedConfiguration, None);
    }
    Ok(())
}
