use super::*;
use crate::state::StateStore;
use serde_json::json;
use std::fs;

fn isolated(path: &Path) -> ManagedState {
    ManagedState::new(
        StateStore::open_at(path.join("state.json")),
        crate::account::LoginStore::open_at(path.join("login.json")),
        crate::github_auth::GithubAuthorizationStore::isolated(path.join("auth.json")),
        None,
        None,
    )
}

fn edit(index: usize, value: &str) -> Change {
    serde_json::from_value(json!({"kind":"edit","fields":[{"index":index,"value":value}]})).unwrap()
}

#[test]
fn vscode_direct_edits_reject_duplicate_members_in_json_or_json5() {
    for bytes in [
        &br#"[{ "vendor": "customendpoint", "name": "A", "name": "B", "models": [] }]"#[..],
        &br#"[{ vendor: 'customendpoint', name: 'A', name: 'B', models: [] }]"#[..],
    ] {
        assert!(vscode::existing::read(Path::new("chatLanguageModels.json"), bytes).is_err());
    }
    assert!(vscode::existing::read(
        Path::new("chatLanguageModels.json"),
        br#"[{ vendor: 'customendpoint', name: 'A', models: [] }]"#
    )
    .is_ok());
}

#[test]
fn existing_vscode_group_is_edited_without_exposing_or_replacing_secrets() {
    let root = tempfile::tempdir().unwrap();
    let state = isolated(root.path());
    let file = root.path().join("chatLanguageModels.json");
    let original = json!([
        {"vendor":"customendpoint","name":"External","apiKey":"FAKE-DONT-EXPOSE-IT",
         "models":[{"id":"model-a","name":"Model A","url":"https://models.invalid/v1/responses","requestHeaders":{"Authorization":"Bearer FAKE-DONT-EXPOSE-IT"}}]},
        {"vendor":"other","name":"Independent","extra": 9007199254740993u64}
    ]);
    fs::write(&file, serde_json::to_vec(&original).unwrap()).unwrap();
    let resolve = |_: &ManagedState, _: &str| Document::read(&file, ClientKind::VsCodeCopilot, 1);
    let list = inventory(&state, "vscode:a".into(), resolve(&state, "").unwrap()).unwrap();
    let public = serde_json::to_string(&list).unwrap();
    assert!(public.contains("External"));
    assert!(!public.contains("FAKE-DONT-EXPOSE-IT"));
    assert!(!public.contains("pointer"));
    assert!(!public.contains("requestHeaders"));
    assert!(review(
        &state,
        &list.inventory_id,
        0,
        edit(2, "https://example.invalid/v1?token=bad"),
        resolve
    )
    .is_err());
    let id = review(&state, &list.inventory_id, 0, edit(0, "Renamed"), resolve).unwrap();
    assert_eq!(
        serde_json::from_slice::<Value>(&fs::read(&file).unwrap()).unwrap(),
        original
    );
    apply(&state, &id, resolve).unwrap();
    let mut expected = original;
    expected[0]["name"] = json!("Renamed");
    assert_eq!(
        serde_json::from_slice::<Value>(&fs::read(&file).unwrap()).unwrap(),
        expected
    );
    assert!(apply(&state, &id, resolve).is_err());
    assert!(!deployment::recovery_required(
        state.store().unwrap().path()
    ));
    assert!(state.store().unwrap().connections().is_empty());
}

#[test]
fn cli_deletes_one_provider_and_its_models_and_rejects_changed_source() {
    let root = tempfile::tempdir().unwrap();
    let state = isolated(root.path());
    let file = root.path().join("providers.json");
    let original = json!({"$schema":"fixture", "providers":[
        {"name":"other","type":"openai","baseUrl":"https://other.invalid/v1"},
        {"name":"selected","type":"openai","baseUrl":"https://selected.invalid/v1","apiKey":"fixture-key"}
    ], "models":[{"provider":"selected","id":"a"},{"provider":"other","id":"b"},{"provider":"selected","id":"c"}]});
    fs::write(&file, serde_json::to_vec(&original).unwrap()).unwrap();
    let resolve = |_: &ManagedState, _: &str| Document::read(&file, ClientKind::CopilotCli, 1);
    let list = inventory(
        &state,
        "copilot-cli:fixture".into(),
        resolve(&state, "").unwrap(),
    )
    .unwrap();
    let plan = review(&state, &list.inventory_id, 1, Change::Delete, resolve).unwrap();
    let mut changed = original;
    changed["models"][1]["name"] = json!("A later edit");
    let changed_bytes = serde_json::to_vec(&changed).unwrap();
    fs::write(&file, &changed_bytes).unwrap();
    assert!(matches!(
        apply(&state, &plan, resolve),
        Err(AppError::PlanChanged)
    ));
    assert_eq!(fs::read(&file).unwrap(), changed_bytes);
    let current = inventory(
        &state,
        "copilot-cli:fixture".into(),
        resolve(&state, "").unwrap(),
    )
    .unwrap();
    let plan = review(&state, &current.inventory_id, 1, Change::Delete, resolve).unwrap();
    apply(&state, &plan, resolve).unwrap();
    assert_eq!(
        serde_json::from_slice::<Value>(&fs::read(&file).unwrap()).unwrap(),
        json!({
            "$schema":"fixture","providers":[changed["providers"][0]],"models":[changed["models"][1]]
        })
    );
}

#[test]
fn jetbrains_edits_escaped_model_paths_and_deletes_only_the_selected_group() {
    let root = tempfile::tempdir().unwrap();
    let file = root.path().join("byok.json");
    let original = json!({
        "a-api-key":"fixture-credential-a", "a-provider-config":{"groupName":"A"},
        "a-models-config":{"x/y~z":{"deploymentUrl":"https://first.invalid/v1","modelCapabilities":{"name":"Model","vision":true}}},
        "a-x/y~z-api-key":"fixture-model-key",
        "b-api-key":"fixture-credential-b", "b-provider-config":{"groupName":"B"},
        "b-models-config":{"b-model":{"deploymentUrl":"https://second.invalid/v1"}},
        "foreign":{"keep":true}
    });
    fs::write(&file, serde_json::to_vec(&original).unwrap()).unwrap();
    let mut document = Document::read(&file, ClientKind::JetBrainsCopilot, 2).unwrap();
    assert_eq!(document.shared_instances, 2);
    let write = document
        .prepare(&edit(2, "https://updated.invalid/v1"), 0)
        .unwrap();
    let updated: Value = serde_json::from_slice(write.after.as_deref().unwrap()).unwrap();
    assert_eq!(
        updated["a-models-config"]["x/y~z"]["deploymentUrl"],
        "https://updated.invalid/v1"
    );
    assert_eq!(updated["a-x/y~z-api-key"], "fixture-model-key");
    let mut document = Document::read(&file, ClientKind::JetBrainsCopilot, 2).unwrap();
    let write = document.prepare(&Change::Delete, 0).unwrap();
    let updated: Value = serde_json::from_slice(write.after.as_deref().unwrap()).unwrap();
    assert_eq!(
        updated,
        json!({
            "b-api-key":original["b-api-key"], "b-provider-config":original["b-provider-config"],
            "b-models-config":original["b-models-config"], "foreign":original["foreign"]
        })
    );
}
