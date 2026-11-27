use super::{commands::*, *};
#[test]
fn sync_review_requires_an_observed_compatible_installation() {
    let status = Status::default();
    assert!(!status.review_supported);
    assert!(!status.enabled);
    assert!(status.selected_connection_ids.is_empty());
}
use crate::{
    domain::{ClientStatus, ConnectionInput},
    state::StateStore,
};

fn input(connection: &Connection) -> ConnectionInput {
    ConnectionInput {
        id: Some(connection.id.clone()),
        name: connection.name.clone(),
        base_url: connection.base_url.clone(),
        provider_kind: connection.provider_kind,
        protocol: connection.protocol,
        headers: connection.headers.clone(),
        models: connection.models.clone(),
        api_key: None,
        clear_secret: false,
    }
}

#[test]
fn a_fresh_install_can_wait_across_restart_and_only_sync_a_later_confirmed_provider() {
    crate::secrets::with_fake_credentials(|| {
        let root = sqlite::tests::private_root();
        let path = root.path().join("state.json");
        let app_db = root.path().join("data.db");
        let open = || {
            ManagedState::new(
                StateStore::open_at(path.clone()),
                crate::account::LoginStore::open_at(root.path().join("login.json")),
                crate::github_auth::GithubAuthorizationStore::isolated(
                    root.path().join("github.json"),
                ),
                None,
                None,
            )
        };
        let state = open();
        let owner = state.store().unwrap().installation_owner_id().to_owned();
        let installed = || Ok("1.4.3".to_owned());
        assert!(enable_waiting(&state, 1, installed).is_err());
        assert!(!path.exists());
        let status = enable_waiting(&state, 0, installed).unwrap();
        assert!(status.enabled && status.review_supported);
        assert_eq!(status.phase, Phase::WaitingForProviders);
        assert!(status.selected_connection_ids.is_empty());
        assert!(status.database_path.is_none());
        assert!(path.is_file());
        let revision = state.app_sync.snapshot().unwrap().revision().unwrap();
        enable_waiting(&state, 0, installed).unwrap();
        assert_eq!(
            state.app_sync.snapshot().unwrap().revision().unwrap(),
            revision
        );
        drop(state);

        let mut state = open();
        assert_eq!(state.store().unwrap().installation_owner_id(), owner);
        assert!(state.app_sync.snapshot().unwrap().waiting_for_providers());
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert!(!app_db.exists());
        let mut draft = input(&sqlite::tests::provider());
        draft.id = None;
        let added = state
            .store()
            .unwrap()
            .upsert_connection(draft.clone())
            .unwrap();
        draft.name = "Other provider".into();
        let other = state.store().unwrap().upsert_connection(draft).unwrap();
        state.test_targets = Some(vec![ClientTarget {
            id: TARGET_ID.into(),
            kind: ClientKind::GithubCopilotApp,
            name: "Fixture".into(),
            path: None,
            detail: String::new(),
            detected: true,
            supports_write: false,
            status: ClientStatus::ReadOnly,
            diagnostic: None,
        }]);
        state.app_sync.schedule();
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert!(state.app_sync.approval(&added, false).unwrap().is_none());
        assert_eq!(
            state.app_sync.status(&state).unwrap().phase,
            Phase::WaitingForProviders
        );
        assert!(state.store().unwrap().ownership().is_empty());
        assert!(!app_db.exists());

        let target = sqlite::tests::database(&app_db);
        let ids = vec![added.id.clone()];
        let abandoned = preview_enable(&state, ids.clone(), || Ok(target.clone())).unwrap();
        assert!(enable(&state, abandoned.id, false, || Ok(target.clone())).is_err());
        assert!(state.app_sync.snapshot().unwrap().waiting_for_providers());
        approve(&state, &target, ids);
        assert!(enable_waiting(&state, 0, installed).is_err());
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert!(scoped(&state, &target, &added.id).read().unwrap().is_some());
        assert!(scoped(&state, &target, &other.id).read().unwrap().is_none());
        state
            .app_sync
            .stop_scope_for_revoke(&added.id, &target)
            .unwrap();
        let waiting = state.app_sync.snapshot().unwrap();
        assert!(waiting.waiting_for_providers());
        assert!(waiting.granted_at.is_none());
        assert!(waiting.recovery_ids.contains(&added.id));
        assert!(state.app_sync.approval(&added, false).unwrap().is_none());
    });
}
fn fixture() -> (tempfile::TempDir, ManagedState, Target, Vec<Connection>) {
    let root = sqlite::tests::private_root();
    let target = sqlite::tests::database(&root.path().join("data.db"));
    let mut store = StateStore::open_at(root.path().join("state.json"));
    let mut template = input(&sqlite::tests::provider());
    template.id = None;
    template.api_key = Some("SYNTHETIC-SELECTED-KEY".into());
    let first = store.upsert_connection(template.clone()).unwrap();
    template.name = "Other provider".into();
    let second = store.upsert_connection(template).unwrap();
    let mut state = ManagedState::new(
        store,
        crate::account::LoginStore::open_at(root.path().join("login.json")),
        crate::github_auth::GithubAuthorizationStore::isolated(root.path().join("github.json")),
        None,
        None,
    );
    state.test_targets = Some(vec![ClientTarget {
        id: TARGET_ID.into(),
        kind: ClientKind::GithubCopilotApp,
        name: "Fixture App".into(),
        path: None,
        detail: "Fixture".into(),
        detected: true,
        supports_write: false,
        status: ClientStatus::ReadOnly,
        diagnostic: None,
    }]);
    (root, state, target, vec![first, second])
}
fn approve(state: &ManagedState, target: &Target, ids: Vec<String>) {
    let preview = preview_enable(state, ids, || Ok(target.clone())).unwrap();
    let public = serde_json::to_string(&preview).unwrap();
    assert!(!public.contains("SYNTHETIC-SELECTED-KEY"));
    assert_eq!(
        enable(state, preview.id, true, || Ok(target.clone()))
            .unwrap()
            .phase,
        Phase::PendingSync
    );
}
fn scoped(state: &ManagedState, target: &Target, id: &str) -> sqlite::AppResource {
    sqlite::resource(
        target,
        state.store().unwrap().installation_owner_id(),
        id,
        "0".repeat(64),
        false,
    )
    .unwrap()
}

#[test]
fn default_off_cancel_one_shot_expiry_stale_state_and_disable_invalidate_enablement() {
    crate::secrets::with_fake_credentials(|| {
        let (root, state, target, connections) = fixture();
        let ids = vec![connections[0].id.clone()];
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert!(scoped(&state, &target, &ids[0]).read().unwrap().is_none());
        let abandoned = preview_enable(&state, ids.clone(), || Ok(target.clone())).unwrap();
        assert!(!root.path().join("app-sync.json").exists());
        assert!(enable(&state, abandoned.id.clone(), false, || Ok(target.clone())).is_err());
        assert!(enable(&state, abandoned.id, true, || Ok(target.clone())).is_err());
        let expired = preview_enable(&state, ids.clone(), || Ok(target.clone())).unwrap();
        state
            .app_sync
            .plans
            .lock()
            .unwrap()
            .get_mut(&expired.id)
            .unwrap()
            .expires = Instant::now();
        assert!(enable(&state, expired.id, true, || Ok(target.clone())).is_err());
        let stale = preview_enable(&state, ids.clone(), || Ok(target.clone())).unwrap();
        let mut edited = input(&connections[0]);
        edited.name = "Saved later".into();
        state.store().unwrap().upsert_connection(edited).unwrap();
        assert!(enable(&state, stale.id, true, || Ok(target.clone())).is_err());
        let disabled = preview_enable(&state, ids, || Ok(target.clone())).unwrap();
        state.app_sync.settings_epoch.fetch_add(1, Ordering::AcqRel);
        state.app_sync.cancelled.store(true, Ordering::Release);
        assert!(enable(&state, disabled.id, true, || Ok(target.clone())).is_err());
        assert!(!state.app_sync.snapshot().unwrap().enabled);
        assert!(!root.path().join("app-sync.json").exists());
    });
}

#[test]
fn saved_selected_providers_sync_through_native_plans_and_coalesce_without_adopting_foreign_rows() {
    crate::secrets::with_fake_credentials(|| {
        let (root, state, target, connections) = fixture();
        let selected = &connections[0];
        approve(&state, &target, vec![selected.id.clone()]);
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert_eq!(
            sqlite::observed_source(&scoped(&state, &target, &selected.id))
                .unwrap()
                .unwrap()
                .1,
            1
        );
        assert!(scoped(&state, &target, &connections[1].id)
            .read()
            .unwrap()
            .is_none());
        assert_eq!(state.store().unwrap().deployments().len(), 1);
        for model in ["intermediate", "latest"] {
            let mut change = input(selected);
            change.models[0].model_id = model.into();
            change.models[0].id = model.into();
            // Adding models is automatic; removal is deliberately reviewed below.
            change.models.insert(0, selected.models[0].clone());
            state.store().unwrap().upsert_connection(change).unwrap();
            state.app_sync.schedule();
        }
        assert!(*state.app_sync.signal.0.lock().unwrap());
        super::worker::run_once(&state.app_sync, &state).unwrap();
        let bytes = scoped(&state, &target, &selected.id)
            .read()
            .unwrap()
            .unwrap();
        let text = String::from_utf8(bytes).unwrap();
        assert!(text.contains("latest"));
        assert!(!text.contains("intermediate"));
        assert_eq!(state.store().unwrap().deployments().len(), 2);
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert_eq!(state.store().unwrap().deployments().len(), 2);
        let record = state.app_sync.snapshot().unwrap();
        assert!(!serde_json::to_string(&record)
            .unwrap()
            .contains("SYNTHETIC-SELECTED-KEY"));
        assert!(!std::fs::read_to_string(root.path().join("state.json"))
            .unwrap()
            .contains("SYNTHETIC-SELECTED-KEY"));
        assert!(!root.path().join("deployment-journal.json").exists());
        let owner = state.store().unwrap().installation_owner_id().to_string();
        assert!(
            consent::Store::open(&root.path().join("state.json"), &owner)
                .snapshot()
                .unwrap()
                .enabled
        );
    });
}

#[test]
fn destination_scope_change_missing_key_model_removal_and_disable_never_silently_write() {
    crate::secrets::with_fake_credentials(|| {
        let (_root, state, target, connections) = fixture();
        let selected = &connections[0];
        approve(&state, &target, vec![selected.id.clone()]);
        super::worker::run_once(&state.app_sync, &state).unwrap();
        let resource = scoped(&state, &target, &selected.id);
        let before = resource.read().unwrap();
        let mut edit = input(selected);
        edit.models[0].enabled = false;
        state.store().unwrap().upsert_connection(edit).unwrap();
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert_eq!(resource.read().unwrap(), before);
        let targets = super::targets(&state);
        let connection = state.store().unwrap().connection(&selected.id).unwrap();
        let approval = state.app_sync.approval(&connection, false).unwrap();
        let store = state.store().unwrap();
        let context = crate::deployment::PlanContext::new(
            store.installation_owner_id(),
            store.revision().unwrap(),
            Some("SYNTHETIC-SELECTED-KEY"),
        )
        .with_ownership(store.ownership())
        .with_app(approval);
        drop(store);
        let plan =
            crate::adapters::preview_resolved(&connection, &[TARGET_ID.into()], &targets).unwrap();
        let plan = state
            .plans()
            .unwrap()
            .insert(
                &connection,
                Some("SYNTHETIC-SELECTED-KEY"),
                plan,
                &targets,
                context,
            )
            .unwrap();
        assert_eq!(
            plan.app_model_removals,
            vec![selected.models[0].model_id.clone()]
        );
        let stored = state.plans().unwrap().consume(&plan.id).unwrap();
        assert!(crate::commands::execute_stored_plan(&state, stored, Default::default()).is_err());
        assert_eq!(resource.read().unwrap(), before);
        let mut edit = input(selected);
        edit.base_url = "https://different.invalid/v1".into();
        state.store().unwrap().upsert_connection(edit).unwrap();
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert_eq!(
            state.app_sync.status(&state).unwrap().phase,
            Phase::ConsentRequired
        );
        assert_eq!(resource.read().unwrap(), before);
        state.app_sync.cancelled.store(true, Ordering::Release);
        state.app_sync.mode.lock().unwrap().disable().unwrap();
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert_eq!(
            state.app_sync.status(&state).unwrap().phase,
            Phase::Disabled
        );
        assert_eq!(resource.read().unwrap(), before);
    });
}

#[test]
fn saved_multi_provider_sync_survives_restart_and_disabled_revocation_keeps_manager_provider() {
    crate::secrets::with_fake_credentials(|| {
        let (_root, state, target, connections) = fixture();
        approve(
            &state,
            &target,
            connections.iter().map(|c| c.id.clone()).collect(),
        );
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert_eq!(state.store().unwrap().ownership().len(), 2);
        state.app_sync.cancelled.store(true, Ordering::Release);
        state.app_sync.mode.lock().unwrap().disable().unwrap();
        let connection = &connections[0];
        let approval = state.app_sync.approval(connection, true).unwrap();
        let targets = super::targets(&state);
        let store = state.store().unwrap();
        let context = crate::deployment::PlanContext::new(
            store.installation_owner_id(),
            store.revision().unwrap(),
            None,
        )
        .with_ownership(store.ownership())
        .with_app(approval);
        drop(store);
        let mut plan =
            crate::adapters::preview_revoke_resolved(connection, &[TARGET_ID.into()], &targets)
                .unwrap();
        plan.purpose = DeploymentPurpose::RevokeApp;
        let plan = state
            .plans()
            .unwrap()
            .insert(connection, None, plan, &targets, context)
            .unwrap();
        let stored = state.plans().unwrap().consume(&plan.id).unwrap();
        let result = crate::commands::execute_stored_plan(
            &state,
            stored,
            crate::commands::AppWriteConfirmations {
                model_references_resolved: true,
                ..Default::default()
            },
        )
        .unwrap();
        assert!(!result.connection_deleted);
        assert!(result
            .records
            .iter()
            .all(|r| r.status == crate::domain::DeploymentStatus::Applied));
        assert!(state.store().unwrap().connection(&connection.id).is_ok());
        assert!(scoped(&state, &target, &connection.id)
            .read()
            .unwrap()
            .is_none());
        assert!(scoped(&state, &target, &connections[1].id)
            .read()
            .unwrap()
            .is_some());
        let path = state.store().unwrap().path().to_path_buf();
        let reopened = StateStore::open_at(path.clone());
        assert!(reopened.recovery().is_none());
        assert_eq!(reopened.ownership().len(), 1);
        let restarted = Jobs::new(&path, reopened.installation_owner_id());
        assert!(!restarted.snapshot().unwrap().enabled);
        assert_eq!(restarted.recovery_resources().unwrap().len(), 2);
    });
}

#[test]
fn app_running_waits_without_writes_and_conflicts_require_reconciliation_before_new_saves() {
    crate::secrets::with_fake_credentials(|| {
        let (_root, state, target, connections) = fixture();
        let connection = &connections[0];
        approve(&state, &target, vec![connection.id.clone()]);
        sqlite::target::TEST_RUNNING.with(|flag| flag.set(true));
        let result = super::worker::run_once(&state.app_sync, &state);
        let reviewed =
            crate::commands::review_publication(&state, &connection.id, &[TARGET_ID.into()]);
        sqlite::target::TEST_RUNNING.with(|flag| flag.set(false));
        result.unwrap();
        let plan = reviewed.unwrap();
        assert_eq!(
            plan.operations[0].blocker,
            Some(crate::domain::DeploymentBlocker::ClientRunning)
        );
        assert!(!plan.operations[0].supported);
        assert!(state
            .plans()
            .unwrap()
            .consume(&plan.id)
            .unwrap()
            .writes
            .is_empty());
        assert_eq!(
            state.app_sync.status(&state).unwrap().phase,
            Phase::PendingAppExit
        );
        assert!(scoped(&state, &target, &connection.id)
            .read()
            .unwrap()
            .is_none());
        super::worker::run_once(&state.app_sync, &state).unwrap();
        let resource = scoped(&state, &target, &connection.id);
        let db = rusqlite::Connection::open(&target.database).unwrap();
        db.execute(
            "UPDATE model_providers SET name='Foreign edit' WHERE id=?1",
            [&resource.provider_id],
        )
        .unwrap();
        drop(db);
        let mut change = input(connection);
        change.name = "Saved change".into();
        state.store().unwrap().upsert_connection(change).unwrap();
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert!(state.app_sync.halted.load(Ordering::Acquire));
        state.app_sync.schedule();
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert_eq!(
            sqlite::observed_source(&resource).unwrap().unwrap().0,
            "Foreign edit"
        );
        let store = state.store().unwrap();
        assert!(sqlite::check_owned(
            &target,
            store.installation_owner_id(),
            &connection.id,
            store.ownership()
        )
        .is_err());
    });
}

#[test]
fn managed_write_contention_is_not_reported_as_a_running_app() {
    crate::secrets::with_fake_credentials(|| {
        let (_root, state, target, connections) = fixture();
        approve(&state, &target, vec![connections[0].id.clone()]);
        let lease = crate::write_lock::WriteLock::acquire(state.store().unwrap().path()).unwrap();
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert_eq!(
            state.app_sync.status(&state).unwrap().phase,
            Phase::Conflict
        );
        assert!(state.app_sync.halted.load(Ordering::Acquire));
        assert!(scoped(&state, &target, &connections[0].id)
            .read()
            .unwrap()
            .is_none());
        drop(lease);
    });
}

#[test]
fn a_client_upgrade_invalidates_an_open_enable_plan_but_keeps_the_same_approved_store() {
    crate::secrets::with_fake_credentials(|| {
        let (_root, state, old, connections) = fixture();
        let id = connections[0].id.clone();
        let preview = preview_enable(&state, vec![id.clone()], || Ok(old.clone())).unwrap();
        let mut upgraded = old.clone();
        upgraded.version = "1.4.3".into();
        upgraded.build_sha256 = Some("a".repeat(64));
        assert!(old.same_scope(&upgraded));
        assert!(matches!(
            enable(&state, preview.id, true, || Ok(upgraded.clone())),
            Err(AppError::PlanChanged)
        ));
        assert!(!state.app_sync.snapshot().unwrap().enabled);
        approve(&state, &old, vec![id]);
        assert!(state
            .app_sync
            .snapshot()
            .unwrap()
            .approve(&connections[0], &upgraded)
            .is_ok());
        upgraded.schema = "b".repeat(64);
        assert!(state
            .app_sync
            .snapshot()
            .unwrap()
            .approve(&connections[0], &upgraded)
            .is_err());
    });
}

#[test]
fn enabled_app_uses_normal_publication_for_an_unscoped_provider() {
    crate::secrets::with_fake_credentials(|| {
        let (_root, state, app, connections) = fixture();
        let first = &connections[0];
        let second = &connections[1];
        let ids = [TARGET_ID.to_owned()];
        let review = || crate::commands::review_publication(&state, &second.id, &ids);
        let apply = |plan_id, consent| {
            crate::commands::apply_reviewed_publication(
                &state,
                plan_id,
                true,
                crate::commands::AppWriteConfirmations {
                    scope_confirmed: consent,
                    ..Default::default()
                },
            )
        };
        assert!(!review().unwrap().operations[0].supported);
        approve(&state, &app, vec![first.id.clone()]);
        assert!(!state
            .app_sync
            .snapshot()
            .unwrap()
            .scopes
            .contains_key(&second.id));
        let plan = review().unwrap();
        assert!(plan.operations[0].supported && plan.app_scope_confirmation);
        let second_resource = scoped(&state, &app, &second.id);
        assert!(second_resource.read().unwrap().is_none());
        assert!(apply(&plan.id, false).is_err());
        assert!(apply(&plan.id, true).is_err());
        assert!(!state
            .app_sync
            .snapshot()
            .unwrap()
            .scopes
            .contains_key(&second.id));
        let plan = review().unwrap();
        let result = apply(&plan.id, true).unwrap();
        assert_eq!(
            result.records[0].status,
            crate::domain::DeploymentStatus::Applied
        );
        assert!(second_resource.read().unwrap().is_some());
        let mode = state.app_sync.snapshot().unwrap();
        assert!(mode.scopes.contains_key(&first.id));
        assert!(mode.approve(second, &app).is_ok());
        assert!(!review().unwrap().app_scope_confirmation);
    });
}

#[test]
fn manual_deletion_requires_a_fresh_confirmed_publication_to_recreate_the_provider() {
    crate::secrets::with_fake_credentials(|| {
        let (_root, state, target, connections) = fixture();
        let c = &connections[0];
        approve(&state, &target, vec![c.id.clone()]);
        super::commands::synchronize(&state, &c.id).unwrap();
        let resource = scoped(&state, &target, &c.id);
        let provider_id = resource.provider_id.as_str();
        let open = || rusqlite::Connection::open(&target.database).unwrap();
        {
            let db = open();
            db.execute_batch("PRAGMA foreign_keys=ON").unwrap();
            db.execute(
                "UPDATE model_providers SET name=?1 WHERE id='manual'",
                [&c.name],
            )
            .unwrap();
            db.execute("INSERT INTO provider_models(id,provider_id,model_id,display_name) VALUES('manual-one','manual','manual-one','Manual model')", []).unwrap();
            db.execute("DELETE FROM model_providers WHERE id=?1", [provider_id])
                .unwrap();
        }
        assert!(resource.read().unwrap().is_none());
        super::worker::run_once(&state.app_sync, &state).unwrap();
        assert_eq!(
            state.app_sync.status(&state).unwrap().phase,
            Phase::ReviewRequired
        );
        assert!(resource.read().unwrap().is_none());

        let review = || crate::commands::review_publication(&state, &c.id, &[TARGET_ID.into()]);
        let apply = |id: &str, recreate| {
            crate::commands::apply_reviewed_publication(
                &state,
                id,
                true,
                crate::commands::AppWriteConfirmations {
                    recreation_confirmed: recreate,
                    ..Default::default()
                },
            )
        };
        let plan = review().unwrap();
        assert!(plan.operations[0].supported && plan.app_recreates_provider);
        assert!(!plan.app_scope_confirmation);
        assert!(matches!(
            apply(&plan.id, false),
            Err(AppError::AppProviderRemoved)
        ));
        assert!(matches!(
            apply(&plan.id, true),
            Err(AppError::PlanUnavailable)
        ));
        assert!(resource.read().unwrap().is_none());

        // A provider that appears after preview cannot be replaced by the reviewed insert.
        let stale = review().unwrap();
        open().execute("INSERT INTO model_providers(id,name,type,settings_json) VALUES(?1,'Intervening provider','openai','{}')", [provider_id]).unwrap();
        assert!(apply(&stale.id, true).is_err());
        let db = open();
        assert_eq!(
            db.query_row(
                "SELECT name FROM model_providers WHERE id=?1",
                [provider_id],
                |row| row.get::<_, String>(0)
            )
            .unwrap(),
            "Intervening provider"
        );
        db.execute("DELETE FROM model_providers WHERE id=?1", [provider_id])
            .unwrap();
        drop(db);

        // An incomplete external delete is a conflict both before and after review.
        let stale = review().unwrap();
        let db = open();
        db.execute_batch("PRAGMA foreign_keys=OFF").unwrap();
        db.execute("INSERT INTO provider_models(id,provider_id,model_id,display_name) VALUES('orphan',?1,'foreign','Foreign')", [provider_id]).unwrap();
        drop(db);
        assert!(apply(&stale.id, true).is_err());
        assert!(review().is_err());
        assert_eq!(
            open()
                .execute("DELETE FROM provider_models WHERE id='orphan'", [])
                .unwrap(),
            1
        );

        let result = apply(&review().unwrap().id, true).unwrap();
        assert_eq!(
            result.records[0].status,
            crate::domain::DeploymentStatus::Applied
        );
        assert!(!review().unwrap().app_recreates_provider);
        assert!(!state.app_sync.halted.load(Ordering::Acquire));
        let db = open();
        let actual: u32 = db
            .query_row(
                "SELECT count(*) FROM provider_models WHERE provider_id=?1",
                [provider_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(actual as usize, c.enabled_models().count());
        let manual: u32 = db.query_row("SELECT count(*) FROM provider_models m JOIN model_providers p ON p.id=m.provider_id WHERE p.id='manual' AND p.name=?1 AND m.id='manual-one'", [&c.name], |row| row.get(0)).unwrap();
        assert_eq!(manual, 1);
        let store = state.store().unwrap();
        sqlite::check_owned(
            &target,
            store.installation_owner_id(),
            &c.id,
            store.ownership(),
        )
        .unwrap();
        assert!(!crate::deployment::recovery_required(store.path()));
    });
}

#[test]
fn enabled_empty_scope_lists_app_as_ready_and_a_stale_confirmation_cannot_establish_it() {
    crate::secrets::with_fake_credentials(|| {
        let (_root, state, app, connections) = fixture();
        enable_waiting(&state, 0, || Ok(app.version.clone())).unwrap();
        // An inert reviewed target stands in for the installation on all test runners.
        let mut settings = state.app_sync.mode.lock().unwrap();
        let mut waiting = settings.snapshot().unwrap();
        waiting.target = Some(app.clone());
        settings.save(waiting).unwrap();
        drop(settings);
        let c = &connections[0];
        let ids = [TARGET_ID.to_owned()];
        assert!(super::publication_targets(&state, &ids)[0].supports_write);
        let plan = crate::commands::review_publication(&state, &c.id, &ids).unwrap();
        assert!(plan.app_scope_confirmation);
        state.app_sync.settings_epoch.fetch_add(1, Ordering::AcqRel);
        assert!(matches!(
            crate::commands::apply_reviewed_publication(
                &state,
                &plan.id,
                true,
                crate::commands::AppWriteConfirmations {
                    scope_confirmed: true,
                    ..Default::default()
                }
            ),
            Err(AppError::PlanChanged)
        ));
        assert!(scoped(&state, &app, &c.id).read().unwrap().is_none());
        assert!(state.app_sync.snapshot().unwrap().scopes.is_empty());
        let plan = crate::commands::review_publication(&state, &c.id, &ids).unwrap();
        let published = crate::commands::apply_reviewed_publication(
            &state,
            &plan.id,
            true,
            crate::commands::AppWriteConfirmations {
                scope_confirmed: true,
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(
            published.records[0].status,
            crate::domain::DeploymentStatus::Applied
        );
        assert!(state.app_sync.snapshot().unwrap().approve(c, &app).is_ok());
    });
}
