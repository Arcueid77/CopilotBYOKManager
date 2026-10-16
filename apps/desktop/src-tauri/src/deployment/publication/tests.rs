use super::*;
use crate::deployment::tests::{connection, target};
use serde_json::{json, Value};
use std::fs;

fn seed(path: &Path) {
    let (write, _) = adapters::vscode::prepare_owned(
        &connection(),
        Some("synthetic-provider-secret"),
        path,
        "owner",
        &[],
        false,
    )
    .unwrap();
    fs::write(path, write.after.unwrap()).unwrap();
}

#[test]
fn live_catalog_accepts_reordering_manual_edits_and_unmanaged_groups_without_audit() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("models.json");
    seed(&path);
    let mut groups: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    groups[0]["name"] = json!("Edited provider");
    groups[0]["models"][0]["id"] = json!("user-model");
    let extra = groups[0]["models"][0].clone();
    groups[0]["models"].as_array_mut().unwrap().push(extra);
    let map = groups[0]
        .as_object()
        .unwrap()
        .iter()
        .rev()
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect::<serde_json::Map<_, _>>();
    groups[0] = Value::Object(map);
    groups.as_array_mut().unwrap().push(json!({"vendor":"customendpoint","name":"Manual provider","apiKey":"foreign-secret","models":[]}));
    let bytes = serde_json::to_vec(&groups).unwrap();
    fs::write(&path, &bytes).unwrap();
    let current = observe(&[target(&path)], &[]);
    assert_eq!(current[0].state, ConfigurationState::Available);
    assert_eq!(current[0].sources.len(), 2);
    assert_eq!(current[0].sources[0].name, "Edited provider");
    assert_eq!(current[0].sources[0].model_count, 2);
    assert!(current[0].sources[0].connection_id.is_none());
    let known = observe(&[target(&path)], &[connection()]);
    assert_eq!(known[0].sources[0].connection_id.as_deref(), Some("one"));
    assert_eq!(current[0].sources[1].name, "Manual provider");
    assert_eq!(current[0].sources[1].model_count, 0);
    assert!(current[0].sources[1].connection_id.is_none());
    assert_eq!(fs::read(&path).unwrap(), bytes);
    let dto = serde_json::to_string(&current).unwrap();
    for forbidden in [
        "synthetic-provider-secret",
        "foreign-secret",
        "user-model",
        "apiKey",
        "requestHeaders",
    ] {
        assert!(!dto.contains(forbidden));
    }
}

#[test]
fn deletion_is_empty_configuration_but_read_failure_is_unknown() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("models.json");
    seed(&path);
    let target = target(&path);
    assert_eq!(
        observe(std::slice::from_ref(&target), &[])[0].sources.len(),
        1
    );
    fs::write(&path, b"[]").unwrap();
    let empty = observe(std::slice::from_ref(&target), &[]);
    assert_eq!(empty[0].state, ConfigurationState::Available);
    assert!(empty[0].sources.is_empty());
    fs::remove_file(&path).unwrap();
    assert_eq!(
        observe(std::slice::from_ref(&target), &[])[0].state,
        ConfigurationState::Available
    );
    for bytes in [
        b"invalid secret text".as_slice(),
        br#"[{"vendor":"customendpoint","models":"secret"}]"#,
    ] {
        fs::write(&path, bytes).unwrap();
        let current = observe(std::slice::from_ref(&target), &[]);
        assert_eq!(current[0].state, ConfigurationState::Unavailable);
        assert!(current[0].sources.is_empty());
    }
}

#[test]
fn shared_chat_and_agents_read_the_same_actual_catalog_without_historical_proofs() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("models.json");
    seed(&path);
    let mut chat = target(&path);
    chat.id = "vscode:stable:default".into();
    let mut agents = chat.clone();
    agents.id = "vscode:stable:profile:builtin/agents".into();
    let separate = target(&root.path().join("separate.json"));
    let mut unsupported = chat.clone();
    unsupported.supports_write = false;
    let result = observe(&[chat, agents, separate, unsupported], &[]);
    assert_eq!(result[0].sources[0].model_count, 1);
    assert_eq!(result[1].sources[0].model_count, 1);
    assert!(result[2].sources.is_empty());
    assert_eq!(result[2].state, ConfigurationState::Available);
    assert_eq!(result[3].state, ConfigurationState::Unsupported);
    assert!(result[3].sources.is_empty());
}

#[test]
fn provider_display_metadata_is_bounded_and_known_keys_cannot_be_echoed_as_names() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("models.json");
    fs::write(&path, br#"[{"vendor":"customendpoint","name":"secret-value","apiKey":"secret-value","models":[]}]"#).unwrap();
    let current = observe(&[target(&path)], &[]);
    assert_eq!(current[0].state, ConfigurationState::Available);
    assert!(!serde_json::to_string(&current)
        .unwrap()
        .contains("secret-value"));
    assert!(ConfiguredSource::new(&"x".repeat(513), None, 1).is_err());
    assert!(ConfiguredSource::new("provider", None, 257).is_err());
    assert!(
        ConfiguredSource::new("provider", Some("not a safe identifier"), 1)
            .unwrap()
            .connection_id
            .is_none()
    );
}

#[test]
fn successful_publication_notices_do_not_claim_client_selection_or_account_verification() {
    assert!(selection_notice(ClientKind::VsCodeCopilot).contains("请到客户端的模型选择器"));
    assert!(selection_notice(ClientKind::JetBrainsCopilot).contains("重启相关 IDE"));
    assert!(selection_notice(ClientKind::CopilotCli).contains("COPILOT_MODEL"));
    assert!(selection_notice(ClientKind::GithubCopilotApp).contains("手动添加"));
    for kind in [
        ClientKind::VsCodeCopilot,
        ClientKind::JetBrainsCopilot,
        ClientKind::CopilotCli,
    ] {
        assert!(!selection_notice(kind).contains("已选用"));
        assert!(!selection_notice(kind).contains("登录成功"));
    }
}
