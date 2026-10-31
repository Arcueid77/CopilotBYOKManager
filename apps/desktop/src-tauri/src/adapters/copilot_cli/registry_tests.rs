use super::*;
use crate::transaction::PreparedWrite;
use std::fs;

const FIXTURE: &[u8] = include_bytes!("../../../tests/fixtures/copilot-cli/providers-v1.json");
fn connection(id: &str) -> Connection {
    let mut c = super::super::tests::connection();
    c.id = id.into();
    c.name = format!("Provider {id}");
    c.secret_ref = format!("connection:{id}");
    c.has_secret = false;
    c.models[0].model_id = "shared-model".into();
    let mut m = c.models[0].clone();
    m.id = "second".into();
    m.model_id = "second-model".into();
    c.models.push(m);
    c
}
fn persist(write: &PreparedWrite) {
    #[cfg(not(windows))]
    let transaction::Resource::File(path) = &write.resource;
    #[cfg(windows)]
    let path = match &write.resource {
        transaction::Resource::File(path) => path,
        _ => panic!("file only"),
    };
    if let Some(bytes) = &write.after {
        fs::write(path, bytes).unwrap();
        #[cfg(unix)]
        if let Some(mode) = write.write_mode {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(path, fs::Permissions::from_mode(mode)).unwrap();
        }
    }
}
fn proof(write: &PreparedWrite, c: &Connection, projection: &str) -> TargetOwnership {
    TargetOwnership {
        owner_id: "owner".into(),
        connection_id: c.id.clone(),
        target_id: "copilot-cli:user-environment".into(),
        target_kind: crate::domain::ClientKind::CopilotCli,
        resource_id: ownership::resource_id(&write.resource),
        projection_fingerprint: projection.into(),
        target_fingerprint: "f".repeat(64),
        deployed_at: chrono::Utc::now(),
    }
}

#[test]
fn multiple_providers_all_models_and_unmanaged_data_survive_updates_and_revocation() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("providers.json");
    fs::write(&path, FIXTURE).unwrap();
    let original = parse(Some(FIXTURE)).unwrap();
    let a = connection("a");
    let b = connection("b");
    let (w, p) = prepare_at(&path, &a, Some("fixture-a"), "owner", &[], false).unwrap();
    persist(&w);
    let pa = proof(&w, &a, p.as_deref().unwrap());
    let (w, p) = prepare_at(
        &path,
        &b,
        Some("fixture-b"),
        "owner",
        std::slice::from_ref(&pa),
        false,
    )
    .unwrap();
    persist(&w);
    let pb = proof(&w, &b, p.as_deref().unwrap());
    let sources = observe_at(&path, &[a.clone(), b.clone()], "owner")
        .unwrap()
        .unwrap();
    assert_eq!(sources.len(), 3);
    assert_eq!(sources[1].model_count, 2);
    assert_eq!(sources[2].model_count, 2);
    let serialized = serde_json::to_string(&sources).unwrap();
    for secret in ["fixture-a", "fixture-b", "fixture-manual-key", "https://"] {
        assert!(!serialized.contains(secret));
    }
    let mut a = a;
    a.base_url = "https://changed.example.test/v1".into();
    a.name = "Renamed A".into();
    a.models[0].enabled = false;
    let (w, _) = prepare_at(
        &path,
        &a,
        Some("fixture-a2"),
        "owner",
        &[pa.clone(), pb],
        false,
    )
    .unwrap();
    persist(&w);
    let data = parse(w.after.as_deref()).unwrap();
    assert_eq!(data["providers"].as_array().unwrap().len(), 3);
    assert_eq!(data["models"].as_array().unwrap().len(), 4);
    assert_eq!(data["providers"][0], original["providers"][0]);
    assert_eq!(data["models"][0], original["models"][0]);
    assert!(String::from_utf8(w.after.clone().unwrap())
        .unwrap()
        .contains("12345678901234567890.123456789"));
    // An old digest is not a content lock; current before bytes still bind plans.
    let (w, _) = prepare_at(&path, &a, None, "owner", &[pa], true).unwrap();
    persist(&w);
    let data = parse(w.after.as_deref()).unwrap();
    assert_eq!(data["providers"].as_array().unwrap().len(), 2);
    assert_eq!(data["models"].as_array().unwrap().len(), 3);
    assert_eq!(data["providers"][0], original["providers"][0]);
}

#[test]
fn repeat_publication_is_byte_idempotent_even_with_multiple_providers() {
    let t = tempfile::tempdir().unwrap();
    let path = t.path().join("providers.json");
    for id in ["a", "b"] {
        let (w, _) = prepare_at(&path, &connection(id), None, "owner", &[], false).unwrap();
        persist(&w);
    }
    let before = fs::read(&path).unwrap();
    let (w, _) = prepare_at(&path, &connection("a"), None, "owner", &[], false).unwrap();
    assert_eq!(w.after.unwrap(), before);
}

#[cfg(unix)]
#[test]
fn identical_credentials_with_public_permissions_are_not_reported_private() {
    use std::os::unix::fs::PermissionsExt;
    let t = tempfile::tempdir().unwrap();
    let path = t.path().join("providers.json");
    let c = connection("a");
    let (write, _) = prepare_at(&path, &c, Some("fixture-key"), "owner", &[], false).unwrap();
    assert_eq!(write.write_mode, Some(0o600));
    persist(&write);
    fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
    assert!(prepare_at(&path, &c, Some("fixture-key"), "owner", &[], false).is_err());
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
    assert!(
        !prepare_at(&path, &c, Some("fixture-key"), "owner", &[], false)
            .unwrap()
            .0
            .changed()
    );
}

#[test]
fn revocation_requires_binding_and_leaves_foreign_installations_intact() {
    let t = tempfile::tempdir().unwrap();
    let path = t.path().join("providers.json");
    let c = connection("a");
    let (w, p) = prepare_at(&path, &c, None, "owner", &[], false).unwrap();
    persist(&w);
    let valid = proof(&w, &c, p.as_deref().unwrap());
    assert!(prepare_at(&path, &c, None, "owner", &[], true).is_err());
    assert!(prepare_at(
        &path,
        &c,
        None,
        "foreign",
        std::slice::from_ref(&valid),
        true
    )
    .is_err());
    let (foreign, _) = prepare_at(&path, &c, None, "foreign", &[], false).unwrap();
    persist(&foreign);
    let (revoked, _) = prepare_at(&path, &c, None, "owner", &[valid], true).unwrap();
    assert_eq!(
        parse(revoked.after.as_deref()).unwrap()["providers"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn protocols_headers_limits_and_local_no_key_are_projected_without_default_selection() {
    let t = tempfile::tempdir().unwrap();
    let path = t.path().join("providers.json");
    for (protocol, kind, wire) in [
        (ApiProtocol::ChatCompletions, "openai", Some("completions")),
        (ApiProtocol::Responses, "openai", Some("responses")),
        (ApiProtocol::Messages, "anthropic", None),
    ] {
        let mut c = connection("a");
        c.protocol = protocol;
        c.headers.insert("X-Key".into(), "${apiKey}".into());
        c.models[0].capabilities.context_window = Some(131072);
        c.models[0].capabilities.max_output_tokens = Some(8192);
        c.models[0].capabilities.vision = Some(true);
        let (w, _) =
            prepare_at(&path, &c, Some("fixture-projection"), "owner", &[], false).unwrap();
        let root = parse(w.after.as_deref()).unwrap();
        let p = &root["providers"][0];
        assert_eq!(p["type"], kind);
        assert_eq!(p.get("wireApi").and_then(Value::as_str), wire);
        assert_eq!(p["headers"]["X-Key"], "fixture-projection");
        assert_eq!(root["models"][0]["maxContextWindowTokens"], 131072);
        assert_eq!(root["models"][0]["maxOutputTokens"], 8192);
        assert!(root.get("model").is_none());
    }
    let mut local = connection("local");
    local.base_url = "http://127.0.0.1:11434/v1".into();
    local.has_secret = false;
    let (w, _) = prepare_at(&path, &local, None, "owner", &[], false).unwrap();
    assert!(parse(w.after.as_deref()).unwrap()["providers"][0]
        .get("apiKey")
        .is_none());
    local.models[0].capabilities.tool_calling = Some(false);
    assert!(prepare_at(&path, &local, None, "owner", &[], false).is_err());
}

#[test]
fn unknown_ambiguous_oversized_and_dangling_schemas_fail_without_secret_diagnostics() {
    for bytes in [
        br#"{"providers":{}}"#.as_slice(),
        br#"{"future":"fixture-private"}"#,
        br#"{"providers":[],"providers":[]}"#,
        br#"{"providers":[{"name":"x","name":"fixture-private","baseUrl":"https://x.test"}]}"#,
        br#"{"models":[{"id":"m","provider":"missing"}]}"#,
        br#"{"providers":[{"name":"x","type":"future","baseUrl":"https://x.test"}]}"#,
    ] {
        let err = parse(Some(bytes)).unwrap_err().to_string();
        assert!(!err.contains("fixture-private"));
    }
    assert!(parse(Some(&vec![b' '; MAX_BYTES as usize + 1])).is_err());
    let deep = format!(
        "{{\"providers\":[],\"models\":[],\"$schema\":{}0{}}}",
        "[".repeat(35),
        "]".repeat(35)
    );
    assert!(parse(Some(deep.as_bytes())).is_err());
    let many = json!({"providers": (0..257).map(|i| json!({"name":format!("p{i}"),"baseUrl":"https://x.test"})).collect::<Vec<_>>()});
    assert!(parse(Some(&serde_json::to_vec(&many).unwrap())).is_err());
}

#[test]
fn empty_catalog_removes_only_this_provider_and_missing_registry_observes_legacy_fallback() {
    let t = tempfile::tempdir().unwrap();
    let path = t.path().join("providers.json");
    let mut c = connection("a");
    assert!(observe_at(&path, &[], "owner").unwrap().is_none());
    fs::write(&path, FIXTURE).unwrap();
    let (w, _) = prepare_at(&path, &c, None, "owner", &[], false).unwrap();
    persist(&w);
    for m in &mut c.models {
        m.enabled = false;
    }
    let (w, p) = prepare_at(&path, &c, None, "owner", &[], false).unwrap();
    assert!(p.is_none());
    assert_eq!(
        parse(w.after.as_deref()).unwrap(),
        parse(Some(FIXTURE)).unwrap()
    );
}

#[test]
fn projected_fingerprint_uses_registry_after_bytes_and_external_edits_invalidate_it() {
    let t = tempfile::tempdir().unwrap();
    let path = t.path().join("providers.json");
    with_test_path(&path, || {
        use crate::deployment::{fingerprint_target, validate_plan, PlanContext, PlanStore};
        use crate::domain::{ClientKind, ClientStatus, ClientTarget};
        let c = connection("a");
        let target = ClientTarget {
            id: "copilot-cli:user-environment".into(),
            kind: ClientKind::CopilotCli,
            name: "Fixture CLI".into(),
            detail: "Fixture".into(),
            path: None,
            detected: true,
            supports_write: true,
            status: ClientStatus::Available,
            diagnostic: None,
        };
        let plan = crate::domain::DeploymentPlan {
            id: String::new(),
            connection_id: c.id.clone(),
            connection_name: c.name.clone(),
            target_ids: vec![target.id.clone()],
            operations: vec![super::super::preview(&c, &target)],
            purpose: crate::domain::DeploymentPurpose::Deploy,
            created_at: chrono::Utc::now(),
        };
        let mut plans = PlanStore::default();
        let context = PlanContext::new("owner", "revision".into(), None);
        let preview = plans
            .insert(
                &c,
                None,
                plan,
                std::slice::from_ref(&target),
                context.clone(),
            )
            .unwrap();
        let stored = plans.consume(&preview.id).unwrap();
        validate_plan(&stored, &c, std::slice::from_ref(&target), &context).unwrap();
        assert!(plans.consume(&preview.id).is_err());
        persist(&stored.writes[0]);
        assert_eq!(
            stored.after_fingerprints[&target.id],
            fingerprint_target(&target).unwrap()
        );
        assert!(validate_plan(&stored, &c, std::slice::from_ref(&target), &context).is_err());
        // A second provider keeps the first provider's durable claim.
        let context = context.with_ownership(&stored.ownership_after);
        let b = connection("b");
        let mut plan = stored.plan.clone();
        plan.connection_id = b.id.clone();
        plan.connection_name = b.name.clone();
        let preview = plans
            .insert(&b, None, plan, std::slice::from_ref(&target), context)
            .unwrap();
        let second = plans.consume(&preview.id).unwrap();
        assert_eq!(second.ownership_after.len(), 2);
        persist(&second.writes[0]);
        let before = fs::read(&path).unwrap();
        let (write, _) = prepare_at(
            &path,
            &b,
            Some("rotated-fixture"),
            "owner",
            &second.ownership_after,
            false,
        )
        .unwrap();
        let journal = t.path().join("journal.json");
        let mut tx =
            transaction::Transaction::begin(journal, "fixture-rollback", vec![write]).unwrap();
        tx.apply().unwrap();
        tx.rollback().unwrap();
        assert_eq!(fs::read(&path).unwrap(), before);
        let (write, _) = prepare_at(
            &path,
            &b,
            Some("rotated-fixture"),
            "owner",
            &second.ownership_after,
            false,
        )
        .unwrap();
        let mut tx = transaction::Transaction::begin(
            t.path().join("journal-2.json"),
            "fixture-conflict",
            vec![write],
        )
        .unwrap();
        tx.apply().unwrap();
        fs::write(&path, b"external edit").unwrap();
        assert!(tx.rollback().is_err());
        assert_eq!(fs::read(&path).unwrap(), b"external edit");
    });
}
