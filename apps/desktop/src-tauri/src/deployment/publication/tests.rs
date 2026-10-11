use super::*;
use crate::deployment::{
    ownership,
    tests::{connection, target},
};
use std::fs;

fn publish(
    path: &Path,
    target: &ClientTarget,
    connection: &crate::domain::Connection,
    proofs: &[TargetOwnership],
) -> TargetOwnership {
    let (write, hash) = adapters::vscode::prepare_owned(
        connection,
        Some("synthetic-provider-secret"),
        path,
        "owner",
        proofs,
        false,
    )
    .unwrap();
    fs::write(path, write.after.as_ref().unwrap()).unwrap();
    TargetOwnership {
        owner_id: "owner".into(),
        connection_id: connection.id.clone(),
        target_id: target.id.clone(),
        target_kind: target.kind,
        resource_id: ownership::resource_id(&write.resource),
        projection_fingerprint: hash.unwrap(),
        target_fingerprint: super::super::fingerprint_target(target).unwrap(),
        deployed_at: Utc::now(),
    }
}

#[test]
fn coexistence_uses_each_owned_projection_not_last_connection_or_whole_file() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("models.json");
    fs::write(
        &path,
        br#"[{"vendor":"other","name":"Foreign","models":[]}]"#,
    )
    .unwrap();
    let target = target(&path);
    let one = connection();
    let proof = publish(&path, &target, &one, &[]);
    let mut two = one.clone();
    two.id = "two".into();
    two.name = "Two".into();
    two.secret_ref = "connection:two".into();
    let mut model = two.models[0].clone();
    model.id = "model-two".into();
    model.model_id = "model-b".into();
    two.models.push(model);
    let other = publish(&path, &target, &two, std::slice::from_ref(&proof));
    let proofs = [proof, other];
    let sources = observe(std::slice::from_ref(&target), &proofs, "owner", false);
    assert_eq!(sources.len(), 2);
    assert!(sources
        .iter()
        .all(|source| source.state == PublicationState::Published));
    assert_eq!(
        sources.iter().map(|s| s.model_count).collect::<Vec<_>>(),
        [Some(1), Some(2)]
    );
    let dto = serde_json::to_string(&sources).unwrap();
    assert!(!dto.contains("synthetic-provider-secret"));
    assert!(!dto.contains("model-a"));
    let mut catalog: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    catalog[0]["name"] = "External foreign edit".into();
    fs::write(&path, serde_json::to_vec(&catalog).unwrap()).unwrap();
    assert!(
        observe(std::slice::from_ref(&target), &proofs, "owner", false)
            .iter()
            .all(|s| s.state == PublicationState::Published)
    );
    catalog[1]["models"][0]["id"] = "External own edit".into();
    fs::write(&path, serde_json::to_vec(&catalog).unwrap()).unwrap();
    let changed = observe(std::slice::from_ref(&target), &proofs, "owner", false);
    assert_eq!(changed[0].state, PublicationState::Changed);
    assert_eq!(changed[0].model_count, None);
    assert_eq!(changed[1].state, PublicationState::Published);
}

#[test]
fn missing_unreadable_foreign_and_recovery_remain_unknown_not_zero() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("models.json");
    let target = target(&path);
    let proof = publish(&path, &target, &connection(), &[]);
    for sources in [
        observe(&[], std::slice::from_ref(&proof), "owner", false),
        observe(
            std::slice::from_ref(&target),
            std::slice::from_ref(&proof),
            "foreign",
            false,
        ),
        observe(
            std::slice::from_ref(&target),
            std::slice::from_ref(&proof),
            "owner",
            true,
        ),
    ] {
        assert_eq!(sources[0].state, PublicationState::Unavailable);
        assert_eq!(sources[0].model_count, None);
    }
    fs::write(&path, b"invalid catalog").unwrap();
    assert_eq!(
        observe(
            std::slice::from_ref(&target),
            std::slice::from_ref(&proof),
            "owner",
            false
        )[0]
        .state,
        PublicationState::Unavailable
    );
    fs::remove_file(&path).unwrap();
    let missing = observe(&[target], &[proof], "owner", false);
    assert_eq!(missing[0].state, PublicationState::Changed);
    assert_eq!(missing[0].model_count, None);
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
