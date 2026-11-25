use super::*;
use crate::{
    adapters::{copilot_cli, jetbrains, vscode},
    domain::{ApiProtocol, ModelCapabilities, ProviderKind},
    state::StateStore,
};
use catalog::{Candidates, ModelFields};
use serde_json::json;
use std::fs;
use std::path::Path;

fn managed(root: &Path) -> ManagedState {
    ManagedState::new(
        StateStore::open_at(root.join("state.json")),
        crate::account::LoginStore::open_at(root.join("login.json")),
        crate::github_auth::GithubAuthorizationStore::isolated(root.join("auth.json")),
        None,
        None,
    )
}

fn hints(name: &str, url: &str, api: ApiProtocol, ids: &[&str]) -> Catalog {
    let mut result = Catalog::default();
    for id in ids {
        result
            .add(
                ModelFields {
                    provider: name,
                    endpoint: url,
                    protocol: Some(api),
                    kind: None,
                    id,
                    name: id,
                    api_key: None,
                    caps: Default::default(),
                },
                |_| false,
            )
            .unwrap();
    }
    result
}

#[test]
fn extraction_actions_only_appear_for_sources_with_savable_models() {
    let url = "https://example.invalid/v1";
    let api = ApiProtocol::Responses;
    let from_vscode = || {
        hints(
            "Renamed provider",
            "https://EXAMPLE.invalid:443/v1/responses",
            api,
            &["MODEL-A"],
        )
    };
    let from_jetbrains = || hints("Gateway", url, api, &["model-a", "model-b"]);
    let vscode = ["vscode:a".into()];
    let jetbrains = ["jetbrains:a".into(), "jetbrains:b".into()];
    let visibility = |saved: &[Connection]| {
        let result = scan::compare_sources(saved, |visit| {
            visit(from_vscode(), &vscode)?;
            visit(from_jetbrains(), &jetbrains)?;
            Ok(vec![])
        })
        .unwrap();
        serde_json::to_value(result).unwrap()
    };

    let mut candidates = Candidates::default();
    candidates.include(from_vscode(), &vscode).unwrap();
    let mut saved = Vec::new();
    merge_selected(&mut saved, &candidates.finish(&[])).unwrap();
    assert_eq!(
        visibility(&saved),
        json!({"targetIds": ["jetbrains:a", "jetbrains:b"], "batch": true})
    );

    let mut candidates = Candidates::default();
    candidates.include(from_vscode(), &vscode).unwrap();
    candidates.include(from_jetbrains(), &jetbrains).unwrap();
    let rows = candidates.finish(&saved);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].action, Action::Extend);
    assert_eq!(rows[0].new_models, 1);
    merge_selected(&mut saved, &rows).unwrap();
    assert_eq!(saved.len(), 1);
    assert_eq!(visibility(&saved), json!({"targetIds": [], "batch": false}));

    let mut retry = Candidates::default();
    retry.include(from_jetbrains(), &jetbrains).unwrap();
    let mut reviews = Reviews::default();
    let preview = reviews
        .present(
            scan::Scanned {
                candidates: retry.finish(&saved),
                issues: vec![],
            },
            "fixture".into(),
        )
        .unwrap();
    assert!(preview.candidates.is_empty());
}

#[test]
fn metadata_only_import_merges_models_without_saving_keys_or_client_ids() {
    let root = tempfile::tempdir().unwrap();
    let vscode_file = root.path().join("chatLanguageModels.json");
    let jb_file = root.path().join("byok.json");
    let key = "SYNTHETIC-ONLY-PRIVATE-KEY";
    fs::write(&vscode_file,serde_json::to_vec(&json!([{"vendor":"customendpoint","name":"MiniMax","apiType":"responses","apiKey":key,"copilotByokManagerConnectionId":"foreign",
        "models":[{"id":"model-a","name":"A","url":"https://EXAMPLE.invalid:443/v1/responses","requestHeaders":{"Authorization":format!("Bearer {key}")}}]}])).unwrap()).unwrap();
    fs::write(&jb_file,serde_json::to_vec(&json!({"external-api-key":key,"external-provider-config":{"groupName":"MiniMax","apiType":"responses"},
        "external-models-config":{"model-a":{"deploymentUrl":"https://example.invalid/v1/","modelCapabilities":{"name":"A"}},"model-b":{"deploymentUrl":"https://example.invalid/v1","modelCapabilities":{"name":"B"}}}})).unwrap()).unwrap();
    let original = fs::read(&vscode_file).unwrap();
    let mut results = Candidates::default();
    results
        .include(
            vscode::import_catalog(&vscode_file, false).unwrap(),
            &["vscode:a".into()],
        )
        .unwrap();
    results
        .include(
            jetbrains::byok::import_catalog(&jb_file, false).unwrap(),
            &["jetbrains:b".into()],
        )
        .unwrap();
    let rows = results.finish(&[]);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].provider.models.len(), 2);
    assert_eq!(rows[0].source_ids.len(), 2);
    assert_eq!(rows[0].key_status, Some(credential::KeyStatus::Available));
    assert!(rows[0].key_material().is_none());
    assert!(!serde_json::to_string(&rows).unwrap().contains(key));
    let path = root.path().join("state.json");
    let mut store = StateStore::open_at(path.clone());
    let revision = store.revision().unwrap();
    assert_eq!(
        store
            .import_providers(&revision, &rows, false)
            .unwrap()
            .created,
        1
    );
    let saved = &store.connections()[0];
    assert_eq!(saved.name, "MiniMax");
    assert_eq!(saved.base_url, "https://example.invalid/v1");
    assert_ne!(saved.id, "foreign");
    assert!(!saved.has_secret);
    assert!(saved.headers.is_empty());
    assert!(!fs::read_to_string(&path).unwrap().contains(key));
    assert_eq!(fs::read(&vscode_file).unwrap(), original);
    assert!(store.import_providers(&revision, &rows, false).is_err());
    let reopened = StateStore::open_at(path);
    let mut repeat = Candidates::default();
    repeat
        .include(
            jetbrains::byok::import_catalog(&jb_file, false).unwrap(),
            &["jetbrains:b".into()],
        )
        .unwrap();
    assert_eq!(
        repeat.finish(reopened.connections())[0].action,
        Action::FillKey
    );
}

#[test]
fn endpoint_and_protocol_separate_names_and_review_rejects_forged_replayed_or_expired_selections() {
    let mut results = Candidates::default();
    for (url, api) in [
        ("https://one.invalid/v1", ApiProtocol::Responses),
        ("https://two.invalid/v1", ApiProtocol::Responses),
        ("https://one.invalid/v1", ApiProtocol::Messages),
    ] {
        results
            .include(hints("Same", url, api, &["x"]), &["vscode:a".into()])
            .unwrap();
    }
    let rows = results.finish(&[]);
    assert_eq!(rows.len(), 3);
    let mut reviews = Reviews::default();
    let make = || scan::Scanned {
        candidates: rows.clone(),
        issues: vec![],
    };
    let first = reviews.present(make(), "r".into()).unwrap();
    let picked = vec![rows[1].id.clone()];
    let (_, selected) = reviews.take(&first.plan_id, &picked).unwrap();
    let mut connections = vec![];
    merge_selected(&mut connections, &selected).unwrap();
    assert_eq!(connections.len(), 1);
    assert_eq!(connections[0].base_url, rows[1].provider.base_url);
    assert!(reviews.take(&first.plan_id, &picked).is_err());
    let second = reviews.present(make(), "r".into()).unwrap();
    assert!(reviews.take(&second.plan_id, &["0".repeat(64)]).is_err());
    let third = reviews.present(make(), "r".into()).unwrap();
    reviews.0.get_mut(&third.plan_id).unwrap().expires = Instant::now();
    assert!(reviews.take(&third.plan_id, &picked).is_err());
}

#[test]
fn extending_preserves_saved_key_headers_paused_models_and_existing_default() {
    let mut pool = Candidates::default();
    pool.include(
        hints(
            "Original",
            "https://demo.invalid/v1",
            ApiProtocol::Responses,
            &["first"],
        ),
        &["cli".into()],
    )
    .unwrap();
    let mut connections = vec![];
    merge_selected(&mut connections, &pool.finish(&[])).unwrap();
    connections[0].has_secret = true;
    connections[0].enabled = false;
    connections[0]
        .headers
        .insert("Authorization".into(), "Bearer ${apiKey}".into());
    connections[0].models[0].enabled = false;
    let old = connections[0].clone();
    let fresh = || {
        let mut pool = Candidates::default();
        pool.include(
            hints(
                "Other name",
                "https://DEMO.invalid/v1/",
                ApiProtocol::Responses,
                &["FIRST", "new"],
            ),
            &["jb".into()],
        )
        .unwrap();
        pool
    };
    let rows = fresh().finish(&connections);
    assert_eq!(rows[0].action, Action::Extend);
    assert_eq!(rows[0].new_models, 1);
    assert_eq!(merge_selected(&mut connections, &rows).unwrap().updated, 1);
    let saved = &connections[0];
    assert_eq!(saved.name, old.name);
    assert_eq!(saved.models[0], old.models[0]);
    assert!(saved.has_secret);
    assert_eq!(saved.secret_ref, old.secret_ref);
    assert_eq!(saved.headers, old.headers);
    assert!(!saved.enabled);
    assert_eq!(saved.models.len(), 2);
    let mut other = old.clone();
    other.id = Uuid::new_v4().to_string();
    connections.push(other);
    assert_eq!(fresh().finish(&connections)[0].action, Action::Ambiguous);
}

#[test]
fn cli_extracts_the_wire_identity_and_discards_sensitive_routes_and_header_aliases() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("providers.json");
    let data = json!({"providers":[{"name":"fixture","type":"openai","wireApi":"responses","baseUrl":"https://one.invalid/v1","apiKey":"FAKE-KEY-ONE","headers":{"X-Secret":"FAKE-HEADER-VALUE"}}],
        "models":[{"id":"alias","provider":"fixture","wireModel":"wire-name","name":"FAKE-HEADER-VALUE"},{"id":"bad","provider":"fixture","wireModel":"FAKE-KEY-ONE"}]});
    fs::write(&path, serde_json::to_vec(&data).unwrap()).unwrap();
    let mut p = Candidates::default();
    p.include(
        copilot_cli::import_catalog_at_for_test(&path, false).unwrap(),
        &["cli".into()],
    )
    .unwrap();
    let rows = p.finish(&[]);
    assert_eq!(rows[0].provider.models.len(), 1);
    assert_eq!(rows[0].provider.models[0].name, "wire-name");
    assert!(!serde_json::to_string(&rows).unwrap().contains("FAKE-"));
    for url in [
        "https://user:secret@example.invalid/v1",
        "https://example.invalid/v1?api_key=anything",
        "https://example.invalid/v1#token",
        "http://example.invalid/v1",
    ] {
        let catalog = hints("Provider", url, ApiProtocol::Responses, &["id"]);
        assert_eq!(catalog.skipped, 1);
        assert!(catalog.providers.is_empty());
    }
    let mut c = Catalog::default();
    c.add(
        ModelFields {
            provider: "Azure",
            endpoint: "https://example.invalid/openai?api-version=2024-10-21",
            protocol: Some(ApiProtocol::Responses),
            kind: Some(ProviderKind::Azure),
            id: "m",
            name: "M",
            api_key: None,
            caps: ModelCapabilities::default(),
        },
        |_| false,
    )
    .unwrap();
    assert_eq!(c.providers.len(), 1);
}

#[test]
fn a_changed_selected_source_cannot_save_a_partial_batch_or_replay_the_review() {
    let root = tempfile::tempdir().unwrap();
    let state = managed(root.path());
    let file = root.path().join("chatLanguageModels.json");
    let write = |second: &str| {
        fs::write(&file,serde_json::to_vec(&json!([
        {"name":"One","vendor":"customendpoint","models":[{"id":"a","url":"https://one.invalid/v1"}]},
        {"name":"Two","vendor":"customendpoint","models":[{"id":second,"url":"https://two.invalid/v1"}]}
    ])).unwrap()).unwrap()
    };
    let read = |_: Option<&[String]>, existing: &[Connection], collect_keys: bool| {
        let mut pool = Candidates::default();
        pool.include(
            vscode::import_catalog(&file, collect_keys)?,
            &["vscode:fixture".into()],
        )?;
        Ok(scan::Scanned {
            candidates: pool.finish(existing),
            issues: vec![],
        })
    };
    write("b");
    let review = preview(&state, None, read).unwrap();
    let ids: Vec<_> = review.candidates.iter().map(|c| c.id.clone()).collect();
    write("changed");
    assert!(matches!(
        apply(&state, &review.plan_id, &ids, false, read),
        Err(AppError::PlanChanged)
    ));
    assert!(state.store().unwrap().connections().is_empty());
    assert!(!root.path().join("state.json").exists());
    assert!(matches!(
        apply(&state, &review.plan_id, &ids, false, read),
        Err(AppError::PlanUnavailable)
    ));
    let current = preview(&state, None, read).unwrap();
    let saved = apply(&state, &current.plan_id, &ids[..1], false, read).unwrap();
    assert_eq!(saved.created, 1);
    assert_eq!(saved.connection_ids.len(), 1);
    assert_eq!(state.store().unwrap().connections().len(), 1);
    assert!(state.store().unwrap().ownership().is_empty());
}

#[test]
fn approval_can_fill_an_existing_key_and_binds_the_exact_source_credential() {
    crate::secrets::with_fake_credentials(|| {
        let root = tempfile::tempdir().unwrap();
        let state = managed(root.path());
        let path = root.path().join("state.json");
        let file = root.path().join("chatLanguageModels.json");
        let write = |key: &str| {
            let config = json!([{"name":"Fixture provider","vendor":"customendpoint","apiKey":key,
              "models":[{"id":"one","url":"https://one.invalid/v1"}]}]);
            fs::write(&file, serde_json::to_vec(&config).unwrap()).unwrap();
        };
        let read = |_: Option<&[String]>, existing: &[Connection], collect_keys: bool| {
            let mut pool = Candidates::default();
            pool.include(
                vscode::import_catalog(&file, collect_keys)?,
                &["vscode:fixture".into()],
            )?;
            Ok(scan::Scanned {
                candidates: pool.finish(existing),
                issues: vec![],
            })
        };
        let review = || preview(&state, None, read).unwrap();
        let finish = |plan: &Preview, consent: bool| {
            apply(
                &state,
                &plan.plan_id,
                &[plan.candidates[0].id.clone()],
                consent,
                read,
            )
        };
        let original_key = "FAKE-ORIGINAL-KEY";
        let next_key = "FAKE-CHANGED-KEY";
        write(original_key);
        let created = finish(&review(), false).unwrap();
        assert_eq!(created.created, 1);
        assert_eq!(created.keys_imported, 0);
        let id = created.connection_ids[0].clone();
        let reference = format!("connection:{id}");
        assert!(crate::secrets::get(&reference).unwrap().is_none());

        let pending = review();
        assert_eq!(pending.candidates[0].action, Action::FillKey);
        assert!(pending.candidates[0].key_material().is_none());
        assert!(!serde_json::to_string(&pending)
            .unwrap()
            .contains(original_key));
        assert!(finish(&pending, false).is_err());
        let pending = review();
        write(next_key);
        assert!(matches!(finish(&pending, true), Err(AppError::PlanChanged)));
        assert!(crate::secrets::get(&reference).unwrap().is_none());

        let pending = review();
        let before = fs::read(&path).unwrap();
        fs::write(&path, b"{}\n").unwrap();
        assert!(finish(&pending, true).is_err());
        assert!(crate::secrets::get(&reference).unwrap().is_none());
        fs::write(&path, before).unwrap();

        let completed = finish(&review(), true).unwrap();
        assert_eq!(completed.keys_imported, 1);
        assert_eq!(completed.connection_ids, [id.clone()]);
        let store = state.store().unwrap();
        let saved = store.connection(&id).unwrap();
        assert!(saved.has_secret);
        assert_eq!(saved.models.len(), 1);
        assert_eq!(
            crate::secrets::get(&reference).unwrap().as_deref(),
            Some(next_key)
        );
        assert!(!fs::read_to_string(&path).unwrap().contains(next_key));
        drop(store);
        write(original_key);
        assert!(review().candidates.is_empty());
        assert_eq!(
            crate::secrets::get(&reference).unwrap().as_deref(),
            Some(next_key)
        );
    });
}

#[test]
fn competing_keys_are_not_selected_and_credential_references_are_not_resolved() {
    let source = |key| {
        let mut catalog = Catalog::for_scan(true);
        catalog
            .add(
                ModelFields {
                    provider: "One",
                    endpoint: "https://example.invalid/v1",
                    protocol: Some(ApiProtocol::Responses),
                    kind: None,
                    id: "m",
                    name: "Model",
                    api_key: Some(key),
                    caps: Default::default(),
                },
                |_| false,
            )
            .unwrap();
        catalog
    };
    let mut found = Candidates::default();
    found
        .include(source("FAKE-KEY-ONE"), &["vscode:a".into()])
        .unwrap();
    found
        .include(source("FAKE-KEY-TWO"), &["jetbrains:b".into()])
        .unwrap();
    let rows = found.finish(&[]);
    assert_eq!(rows[0].key_status, Some(credential::KeyStatus::Conflict));
    assert!(rows[0].key_material().is_none());
    for value in [
        "${API_KEY}",
        "$API_KEY",
        "ghp_fixture_do_not_import",
        "%API_KEY%",
    ] {
        let mut found = Candidates::default();
        found.include(source(value), &["cli".into()]).unwrap();
        assert!(found.finish(&[])[0].key_status.is_none());
    }
}

#[test]
fn explicit_app_import_reads_unlinked_model_metadata_from_a_private_fixture() {
    use crate::adapters::github_app::sqlite;
    let root = sqlite::tests::private_root();
    let target = sqlite::tests::database(&root.path().join("data.db"));
    let db = rusqlite::Connection::open(&target.database).unwrap();
    db.execute("INSERT INTO accounts(id) VALUES('account-fixture')", [])
        .unwrap();
    let settings = r#"{"baseUrl":"https://service.invalid/v1","wireApi":"responses","authKind":"none","headersJson":"{\"Authorization\":\"Bearer FAKE-APP-ONLY-KEY\",\"X-Private\":\"FAKE_HEADER_DO_NOT_COPY\"}"}"#;
    db.execute("INSERT INTO model_providers(id,name,type,settings_json) VALUES('custom','Local provider','openai',?1)",[settings]).unwrap();
    let linked_settings = settings.replace("FAKE-APP-ONLY-KEY", "FAKE-LINKED-KEY");
    db.execute("INSERT INTO model_providers(id,name,type,settings_json,account_id) VALUES('linked','PRIVATE_ACCOUNT_PROVIDER','openai',?1,'account-fixture')",[linked_settings]).unwrap();
    for id in ["custom", "linked"] {
        db.execute("INSERT INTO provider_models(id,provider_id,model_id,display_name) VALUES(?1,?1,'upstream','Model')",[id]).unwrap();
    }
    drop(db);
    let observed = sqlite::import::observed_catalog(&target, &Default::default()).unwrap();
    assert_eq!(observed.len(), 2);
    assert_eq!(observed[0].name, "Local provider");
    assert_eq!(observed[0].model_count, 1);
    assert_eq!(observed[0].connection_id, None);
    assert_eq!(observed[1].name, "Foreign provider");
    assert_eq!(observed[1].model_count, 0);
    let observed_json = serde_json::to_string(&observed).unwrap();
    assert!(!observed_json.contains("FAKE_HEADER"));
    assert!(!observed_json.contains("PRIVATE_ACCOUNT"));
    let mut rows = Candidates::default();
    rows.include(
        sqlite::import::read(&target, false).unwrap(),
        &["app".into()],
    )
    .unwrap();
    let imported = rows.finish(&[]);
    assert_eq!(imported.len(), 1);
    assert_eq!(imported[0].provider.name, "Local provider");
    assert_eq!(imported[0].provider.models[0].model_id, "upstream");
    assert_eq!(
        imported[0].key_status,
        Some(credential::KeyStatus::Available)
    );
    assert!(imported[0].key_material().is_none());
    let result = serde_json::to_string(&imported).unwrap();
    assert!(!result.contains("FAKE_HEADER"));
    assert!(!result.contains("PRIVATE_ACCOUNT"));
    assert!(!result.contains("FAKE-APP-ONLY-KEY"));
    let mut approved = Candidates::default();
    approved
        .include(
            sqlite::import::read(&target, true).unwrap(),
            &["app".into()],
        )
        .unwrap();
    let approved = approved.finish(&[]);
    assert_eq!(approved[0].key_material(), Some("FAKE-APP-ONLY-KEY"));
    assert!(!serde_json::to_string(&approved)
        .unwrap()
        .contains("FAKE-APP-ONLY-KEY"));
}
