use crate::account::{
    self, AccountStatusSnapshot, LoginApplyResult, LoginPlan, LoginPlanStore, LoginStore,
    LoginSurface,
};
use crate::adapters;
use crate::deployment::{self, PlanContext, PlanStore, StoredPlan};
use crate::domain::{
    ApplyResult, Connection, ConnectionInput, DashboardSnapshot, DeploymentOperation,
    DeploymentPlan, DeploymentPurpose, DeploymentRecord, DeploymentStatus, UsageDbStatus,
    STATE_VERSION,
};
use crate::error::{AppError, AppResult};
use crate::github_auth::{
    self, GithubAuthorizationStatus, GithubAuthorizationStore, GithubValidationOutcome,
};
use crate::installer::{
    self, InstallApplyResult, InstallComponentObservation, InstallPlan, InstallPlanStore,
};
use crate::redact;
use crate::state::{DeleteConnectionResult, StateStore};
use crate::usage_db::UsageDb;
use chrono::Utc;
use std::sync::{Arc, Mutex, MutexGuard};
use tauri::Emitter;
use tauri::State;
use uuid::Uuid;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryPlan {
    id: String,
    action: RecoveryAction,
    view: crate::transaction::RecoveryView,
    expires_at: chrono::DateTime<Utc>,
}

#[derive(Clone, Copy, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecoveryAction {
    #[default]
    Restore,
    KeepCurrent,
}

#[derive(Clone)]
pub struct ManagedState {
    #[cfg(test)]
    pub(crate) test_targets: Option<Vec<crate::domain::ClientTarget>>,
    pub(crate) writes: Arc<Mutex<()>>,
    pub(crate) resource_plans: Arc<Mutex<crate::resources::ResourcePlans>>,
    recovery_plan: Arc<Mutex<Option<RecoveryPlan>>>,
    installs: Arc<Mutex<()>>,
    install_jobs: Arc<installer::history::InstallJobs>,
    logins: Arc<Mutex<()>>,
    store: Arc<Mutex<StateStore>>,
    plans: Arc<Mutex<PlanStore>>,
    install_plans: Arc<Mutex<InstallPlanStore>>,
    login_plans: Arc<Mutex<LoginPlanStore>>,
    login_store: Arc<Mutex<LoginStore>>,
    github_authorization: Arc<Mutex<GithubAuthorizationStore>>,
    pub(crate) usage_db: Arc<Mutex<Option<UsageDb>>>,
    pub(crate) usage_jobs: Arc<crate::usage::commands::UsageJobs>,
    pub(crate) app_sync: Arc<crate::app_sync::Jobs>,
    usage_db_error: Option<String>,
}

impl ManagedState {
    pub fn new(
        store: StateStore,
        login_store: LoginStore,
        github_authorization: GithubAuthorizationStore,
        usage_db: Option<UsageDb>,
        usage_db_error: Option<String>,
    ) -> Self {
        let install_jobs = Arc::new(installer::history::InstallJobs::open(
            store.path().with_file_name("install-history.json"),
        ));
        let app_sync = Arc::new(crate::app_sync::Jobs::new(
            store.path(),
            store.installation_owner_id(),
        ));
        Self {
            #[cfg(test)]
            test_targets: None,
            writes: Arc::new(Mutex::new(())),
            resource_plans: Arc::new(Mutex::new(crate::resources::ResourcePlans::default())),
            recovery_plan: Arc::new(Mutex::new(None)),
            installs: Arc::new(Mutex::new(())),
            install_jobs,
            app_sync,
            logins: Arc::new(Mutex::new(())),
            store: Arc::new(Mutex::new(store)),
            plans: Arc::new(Mutex::new(PlanStore::default())),
            install_plans: Arc::new(Mutex::new(InstallPlanStore::default())),
            login_plans: Arc::new(Mutex::new(LoginPlanStore::default())),
            login_store: Arc::new(Mutex::new(login_store)),
            github_authorization: Arc::new(Mutex::new(github_authorization)),
            usage_db: Arc::new(Mutex::new(usage_db)),
            usage_jobs: Arc::new(crate::usage::commands::UsageJobs::default()),
            usage_db_error,
        }
    }

    pub(crate) fn store(&self) -> AppResult<MutexGuard<'_, StateStore>> {
        self.store.lock().map_err(|_| AppError::Lock)
    }

    pub(crate) fn plans(&self) -> AppResult<MutexGuard<'_, PlanStore>> {
        self.plans.lock().map_err(|_| AppError::Lock)
    }

    fn install_plans(&self) -> AppResult<MutexGuard<'_, InstallPlanStore>> {
        self.install_plans.lock().map_err(|_| AppError::Lock)
    }

    fn login_plans(&self) -> AppResult<MutexGuard<'_, LoginPlanStore>> {
        self.login_plans.lock().map_err(|_| AppError::Lock)
    }

    fn login_store(&self) -> AppResult<MutexGuard<'_, LoginStore>> {
        self.login_store.lock().map_err(|_| AppError::Lock)
    }

    pub(crate) fn github_authorization(
        &self,
    ) -> AppResult<MutexGuard<'_, GithubAuthorizationStore>> {
        self.github_authorization.lock().map_err(|_| AppError::Lock)
    }

    pub(crate) fn usage_db_status(&self) -> AppResult<UsageDbStatus> {
        let guard = self.usage_db.lock().map_err(|_| AppError::Lock)?;
        Ok(match guard.as_ref() {
            Some(db) => db.status(),
            None => UsageDbStatus::unavailable(
                self.usage_db_error
                    .clone()
                    .unwrap_or_else(|| "Usage database is not available".to_string()),
            ),
        })
    }
}

fn command_error(error: AppError) -> String {
    redact::redact_text(&error.to_string())
}

#[tauri::command]
pub async fn get_dashboard(state: State<'_, ManagedState>) -> Result<DashboardSnapshot, String> {
    let state = state.inner().clone();
    native_job(move || {
        let (state_path, mut connections, deployments, state_recovery, owner_id) = {
            let store = state.store().map_err(command_error)?;
            (
                store.path().to_string_lossy().to_string(),
                store.connections().to_vec(),
                store.deployments().to_vec(),
                store.recovery().map(str::to_string),
                store.installation_owner_id().to_string(),
            )
        };
        let credential_statuses = connections
            .iter()
            .map(|connection| {
                (
                    connection.id.clone(),
                    if state_recovery.is_some() {
                        crate::domain::CredentialObservation {
                            state: crate::domain::CredentialState::Unavailable,
                        }
                    } else {
                        crate::secrets::observe(&connection.id)
                    },
                )
            })
            .collect::<std::collections::BTreeMap<_, _>>();
        for connection in &mut connections {
            match credential_statuses[&connection.id].state {
                crate::domain::CredentialState::Stored => connection.has_secret = true,
                crate::domain::CredentialState::Missing => connection.has_secret = false,
                crate::domain::CredentialState::Unavailable => {}
            }
        }
        let deployment_recovery = deployment::recovery_required(std::path::Path::new(&state_path))
            .then(|| {
                "An interrupted deployment requires recovery review; managed writes are disabled"
                    .to_string()
            });
        let clients = crate::app_sync::targets(&state);
        let mut client_configurations =
            deployment::publication::observe(&clients, &connections, &owner_id);
        state.app_sync.observe(&state, &mut client_configurations);
        Ok(DashboardSnapshot {
            client_configurations,
            credential_statuses,
            deployment_recovery,
            version: STATE_VERSION,
            state_path,
            connections,
            clients,
            deployments,
            state_recovery: state_recovery.map(|reason| redact::redact_text(&reason)),
            usage_db: state.usage_db_status().map_err(command_error)?,
        })
    })
    .await
}

#[tauri::command]
pub async fn get_installation_status() -> Result<Vec<InstallComponentObservation>, String> {
    native_job(|| Ok(installer::discover_components())).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn preview_install(
    state: State<'_, ManagedState>,
    component_ids: Vec<String>,
) -> Result<InstallPlan, String> {
    let state = state.inner().clone();
    native_job(move || {
        state
            .install_plans()
            .and_then(|mut plans| plans.preview(component_ids))
            .map_err(command_error)
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn apply_install_plan(
    state: State<'_, ManagedState>,
    app: tauri::AppHandle,
    plan_id: String,
) -> Result<InstallApplyResult, String> {
    let state = state.inner().clone();
    native_job(move || {
        let _run = state
            .installs
            .try_lock()
            .map_err(|_| "Another installation is active".to_string())?;
        let _write = state.writes.try_lock().map_err(|_| "Another managed write is active".to_string())?;
        let _lease = {
            let store = state.store().map_err(command_error)?;
            store.ensure_writable().map_err(command_error)?;
            deployment::ensure_no_pending_journal(store.path()).map_err(command_error)?;
            crate::write_lock::WriteLock::acquire(store.path()).map_err(command_error)?
        };
        let plan = state
            .install_plans()
            .and_then(|mut plans| plans.consume(&plan_id))
            .map_err(command_error)?;
        let (ticket, started) = state.install_jobs.begin(&plan).map_err(command_error)?;
        let _ = app.emit("copilot-byok-manager:install-progress", &started);
        let result = installer::execute_plan(plan, ticket.cancel.clone(), &mut |component, result| {
            let progress = state.install_jobs.progress(&ticket.id, component, result)?;
            let _ = app.emit("copilot-byok-manager:install-progress", &progress);
            Ok(())
        }, &mut |component, update| {
            if let Ok(progress) = state.install_jobs.telemetry(&ticket.id, component, update) {
                let _ = app.emit("copilot-byok-manager:install-progress", &progress);
            }
        });
        let finished = state.install_jobs.finish(&ticket.id, &result, ticket.cancel.load(std::sync::atomic::Ordering::Acquire))
            .map_err(|_| "Installation may have changed components, but the final summary could not be saved. Rediscover and inspect interrupted history before retrying".to_string())?;
        let _ = app.emit("copilot-byok-manager:install-progress", &finished);
        result.map_err(command_error)
    })
    .await
}

#[tauri::command]
pub async fn get_install_runs(
    state: State<'_, ManagedState>,
) -> Result<Vec<installer::history::InstallRun>, String> {
    state.install_jobs.runs().map_err(command_error)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn cancel_install_run(
    state: State<'_, ManagedState>,
    run_id: String,
) -> Result<bool, String> {
    state.install_jobs.cancel(&run_id).map_err(command_error)
}

#[tauri::command]
pub async fn get_account_status(
    state: State<'_, ManagedState>,
) -> Result<AccountStatusSnapshot, String> {
    let state = state.inner().clone();
    native_job(move || {
        let (runs, recovery) = {
            let store = state.login_store().map_err(command_error)?;
            (store.runs(), store.recovery())
        };
        Ok(account::discover_status(runs, recovery))
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn preview_login(
    state: State<'_, ManagedState>,
    surfaces: Vec<LoginSurface>,
) -> Result<LoginPlan, String> {
    let state = state.inner().clone();
    native_job(move || {
        state
            .login_plans()
            .and_then(|mut plans| plans.preview(surfaces))
            .map_err(command_error)
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn apply_login_plan(
    state: State<'_, ManagedState>,
    plan_id: String,
) -> Result<LoginApplyResult, String> {
    let state = state.inner().clone();
    native_job(move || {
    let _run = state.logins.try_lock().map_err(|_| "Another sign-in launch is active".to_string())?;
    let stored = {
        let mut plans = state.login_plans().map_err(command_error)?;
        plans.consume(&plan_id).map_err(command_error)?
    };
    let run = {
        let mut history = state.login_store().map_err(command_error)?;
        history.begin_run(&stored.plan).map_err(command_error)?
    };
    let finished = account::execute_plan(&stored, run);
    {
        let mut history = state.login_store().map_err(command_error)?;
        if let Err(error) = history.finish_run(finished.clone()) {
            return Err(command_error(AppError::Config(format!(
                "Official sign-in clients may have been launched, but the final local run summary could not be persisted; the prepared history entry remains interrupted: {error}"
            ))));
        }
    }
    let (runs, recovery) = {
        let history = state.login_store().map_err(command_error)?;
        (history.runs(), history.recovery())
    };
    Ok(LoginApplyResult {
        run: finished,
        account_status: account::discover_status(runs, recovery),
    })

    }).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn verify_login_run(
    state: State<'_, ManagedState>,
    run_id: String,
) -> Result<LoginApplyResult, String> {
    let state = state.inner().clone();
    native_job(move || {
        let _run = state
            .logins
            .try_lock()
            .map_err(|_| "Another sign-in launch or verification is active".to_string())?;
        let run = state
            .login_store()
            .map_err(command_error)?
            .run(&run_id)
            .map_err(command_error)?;
        let observation = if account::lifecycle::needs_cli_probe(&run) {
            Some(crate::usage::runtime::identity(
                &std::sync::atomic::AtomicBool::new(false),
            ))
        } else {
            None
        };
        let (run, runs, recovery) = {
            let mut history = state.login_store().map_err(command_error)?;
            // Re-read after the bounded probe: a concurrent Cancel wins over a
            // late result and is never overwritten by a success observation.
            let run = history
                .reconcile(&run_id, observation)
                .map_err(command_error)?;
            (run, history.runs(), history.recovery())
        };
        Ok(LoginApplyResult {
            run,
            account_status: account::discover_status(runs, recovery),
        })
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn cancel_login_run(
    state: State<'_, ManagedState>,
    run_id: String,
) -> Result<LoginApplyResult, String> {
    let state = state.inner().clone();
    native_job(move || {
        let (run, runs, recovery) = {
            let mut history = state.login_store().map_err(command_error)?;
            if history.run(&run_id).map_err(command_error)?.status == account::LoginRunStatus::InProgress {
                return Err("The official client launcher is still running; cancel follow-up after its result appears".into());
            }
            let run = history.cancel(&run_id).map_err(command_error)?;
            (run, history.runs(), history.recovery())
        };
        Ok(LoginApplyResult { run, account_status: account::discover_status(runs, recovery) })
    }).await
}

#[tauri::command]
pub async fn get_github_authorization_status(
    state: State<'_, ManagedState>,
) -> Result<GithubAuthorizationStatus, String> {
    let state = state.inner().clone();
    native_job(move || {
        Ok(state
            .github_authorization()
            .map_err(command_error)?
            .status())
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn authorize_github(
    state: State<'_, ManagedState>,
    token: String,
) -> Result<GithubAuthorizationStatus, String> {
    let (revision, existing) = {
        let mut store = state.github_authorization().map_err(command_error)?;
        (
            store.begin_attempt().map_err(command_error)?,
            store.status(),
        )
    };
    let (token, outcome) = validate_github_token(token).await?;
    let mut store = state.github_authorization().map_err(command_error)?;
    store.ensure_current(revision).map_err(command_error)?;
    match outcome {
        GithubValidationOutcome::Verified(validation) => store
            .save_verified(&token, validation)
            .map_err(command_error),
        GithubValidationOutcome::Rejected(status) if existing.has_secret => Err(format!(
            "{} The previously stored authorization was left unchanged.",
            status.detail
        )),
        GithubValidationOutcome::Rejected(status) => Ok(status),
    }
}

#[tauri::command]
pub async fn refresh_github_authorization(
    state: State<'_, ManagedState>,
) -> Result<GithubAuthorizationStatus, String> {
    let (token, revision) = {
        let mut store = state.github_authorization().map_err(command_error)?;
        let Some(token) = store.secret_for_refresh().map_err(command_error)? else {
            return Ok(store.status());
        };
        (token, store.begin_attempt().map_err(command_error)?)
    };
    let (token, outcome) = validate_github_token(token).await?;
    let mut store = state.github_authorization().map_err(command_error)?;
    store.ensure_current(revision).map_err(command_error)?;
    match outcome {
        GithubValidationOutcome::Verified(validation) => store
            .save_verified(&token, validation)
            .map_err(command_error),
        GithubValidationOutcome::Rejected(status) => {
            store.record_refresh_failure(status).map_err(command_error)
        }
    }
}

#[tauri::command]
pub async fn clear_github_authorization(
    state: State<'_, ManagedState>,
) -> Result<GithubAuthorizationStatus, String> {
    let state = state.inner().clone();
    native_job(move || {
        state
            .github_authorization()
            .and_then(|mut store| store.clear())
            .map_err(command_error)
    })
    .await
}

async fn validate_github_token(token: String) -> Result<(String, GithubValidationOutcome), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let outcome = github_auth::validate_token_native(&token)?;
        Ok::<_, AppError>((token, outcome))
    })
    .await
    .map_err(|error| {
        command_error(AppError::Config(format!(
            "GitHub authorization task failed: {error}"
        )))
    })?
    .map_err(command_error)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn upsert_connection(
    state: State<'_, ManagedState>,
    input: ConnectionInput,
) -> Result<Connection, String> {
    let state = state.inner().clone();
    native_job(move || {
        let _write = state
            .writes
            .try_lock()
            .map_err(|_| "Another managed write is active".to_string())?;
        let mut store = state.store().map_err(command_error)?;
        let _lease = crate::write_lock::WriteLock::acquire(store.path()).map_err(command_error)?;
        deployment::ensure_no_pending_journal(store.path()).map_err(command_error)?;
        let result = store.upsert_connection(input).map_err(command_error)?;
        drop(store);
        state.app_sync.schedule();
        Ok(result)
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn set_connection_enabled(
    state: State<'_, ManagedState>,
    connection_id: String,
    enabled: bool,
) -> Result<Connection, String> {
    let state = state.inner().clone();
    native_job(move || {
        let _write = state
            .writes
            .try_lock()
            .map_err(|_| "Another managed write is active".to_string())?;
        let mut store = state.store().map_err(command_error)?;
        let _lease = crate::write_lock::WriteLock::acquire(store.path()).map_err(command_error)?;
        deployment::ensure_no_pending_journal(store.path()).map_err(command_error)?;
        let result = store
            .set_connection_enabled(&connection_id, enabled)
            .map_err(command_error)?;
        drop(store);
        state.app_sync.schedule();
        Ok(result)
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn delete_connection(
    state: State<'_, ManagedState>,
    connection_id: String,
) -> Result<DeleteConnectionResult, String> {
    let state = state.inner().clone();
    native_job(move || {
        let _write = state
            .writes
            .try_lock()
            .map_err(|_| "Another managed write is active".to_string())?;
        let mut store = state.store().map_err(command_error)?;
        let _lease = crate::write_lock::WriteLock::acquire(store.path()).map_err(command_error)?;
        deployment::ensure_no_pending_journal(store.path()).map_err(command_error)?;
        let result = store
            .delete_connection(&connection_id)
            .map_err(command_error)?;
        drop(store);
        state.app_sync.schedule();
        Ok(result)
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn preview_deployment(
    state: State<'_, ManagedState>,
    connection_id: String,
    target_ids: Vec<String>,
) -> Result<DeploymentPlan, String> {
    let state = state.inner().clone();
    native_job(move || {
        let (connection, secret, context) = {
            let store = state.store().map_err(command_error)?;
            store.ensure_writable().map_err(command_error)?;
            deployment::ensure_no_pending_journal(store.path()).map_err(command_error)?;
            let connection = store.connection(&connection_id).map_err(command_error)?;
            if !connection.enabled {
                return Err(command_error(AppError::InvalidInput(
                    "Enable this connection before publishing".into(),
                )));
            }
            let secret = store.secret_for(&connection).map_err(command_error)?;
            let context = PlanContext::new(
                store.installation_owner_id(),
                store.revision().map_err(command_error)?,
                secret.as_deref(),
            )
            .with_ownership(store.ownership());
            (connection, secret, context)
        };
        let targets = crate::app_sync::targets_for_connection(&state, &connection);
        let plan = adapters::preview_resolved(&connection, &target_ids, &targets)
            .map_err(command_error)?;
        let context = context.with_app(
            crate::app_sync::commands::approval_for_plan(&state, &connection, &plan)
                .map_err(command_error)?,
        );
        state
            .plans()
            .and_then(|mut plans| {
                plans.insert(&connection, secret.as_deref(), plan, &targets, context)
            })
            .map_err(command_error)
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn apply_deployment_plan(
    state: State<'_, ManagedState>,
    plan_id: String,
    confirmed: bool,
    app_model_references_resolved: Option<bool>,
) -> Result<ApplyResult, String> {
    let state = state.inner().clone();
    native_job(move || {
        let stored = state
            .plans()
            .and_then(|mut plans| plans.consume(&plan_id))
            .map_err(command_error)?;
        if !confirmed {
            return Err("Explicit deployment confirmation is required".into());
        }
        execute_stored_plan(
            &state,
            stored,
            app_model_references_resolved.unwrap_or(false),
        )
        .map_err(command_error)
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn preview_revoke_and_delete(
    state: State<'_, ManagedState>,
    connection_id: String,
) -> Result<DeploymentPlan, String> {
    let state = state.inner().clone();
    native_job(move || {
        let store = state.store().map_err(command_error)?;
        store.ensure_writable().map_err(command_error)?;
        deployment::ensure_no_pending_journal(store.path()).map_err(command_error)?;
        let connection = store.connection(&connection_id).map_err(command_error)?;
        // Pre-hardening audits lack the durable ownership required for revocation.
        if store.deployments().iter().any(|record| record.connection_id == connection_id
            && record.status == DeploymentStatus::Applied && !record.ownership_tracked) {
            return Err("Legacy deployments have no durable ownership proof. Review their configuration manually, or choose Detach only; no client data was changed".into());
        }
        let targets = crate::app_sync::targets(&state);
        let owned_ids = store.ownership().iter().filter(|proof| proof.connection_id == connection_id)
            .map(|proof| proof.target_id.clone()).collect::<Vec<_>>();
        let mut plan = if owned_ids.is_empty() {
            DeploymentPlan {
                id: Uuid::new_v4().to_string(), purpose: DeploymentPurpose::RevokeAndDelete,
                connection_id: connection.id.clone(), connection_name: connection.name.clone(),
                target_ids: Vec::new(), operations: Vec::new(), app_model_removals:Vec::new(),created_at: Utc::now(),
            }
        } else {
            adapters::preview_revoke_resolved(&connection, &owned_ids, &targets).map_err(command_error)?
        };
        plan.purpose = DeploymentPurpose::RevokeAndDelete;
        for operation in &mut plan.operations {
            if !operation.supported { return Err("An owned target is unavailable; revoke it after rediscovery or explicitly choose Detach only".into()); }
            operation.title = "Revoke owned configuration".into();
            operation.description = "Remove only configuration proven to belong to this installation and connection".into();
            operation.changes = vec!["Verify durable ownership and current projection fingerprint".into(),
                "Prepare all target removals before writing; compensate on failure".into(),
                "Delete connection and credential only after target removal commits".into()];
        }
        let context = PlanContext::new(store.installation_owner_id(), store.revision().map_err(command_error)?, None)
            .with_ownership(store.ownership());
        drop(store);
        let context=context.with_app(crate::app_sync::commands::approval_for_plan(&state,&connection,&plan).map_err(command_error)?);
        state.plans().and_then(|mut plans| plans.insert(&connection, None, plan, &targets, context)).map_err(command_error)
    }).await
}

pub(crate) fn execute_stored_plan(
    state: &ManagedState,
    stored: StoredPlan,
    allow_app_model_removal: bool,
) -> AppResult<ApplyResult> {
    let revoke = stored.plan.purpose.is_revocation();
    let delete_connection = stored.plan.purpose == DeploymentPurpose::RevokeAndDelete;
    let app_resources = stored
        .writes
        .iter()
        .filter_map(|w| match &w.resource {
            crate::transaction::Resource::AppSqlite(r) => Some(r.clone()),
            _ => None,
        })
        .collect::<Vec<_>>();
    let _app_activity = (!app_resources.is_empty()).then(|| state.app_sync.activity());
    let _write = state.writes.lock().map_err(|_| AppError::Lock)?;
    let state_path = state.store()?.path().to_path_buf();
    let _lease = crate::write_lock::WriteLock::acquire(&state_path)?;
    let (connection, secret, context) = {
        let store = state.store()?;
        store.ensure_writable()?;
        deployment::ensure_no_pending_journal(store.path())?;
        let connection = store.connection(&stored.plan.connection_id)?;
        let secret = if revoke {
            None
        } else {
            store.secret_for(&connection)?
        };
        let context = PlanContext::new(
            store.installation_owner_id(),
            store.revision()?,
            secret.as_deref(),
        )
        .with_ownership(store.ownership());
        (connection, secret, context)
    };
    let context = context.with_app(crate::app_sync::commands::approval_for_plan(
        state,
        &connection,
        &stored.plan,
    )?);
    let targets = if revoke {
        crate::app_sync::targets(state)
    } else {
        crate::app_sync::targets_for_connection(state, &connection)
    };
    deployment::validate_plan(&stored, &connection, &targets, &context)?;
    crate::app_sync::commands::authorize_plan(
        state,
        &connection,
        &stored.writes,
        allow_app_model_removal,
    )?;
    if revoke {
        for resource in &app_resources {
            state
                .app_sync
                .stop_scope_for_revoke(&connection.id, &resource.target)?;
        }
    }
    let mut tx = crate::transaction::Transaction::begin(
        deployment::journal_path(&state_path),
        &stored.plan.id,
        stored.writes,
    )?;
    let applied = tx.apply_checked(allow_app_model_removal, &|resource| {
        state.app_sync.authorize(&connection, resource)
    });
    let failed = applied.is_err();
    let mut detail = "Prepared changes were applied and verified".to_string();
    let mut recovery_failed = false;
    if let Err(error) = applied {
        detail = redact::redact_with_secret(&error.to_string(), secret.as_deref());
        match tx.rollback() {
            Ok(()) => detail.push_str("; attempted changes were restored"),
            Err(error) => {
                recovery_failed = true;
                detail.push_str(&format!(
                    "; {}",
                    redact::redact_with_secret(&error.to_string(), secret.as_deref())
                ));
            }
        }
    }
    let records = stored
        .plan
        .operations
        .iter()
        .map(|operation| {
            let mut record = record(
                &stored.plan,
                operation,
                if !operation.supported {
                    DeploymentStatus::Skipped
                } else if failed {
                    DeploymentStatus::Failed
                } else {
                    DeploymentStatus::Applied
                },
                if operation.supported {
                    detail.clone()
                } else {
                    operation.description.clone()
                },
            );
            if record.status == DeploymentStatus::Applied {
                if !revoke && connection.default_model().is_some() {
                    record.detail.push_str("; ");
                    record
                        .detail
                        .push_str(deployment::publication::selection_notice(
                            operation.target_kind,
                        ));
                }
                record.target_fingerprint =
                    stored.after_fingerprints.get(&record.target_id).cloned();
                record.connection_revision = Some(crate::fingerprint::json(
                    "setup-connection-v1",
                    &connection,
                )?);
            }
            Ok(record)
        })
        .collect::<AppResult<Vec<_>>>();
    let recorded = records.and_then(|records| {
        #[cfg(feature = "local-e2e")]
        crate::test_support::fault("audit")?;
        for record in records
            .iter()
            .filter(|record| record.status == DeploymentStatus::Applied)
        {
            let target = targets
                .iter()
                .find(|target| target.id == record.target_id)
                .ok_or(AppError::PlanChanged)?;
            if record.target_fingerprint.as_ref() != Some(&deployment::fingerprint_target(target)?)
            {
                return Err(AppError::PlanChanged);
            }
        }
        state.store()?.commit_deployment(
            records.clone(),
            if failed {
                context.ownership.clone()
            } else {
                stored.ownership_after.clone()
            },
            if delete_connection && !failed {
                Some(connection.id.as_str())
            } else {
                None
            },
        )?;
        Ok(records)
    });
    if let Err(error) = &recorded {
        let rollback = tx.rollback();
        return Err(AppError::Config(format!(
            "Final deployment audit could not be saved; recovery journal retained. Audit: {}; compensation: {}",
            redact::redact_with_secret(&error.to_string(), secret.as_deref()),
            if rollback.is_ok() { "restored" } else { "incomplete; inspect recovery" }
        )));
    }
    let records = recorded?;
    if !recovery_failed {
        if failed {
            tx.clear()?;
        } else {
            tx.complete()?;
        }
    }
    // Notification is not part of registry persistence; failure does not undo
    // a successfully committed environment or falsely report a failed write.
    if !failed
        && stored
            .plan
            .operations
            .iter()
            .any(|op| op.supported && op.target_kind == crate::domain::ClientKind::CopilotCli)
    {
        if let Some(warning) = adapters::copilot_cli::notify_environment() {
            log::warn!("{warning}");
        }
    }
    if !app_resources.is_empty() {
        if failed {
            state
                .app_sync
                .halt(crate::app_sync::Phase::Failed, Some(detail));
        }
        let count = if failed {
            None
        } else if revoke {
            Some(0)
        } else {
            adapters::github_app::sqlite::observed_source(&app_resources[0])
                .ok()
                .flatten()
                .map(|(_, count)| count)
        };
        state.app_sync.notify_result(
            &connection,
            stored.plan.purpose,
            if failed {
                crate::app_sync::Phase::Failed
            } else {
                crate::app_sync::Phase::SyncedConfiguration
            },
            count,
        );
    }
    Ok(ApplyResult {
        plan_id: stored.plan.id,
        records,
        connection_deleted: delete_connection && !failed,
        credential_cleanup_warning: if delete_connection && !failed {
            crate::secrets::delete(&connection.secret_ref).err().map(|_|
                "Configuration was revoked and the connection deleted, but its OS credential could not be removed".into())
        } else {
            None
        },
    })
}

fn record(
    plan: &DeploymentPlan,
    operation: &DeploymentOperation,
    status: DeploymentStatus,
    detail: String,
) -> DeploymentRecord {
    DeploymentRecord {
        id: Uuid::new_v4().to_string(),
        plan_id: plan.id.clone(),
        connection_id: plan.connection_id.clone(),
        target_id: operation.target_id.clone(),
        target_kind: operation.target_kind,
        status,
        purpose: Some(plan.purpose),
        detail: redact::redact_text(&detail),
        created_at: Utc::now(),
        target_fingerprint: None,
        connection_revision: None,
        ownership_tracked: true,
    }
}

#[tauri::command]
pub async fn preview_deployment_recovery(
    state: State<'_, ManagedState>,
    action: Option<RecoveryAction>,
) -> Result<RecoveryPlan, String> {
    let state = state.inner().clone();
    native_job(move || {
        let path = deployment::journal_path(state.store().map_err(command_error)?.path());
        let action = action.unwrap_or_default();
        let allowed = match action {
            RecoveryAction::Restore => {
                let mut allowed = deployment::recovery_resources().unwrap_or_default();
                allowed.extend(state.app_sync.recovery_resources().unwrap_or_default());
                if let Ok(resources) = crate::resources::recovery_resources(
                    state.store().map_err(command_error)?.resources(),
                ) {
                    allowed.extend(resources);
                }
                allowed
            }
            RecoveryAction::KeepCurrent => Vec::new(),
        };
        let plan = RecoveryPlan {
            id: Uuid::new_v4().to_string(),
            action,
            view: crate::transaction::recovery_view(&path, &allowed).map_err(command_error)?,
            expires_at: Utc::now() + chrono::Duration::minutes(15),
        };
        *state
            .recovery_plan
            .lock()
            .map_err(|_| "Recovery plan lock failed".to_string())? = Some(plan.clone());
        Ok(plan)
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn apply_deployment_recovery(
    state: State<'_, ManagedState>,
    plan_id: String,
    confirmed: bool,
) -> Result<bool, String> {
    let state = state.inner().clone();
    native_job(move || {
        if !confirmed {
            return Err("Explicit recovery confirmation is required".into());
        }
        let plan = state
            .recovery_plan
            .lock()
            .map_err(|_| "Recovery plan lock failed".to_string())?
            .take()
            .ok_or_else(|| {
                "Preview recovery again; previous plan is missing or consumed".to_string()
            })?;
        if plan.id != plan_id || plan.expires_at <= Utc::now() {
            return Err("Recovery preview is stale".into());
        }
        let _write = state
            .writes
            .try_lock()
            .map_err(|_| "Another managed write is active".to_string())?;
        let store = state.store().map_err(command_error)?;
        let _lease = crate::write_lock::WriteLock::acquire(store.path()).map_err(command_error)?;
        let path = deployment::journal_path(store.path());
        match plan.action {
            RecoveryAction::Restore => {
                let mut allowed = deployment::recovery_resources().unwrap_or_default();
                allowed.extend(state.app_sync.recovery_resources().unwrap_or_default());
                if let Ok(resources) = crate::resources::recovery_resources(store.resources()) {
                    allowed.extend(resources);
                }
                crate::transaction::recover(&path, &plan.view.digest, &allowed)
            }
            RecoveryAction::KeepCurrent => {
                crate::transaction::keep_current(&path, &plan.view.digest)
            }
        }
        .map_err(command_error)?;
        Ok(true)
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_github_billing_overview(
    state: State<'_, ManagedState>,
    year: i32,
    month: u32,
) -> Result<crate::github_billing::GithubBillingOverview, String> {
    crate::usage::commands::get_github_billing(state, Some(year), Some(month))
}
#[tauri::command(rename_all = "camelCase")]
pub async fn refresh_github_billing(
    state: State<'_, ManagedState>,
    year: i32,
    month: u32,
) -> Result<crate::github_billing::GithubBillingOverview, String> {
    crate::usage::commands::refresh_personal_github_usage(state, year, month).await
}

async fn native_job<T: Send + 'static>(
    job: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(job)
        .await
        .map_err(|_| "Native task failed; inspect recovery status before retrying".to_string())?
}
