use super::*;
use crate::domain::{ApiProtocol, ClientKind};
use std::fs;

fn connection() -> Connection {
    let mut value = super::super::tests::connection();
    value.secret_ref = "connection:fixture".into();
    value.headers = BTreeMap::from([
        ("Authorization".into(), "Bearer ${apiKey}".into()),
        ("X-Extra".into(), "test".into()),
    ]);
    value.models[0].capabilities.context_window = Some(234567);
    value.models[0].capabilities.max_output_tokens = Some(12345);
    value.models[0].capabilities.reasoning = Some(true);
    value.models[0].capabilities.vision = Some(true);
    let mut disabled = value.models[0].clone();
    disabled.id = "disabled".into();
    disabled.model_id = "disabled-model".into();
    disabled.enabled = false;
    value.models.push(disabled);
    value
}
fn proof(write: &transaction::PreparedWrite, projection: String) -> TargetOwnership {
    TargetOwnership {
        owner_id: "owner".into(),
        connection_id: "fixture".into(),
        target_id: "jetbrains:fixture".into(),
        target_kind: ClientKind::JetBrainsCopilot,
        resource_id: ownership::resource_id(&write.resource),
        projection_fingerprint: projection,
        target_fingerprint: "a".repeat(64),
        deployed_at: chrono::Utc::now(),
    }
}
fn prepare(
    path: &Path,
    connection: &Connection,
    proofs: &[TargetOwnership],
    revoke: bool,
) -> (transaction::PreparedWrite, Option<String>) {
    prepare_at(
        path,
        connection,
        Some("synthetic-own-secret"),
        "owner",
        proofs,
        revoke,
    )
    .unwrap()
}
fn write_after(write: &transaction::PreparedWrite) {
    match &write.resource {
        transaction::Resource::File(path) => {
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, write.after.as_ref().unwrap()).unwrap();
        }
        #[cfg(windows)]
        _ => panic!("not a file"),
    }
}

#[test]
fn official_namespace_projection_covers_protocols_models_capabilities_headers_and_key() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("byok.json");
    let seed = include_bytes!("fixtures/byok-v1.json");
    fs::write(&path, seed).unwrap();
    let original: Value = serde_json::from_slice(seed).unwrap();
    for (protocol, wire) in [
        (ApiProtocol::ChatCompletions, "chatCompletions"),
        (ApiProtocol::Responses, "responses"),
        (ApiProtocol::Messages, "messages"),
    ] {
        let mut connection = connection();
        connection.protocol = protocol;
        let (write, fingerprint) = prepare(&path, &connection, &[], false);
        assert!(fingerprint.is_some());
        let after: Value = serde_json::from_slice(write.after.as_ref().unwrap()).unwrap();
        for (key, value) in original.as_object().unwrap() {
            assert_eq!(after[key], *value);
        }
        let owned = keys(&provider_name("owner", "fixture").unwrap());
        assert_eq!(after[&owned[0]], "synthetic-own-secret");
        assert_eq!(after[&owned[1]]["apiType"], wire);
        let models = &after[&owned[2]];
        assert!(models.get("disabled-model").is_none());
        let model = &models["fixture-model"];
        assert_eq!(model["deploymentUrl"], connection.base_url);
        assert_eq!(model["isRegistered"], true);
        let capabilities = &model["modelCapabilities"];
        assert_eq!(capabilities["maxInputTokens"], 234567);
        assert_eq!(capabilities["maxOutputTokens"], 12345);
        assert_eq!(capabilities["thinking"], true);
        assert_eq!(capabilities["vision"], true);
        assert_eq!(
            capabilities["requestHeaders"]["Authorization"],
            "Bearer synthetic-own-secret"
        );
        assert_eq!(fs::read(&path).unwrap(), seed); // Preview prepares, never writes.
    }
}

#[test]
fn proven_projection_is_noop_preserves_bytes_and_revoke_preserves_unmanaged_data() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("byok.json");
    let connection = connection();
    fs::write(&path, include_bytes!("fixtures/byok-v1.json")).unwrap();
    let (write, projection) = prepare(&path, &connection, &[], false);
    let proof = proof(&write, projection.unwrap());
    write_after(&write);
    let bytes = fs::read(&path).unwrap();
    let (noop, _) = prepare(&path, &connection, std::slice::from_ref(&proof), false);
    assert!(!noop.changed());
    assert_eq!(noop.after.as_ref().unwrap(), &bytes);
    let mut changed = connection.clone();
    changed.models[0].name = "Renamed".into();
    assert!(
        prepare(&path, &changed, std::slice::from_ref(&proof), false)
            .0
            .changed()
    );
    let (revoke, projection) = prepare(&path, &connection, &[proof], true);
    assert!(projection.is_none());
    assert_eq!(
        serde_json::from_slice::<Value>(revoke.after.as_ref().unwrap()).unwrap(),
        serde_json::from_slice::<Value>(include_bytes!("fixtures/byok-v1.json")).unwrap()
    );
}

#[test]
fn unproven_foreign_partial_changed_or_overriding_keys_are_conflicts() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("byok.json");
    let connection = connection();
    let (write, projection) = prepare(&path, &connection, &[], false);
    let proof = proof(&write, projection.unwrap());
    write_after(&write);
    assert!(prepare_at(&path, &connection, Some("secret"), "owner", &[], false).is_err());
    assert!(prepare_at(
        &path,
        &connection,
        Some("secret"),
        "other-owner",
        std::slice::from_ref(&proof),
        false
    )
    .is_err());
    let original: Value = serde_json::from_slice(write.after.as_ref().unwrap()).unwrap();
    let owned = keys(&provider_name("owner", "fixture").unwrap());
    for mutation in 0..5 {
        let mut changed = original.clone();
        match mutation {
            0 => {
                changed[&owned[1]]["groupName"] = json!("User changed");
            }
            1 => {
                changed.as_object_mut().unwrap().remove(&owned[0]);
            }
            2 => {
                changed[&owned[1]][OWNER] = json!("foreign");
            }
            3 => {
                changed.as_object_mut().unwrap().insert(
                    format!(
                        "{}-fixture-model-api-key",
                        provider_name("owner", "fixture").unwrap()
                    ),
                    json!("override"),
                );
            }
            _ => {
                changed = json!({});
            }
        }
        fs::write(&path, serde_json::to_vec(&changed).unwrap()).unwrap();
        assert!(prepare_at(
            &path,
            &connection,
            Some("secret"),
            "owner",
            std::slice::from_ref(&proof),
            false
        )
        .is_err());
        if mutation != 4 {
            assert!(prepare_at(
                &path,
                &connection,
                None,
                "owner",
                std::slice::from_ref(&proof),
                true
            )
            .is_err());
        }
    }
}

#[test]
fn parser_fails_closed_without_raw_values_or_duplicate_key_adoption() {
    for bytes in [
        b"[1,2]".as_slice(),
        b"{SECRET-DO-NOT-ECHO",
        b"{\"x\":1,\"x\":2}",
        b"{\"x\":{\"nested\":1,\"nested\":2}}",
    ] {
        let error = parse(Some(bytes)).err().unwrap().to_string();
        assert!(!error.contains("SECRET-DO-NOT-ECHO"));
    }
    let deep = format!("{{\"nested\":{}0{}}}", "[".repeat(34), "]".repeat(34));
    assert!(parse(Some(deep.as_bytes())).is_err());
    assert!(parse(Some(&vec![b' '; MAX_BYTES as usize + 1])).is_err());
    let oversized = json!({"x":"s".repeat(65537)});
    assert!(parse(Some(&serde_json::to_vec(&oversized).unwrap())).is_err());
}

#[test]
fn namespace_paths_follow_the_reviewed_runtime_not_ide_options_or_password_safe() {
    let root = tempfile::tempdir().unwrap();
    let home = root.path();
    let xdg = home.join("xdg");
    assert_eq!(
        path_at(home, None, true),
        home.join("AppData/Local/github-copilot/byok.json")
    );
    assert_eq!(
        path_at(home, None, false),
        home.join(".config/github-copilot/byok.json")
    );
    assert_eq!(
        path_at(home, Some(&xdg), true),
        xdg.join("github-copilot/byok.json")
    );
    assert_eq!(
        path_at(home, Some(Path::new("relative")), false),
        home.join(".config/github-copilot/byok.json")
    );
    assert!(supported_version("1.19.0-261-windows-x64"));
    assert!(supported_version("1.19.0-252"));
    assert!(!supported_version("1.18.0-252"));
    assert!(!supported_version("1.20.0-261-windows-x64"));
    assert!(!supported_version("1.19.0-261-win-x64"));
    let mut c = connection();
    c.base_url = "https://example.invalid/v1?api-version=future".into();
    assert!(compatibility(&c).is_err());
    c.base_url = "https://example.invalid/v1".into();
    c.has_secret = false;
    assert!(compatibility(&c).is_err());
}

#[test]
fn missing_key_and_unsafe_paths_never_prepare_a_mutation() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("byok.json");
    let c = connection();
    assert!(prepare_at(&path, &c, None, "owner", &[], false).is_err());
    assert!(!path.exists());
    fs::create_dir(&path).unwrap();
    assert!(prepare_at(&path, &c, Some("key"), "owner", &[], false).is_err());
}

#[test]
fn reviewed_endpoint_normalization_never_silently_changes_a_terminal_route() {
    let mut c = connection();
    for (protocol, input, expected) in [
        (
            ApiProtocol::ChatCompletions,
            "https://example.invalid",
            "https://example.invalid/v1/chat/completions",
        ),
        (
            ApiProtocol::ChatCompletions,
            "https://example.invalid/api/v2",
            "https://example.invalid/api/v2/chat/completions",
        ),
        (
            ApiProtocol::ChatCompletions,
            "https://example.invalid/api/v1/chat/completions",
            "https://example.invalid/api/v1/chat/completions",
        ),
        (
            ApiProtocol::Responses,
            "https://example.invalid/v1",
            "https://example.invalid/v1/responses",
        ),
        (
            ApiProtocol::Responses,
            "https://example.invalid/v1/responses/",
            "https://example.invalid/v1/responses",
        ),
        (
            ApiProtocol::Messages,
            "https://example.invalid/",
            "https://example.invalid/v1/messages",
        ),
        (
            ApiProtocol::Messages,
            "https://example.invalid/proxy/v1",
            "https://example.invalid/proxy/v1/messages",
        ),
        (
            ApiProtocol::Messages,
            "https://example.invalid/proxy/v1/messages",
            "https://example.invalid/proxy/v1/messages",
        ),
    ] {
        c.protocol = protocol;
        c.base_url = input.into();
        assert_eq!(effective_endpoint(&c).unwrap(), expected);
        compatibility(&c).unwrap();
    }
    for (protocol, input) in [
        (ApiProtocol::ChatCompletions, "https://example.invalid/api"),
        (
            ApiProtocol::ChatCompletions,
            "https://example.invalid/chat/completions",
        ),
        (
            ApiProtocol::ChatCompletions,
            "https://example.invalid/v1beta/openai",
        ),
        (
            ApiProtocol::Responses,
            "https://example.invalid/v1/chat/completions",
        ),
        (ApiProtocol::Messages, "https://example.invalid/v2"),
        (ApiProtocol::Messages, "https://example.invalid/v2/messages"),
        (ApiProtocol::Messages, "https://example.invalid/messages"),
        (
            ApiProtocol::Messages,
            "https://example.invalid/v1/responses",
        ),
    ] {
        c.protocol = protocol;
        c.base_url = input.into();
        assert!(matches!(
            effective_endpoint(&c),
            Err(AppError::Unsupported(_))
        ));
    }
}

#[test]
fn byok_recovery_refuses_to_overwrite_external_provider_changes() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("byok.json");
    let journal = root.path().join("private-journal.json");
    fs::write(&path, include_bytes!("fixtures/byok-v1.json")).unwrap();
    let (write, _) = prepare(&path, &connection(), &[], false);
    let allowed = vec![write.resource.clone()];
    let mut tx = transaction::Transaction::begin(journal.clone(), "fixture", vec![write]).unwrap();
    tx.apply().unwrap();
    drop(tx); // Simulated interruption before audit/commit.
    let mut external: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    external["another-provider-api-key"] = json!("synthetic-external-secret");
    let external_bytes = serde_json::to_vec(&external).unwrap();
    fs::write(&path, &external_bytes).unwrap();
    let review = transaction::recovery_view(&journal, &allowed).unwrap();
    assert_eq!(review.conflict_count, 1);
    let public = serde_json::to_string(&review).unwrap();
    assert!(!public.contains("synthetic-own-secret"));
    assert!(!public.contains("synthetic-external-secret"));
    assert!(transaction::recover(&journal, &review.digest, &allowed).is_err());
    assert_eq!(fs::read(&path).unwrap(), external_bytes);
    assert!(journal.exists());
}

#[test]
fn owned_source_observation_counts_published_models_without_returning_keys() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("byok.json");
    let (write, hash) = prepare(&path, &connection(), &[], false);
    write_after(&write);
    let observed = observe_owned(&path, "owner").unwrap();
    assert_eq!(observed.sources["fixture"], (hash.unwrap(), 1));
    assert_eq!(
        observed.resource_id,
        ownership::resource_id(&write.resource)
    );
    assert!(observe_owned(&path, "foreign").unwrap().sources.is_empty());
    let copied = root.path().join("copied.json");
    fs::copy(&path, &copied).unwrap();
    assert_ne!(
        observe_owned(&copied, "owner").unwrap().resource_id,
        observed.resource_id
    );
    let mut external: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    let owned = keys(&provider_name("owner", "fixture").unwrap());
    external[&owned[1]][SCHEMA] = json!("unreviewed-schema");
    fs::write(path.clone(), serde_json::to_vec(&external).unwrap()).unwrap();
    assert!(observe_owned(&path, "owner").is_err());
}
