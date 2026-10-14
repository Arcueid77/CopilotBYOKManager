use super::*;
use std::io::{Cursor, Write};

const XML: &[u8] = include_bytes!("fixtures/plugin-v1.xml");

fn jar(xml: &[u8], name: &str) -> Vec<u8> {
    let mut archive = zip::ZipWriter::new(Cursor::new(Vec::new()));
    archive
        .start_file(
            name,
            zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated),
        )
        .unwrap();
    archive.write_all(xml).unwrap();
    archive.finish().unwrap().into_inner()
}
fn install(root: &Path, profile: &str) -> PathBuf {
    let dir = root
        .join(profile)
        .join("plugins/github-copilot-intellij/lib");
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join("github-copilot-intellij.jar");
    fs::write(&path, jar(XML, "META-INF/plugin.xml")).unwrap();
    path
}
pub(super) fn connection() -> Connection {
    serde_json::from_value(
        serde_json::json!({"id":"fixture", "name":"Fixture", "baseUrl":"https://example.invalid/v1",
        "secretRef":"never-return-this-reference", "hasSecret":true,
        "createdAt":chrono::Utc::now(), "updatedAt":chrono::Utc::now(),
        "headers":{"Authorization":"never-return-this-header"},
        "models":[{"id":"model","modelId":"fixture-model","name":"Fixture model","enabled":true}]}),
    )
    .unwrap()
}

#[test]
fn standard_profiles_are_separate_stable_writable_targets_for_reviewed_version() {
    let root = tempfile::tempdir().unwrap();
    let idea = install(root.path(), "IntelliJIdea2026.2");
    install(root.path(), "PyCharm2026.2");
    fs::create_dir_all(root.path().join("UnknownProduct2026.2")).unwrap();
    let before = fs::read(&idea).unwrap();
    let first = discover_at(root.path(), root.path()).unwrap();
    assert_eq!(first.len(), 2);
    assert_ne!(first[0].target.id, first[1].target.id);
    for o in &first {
        assert!(o.target.detected);
        assert!(o.target.supports_write);
        assert_eq!(o.target.status, ClientStatus::Available);
    }
    let second = discover_at(root.path(), root.path()).unwrap();
    assert_eq!(first[0].target.id, second[0].target.id);
    assert_eq!(first[0].digest, second[0].digest);
    assert_eq!(fs::read(&idea).unwrap(), before);
}

#[test]
fn official_distribution_with_many_dependencies_reads_only_the_descriptor_jar() {
    let root = tempfile::tempdir().unwrap();
    let path = install(root.path(), "IntelliJIdea2026.2");
    let lib = path.parent().unwrap();
    fs::rename(
        &path,
        lib.join("github-copilot-intellij-1.19.0-261-windows-x64.jar"),
    )
    .unwrap();
    // The reviewed archive has more than 32 libraries. Corrupt/non-descriptor
    // dependencies must neither be parsed nor exhaust the descriptor byte budget.
    for index in 0..64 {
        fs::write(
            lib.join(format!("dependency-{index}.jar")),
            b"not a descriptor jar",
        )
        .unwrap();
    }
    let mut budget = 16 * 1024;
    let profile = root.path().join("IntelliJIdea2026.2");
    let found = inspect_profile(&profile, &profile.join("plugins"), &mut budget)
        .unwrap()
        .unwrap();
    assert_eq!(found.0, "1.19.0-261-windows-x64");
    assert!(budget > 0);
    assert!(
        discover_at(root.path(), root.path()).unwrap()[0]
            .target
            .supports_write
    );
}

#[test]
fn reviewed_252_bundle_is_writable_through_the_same_native_plan_contract() {
    let root = tempfile::tempdir().unwrap();
    let jar_path = install(root.path(), "IntelliJIdea2025.2");
    fs::write(
        &jar_path,
        jar(
            include_bytes!("fixtures/plugin-252-v1.xml"),
            "META-INF/plugin.xml",
        ),
    )
    .unwrap();
    let path = root.path().join("runtime/byok.json");
    with_test_roots(root.path(), || {
        byok::with_test_path(&path, || {
            let targets = discover_at(root.path(), root.path())
                .unwrap()
                .into_iter()
                .map(|o| o.target)
                .collect::<Vec<_>>();
            assert!(targets[0].detected && targets[0].supports_write);
            let ids = vec![targets[0].id.clone()];
            let mut c = connection();
            c.secret_ref = "connection:fixture".into();
            c.headers.clear();
            let mut plans = crate::deployment::PlanStore::default();
            let context =
                crate::deployment::PlanContext::new("owner", "state".into(), Some("synthetic-key"));
            let plan = plans
                .insert(
                    &c,
                    Some("synthetic-key"),
                    crate::adapters::preview_resolved(&c, &ids, &targets).unwrap(),
                    &targets,
                    context,
                )
                .unwrap();
            let stored = plans.consume(&plan.id).unwrap();
            assert!(plan.operations[0].supported);
            assert_eq!(stored.writes.len(), 1);
            assert_eq!(stored.ownership_after.len(), 1);
            assert!(!path.exists());
        })
    });
}

#[test]
fn missing_and_disabled_plugins_are_not_reported_ready() {
    let root = tempfile::tempdir().unwrap();
    install(root.path(), "WebStorm2026.2");
    fs::write(
        root.path().join("WebStorm2026.2/disabled_plugins.txt"),
        b"\xef\xbb\xbfcom.github.copilot\r\nother.plugin\r\n",
    )
    .unwrap();
    fs::create_dir_all(root.path().join("GoLand2026.2")).unwrap();
    let targets = discover_at(root.path(), root.path()).unwrap();
    let disabled = targets
        .iter()
        .find(|o| o.target.name.starts_with("WebStorm"))
        .unwrap();
    assert!(!disabled.target.detected);
    assert!(disabled.target.detail.contains("disabled"));
    let missing = targets
        .iter()
        .find(|o| o.target.name.starts_with("GoLand"))
        .unwrap();
    assert_eq!(missing.target.status, ClientStatus::NotInstalled);
}

#[test]
fn linux_separate_config_and_plugin_roots_are_respected() {
    let root = tempfile::tempdir().unwrap();
    let config = root.path().join("config");
    let plugins = root.path().join("data");
    fs::create_dir_all(config.join("Rider2026.2")).unwrap();
    let jar = install(&plugins, "Rider2026.2");
    let direct = plugins.join("Rider2026.2/github-copilot-intellij/lib");
    fs::create_dir_all(&direct).unwrap();
    fs::rename(&jar, direct.join("copilot.jar")).unwrap();
    // Linux's data profile is itself the plugin root, not <profile>/plugins.
    fs::remove_dir_all(plugins.join("Rider2026.2/plugins")).unwrap();
    let targets = discover_at(&config, &plugins).unwrap();
    assert!(targets[0].target.detected);
    assert!(targets[0].target.path.as_ref().unwrap().contains("config"));
}

#[test]
fn lookalike_id_and_wrong_vendor_cannot_impersonate_copilot() {
    assert!(descriptor::parse(
        &String::from_utf8(XML.to_vec())
            .unwrap()
            .replace(PLUGIN_ID, "example.copilot")
            .into_bytes()
    )
    .unwrap()
    .is_none());
    assert!(descriptor::parse(
        &String::from_utf8(XML.to_vec())
            .unwrap()
            .replace(">GitHub</vendor>", ">Other</vendor>")
            .into_bytes()
    )
    .is_err());
    let root = tempfile::tempdir().unwrap();
    let path = install(root.path(), "IntelliJIdea2026.2");
    fs::write(
        path,
        jar(
            b"<idea-plugin><id>example.copilot</id></idea-plugin>",
            "META-INF/plugin.xml",
        ),
    )
    .unwrap();
    assert!(
        !discover_at(root.path(), root.path()).unwrap()[0]
            .target
            .detected
    );
}

#[test]
fn jar_parser_does_not_extract_paths_and_bounds_decompression() {
    assert!(descriptor::from_jar(&jar(XML, "../../outside.xml"))
        .unwrap()
        .is_none());
    assert!(descriptor::from_jar(b"not a jar").is_err());
    let bomb = jar(
        &vec![b'x'; descriptor::MAX_XML_BYTES as usize + 1],
        "META-INF/plugin.xml",
    );
    assert!(descriptor::from_jar(&bomb).is_err());
    assert_eq!(
        descriptor::parse(
            &descriptor::from_jar(&jar(XML, "META-INF/plugin.xml"))
                .unwrap()
                .unwrap()
        )
        .unwrap()
        .unwrap(),
        "1.19.0-261-windows-x64"
    );
    let mut excessive = jar(XML, "META-INF/plugin.xml");
    let len = excessive.len();
    excessive[len - 12..len - 10].copy_from_slice(&8193_u16.to_le_bytes());
    assert!(descriptor::from_jar(&excessive).is_err());
}

#[test]
fn unsupported_descriptor_versions_duplicates_and_external_entities_fail_closed() {
    for xml in [b"<future-plugin><id>com.github.copilot</id></future-plugin>".as_slice(),
        b"<idea-plugin><id>com.github.copilot</id><id>com.github.copilot</id></idea-plugin>",
        b"<!DOCTYPE idea-plugin [<!ENTITY key SYSTEM 'file:///private/secret'>]><idea-plugin><id>&key;</id></idea-plugin>",
        b"<idea-plugin><id>com.github.copilot</id>",
        b"garbage<idea-plugin><id>example.plugin</id></idea-plugin>",
        b"<idea-plugin><id/><id>com.github.copilot</id></idea-plugin>",
        b"<?xml version='1.0' encoding='ISO-8859-1'?><idea-plugin><id>example.plugin</id></idea-plugin>"] {
        assert!(descriptor::parse(xml).is_err());
    }
    let harmless = String::from_utf8(XML.to_vec())
        .unwrap()
        .replace("<description>", "<description>&amp; &#65;");
    assert!(descriptor::parse(harmless.as_bytes()).unwrap().is_some());
}

#[test]
fn loose_descriptors_work_and_ambiguous_plugin_copies_are_errors() {
    let root = tempfile::tempdir().unwrap();
    let plugin = root
        .path()
        .join("IntelliJIdea2026.2/plugins/copilot-intellij/META-INF");
    fs::create_dir_all(&plugin).unwrap();
    fs::write(plugin.join("plugin.xml"), XML).unwrap();
    assert!(
        discover_at(root.path(), root.path()).unwrap()[0]
            .target
            .detected
    );
    install(root.path(), "IntelliJIdea2026.2");
    assert_eq!(
        discover_at(root.path(), root.path()).unwrap()[0]
            .target
            .status,
        ClientStatus::Error
    );
}

#[test]
fn descriptor_change_and_disable_invalidate_the_observation_digest() {
    let root = tempfile::tempdir().unwrap();
    let path = install(root.path(), "IntelliJIdea2026.2");
    let first = discover_at(root.path(), root.path()).unwrap().remove(0);
    let changed = String::from_utf8(XML.to_vec())
        .unwrap()
        .replace("Synthetic", "Changed");
    fs::write(path, jar(changed.as_bytes(), "META-INF/plugin.xml")).unwrap();
    let second = discover_at(root.path(), root.path()).unwrap().remove(0);
    assert_eq!(first.target.id, second.target.id);
    assert_ne!(first.digest, second.digest);
    fs::write(
        root.path().join("IntelliJIdea2026.2/disabled_plugins.txt"),
        PLUGIN_ID,
    )
    .unwrap();
    let third = discover_at(root.path(), root.path()).unwrap().remove(0);
    assert_ne!(second.digest, third.digest);
    assert!(!third.target.detected);
}

#[test]
fn unsafe_corrupt_and_excessive_metadata_are_errors_not_missing_or_success() {
    let root = tempfile::tempdir().unwrap();
    let path = install(root.path(), "PyCharm2026.2");
    fs::write(&path, b"corrupt").unwrap();
    let found = discover_at(root.path(), root.path()).unwrap();
    assert_eq!(found[0].target.status, ClientStatus::Error);
    assert!(!found[0].target.detected);
    fs::write(&path, jar(XML, "META-INF/plugin.xml")).unwrap();
    let mut budget = 1;
    assert!(inspect_profile(
        &root.path().join("PyCharm2026.2"),
        &root.path().join("PyCharm2026.2/plugins"),
        &mut budget
    )
    .is_err());
    for n in 0..MAX_ENTRIES + 1 {
        fs::create_dir(root.path().join(format!("unrelated-{n}"))).unwrap();
    }
    assert!(discover_at(root.path(), root.path()).is_err());
}

#[test]
fn preview_supports_automatic_byok_without_returning_credentials() {
    let root = tempfile::tempdir().unwrap();
    install(root.path(), "IntelliJIdea2026.2");
    let target = discover_at(root.path(), root.path())
        .unwrap()
        .remove(0)
        .target;
    let connection = connection();
    let operation = preview(&connection, &target);
    assert!(operation.supported);
    assert!(operation.description.contains("Automatically deploy"));
    let serialized = serde_json::to_string(&operation).unwrap();
    assert!(serialized.contains("fixture-model"));
    assert!(!serialized.contains("never-return-this"));
    assert!(crate::adapters::apply_to_target(
        &connection,
        Some("provider-key-not-to-copy"),
        &target
    )
    .is_err());
    let plan = crate::adapters::preview_resolved(
        &connection,
        std::slice::from_ref(&target.id),
        std::slice::from_ref(&target),
    )
    .unwrap();
    assert!(plan.operations[0].supported);
    assert_eq!(plan.operations[0].target_kind, ClientKind::JetBrainsCopilot);
}

#[test]
fn forged_writable_flag_cannot_bypass_an_unreviewed_plugin_version() {
    let root = tempfile::tempdir().unwrap();
    let jar = install(root.path(), "IntelliJIdea2026.2");
    let xml = String::from_utf8(XML.to_vec())
        .unwrap()
        .replace("1.19.0", "1.20.0");
    fs::write(
        &jar,
        super::tests::jar(xml.as_bytes(), "META-INF/plugin.xml"),
    )
    .unwrap();
    let before = fs::read(&jar).unwrap();
    let mut target = discover_at(root.path(), root.path())
        .unwrap()
        .remove(0)
        .target;
    target.supports_write = true;
    let mut connection = connection();
    connection.secret_ref = "connection:fixture".into();
    connection.headers.clear();
    let mut plan = crate::adapters::preview_resolved(
        &connection,
        std::slice::from_ref(&target.id),
        std::slice::from_ref(&target),
    )
    .unwrap();
    plan.operations[0].supported = true;
    let context = crate::deployment::PlanContext::new("owner", "state".into(), None);
    with_test_roots(root.path(), || {
        assert!(matches!(
            crate::deployment::prepare_writes(
                &connection,
                Some("secret"),
                &mut plan,
                &[target],
                &context
            ),
            Err(AppError::Unsupported(_))
        ));
    });
    assert_eq!(fs::read(&jar).unwrap(), before);
}

#[test]
fn jetbrains_durable_proof_is_accepted_but_client_auth_remains_separate() {
    let proof = crate::deployment::ownership::TargetOwnership {
        owner_id: "owner".into(),
        connection_id: "connection".into(),
        target_id: "jetbrains:fixture".into(),
        target_kind: ClientKind::JetBrainsCopilot,
        resource_id: "a".repeat(64),
        projection_fingerprint: "b".repeat(64),
        target_fingerprint: "c".repeat(64),
        deployed_at: chrono::Utc::now(),
    };
    assert!(crate::deployment::ownership::validate(
        &[proof],
        "owner",
        &std::collections::HashSet::from(["connection".into()])
    )
    .is_ok());
}

#[test]
fn shared_byok_is_written_once_with_native_plan_stale_checks_and_private_recovery() {
    use crate::{deployment, transaction};
    let root = tempfile::tempdir().unwrap();
    install(root.path(), "IntelliJIdea2026.2");
    install(root.path(), "PyCharm2026.2");
    let path = root.path().join("runtime/byok.json");
    with_test_roots(root.path(), || {
        byok::with_test_path(&path, || {
            let targets = discover_at(root.path(), root.path())
                .unwrap()
                .into_iter()
                .map(|o| o.target)
                .collect::<Vec<_>>();
            let ids = targets.iter().map(|t| t.id.clone()).collect::<Vec<_>>();
            let mut connection = connection();
            connection.secret_ref = "connection:fixture".into();
            connection.headers.clear();
            let context =
                deployment::PlanContext::new("owner", "state".into(), Some("synthetic-key"));
            let mut plans = deployment::PlanStore::default();
            let plan = plans
                .insert(
                    &connection,
                    Some("synthetic-key"),
                    crate::adapters::preview_resolved(&connection, &ids, &targets).unwrap(),
                    &targets,
                    context.clone(),
                )
                .unwrap();
            assert!(plan
                .operations
                .iter()
                .all(|o| o.supported && o.requires_restart));
            assert!(!serde_json::to_string(&plan)
                .unwrap()
                .contains("synthetic-key"));
            let stored = plans.consume(&plan.id).unwrap();
            assert!(plans.consume(&plan.id).is_err());
            assert_eq!(stored.writes.len(), 1);
            assert_eq!(stored.ownership_after.len(), 2);
            assert_eq!(
                stored.ownership_after[0].resource_id,
                stored.ownership_after[1].resource_id
            );
            deployment::validate_plan(&stored, &connection, &targets, &context).unwrap();
            let journal = root.path().join("journal.json");
            let mut tx =
                transaction::Transaction::begin(journal.clone(), &plan.id, stored.writes.clone())
                    .unwrap();
            tx.apply().unwrap();
            assert!(path.exists());
            assert!(deployment::validate_plan(&stored, &connection, &targets, &context).is_err());
            let allowed = byok::observed_resources().unwrap();
            let recovery = transaction::recovery_view(&journal, &allowed).unwrap();
            let rendered = serde_json::to_string(&recovery).unwrap();
            assert!(!rendered.contains("synthetic-key"));
            // Restore uses the known dedicated namespace, including after plugin removal.
            transaction::recover(&journal, &recovery.digest, &allowed).unwrap();
            assert!(!path.exists());
        })
    });
}

#[test]
fn external_namespace_or_plugin_changes_reject_a_reviewed_plan_before_any_write() {
    use crate::deployment;
    for change_namespace in [true, false] {
        let root = tempfile::tempdir().unwrap();
        install(root.path(), "IntelliJIdea2026.2");
        let path = root.path().join("byok.json");
        with_test_roots(root.path(), || {
            byok::with_test_path(&path, || {
                let targets = discover_at(root.path(), root.path())
                    .unwrap()
                    .into_iter()
                    .map(|o| o.target)
                    .collect::<Vec<_>>();
                let ids = vec![targets[0].id.clone()];
                let mut c = connection();
                c.secret_ref = "connection:fixture".into();
                c.headers.clear();
                let context =
                    deployment::PlanContext::new("owner", "state".into(), Some("synthetic-key"));
                let mut plans = deployment::PlanStore::default();
                let plan = plans
                    .insert(
                        &c,
                        Some("synthetic-key"),
                        crate::adapters::preview_resolved(&c, &ids, &targets).unwrap(),
                        &targets,
                        context.clone(),
                    )
                    .unwrap();
                let stored = plans.consume(&plan.id).unwrap();
                if change_namespace {
                    fs::write(&path, include_bytes!("fixtures/byok-v1.json")).unwrap();
                } else {
                    fs::write(
                        root.path().join("IntelliJIdea2026.2/disabled_plugins.txt"),
                        PLUGIN_ID,
                    )
                    .unwrap();
                }
                let before = crate::safe_file::read_optional(&path, 4 * 1024 * 1024).unwrap();
                assert!(matches!(
                    deployment::validate_plan(&stored, &c, &targets, &context),
                    Err(AppError::PlanChanged)
                ));
                assert_eq!(
                    crate::safe_file::read_optional(&path, 4 * 1024 * 1024).unwrap(),
                    before
                );
                assert!(plans.consume(&plan.id).is_err());
            })
        });
    }
}

#[test]
fn jetbrains_prepare_failure_leaves_an_earlier_vscode_target_untouched() {
    use crate::deployment;
    let root = tempfile::tempdir().unwrap();
    install(root.path(), "IntelliJIdea2026.2");
    let path = root.path().join("byok.json");
    let vscode = root.path().join("chatLanguageModels.json");
    let vscode_seed = b"// user formatting\n[{name:'Unmanaged',vendor:'customendpoint'}]";
    let malformed = b"{\"duplicate\":1,\"duplicate\":2}";
    fs::write(&path, malformed).unwrap();
    fs::write(&vscode, vscode_seed).unwrap();
    with_test_roots(root.path(), || {
        byok::with_test_path(&path, || {
            let mut targets = vec![ClientTarget {
                id: "vscode:fixture".into(),
                kind: ClientKind::VsCodeCopilot,
                name: "Fixture VS Code".into(),
                detail: "Temporary target".into(),
                path: Some(vscode.to_string_lossy().into()),
                detected: true,
                supports_write: true,
                status: ClientStatus::Available,
                diagnostic: None,
            }];
            targets.extend(
                discover_at(root.path(), root.path())
                    .unwrap()
                    .into_iter()
                    .map(|o| o.target),
            );
            let ids = targets.iter().map(|t| t.id.clone()).collect::<Vec<_>>();
            let mut c = connection();
            c.secret_ref = "connection:fixture".into();
            c.headers.clear();
            let context =
                deployment::PlanContext::new("owner", "state".into(), Some("synthetic-key"));
            let mut plans = deployment::PlanStore::default();
            assert!(plans
                .insert(
                    &c,
                    Some("synthetic-key"),
                    crate::adapters::preview_resolved(&c, &ids, &targets).unwrap(),
                    &targets,
                    context
                )
                .is_err());
            assert_eq!(fs::read(&vscode).unwrap(), vscode_seed);
            assert_eq!(fs::read(&path).unwrap(), malformed);
            assert!(!vscode
                .with_extension("json.copilot-byok-manager.bak")
                .exists());
        })
    });
}

#[test]
fn owned_revocation_does_not_require_a_cleared_key_or_changed_endpoint_to_be_deployable() {
    use crate::{deployment, transaction};
    let root = tempfile::tempdir().unwrap();
    install(root.path(), "IntelliJIdea2026.2");
    let path = root.path().join("byok.json");
    let seed = include_bytes!("fixtures/byok-v1.json");
    fs::write(&path, seed).unwrap();
    with_test_roots(root.path(), || {
        byok::with_test_path(&path, || {
            let targets = discover_at(root.path(), root.path())
                .unwrap()
                .into_iter()
                .map(|o| o.target)
                .collect::<Vec<_>>();
            let ids = vec![targets[0].id.clone()];
            let mut c = connection();
            c.secret_ref = "connection:fixture".into();
            c.headers.clear();
            let mut plans = deployment::PlanStore::default();
            let context =
                deployment::PlanContext::new("owner", "state".into(), Some("synthetic-key"));
            let plan = plans
                .insert(
                    &c,
                    Some("synthetic-key"),
                    crate::adapters::preview_resolved(&c, &ids, &targets).unwrap(),
                    &targets,
                    context,
                )
                .unwrap();
            let deployed = plans.consume(&plan.id).unwrap();
            let mut tx = transaction::Transaction::begin(
                root.path().join("journal"),
                &plan.id,
                deployed.writes,
            )
            .unwrap();
            tx.apply().unwrap();
            tx.complete().unwrap();
            c.has_secret = false;
            c.base_url = "https://example.invalid/custom?api-version=changed".into();
            assert!(!preview(&c, &targets[0]).supported);
            let context = deployment::PlanContext::new("owner", "changed-state".into(), None)
                .with_ownership(&deployed.ownership_after);
            let plan = plans
                .insert(
                    &c,
                    None,
                    crate::adapters::preview_revoke_resolved(&c, &ids, &targets).unwrap(),
                    &targets,
                    context.clone(),
                )
                .unwrap();
            assert!(plan.operations[0].supported);
            assert_eq!(
                plan.purpose,
                crate::domain::DeploymentPurpose::RevokeAndDelete
            );
            let revoke = plans.consume(&plan.id).unwrap();
            assert!(revoke.ownership_after.is_empty());
            deployment::validate_plan(&revoke, &c, &targets, &context).unwrap();
            let mut tx = transaction::Transaction::begin(
                root.path().join("journal"),
                &plan.id,
                revoke.writes,
            )
            .unwrap();
            tx.apply().unwrap();
            tx.complete().unwrap();
            assert_eq!(
                serde_json::from_slice::<serde_json::Value>(&fs::read(&path).unwrap()).unwrap(),
                serde_json::from_slice::<serde_json::Value>(seed).unwrap()
            );
        })
    });
}

#[test]
fn byok_ownership_reopens_with_state_and_allows_idempotent_redeployment() {
    use crate::{deployment, domain::PersistentState, state::StateStore, transaction};
    let root = tempfile::tempdir().unwrap();
    install(root.path(), "IntelliJIdea2026.2");
    install(root.path(), "PyCharm2026.2");
    let path = root.path().join("runtime/byok.json");
    let state_path = root.path().join("state.json");
    let mut connection = connection();
    connection.secret_ref = "connection:fixture".into();
    connection.headers.clear();
    let seed = PersistentState {
        connections: vec![connection.clone()],
        ..PersistentState::default()
    };
    fs::write(&state_path, serde_json::to_vec(&seed).unwrap()).unwrap();
    with_test_roots(root.path(), || {
        byok::with_test_path(&path, || {
            let targets = discover_at(root.path(), root.path())
                .unwrap()
                .into_iter()
                .map(|o| o.target)
                .collect::<Vec<_>>();
            let ids = targets.iter().map(|t| t.id.clone()).collect::<Vec<_>>();
            let mut state = StateStore::open_at(state_path.clone());
            assert!(state.recovery().is_none());
            let context = deployment::PlanContext::new(
                state.installation_owner_id(),
                state.revision().unwrap(),
                Some("synthetic-key"),
            )
            .with_ownership(state.ownership());
            let mut plans = deployment::PlanStore::default();
            let plan = plans
                .insert(
                    &connection,
                    Some("synthetic-key"),
                    crate::adapters::preview_resolved(&connection, &ids, &targets).unwrap(),
                    &targets,
                    context,
                )
                .unwrap();
            let stored = plans.consume(&plan.id).unwrap();
            let mut tx = transaction::Transaction::begin(
                root.path().join("journal.json"),
                &plan.id,
                stored.writes,
            )
            .unwrap();
            tx.apply().unwrap();
            state
                .commit_deployment(Vec::new(), stored.ownership_after, None)
                .unwrap();
            tx.complete().unwrap();
            drop(state);
            let state = StateStore::open_at(state_path.clone());
            assert!(state.recovery().is_none());
            assert_eq!(state.ownership().len(), 2);
            assert!(!String::from_utf8(fs::read(&state_path).unwrap())
                .unwrap()
                .contains("synthetic-key"));
            let context = deployment::PlanContext::new(
                state.installation_owner_id(),
                state.revision().unwrap(),
                Some("synthetic-key"),
            )
            .with_ownership(state.ownership());
            let plan = plans
                .insert(
                    &connection,
                    Some("synthetic-key"),
                    crate::adapters::preview_resolved(&connection, &ids, &targets).unwrap(),
                    &targets,
                    context,
                )
                .unwrap();
            let stored = plans.consume(&plan.id).unwrap();
            assert_eq!(stored.writes.len(), 1);
            assert!(!stored.writes[0].changed());
            assert_eq!(stored.ownership_after.len(), 2);
        })
    });
}

#[cfg(unix)]
#[test]
fn linked_plugin_or_profile_is_never_followed() {
    let root = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    install(outside.path(), "PyCharm2026.2");
    std::os::unix::fs::symlink(
        outside.path().join("PyCharm2026.2"),
        root.path().join("PyCharm2026.2"),
    )
    .unwrap();
    let found = discover_at(root.path(), root.path()).unwrap();
    assert_eq!(found[0].target.status, ClientStatus::Error);
}

#[cfg(windows)]
#[test]
fn junction_plugin_or_profile_is_never_followed() {
    let root = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    install(outside.path(), "PyCharm2026.2");
    let junction = root.path().join("PyCharm2026.2");
    // Test-only temp directory junction. No home/profile path is involved.
    let status = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(&junction)
        .arg(outside.path().join("PyCharm2026.2"))
        .output()
        .unwrap();
    assert!(status.status.success());
    assert_eq!(
        discover_at(root.path(), root.path()).unwrap()[0]
            .target
            .status,
        ClientStatus::Error
    );
    fs::remove_dir(junction).unwrap();
}
