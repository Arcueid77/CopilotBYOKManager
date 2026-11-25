//! Explicit edits to one existing client provider group. Client catalogs and
//! editor field addresses stay native, and every change uses the shared journal.
mod catalog;
#[cfg(test)]
mod tests;

use crate::adapters::{copilot_cli, jetbrains, vscode};
use crate::commands::ManagedState;
use crate::deployment::{self, ownership};
use crate::domain::ClientKind;
use crate::error::{AppError, AppResult};
use crate::transaction::{PreparedWrite, Resource, Transaction};
use catalog::Change;
pub(crate) use catalog::{pointer_key, Binding, Entry, FieldKind, Removal};
use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::State;

struct Document {
    path: PathBuf,
    kind: ClientKind,
    before: Vec<u8>,
    root: Value,
    entries: Vec<Entry>,
    revision: String,
    shared_instances: usize,
}

impl Document {
    fn resolve(state: &ManagedState, id: &str) -> AppResult<Self> {
        if id.is_empty() || id.len() > 512 || id.chars().any(char::is_control) {
            return Err(AppError::PlanChanged);
        }
        let targets = crate::app_sync::publication_targets(state, &[id.to_owned()]);
        let target = targets
            .iter()
            .find(|target| target.id == id && target.detected && target.supports_write)
            .ok_or_else(unsupported)?;
        let path = match target.kind {
            ClientKind::VsCodeCopilot => target
                .path
                .as_ref()
                .map(PathBuf::from)
                .ok_or_else(unsupported)?,
            ClientKind::CopilotCli => copilot_cli::existing::path()?,
            ClientKind::JetBrainsCopilot => jetbrains::byok::store_path()?,
            ClientKind::GithubCopilotApp => return Err(unsupported()),
        };
        let count = targets
            .iter()
            .filter(|other| {
                other.kind == target.kind
                    && other.detected
                    && match target.kind {
                        ClientKind::VsCodeCopilot => other.path == target.path,
                        ClientKind::JetBrainsCopilot => other.supports_write,
                        _ => other.id == target.id,
                    }
            })
            .count();
        Self::read(&path, target.kind, count)
    }

    fn read(path: &Path, kind: ClientKind, shared_instances: usize) -> AppResult<Self> {
        let path = crate::safe_io::resource_path(path)?;
        let before = Resource::File(path.clone())
            .read()?
            .ok_or_else(unsupported)?;
        let revision = crate::fingerprint::json(
            "existing-provider-catalog-v1",
            &(
                Resource::File(path.clone()).key(),
                kind,
                crate::fingerprint::bytes("existing-provider-file-v1", Some(&before)),
                shared_instances,
            ),
        )?;
        let (root, entries) = parse(&path, kind, &before)?;
        Ok(Self {
            path,
            kind,
            before,
            root,
            entries,
            revision,
            shared_instances,
        })
    }

    fn prepare(&mut self, change: &Change, provider_index: usize) -> AppResult<PreparedWrite> {
        let entry = self
            .entries
            .get(provider_index)
            .ok_or(AppError::PlanChanged)?;
        entry.mutate(&mut self.root, change)?;
        let mut after = serde_json::to_vec_pretty(&self.root).map_err(|_| unsupported())?;
        after.push(b'\n');
        parse(&self.path, self.kind, &after)?;
        let write = PreparedWrite::file(&self.path, Some(after), false)?;
        if write.before.as_deref() != Some(self.before.as_slice()) {
            return Err(AppError::PlanChanged);
        }
        Ok(write)
    }
}

fn parse(path: &Path, kind: ClientKind, bytes: &[u8]) -> AppResult<(Value, Vec<Entry>)> {
    match kind {
        ClientKind::VsCodeCopilot => vscode::existing::read(path, bytes),
        ClientKind::CopilotCli => copilot_cli::existing::read(bytes),
        ClientKind::JetBrainsCopilot => jetbrains::byok::existing::read(bytes),
        ClientKind::GithubCopilotApp => Err(unsupported()),
    }
}

fn unsupported() -> AppError {
    AppError::Unsupported("Client provider configuration is unavailable for direct editing".into())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Inventory {
    entries: Vec<Entry>,
    inventory_id: String,
    shared_instances: usize,
}

struct Observed {
    id: String,
    target_id: String,
    revision: String,
    expires: Instant,
}

struct Plan {
    id: String,
    expires: Instant,
    target_id: String,
    provider_index: usize,
    revision: String,
    state_revision: String,
    change: Change,
}

#[derive(Default)]
pub(crate) struct Plans {
    observed: Option<Observed>,
    plan: Option<Plan>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Failure {
    Stale,
    Busy,
    Invalid,
    Unavailable,
    Recovery,
}

async fn job<T: Send + 'static>(
    state: ManagedState,
    work: impl FnOnce(&ManagedState) -> AppResult<T> + Send + 'static,
) -> Result<T, Failure> {
    tauri::async_runtime::spawn_blocking(move || {
        work(&state).map_err(|err| {
            let recovery = state.store().is_ok_and(|store| {
                store.recovery().is_some() || deployment::recovery_required(store.path())
            });
            if recovery {
                return Failure::Recovery;
            }
            match err {
                AppError::PlanChanged | AppError::PlanUnavailable => Failure::Stale,
                AppError::Busy => Failure::Busy,
                AppError::InvalidInput(_) => Failure::Invalid,
                _ => Failure::Unavailable,
            }
        })
    })
    .await
    .map_err(|_| Failure::Unavailable)?
}

#[tauri::command(rename_all = "camelCase")]
pub(crate) async fn list_existing_providers(
    state: State<'_, ManagedState>,
    target_id: String,
) -> Result<Inventory, Failure> {
    job(state.inner().clone(), move |state| {
        let document = Document::resolve(state, &target_id)?;
        inventory(state, target_id, document)
    })
    .await
}

fn inventory(state: &ManagedState, target_id: String, document: Document) -> AppResult<Inventory> {
    let mut plans = state
        .existing_provider_plans
        .lock()
        .map_err(|_| AppError::Lock)?;
    let inventory_id = uuid::Uuid::new_v4().to_string();
    plans.observed = Some(Observed {
        id: inventory_id.clone(),
        target_id,
        revision: document.revision,
        expires: Instant::now() + Duration::from_secs(300),
    });
    plans.plan = None;
    Ok(Inventory {
        entries: document.entries,
        inventory_id,
        shared_instances: document.shared_instances,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub(crate) async fn preview_existing_provider_change(
    state: State<'_, ManagedState>,
    inventory_id: String,
    provider_index: usize,
    change: Change,
) -> Result<String, Failure> {
    job(state.inner().clone(), move |state| {
        review(
            state,
            &inventory_id,
            provider_index,
            change,
            Document::resolve,
        )
    })
    .await
}

fn review(
    state: &ManagedState,
    inventory_id: &str,
    provider_index: usize,
    change: Change,
    resolve: impl FnOnce(&ManagedState, &str) -> AppResult<Document>,
) -> AppResult<String> {
    let state_revision = {
        let store = state.store()?;
        deployment::ensure_no_pending_journal(store.path())?;
        store.revision()?
    };
    let (target_id, revision) = {
        let plans = state
            .existing_provider_plans
            .lock()
            .map_err(|_| AppError::Lock)?;
        let observed = plans
            .observed
            .as_ref()
            .filter(|item| item.id == inventory_id && item.expires > Instant::now())
            .ok_or(AppError::PlanUnavailable)?;
        (observed.target_id.clone(), observed.revision.clone())
    };
    let mut document = resolve(state, &target_id)?;
    if document.revision != revision {
        return Err(AppError::PlanChanged);
    }
    document.prepare(&change, provider_index)?;
    let id = uuid::Uuid::new_v4().to_string();
    let mut plans = state
        .existing_provider_plans
        .lock()
        .map_err(|_| AppError::Lock)?;
    if plans
        .observed
        .as_ref()
        .is_none_or(|item| item.id != inventory_id)
    {
        return Err(AppError::PlanChanged);
    }
    plans.plan = Some(Plan {
        id: id.clone(),
        expires: Instant::now() + Duration::from_secs(300),
        target_id,
        provider_index,
        revision,
        state_revision,
        change,
    });
    Ok(id)
}

#[tauri::command(rename_all = "camelCase")]
pub(crate) async fn apply_existing_provider_change(
    state: State<'_, ManagedState>,
    plan_id: String,
    confirmed: bool,
) -> Result<(), Failure> {
    if !confirmed {
        return Err(Failure::Invalid);
    }
    job(state.inner().clone(), move |state| {
        apply(state, &plan_id, Document::resolve)
    })
    .await
}

fn apply(
    state: &ManagedState,
    id: &str,
    resolve: impl FnOnce(&ManagedState, &str) -> AppResult<Document>,
) -> AppResult<()> {
    let plan = {
        let mut plans = state
            .existing_provider_plans
            .lock()
            .map_err(|_| AppError::Lock)?;
        if plans
            .plan
            .as_ref()
            .is_none_or(|plan| plan.id != id || plan.expires <= Instant::now())
        {
            return Err(AppError::PlanUnavailable);
        }
        plans.plan.take().ok_or(AppError::PlanUnavailable)?
    };
    let _write = state.writes.try_lock().map_err(|_| AppError::Busy)?;
    let mut document = resolve(state, &plan.target_id)?;
    if document.revision != plan.revision {
        return Err(AppError::PlanChanged);
    }
    let write = document.prepare(&plan.change, plan.provider_index)?;
    let mut store = state.store()?;
    let _lease = crate::write_lock::WriteLock::acquire(store.path())?;
    deployment::ensure_no_pending_journal(store.path())?;
    if store.revision()? != plan.state_revision {
        return Err(AppError::PlanChanged);
    }
    let resource = ownership::resource_id(&write.resource);
    let binding = &document.entries[plan.provider_index].binding;
    let mut proofs = store.ownership().to_vec();
    if matches!(plan.change, Change::Delete)
        && binding.is_some()
        && document
            .entries
            .iter()
            .filter(|entry| &entry.binding == binding)
            .count()
            == 1
    {
        proofs.retain(|proof| {
            proof.resource_id != resource
                || !match binding {
                    Some(Binding::Marked { owner, connection }) => {
                        proof.owner_id == *owner && proof.connection_id == *connection
                    }
                    Some(Binding::Cli(name)) => copilot_cli::existing::matches_binding(
                        name,
                        &proof.owner_id,
                        &proof.connection_id,
                    ),
                    None => false,
                }
        });
    }
    let mut tx = Transaction::begin(
        deployment::journal_path(store.path()),
        &plan.id,
        vec![write],
    )?;
    if let Err(error) = tx.apply().and_then(|()| {
        if proofs.len() != store.ownership().len() {
            store.commit_deployment(vec![], proofs, None)?;
        }
        Ok(())
    }) {
        tx.rollback()?;
        tx.clear()?;
        return Err(error);
    }
    tx.complete()
}
