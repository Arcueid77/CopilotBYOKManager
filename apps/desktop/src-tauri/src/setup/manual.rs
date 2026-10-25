//! Local user confirmations only: no app store, credentials, process or network probes.
use super::{load, save, Preferences};
use crate::{
    commands::ManagedState,
    deployment,
    domain::Connection,
    error::AppResult,
    fingerprint,
    usage::{
        commands::{error, with_db},
        invalid,
    },
    validation,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Confirmation {
    revision: String,
    confirmed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ConfirmationState {
    NotConfirmed,
    UserConfirmed,
    ConfigurationChanged,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Observation {
    connection_id: String,
    pub state: ConfirmationState,
    revision: String,
    confirmed_at: Option<DateTime<Utc>>,
    provider_updated_at: DateTime<Utc>,
}

fn validate(preferences: &Preferences) -> AppResult<()> {
    if preferences.manual_providers.len() > validation::MAX_CONNECTIONS {
        return Err(invalid("Too many manual provider confirmations"));
    }
    for (id, record) in &preferences.manual_providers {
        validation::validate_connection_id(id)?;
        if record.revision.len() != 64 || !record.revision.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(invalid("Invalid manual provider confirmation"));
        }
        if record.confirmed_at.is_some_and(|at| at > Utc::now()) {
            return Err(invalid(
                "Manual provider confirmation is dated in the future",
            ));
        }
    }
    Ok(())
}

pub(super) fn observe(
    preferences: &Preferences,
    connection: &Connection,
) -> AppResult<Observation> {
    validate(preferences)?;
    let revision = fingerprint::json("setup-connection-v1", connection)?;
    let saved = preferences.manual_providers.get(&connection.id);
    let state = match saved {
        Some(record) if record.revision == revision => ConfirmationState::UserConfirmed,
        Some(_) => ConfirmationState::ConfigurationChanged,
        None if preferences.manual_connection_revision.as_ref() == Some(&revision) => {
            ConfirmationState::UserConfirmed
        }
        None => ConfirmationState::NotConfirmed,
    };
    Ok(Observation {
        connection_id: connection.id.clone(),
        state,
        revision,
        confirmed_at: saved.and_then(|record| record.confirmed_at),
        provider_updated_at: connection.updated_at,
    })
}

fn record(
    preferences: &mut Preferences,
    connections: &[Connection],
    connection_id: &str,
    expected_revision: &str,
    confirmed: bool,
) -> AppResult<()> {
    validate(preferences)?;
    if !confirmed {
        return Err(invalid(
            "Confirm completing the app's manual provider setup",
        ));
    }
    let connection = connections
        .iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| invalid("Provider no longer exists"))?;
    let current = observe(preferences, connection)?;
    if expected_revision != current.revision {
        return Err(invalid(
            "Provider changed; reopen its manual setup before confirming",
        ));
    }
    // Preserve a legacy confirmation only when its exact Connection still matches.
    for existing in connections {
        let revision = fingerprint::json("setup-connection-v1", existing)?;
        if preferences.manual_connection_revision.as_ref() == Some(&revision) {
            preferences
                .manual_providers
                .entry(existing.id.clone())
                .or_insert(Confirmation {
                    revision,
                    confirmed_at: None,
                });
        }
    }
    preferences
        .manual_providers
        .retain(|id, _| connections.iter().any(|c| &c.id == id));
    preferences.manual_providers.insert(
        connection_id.into(),
        Confirmation {
            revision: current.revision,
            confirmed_at: Some(Utc::now()),
        },
    );
    // Keep the legacy field intact for retained extended readers; never adopt an unrelated record.
    validate(preferences)
}

#[tauri::command]
pub fn get_manual_provider_status(
    state: State<'_, ManagedState>,
) -> Result<Vec<Observation>, String> {
    let connections = state.store().map_err(error)?.connections().to_vec();
    with_db(&state, |db| {
        let preferences = load(db)?;
        validate(&preferences)?;
        connections
            .iter()
            .map(|c| observe(&preferences, c))
            .collect()
    })
}

pub(super) fn confirm(
    state: &ManagedState,
    connection_id: &str,
    revision: &str,
    confirmed: bool,
) -> Result<(), String> {
    validation::validate_connection_id(connection_id).map_err(error)?;
    if revision.len() != 64 {
        return Err("Invalid provider revision".into());
    }
    let _write = state
        .writes
        .try_lock()
        .map_err(|_| "Another managed write is active".to_string())?;
    let store = state.store().map_err(error)?;
    let _lease = crate::write_lock::WriteLock::acquire(store.path()).map_err(error)?;
    store.ensure_writable().map_err(error)?;
    deployment::ensure_no_pending_journal(store.path()).map_err(error)?;
    with_db(state, |db| {
        let mut preferences = load(db)?;
        record(
            &mut preferences,
            store.connections(),
            connection_id,
            revision,
            confirmed,
        )?;
        save(db, &preferences)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connection(id: &str) -> Connection {
        serde_json::from_value(serde_json::json!({
            "id":id,"name":id,"providerKind":"openai","protocol":"chat-completions",
            "baseUrl":"https://example.invalid/v1","headers":{},"secretRef":format!("connection:{id}"),
            "hasSecret":false,"enabled":true,"models":[],"createdAt":"2026-10-01T00:00:00Z","updatedAt":"2026-10-01T00:00:00Z"
        })).unwrap()
    }

    #[test]
    fn confirmations_are_independent_persistent_and_invalidated_only_by_their_provider() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("usage.sqlite3");
        let db = crate::usage_db::UsageDb::open_at(&path).unwrap();
        let mut providers = vec![connection("a"), connection("b")];
        let mut preferences = Preferences::default();
        for provider in &providers {
            let revision = observe(&preferences, provider).unwrap().revision;
            record(&mut preferences, &providers, &provider.id, &revision, true).unwrap();
        }
        save(&db, &preferences).unwrap();
        drop(db);
        let db = crate::usage_db::UsageDb::open_at(&path).unwrap();
        let preferences = load(&db).unwrap();
        assert_eq!(preferences.manual_providers.len(), 2);
        providers[0].base_url = "https://changed.invalid/v1".into();
        assert_eq!(
            observe(&preferences, &providers[0]).unwrap().state,
            ConfirmationState::ConfigurationChanged
        );
        assert_eq!(
            observe(&preferences, &providers[1]).unwrap().state,
            ConfirmationState::UserConfirmed
        );
        assert!(observe(&preferences, &providers[1])
            .unwrap()
            .confirmed_at
            .is_some());
    }

    #[test]
    fn legacy_confirmation_is_bound_without_fabricating_a_timestamp_and_stale_confirmation_fails() {
        let providers = vec![connection("a"), connection("b")];
        let revision = fingerprint::json("setup-connection-v1", &providers[0]).unwrap();
        let mut preferences: Preferences = serde_json::from_value(serde_json::json!({"connectionId":"a","accountConfirmation":null,"manualConnectionRevision":revision})).unwrap();
        assert_eq!(
            observe(&preferences, &providers[0]).unwrap().state,
            ConfirmationState::UserConfirmed
        );
        let next = observe(&preferences, &providers[1]).unwrap().revision;
        assert!(record(&mut preferences, &providers, "b", &"0".repeat(64), true).is_err());
        assert!(record(&mut preferences, &providers, "b", &next, false).is_err());
        record(&mut preferences, &providers, "b", &next, true).unwrap();
        assert_eq!(preferences.manual_providers.len(), 2);
        assert!(observe(&preferences, &providers[0])
            .unwrap()
            .confirmed_at
            .is_none());
        let public = serde_json::to_string(&observe(&preferences, &providers[0]).unwrap()).unwrap();
        assert!(!public.contains("example.invalid"));
        assert!(!public.contains("secretRef"));
    }

    #[test]
    fn malformed_future_and_oversized_confirmations_are_not_treated_as_empty() {
        let provider = connection("a");
        let mut preferences = Preferences::default();
        preferences.manual_providers.insert(
            "a".into(),
            Confirmation {
                revision: "invalid".into(),
                confirmed_at: None,
            },
        );
        assert!(observe(&preferences, &provider).is_err());
        preferences.manual_providers.get_mut("a").unwrap().revision = "0".repeat(64);
        preferences
            .manual_providers
            .get_mut("a")
            .unwrap()
            .confirmed_at = Some(Utc::now() + chrono::Duration::days(1));
        assert!(observe(&preferences, &provider).is_err());
        preferences.manual_providers.clear();
        for index in 0..=validation::MAX_CONNECTIONS {
            preferences.manual_providers.insert(
                index.to_string(),
                Confirmation {
                    revision: "0".repeat(64),
                    confirmed_at: None,
                },
            );
        }
        assert!(observe(&preferences, &provider).is_err());
    }
}
