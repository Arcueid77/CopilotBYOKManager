use super::*;
use crate::{adapters::github_app::sqlite, app_sync::consent::Consent, transaction};
use rusqlite::Connection;
use std::{collections::BTreeMap, path::Path};

fn state_at(root: &Path, enabled: bool) -> ManagedState {
    let open = || super::super::tests::isolated(root);
    let state = open();
    let mut store = state.store().unwrap();
    store.persist_owner_if_new().unwrap();
    let mut mode = Consent::disabled(store.installation_owner_id());
    mode.enabled = enabled;
    mode.nonce = uuid::Uuid::new_v4().to_string();
    drop(store);
    crate::safe_io::write_private(
        &root.join("app-sync.json"),
        &serde_json::to_vec(&mode).unwrap(),
    )
    .unwrap();
    open()
}

fn selection(target: &target::Target) -> String {
    sqlite::import::observed_catalog(target, &BTreeMap::new())
        .unwrap()
        .into_iter()
        .find(|row| row.name == "Foreign provider" && row.model_count == 1)
        .unwrap()
        .manual_deletion_id
        .unwrap()
}

fn seed(target: &target::Target) {
    let db = Connection::open(&target.database).unwrap();
    db.execute_batch("INSERT INTO provider_models(id,provider_id,model_id,display_name) VALUES('child','manual','a','A');
        INSERT INTO model_providers(id,name,type) VALUES('twin','Foreign provider','custom');
        INSERT INTO model_providers(id,name,type) VALUES('cbm-other-install','Reserved','openai');
        INSERT INTO accounts(id) VALUES('account');
        INSERT INTO model_providers(id,name,type,account_id) VALUES('linked','Account provider','openai','account');
        INSERT INTO model_providers(id,name,type) VALUES('builtin','Built-in','copilot');").unwrap();
    db.execute(
        "UPDATE model_providers SET settings_json=?1 WHERE id='manual'",
        [r#"{"baseUrl":"https://manual.example.invalid/v1?secret=fixture-query","headersJson":"synthetic-private-value","authKind":"none"}"#],
    )
    .unwrap();
}

#[test]
fn manual_delete_is_confirmed_once_and_never_enrolls_or_collides_with_another_provider() {
    let root = sqlite::tests::private_root();
    let target = sqlite::tests::database(&root.path().join("data.db"));
    seed(&target);
    let selected = selection(&target);
    let list = sqlite::import::observed_catalog(&target, &BTreeMap::new()).unwrap();
    assert_eq!(
        list.iter()
            .filter(|r| r.manual_deletion_id.is_some())
            .count(),
        2
    );
    assert!(list
        .iter()
        .all(|r| r.name != "Account provider" && r.name != "Built-in"));
    assert!(list
        .iter()
        .find(|r| r.name == "Reserved")
        .unwrap()
        .manual_deletion_id
        .is_none());
    assert!(!serde_json::to_string(&list)
        .unwrap()
        .contains("synthetic-private-value"));
    let disabled = state_at(root.path(), false);
    assert!(preview(&disabled, &selected, || Ok(target.clone())).is_err());
    let state = state_at(root.path(), true);
    let review = || {
        let reviewed = preview(&state, &selected, || Ok(target.clone())).unwrap();
        assert_eq!(
            reviewed.origin.as_deref(),
            Some("https://manual.example.invalid")
        );
        let public = serde_json::to_string(&reviewed).unwrap();
        assert!(!public.contains("synthetic-private-value") && !public.contains("fixture-query"));
        reviewed.plan_id
    };
    let consent = state.app_sync.snapshot().unwrap().revision().unwrap();
    let cancelled = review();
    assert!(apply(&state, &cancelled, false).is_err());
    assert!(apply(&state, &cancelled, true).is_err());
    let dismissed = review();
    state
        .existing_provider_plans
        .lock()
        .unwrap()
        .discard(&dismissed);
    assert!(apply(&state, &dismissed, true).is_err());
    let expired = review();
    state
        .existing_provider_plans
        .lock()
        .unwrap()
        .manual_app
        .as_mut()
        .unwrap()
        .expires = Instant::now();
    assert!(apply(&state, &expired, true).is_err());
    let stale = review();
    let db = Connection::open(&target.database).unwrap();
    db.execute(
        "UPDATE provider_models SET display_name='Changed' WHERE id='child'",
        [],
    )
    .unwrap();
    assert!(matches!(
        apply(&state, &stale, true),
        Err(AppError::PlanChanged)
    ));
    let id = review();
    apply(&state, &id, true).unwrap();
    assert!(apply(&state, &id, true).is_err());
    assert_eq!(
        db.query_row::<i64, _, _>("SELECT count(*) FROM provider_models", [], |r| r.get(0))
            .unwrap(),
        0
    );
    assert_eq!(db.query_row::<i64, _, _>("SELECT count(*) FROM model_providers WHERE id IN ('twin','linked','builtin','cbm-other-install')", [], |r| r.get(0)).unwrap(), 4);
    assert_eq!(
        state.app_sync.snapshot().unwrap().revision().unwrap(),
        consent
    );
    assert!(state.store().unwrap().ownership().is_empty());
}

#[test]
fn reference_or_disabling_sync_preserves_the_group_without_touching_sessions() {
    let root = sqlite::tests::private_root();
    let target = sqlite::tests::database(&root.path().join("data.db"));
    seed(&target);
    let selected = selection(&target);
    let state = state_at(root.path(), true);
    let review = || {
        preview(&state, &selected, || Ok(target.clone()))
            .unwrap()
            .plan_id
    };
    let db = Connection::open(&target.database).unwrap();
    db.execute("INSERT INTO sessions(id,provider_id,fixture_private_payload) VALUES('x','manual','session-fixture')", []).unwrap();
    assert!(matches!(
        apply(&state, &review(), true),
        Err(AppError::AppProviderReferenced)
    ));
    assert_eq!(
        db.query_row::<String, _, _>("SELECT provider_id FROM sessions WHERE id='x'", [], |r| r
            .get(0))
            .unwrap(),
        "manual"
    );
    assert_eq!(selection(&target), selected);
    let plan = review();
    let _disabled = state_at(root.path(), false);
    assert!(apply(&state, &plan, true).is_err());
    assert_eq!(selection(&target), selected);
    assert!(!deployment::journal_path(state.store().unwrap().path()).exists());
}

#[test]
fn restart_restores_exact_reviewed_rows_and_rejects_later_changes_or_a_forged_receipt() {
    let root = sqlite::tests::private_root();
    let target = sqlite::tests::database(&root.path().join("data.db"));
    seed(&target);
    let selected = selection(&target);
    let path = root.path().join("recovery.json");
    let write = manual::review(&target, &selected)
        .unwrap()
        .0
        .deletion()
        .unwrap();
    let original = write.resource.read().unwrap();
    let mut tx = Transaction::begin(path.clone(), "confirmed-plan", vec![write.clone()]).unwrap();
    assert!(tx.apply().is_err());
    assert!(tx.apply_checked(true, &|_| Ok(())).is_err());
    tx.permit_manual_undo().unwrap();
    tx.apply_checked(true, &|_| Ok(())).unwrap();
    drop(tx);
    let permit_path = path.with_extension("manual-delete-permit");
    let permit = std::fs::read(&permit_path).unwrap();
    assert_eq!(permit.len(), 64);
    std::fs::write(&permit_path, b"forged").unwrap();
    assert!(transaction::reviewed_manual_resource(&path)
        .unwrap()
        .is_none());
    let view = transaction::recovery_view(&path, &[]).unwrap();
    assert_eq!(view.unknown_resource_count, 1);
    assert!(transaction::recover(&path, &view.digest, &[]).is_err());
    std::fs::write(&permit_path, permit).unwrap();
    let allowed: Vec<_> = transaction::reviewed_manual_resource(&path)
        .unwrap()
        .into_iter()
        .collect();
    let db = Connection::open(&target.database).unwrap();
    db.execute(
        "INSERT INTO model_providers(id,name,type) VALUES('manual','Replacement','azure')",
        [],
    )
    .unwrap();
    let conflict = transaction::recovery_view(&path, &allowed).unwrap();
    assert_eq!(conflict.conflict_count, 1);
    assert!(transaction::recover(&path, &conflict.digest, &allowed).is_err());
    assert_eq!(
        db.query_row::<String, _, _>(
            "SELECT name FROM model_providers WHERE id='manual'",
            [],
            |r| r.get(0)
        )
        .unwrap(),
        "Replacement"
    );
    db.execute("DELETE FROM model_providers WHERE id='manual'", [])
        .unwrap();
    let ready = transaction::recovery_view(&path, &allowed).unwrap();
    transaction::recover(&path, &ready.digest, &allowed).unwrap();
    assert_eq!(write.resource.read().unwrap(), original);
    assert!(!path.exists() && !permit_path.exists());
}
