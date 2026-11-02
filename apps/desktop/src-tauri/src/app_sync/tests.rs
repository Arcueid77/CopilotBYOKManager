use super::{commands::*, *};
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
        assert!(crate::commands::execute_stored_plan(&state, stored, false).is_err());
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
        let result = crate::commands::execute_stored_plan(&state, stored, true).unwrap();
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
        sqlite::target::TEST_RUNNING.with(|flag| flag.set(false));
        result.unwrap();
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
