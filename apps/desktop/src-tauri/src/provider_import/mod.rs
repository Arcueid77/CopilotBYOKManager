//! Reviewed extraction of provider configurations and explicitly approved API keys.
mod catalog;
mod credential;
mod scan;
#[cfg(test)]
mod tests;

use crate::{
    commands::ManagedState,
    domain::Connection,
    error::{AppError, AppResult},
};
use catalog::Action;
pub(crate) use catalog::Candidate;
pub(crate) use catalog::{endpoint as portable_endpoint, public_text};
pub(crate) use catalog::{protocol, repeats_private, Catalog, ModelFields};
use chrono::Utc;
pub(crate) use credential::bearer_key;
use serde::Serialize;
use std::{
    collections::{BTreeSet, HashMap},
    time::{Duration, Instant},
};
use tauri::State;
use uuid::Uuid;

pub(crate) fn too_large() -> AppError {
    catalog::limit()
}

struct Review {
    state_revision: String,
    rows: Vec<Candidate>,
    expires: Instant,
}
#[derive(Default)]
pub(crate) struct Reviews(HashMap<String, Review>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Preview {
    plan_id: String,
    candidates: Vec<Candidate>,
    issues: Vec<scan::Issue>,
}
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Outcome {
    pub created: usize,
    pub updated: usize,
    pub keys_imported: usize,
    pub connection_ids: Vec<String>,
}

impl Reviews {
    fn present(&mut self, mut scan: scan::Scanned, state_revision: String) -> AppResult<Preview> {
        scan.candidates.retain(|row| row.action.selectable());
        for row in &mut scan.candidates {
            row.drop_key_material();
        }
        let now = Instant::now();
        self.0.retain(|_, p| p.expires > now);
        // Retire the oldest unused review when the operator reopens the dialog.
        if self.0.len() >= 4 {
            if let Some(id) = self
                .0
                .iter()
                .min_by_key(|(_, p)| p.expires)
                .map(|(id, _)| id.clone())
            {
                self.0.remove(&id);
            }
        }
        let id = Uuid::new_v4().to_string();
        self.0.insert(
            id.clone(),
            Review {
                state_revision,
                rows: scan.candidates.clone(),
                expires: now + Duration::from_secs(300),
            },
        );
        Ok(Preview {
            plan_id: id,
            candidates: scan.candidates,
            issues: scan.issues,
        })
    }
    fn take(&mut self, id: &str, selected: &[String]) -> AppResult<(String, Vec<Candidate>)> {
        if id.len() != 36 {
            return Err(AppError::PlanUnavailable);
        }
        let review = self.0.remove(id).ok_or(AppError::PlanUnavailable)?;
        if Instant::now() >= review.expires {
            return Err(AppError::PlanUnavailable);
        }
        if selected.is_empty() || selected.len() > 256 || selected.iter().any(|s| s.len() != 64) {
            return Err(AppError::InvalidInput(
                "Select distinct providers from this review".into(),
            ));
        }
        let keys: BTreeSet<_> = selected.iter().collect();
        if keys.len() != selected.len() {
            return Err(AppError::InvalidInput("Duplicate import selection".into()));
        }
        let rows: Vec<_> = review
            .rows
            .into_iter()
            .filter(|r| keys.contains(&r.id) && r.action.selectable())
            .collect();
        if rows.len() != keys.len() {
            return Err(AppError::PlanChanged);
        }
        Ok((review.state_revision, rows))
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ImportError {
    Stale,
    Busy,
    Limit,
    Unavailable,
    CredentialStore,
}
impl From<AppError> for ImportError {
    fn from(value: AppError) -> Self {
        match value {
            AppError::PlanChanged | AppError::PlanUnavailable => Self::Stale,
            AppError::Busy => Self::Busy,
            AppError::ProviderImportLimit => Self::Limit,
            AppError::Secret(_) => Self::CredentialStore,
            _ => Self::Unavailable,
        }
    }
}
async fn native<T: Send + 'static>(
    job: impl FnOnce() -> AppResult<T> + Send + 'static,
) -> Result<T, ImportError> {
    tauri::async_runtime::spawn_blocking(job)
        .await
        .map_err(|_| ImportError::Unavailable)?
        .map_err(ImportError::from)
}

fn credential_view(mut connections: Vec<Connection>) -> Vec<Connection> {
    for connection in &mut connections {
        // An unavailable credential store is not evidence that the key is missing.
        connection.has_secret = crate::secrets::observe(&connection.id).state
            != crate::domain::CredentialState::Missing;
    }
    connections
}

/// Visibility is advisory. Read the same reviewed catalogs as preview, without
/// exposing metadata or allocating a review plan.
#[tauri::command]
pub(crate) async fn get_provider_import_availability(
    state: State<'_, ManagedState>,
) -> Result<scan::Availability, ImportError> {
    let state = state.inner().clone();
    native(move || {
        let (connections, revision) = {
            let store = state.store()?;
            if store.recovery().is_some() || crate::deployment::recovery_required(store.path()) {
                return Ok(scan::Availability::default());
            }
            (store.connections().to_vec(), store.revision()?)
        };
        let availability = scan::availability(&credential_view(connections))?;
        let store = state.store()?;
        if store.recovery().is_some() || crate::deployment::recovery_required(store.path()) {
            return Ok(scan::Availability::default());
        }
        if store.revision()? != revision {
            return Err(AppError::PlanChanged);
        }
        Ok(availability)
    })
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub(crate) async fn preview_provider_import(
    state: State<'_, ManagedState>,
    target_ids: Option<Vec<String>>,
) -> Result<Preview, ImportError> {
    let state = state.inner().clone();
    native(move || preview(&state, target_ids.as_deref(), scan::scan)).await
}
fn preview(
    state: &ManagedState,
    ids: Option<&[String]>,
    scan: impl FnOnce(Option<&[String]>, &[Connection], bool) -> AppResult<scan::Scanned>,
) -> AppResult<Preview> {
    let (existing, revision) = {
        let store = state.store()?;
        crate::deployment::ensure_no_pending_journal(store.path())?;
        (store.connections().to_vec(), store.revision()?)
    };
    let results = scan(ids, &credential_view(existing), false)?;
    state
        .import_reviews
        .lock()
        .map_err(|_| AppError::Lock)?
        .present(results, revision)
}
#[tauri::command(rename_all = "camelCase")]
pub(crate) async fn apply_provider_import(
    state: State<'_, ManagedState>,
    plan_id: String,
    selected_ids: Vec<String>,
    include_api_keys: Option<bool>,
) -> Result<Outcome, ImportError> {
    let state = state.inner().clone();
    native(move || {
        apply(
            &state,
            &plan_id,
            &selected_ids,
            include_api_keys == Some(true),
            scan::scan,
        )
    })
    .await
}
fn apply(
    state: &ManagedState,
    id: &str,
    selected: &[String],
    include_keys: bool,
    scan: impl FnOnce(Option<&[String]>, &[Connection], bool) -> AppResult<scan::Scanned>,
) -> AppResult<Outcome> {
    let (revision, rows) = state
        .import_reviews
        .lock()
        .map_err(|_| AppError::Lock)?
        .take(id, selected)?;
    if !include_keys && rows.iter().any(|row| row.action == Action::FillKey) {
        return Err(AppError::InvalidInput(
            "Confirm local API key import before saving keys".into(),
        ));
    }
    let sources: Vec<_> = rows
        .iter()
        .flat_map(|r| r.source_ids.iter().cloned())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let existing = {
        let store = state.store()?;
        if store.revision()? != revision {
            return Err(AppError::PlanChanged);
        }
        store.connections().to_vec()
    };
    let mut fresh = scan(Some(&sources), &credential_view(existing), include_keys)?.candidates;
    let mut confirmed = Vec::with_capacity(rows.len());
    for row in rows {
        let index = fresh
            .iter()
            .position(|candidate| *candidate == row)
            .ok_or(AppError::PlanChanged)?;
        let candidate = fresh.swap_remove(index);
        if include_keys
            && candidate.key_status == Some(credential::KeyStatus::Available)
            && candidate.key_material().is_none()
        {
            return Err(AppError::PlanChanged);
        }
        confirmed.push(candidate);
    }
    let _write = state.writes.try_lock().map_err(|_| AppError::Busy)?;
    let mut store = state.store()?;
    let _lease = crate::write_lock::WriteLock::acquire(store.path())?;
    crate::deployment::ensure_no_pending_journal(store.path())?;
    store.import_providers(&revision, &confirmed, include_keys)
}

pub(crate) fn merge_selected(
    connections: &mut Vec<Connection>,
    rows: &[Candidate],
) -> AppResult<Outcome> {
    let mut result = Outcome::default();
    let now = Utc::now();
    for row in rows {
        let p = &row.provider;
        match row.action {
            Action::Create => {
                if connections.len() >= crate::validation::MAX_CONNECTIONS {
                    return Err(catalog::limit());
                }
                let id = Uuid::new_v4().to_string();
                let connection = Connection {
                    id: id.clone(),
                    name: p.name.clone(),
                    enabled: true,
                    base_url: p.base_url.clone(),
                    provider_kind: p.kind,
                    protocol: p.protocol,
                    headers: Default::default(),
                    models: p.models.iter().map(|m| m.to_spec()).collect(),
                    secret_ref: format!("connection:{id}"),
                    has_secret: false,
                    created_at: now,
                    updated_at: now,
                };
                crate::validation::validate_connection(&connection)?;
                result.connection_ids.push(connection.id.clone());
                connections.push(connection);
                result.created += 1;
            }
            Action::Extend | Action::FillKey => {
                let conn = connections
                    .iter_mut()
                    .find(|c| Some(&c.id) == row.existing_id.as_ref())
                    .ok_or(AppError::PlanChanged)?;
                if row.action == Action::Extend {
                    for m in &p.models {
                        if !conn
                            .models
                            .iter()
                            .any(|old| old.model_id.eq_ignore_ascii_case(&m.model_id))
                        {
                            conn.models.push(m.to_spec());
                        }
                    }
                    result.updated += 1;
                }
                crate::validation::validate_connection(conn)?;
                result.connection_ids.push(conn.id.clone());
                conn.updated_at = now;
            }
            _ => return Err(AppError::PlanChanged),
        }
    }
    Ok(result)
}
