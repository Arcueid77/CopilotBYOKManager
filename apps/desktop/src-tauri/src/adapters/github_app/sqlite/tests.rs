use super::*;
use crate::{
    domain::{ApiProtocol, Connection as Provider, ModelCapabilities, ModelSpec, ProviderKind},
    transaction::{PreparedWrite, Resource, Transaction},
};
use std::{collections::BTreeMap, path::Path};

pub(crate) fn private_root() -> tempfile::TempDir {
    #[cfg(windows)]
    super::test_permissions::prepare_thread();
    let root = tempfile::tempdir().unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(root.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    root
}

pub(crate) fn provider() -> Provider {
    Provider {
        id: "fixture-connection".into(),
        name: "Fixture provider".into(),
        enabled: true,
        provider_kind: ProviderKind::Openai,
        protocol: ApiProtocol::ChatCompletions,
        base_url: "https://example.invalid/v1".into(),
        headers: BTreeMap::new(),
        models: vec![ModelSpec {
            id: "model".into(),
            model_id: "fixture-model".into(),
            name: "Fixture model".into(),
            enabled: true,
            capabilities: ModelCapabilities::default(),
        }],
        secret_ref: "connection:fixture-connection".into(),
        has_secret: false,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }
}
pub(crate) fn database(path: &Path) -> Target {
    #[cfg(windows)]
    private_directory(path.parent().unwrap());
    crate::safe_file::create_private(path).unwrap();
    let db = Connection::open(path).unwrap();
    db.execute_batch(include_str!(
        "../../../../tests/fixtures/copilot-app/schema-v1.sql"
    ))
    .unwrap();
    db.execute("INSERT INTO model_providers(id,name,type,settings_json) VALUES('manual','Foreign provider','openai','{}')",[]).unwrap();
    drop(db);
    target::fixture(path).unwrap()
}

#[cfg(windows)]
fn private_directory(path: &Path) {
    directory_acl(path, "D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;OW)");
}

#[cfg(windows)]
fn directory_acl(path: &Path, permissions: &str) {
    use std::{os::windows::ffi::OsStrExt, ptr};
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::{
            Authorization::{
                ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
            },
            SetFileSecurityW, DACL_SECURITY_INFORMATION, PROTECTED_DACL_SECURITY_INFORMATION,
        },
    };
    let mut descriptor = ptr::null_mut();
    let sddl = permissions
        .encode_utf16()
        .chain(Some(0))
        .collect::<Vec<_>>();
    assert_ne!(
        unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(),
                SDDL_REVISION_1,
                &mut descriptor,
                ptr::null_mut(),
            )
        },
        0
    );
    let path = path
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        SetFileSecurityW(
            path.as_ptr(),
            DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
            descriptor,
        )
    };
    unsafe {
        LocalFree(descriptor);
    }
    assert_ne!(result, 0);
}
fn proof(write: &PreparedWrite, p: &Provider) -> TargetOwnership {
    TargetOwnership {
        owner_id: "fixture-owner".into(),
        connection_id: p.id.clone(),
        target_id: "github-copilot-app:local".into(),
        target_kind: crate::domain::ClientKind::GithubCopilotApp,
        resource_id: ownership::resource_id(&write.resource),
        projection_fingerprint: crate::fingerprint::bytes(
            "app-owned-rows-v1",
            write.after.as_deref(),
        ),
        target_fingerprint: "0".repeat(64),
        deployed_at: chrono::Utc::now(),
    }
}
fn app(write: &PreparedWrite) -> &AppResource {
    match &write.resource {
        Resource::AppSqlite(value) => value,
        _ => panic!("App resource expected"),
    }
}

#[test]
fn migrated_vision_column_preserves_legacy_ownership_and_conditional_rollback() {
    let root = private_root();
    let old = database(&root.path().join("data.db"));
    let mut p = provider();
    let owner = "fixture-owner";
    let prepare_for = |p: &Provider, target: &Target, proofs: &[TargetOwnership], revoke| {
        prepare(p, None, owner, proofs, target, "a".repeat(64), revoke)
    };
    let (first, _) = prepare_for(&p, &old, &[], false).unwrap();
    app(&first)
        .write(None, first.after.as_deref(), false, || Ok(()))
        .unwrap();
    let old_proof = proof(&first, &p);
    let db = Connection::open(&old.database).unwrap();
    db.execute_batch(include_str!(
        "../../../../tests/fixtures/copilot-app/schema-v2-upgrade.sql"
    ))
    .unwrap();
    let mut upgraded = target::fixture(&old.database).unwrap();
    upgraded.version = "1.4.3".into();
    assert_eq!(upgraded.format, schema::Format::VisionV2);
    assert!(old.same_store(&upgraded));
    assert!(!old.same_scope(&upgraded));
    assert!(app(&first).read().is_err()); // Old plan cannot cross a format change.
    p.models[0].capabilities.vision = Some(true);
    let (next, _) = prepare_for(&p, &upgraded, std::slice::from_ref(&old_proof), false).unwrap();
    assert_eq!(
        ownership::resource_id(&next.resource),
        old_proof.resource_id
    );
    assert_eq!(next.before, first.after);
    app(&next)
        .write(next.before.as_deref(), next.after.as_deref(), false, || {
            Ok(())
        })
        .unwrap();
    assert_eq!(
        db.query_row(
            "SELECT supports_vision FROM provider_models WHERE provider_id=?1",
            [&app(&next).provider_id],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        1
    );
    let (idempotent, _) = prepare_for(&p, &upgraded, &[proof(&next, &p)], false).unwrap();
    assert_eq!(idempotent.before, idempotent.after);
    app(&next)
        .write(next.after.as_deref(), next.before.as_deref(), false, || {
            Ok(())
        })
        .unwrap();
    assert_eq!(app(&next).read().unwrap(), first.after);
    let (remove, _) = prepare_for(&p, &upgraded, &[old_proof], true).unwrap();
    app(&remove)
        .write(remove.before.as_deref(), None, true, || Ok(()))
        .unwrap();
    assert!(rows::provider_present(&db, "manual").unwrap());
    assert!(app(&remove).read().unwrap().is_none());
    db.execute_batch("ALTER TABLE provider_models ADD COLUMN future_field TEXT;")
        .unwrap();
    assert!(target::fixture(&old.database).is_err());
}

fn set_fixture_format(db: &Connection, format: schema::Format) {
    if format.has_legacy_columns() {
        db.execute_batch("PRAGMA foreign_keys=OFF; DROP TABLE sessions; DROP TABLE provider_models; DROP TABLE model_providers;").unwrap();
        db.execute_batch(include_str!(
            "../../../../tests/fixtures/copilot-app/schema-early-json.sql"
        ))
        .unwrap();
        if format.has_account() {
            db.execute_batch("ALTER TABLE model_providers ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE;").unwrap();
        }
    } else if format == schema::Format::Basic {
        db.execute_batch("ALTER TABLE provider_models DROP COLUMN supported_reasoning_efforts;")
            .unwrap();
    } else if format == schema::Format::VisionV2 {
        db.execute_batch(include_str!(
            "../../../../tests/fixtures/copilot-app/schema-v2-upgrade.sql"
        ))
        .unwrap();
    }
}

#[test]
fn manual_deletion_round_trips_each_supported_format_including_provider_and_model_options() {
    use schema::Format::*;
    for format in [
        JsonWithLegacyColumns,
        JsonWithLegacyColumnsAndAccount,
        Basic,
        V1,
        VisionV2,
    ] {
        let root = private_root();
        let path = root.path().join("data.db");
        database(&path);
        let db = Connection::open(&path).unwrap();
        set_fixture_format(&db, format);
        db.execute_batch("INSERT INTO provider_models(id,provider_id,model_id,display_name,wire_model,max_prompt_tokens,max_output_tokens,wire_api_override) VALUES('arbitrary-id','manual','model','Model','mapped',2048,1024,'responses');").unwrap();
        if format.has_legacy_columns() {
            db.execute_batch("UPDATE model_providers SET azure_api_version='2026-01-01',auth_kind='bearer_token',headers_json='{}' WHERE id='manual';").unwrap();
        }
        if format.has_efforts() {
            db.execute_batch(
                "UPDATE provider_models SET supported_reasoning_efforts='[\"high\"]';",
            )
            .unwrap();
        }
        if format == VisionV2 {
            db.execute_batch("UPDATE provider_models SET supports_vision=1;")
                .unwrap();
        }
        let target = target::fixture(&path).unwrap();
        let selection = import::observed_catalog(&target, &BTreeMap::new()).unwrap()[0]
            .manual_deletion_id
            .clone()
            .unwrap();
        let resource = manual::review(&target, &selection).unwrap().0;
        let original = resource.read().unwrap().unwrap();
        resource.write(Some(&original), None, || Ok(())).unwrap();
        assert!(resource.read().unwrap().is_none());
        resource.write(None, Some(&original), || Ok(())).unwrap();
        assert_eq!(resource.read().unwrap().unwrap(), original);
        if format.has_legacy_columns() {
            assert_eq!(
                db.query_row::<String, _, _>(
                    "SELECT azure_api_version FROM model_providers WHERE id='manual'",
                    [],
                    |r| r.get(0)
                )
                .unwrap(),
                "2026-01-01"
            );
        }
        if format == VisionV2 {
            assert_eq!(
                db.query_row::<i64, _, _>(
                    "SELECT supports_vision FROM provider_models WHERE id='arbitrary-id'",
                    [],
                    |r| r.get(0)
                )
                .unwrap(),
                1
            );
        }
    }
}

#[test]
fn earlier_json_stores_update_only_owned_rows_and_detect_divergent_legacy_columns() {
    for format in [
        schema::Format::JsonWithLegacyColumns,
        schema::Format::JsonWithLegacyColumnsAndAccount,
        schema::Format::Basic,
    ] {
        let root = private_root();
        let path = root.path().join("data.db");
        // Reuse the restrictive directory and file permissions of the v1 fixture.
        let original = database(&path);
        let db = Connection::open(&path).unwrap();
        set_fixture_format(&db, format);
        let target = target::fixture(&path).unwrap();
        assert_eq!(target.format, format);
        assert!(original.same_store(&target));
        let p = provider();
        let (write, _) = prepare(
            &p,
            Some("synthetic-only"),
            "fixture-owner",
            &[],
            &target,
            "0".repeat(64),
            false,
        )
        .unwrap();
        app(&write)
            .write(None, write.after.as_deref(), false, || Ok(()))
            .unwrap();
        assert_eq!(app(&write).read().unwrap(), write.after);
        let owned = proof(&write, &p);
        let (next, _) = prepare(
            &p,
            Some("synthetic-only"),
            "fixture-owner",
            &[owned],
            &target,
            "0".repeat(64),
            false,
        )
        .unwrap();
        assert_eq!(next.before, next.after);
        if format.has_legacy_columns() {
            db.execute(
                "UPDATE model_providers SET base_url='https://external.invalid' WHERE id=?1",
                [&app(&write).provider_id],
            )
            .unwrap();
            assert!(app(&write)
                .write(write.after.as_deref(), None, true, || Ok(()))
                .is_err());
            db.execute(
                "UPDATE model_providers SET base_url=?1 WHERE id=?2",
                [&p.base_url, &app(&write).provider_id],
            )
            .unwrap();
        }
        app(&write)
            .write(write.after.as_deref(), None, true, || Ok(()))
            .unwrap();
        assert!(app(&write).read().unwrap().is_none());
        assert!(rows::provider_present(&db, "manual").unwrap());
    }
}

#[test]
fn default_transaction_cannot_bypass_consent_and_checked_projection_is_atomic_and_idempotent() {
    let root = private_root();
    let target = database(&root.path().join("data.db"));
    let p = provider();
    let (write, _) = prepare(
        &p,
        Some("fixture-key"),
        "fixture-owner",
        &[],
        &target,
        "a".repeat(64),
        false,
    )
    .unwrap();
    let mut tx = Transaction::begin(
        root.path().join("blocked.json"),
        "blocked",
        vec![write.clone()],
    )
    .unwrap();
    assert!(tx.apply().is_err());
    tx.rollback().unwrap();
    tx.clear().unwrap();
    assert!(app(&write).read().unwrap().is_none());
    let mut tx = Transaction::begin(
        root.path().join("journal.json"),
        "checked",
        vec![write.clone()],
    )
    .unwrap();
    tx.apply_checked(false, &|_| Ok(())).unwrap();
    tx.complete().unwrap();
    let snapshot = app(&write).read().unwrap().unwrap();
    assert!(String::from_utf8(snapshot).unwrap().contains("fixture-key"));
    let (next, _) = prepare(
        &p,
        Some("fixture-key"),
        "fixture-owner",
        &[proof(&write, &p)],
        &target,
        "a".repeat(64),
        false,
    )
    .unwrap();
    assert!(!next.changed());
    let db = Connection::open(&target.database).unwrap();
    assert_eq!(
        db.query_row(
            "SELECT name FROM model_providers WHERE id='manual'",
            [],
            |r| r.get::<_, String>(0)
        )
        .unwrap(),
        "Foreign provider"
    );
}

#[test]
fn durable_proof_required_and_external_edits_never_become_a_new_baseline() {
    let root = private_root();
    let target = database(&root.path().join("data.db"));
    let p = provider();
    let (write, _) = prepare(
        &p,
        None,
        "fixture-owner",
        &[],
        &target,
        "a".repeat(64),
        false,
    )
    .unwrap();
    app(&write)
        .write(None, write.after.as_deref(), false, || Ok(()))
        .unwrap();
    assert!(prepare(
        &p,
        None,
        "fixture-owner",
        &[],
        &target,
        "a".repeat(64),
        false
    )
    .is_err());
    let db = Connection::open(&target.database).unwrap();
    db.execute(
        "UPDATE model_providers SET name='External edit' WHERE id=?1",
        [&app(&write).provider_id],
    )
    .unwrap();
    drop(db);
    assert!(prepare(
        &p,
        None,
        "fixture-owner",
        &[proof(&write, &p)],
        &target,
        "a".repeat(64),
        false
    )
    .is_err());
}

#[test]
fn foreign_key_actions_cannot_change_sessions_during_revocation_and_failed_rows_roll_back() {
    let root = private_root();
    let target = database(&root.path().join("data.db"));
    let p = provider();
    let (write, _) = prepare(
        &p,
        None,
        "fixture-owner",
        &[],
        &target,
        "a".repeat(64),
        false,
    )
    .unwrap();
    app(&write)
        .write(None, write.after.as_deref(), false, || Ok(()))
        .unwrap();
    let db = Connection::open(&target.database).unwrap();
    db.execute("INSERT INTO sessions(id,provider_id,fixture_private_payload) VALUES('s',?1,'UNRELATED PRIVATE FIXTURE')",[&app(&write).provider_id]).unwrap();
    drop(db);
    let (revoke, _) = prepare(
        &p,
        None,
        "fixture-owner",
        &[proof(&write, &p)],
        &target,
        "a".repeat(64),
        true,
    )
    .unwrap();
    assert!(app(&revoke)
        .write(revoke.before.as_deref(), None, true, || Ok(()))
        .is_err());
    assert!(app(&revoke).read().unwrap() == revoke.before);
    let db = Connection::open(&target.database).unwrap();
    let row: (String, String) = db
        .query_row(
            "SELECT provider_id,fixture_private_payload FROM sessions WHERE id='s'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(
        row,
        (
            app(&write).provider_id.clone(),
            "UNRELATED PRIVATE FIXTURE".into()
        )
    );
}

#[test]
fn consent_rechecked_inside_sqlite_transaction_and_model_removal_requires_review() {
    use std::cell::Cell;
    let root = private_root();
    let target = database(&root.path().join("data.db"));
    let p = provider();
    let (write, _) = prepare(
        &p,
        None,
        "fixture-owner",
        &[],
        &target,
        "a".repeat(64),
        false,
    )
    .unwrap();
    let calls = Cell::new(0);
    assert!(app(&write)
        .write(None, write.after.as_deref(), false, || {
            calls.set(calls.get() + 1);
            if calls.get() == 2 {
                Err(AppError::PlanChanged)
            } else {
                Ok(())
            }
        })
        .is_err());
    assert!(app(&write).read().unwrap().is_none());
    app(&write)
        .write(None, write.after.as_deref(), false, || Ok(()))
        .unwrap();
    assert!(app(&write)
        .write(write.after.as_deref(), None, false, || Ok(()))
        .is_err());
    assert!(app(&write).read().unwrap() == write.after);
}

#[test]
fn unknown_schema_missing_database_and_app_triggers_are_rejected_without_initialization() {
    let root = private_root();
    let missing = root.path().join("missing/data.db");
    assert!(target::fixture(&missing).is_err());
    assert!(!missing.exists());
    let target = database(&root.path().join("data.db"));
    let db = Connection::open(&target.database).unwrap();
    db.execute_batch(
        "CREATE TRIGGER bad AFTER INSERT ON model_providers BEGIN DELETE FROM sessions; END;",
    )
    .unwrap();
    drop(db);
    assert!(target::fixture(&target.database).is_err());
}

#[test]
fn committed_but_unacknowledged_rows_recover_after_restart_and_external_edits_block_restore() {
    let root = private_root();
    let target = database(&root.path().join("data.db"));
    let p = provider();
    let (write, _) = prepare(
        &p,
        Some("fixture-key"),
        "fixture-owner",
        &[],
        &target,
        "a".repeat(64),
        false,
    )
    .unwrap();
    let file = root.path().join("other-client.json");
    crate::safe_file::atomic_write_private(&file, b"original").unwrap();
    let other = PreparedWrite::file(&file, Some(b"new".to_vec()), false).unwrap();
    let allowed = vec![write.resource.clone(), other.resource.clone()];
    let journal = root.path().join("journal.json");
    let mut tx = Transaction::begin(
        journal.clone(),
        "interrupted",
        vec![write.clone(), other.clone()],
    )
    .unwrap();
    FAIL_ACK.with(|flag| flag.set(true));
    assert!(tx.apply_checked(false, &|_| Ok(())).is_err());
    drop(tx);
    assert_eq!(app(&write).read().unwrap(), write.after);
    assert_eq!(std::fs::read(&file).unwrap(), b"original");
    let view = crate::transaction::recovery_view(&journal, &allowed).unwrap();
    assert_eq!(view.conflict_count, 0);
    crate::transaction::recover(&journal, &view.digest, &allowed).unwrap();
    assert!(app(&write).read().unwrap().is_none());
    let mut tx =
        Transaction::begin(journal.clone(), "external", vec![write.clone(), other]).unwrap();
    FAIL_ACK.with(|flag| flag.set(true));
    assert!(tx.apply_checked(false, &|_| Ok(())).is_err());
    drop(tx);
    let db = Connection::open(&target.database).unwrap();
    db.execute(
        "UPDATE model_providers SET name='External' WHERE id=?1",
        [&app(&write).provider_id],
    )
    .unwrap();
    drop(db);
    let view = crate::transaction::recovery_view(&journal, &allowed).unwrap();
    assert!(view.conflict_count > 0);
    assert!(crate::transaction::recover(&journal, &view.digest, &allowed).is_err());
    assert_eq!(observed_source(app(&write)).unwrap().unwrap().0, "External");
    assert!(journal.exists());
}

#[test]
fn cross_target_failure_compensates_sqlite_without_overwriting_an_external_file() {
    let root = private_root();
    let target = database(&root.path().join("data.db"));
    let p = provider();
    let (write, _) = prepare(
        &p,
        None,
        "fixture-owner",
        &[],
        &target,
        "a".repeat(64),
        false,
    )
    .unwrap();
    let file = root.path().join("other.json");
    crate::safe_file::atomic_write_private(&file, b"original").unwrap();
    let other = PreparedWrite::file(&file, Some(b"new".to_vec()), false).unwrap();
    let calls = std::cell::Cell::new(0);
    let mut tx = Transaction::begin(
        root.path().join("journal"),
        "partial",
        vec![write.clone(), other],
    )
    .unwrap();
    assert!(tx
        .apply_checked(false, &|resource| {
            if matches!(resource, Resource::File(_)) {
                calls.set(calls.get() + 1);
                if calls.get() == 2 {
                    std::fs::write(&file, b"external").unwrap();
                    return Err(AppError::PlanChanged);
                }
            }
            Ok(())
        })
        .is_err());
    tx.rollback().unwrap();
    tx.clear().unwrap();
    assert!(app(&write).read().unwrap().is_none());
    assert_eq!(std::fs::read(&file).unwrap(), b"external");
}

#[test]
fn busy_database_collision_missing_key_and_oversized_owned_metadata_preserve_existing_data() {
    let root = private_root();
    let target = database(&root.path().join("data.db"));
    let mut p = provider();
    p.has_secret = true;
    assert!(prepare(
        &p,
        None,
        "fixture-owner",
        &[],
        &target,
        "a".repeat(64),
        false
    )
    .is_err());
    p.has_secret = false;
    let (write, _) = prepare(
        &p,
        None,
        "fixture-owner",
        &[],
        &target,
        "a".repeat(64),
        false,
    )
    .unwrap();
    let db = Connection::open(&target.database).unwrap();
    db.execute_batch("BEGIN IMMEDIATE;").unwrap();
    let error = app(&write)
        .write(None, write.after.as_deref(), false, || Ok(()))
        .unwrap_err();
    assert!(!error.to_string().contains("fixture-key"));
    db.execute_batch("ROLLBACK;").unwrap();
    drop(db);
    assert!(app(&write).read().unwrap().is_none());
    let desired = rows::Projection::decode(write.after.as_deref().unwrap()).unwrap();
    let db = Connection::open(&target.database).unwrap();
    db.execute("INSERT INTO provider_models(id,provider_id,model_id,display_name) VALUES(?1,'manual','foreign','Foreign')",[&desired.models[0].id]).unwrap();
    drop(db);
    assert!(prepare(
        &p,
        None,
        "fixture-owner",
        &[],
        &target,
        "a".repeat(64),
        false
    )
    .is_err());
    let db = Connection::open(&target.database).unwrap();
    db.execute("DELETE FROM provider_models WHERE provider_id='manual'", [])
        .unwrap();
    drop(db);
    app(&write)
        .write(None, write.after.as_deref(), false, || Ok(()))
        .unwrap();
    let db = Connection::open(&target.database).unwrap();
    db.execute(
        "UPDATE provider_models SET wire_model=?2 WHERE provider_id=?1",
        rusqlite::params![app(&write).provider_id, "x".repeat(513)],
    )
    .unwrap();
    drop(db);
    assert!(app(&write).read().is_err());
}

#[test]
fn unsafe_permissions_and_changed_database_identity_are_rejected() {
    let root = private_root();
    let target = database(&root.path().join("data.db"));
    #[cfg(windows)]
    {
        directory_acl(
            root.path(),
            "D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;OW)(A;OICI;FR;;;WD)",
        );
        assert!(target.verify().is_err());
        private_directory(root.path());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(root.path(), std::fs::Permissions::from_mode(0o755)).unwrap();
        assert!(target.verify().is_err());
        std::fs::set_permissions(root.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    std::fs::rename(&target.database, root.path().join("original.db")).unwrap();
    let replacement = database(&target.database);
    assert_ne!(replacement.identity, target.identity);
    assert!(target.verify().is_err());
}

#[test]
fn recovery_cannot_adopt_a_schema_contract_replaced_in_the_private_journal() {
    let root = private_root();
    let target = database(&root.path().join("data.db"));
    let p = provider();
    let (write, _) = prepare(
        &p,
        None,
        "fixture-owner",
        &[],
        &target,
        "a".repeat(64),
        false,
    )
    .unwrap();
    let journal = root.path().join("journal.json");
    let allowed = vec![write.resource.clone()];
    let mut tx =
        Transaction::begin(journal.clone(), "schema-binding", vec![write.clone()]).unwrap();
    tx.apply_checked(false, &|_| Ok(())).unwrap();
    drop(tx);
    let mut value: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&journal).unwrap()).unwrap();
    value["writes"][0]["resource"]["location"]["target"]["schema"] =
        serde_json::Value::String("f".repeat(64));
    crate::safe_file::atomic_write_private(&journal, &serde_json::to_vec(&value).unwrap()).unwrap();
    let view = crate::transaction::recovery_view(&journal, &allowed).unwrap();
    assert_eq!(view.unknown_resource_count, 1);
    assert!(crate::transaction::recover(&journal, &view.digest, &allowed).is_err());
    assert_eq!(app(&write).read().unwrap(), write.after);
}
