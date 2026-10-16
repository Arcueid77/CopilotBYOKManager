use super::*;
use crate::deployment::ownership::{self, TargetOwnership};
use crate::transaction::{PreparedWrite, Resource, Transaction};
use std::fs;

// No real home, registry, credential store or process environment is accessed.
fn fixture() -> (tempfile::TempDir, Vec<PreparedWrite>) {
    let root = tempfile::tempdir().unwrap();
    let values = desired_environment(&super::tests::connection(), Some("new-fixture-key")).unwrap();
    #[cfg(windows)]
    let writes = {
        use winreg::types::ToRegValue;
        let encode = |value: &str, kind: u32| {
            let mut bytes = kind.to_le_bytes().to_vec();
            bytes.extend(value.to_reg_value().bytes);
            bytes
        };
        values
            .into_iter()
            .map(|(name, value)| PreparedWrite {
                // Include REG_EXPAND_SZ; rollback must preserve the raw type/bytes.
                before: Some(encode(&format!("foreign-fixture-{name}"), 2)),
                after: value.map(|value| encode(&value, 1)),
                resource: Resource::UserEnvironment(name),
                restore_mode: None,
                write_mode: None,
            })
            .collect()
    };
    #[cfg(unix)]
    let writes = {
        let paths = unix_paths(root.path());
        for (index, path) in paths.iter().enumerate() {
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            let text = if matches!(index, 0 | 1 | 5) {
                "# foreign-fixture-key\n".to_string()
            } else {
                format!("export UNRELATED=keep\n{BLOCK_START}\n# foreign-fixture-key\n{BLOCK_END}\nexport AFTER=keep\n")
            };
            fs::write(path, text).unwrap();
        }
        prepare_unix_at(root.path(), &values).unwrap()
    };
    (root, writes)
}

fn proof(writes: &[PreparedWrite]) -> TargetOwnership {
    TargetOwnership {
        owner_id: "current-owner".into(),
        connection_id: super::tests::connection().id,
        target_id: "copilot-cli:user-environment".into(),
        target_kind: ClientKind::CopilotCli,
        resource_id: ownership::cli_resource_id(),
        projection_fingerprint: ownership::cli_projection(writes, false).unwrap(),
        target_fingerprint: "fixture-target".into(),
        deployed_at: chrono::Utc::now(),
    }
}

fn deploy(writes: Vec<PreparedWrite>, proofs: &[TargetOwnership]) -> Vec<PreparedWrite> {
    finish_preparation(
        &super::tests::connection(),
        "current-owner",
        proofs,
        false,
        writes,
    )
    .unwrap()
}

#[test]
fn publication_accepts_unmanaged_foreign_legacy_and_changed_cli_projections() {
    let (_root, writes) = fixture();
    let mut foreign = proof(&writes);
    foreign.owner_id = "another-installation".into();
    let mut changed = proof(&writes);
    changed.projection_fingerprint = "previous-projection".into();
    let mut different_connection = proof(&writes);
    different_connection.connection_id = "previous-connection".into();
    let expected = deploy(writes.clone(), &[]);
    for proofs in [
        vec![],
        vec![foreign],
        vec![changed],
        vec![different_connection],
    ] {
        let result = deploy(writes.clone(), &proofs);
        for ((before, result), expected) in writes.iter().zip(&result).zip(&expected) {
            assert_eq!(result.before, before.before);
            assert_eq!(result.after, expected.after);
        }
    }
    assert_ne!(
        ownership::cli_projection(&writes, false).unwrap(),
        ownership::cli_projection(&expected, true).unwrap()
    );
    #[cfg(windows)]
    for name in [
        "COPILOT_BYOK_MANAGER_COPILOT_OWNER_ID",
        "COPILOT_BYOK_MANAGER_COPILOT_CONNECTION_ID",
    ] {
        let write = expected
            .iter()
            .find(|write| matches!(&write.resource, Resource::UserEnvironment(key) if key == name))
            .unwrap();
        let text = String::from_utf16(
            &write.after.as_ref().unwrap()[4..]
                .chunks_exact(2)
                .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
                .collect::<Vec<_>>(),
        )
        .unwrap();
        assert!(text.starts_with(if name.ends_with("OWNER_ID") {
            "current-owner"
        } else {
            "one"
        }));
    }
    #[cfg(unix)]
    for write in &expected[2..5] {
        let text = std::str::from_utf8(write.after.as_ref().unwrap()).unwrap();
        assert!(text.starts_with("export UNRELATED=keep\n"));
        assert!(text.ends_with("export AFTER=keep\n"));
        assert!(text.contains("owner=current-owner"));
    }
}

#[test]
fn revocation_still_requires_this_connection_and_an_unchanged_owned_projection() {
    let (_root, writes) = fixture();
    let mut published = deploy(writes, &[]);
    for write in &mut published {
        write.before = write.after.clone();
    }
    let valid = proof(&published);
    let revoke = |proofs: &[TargetOwnership], writes| {
        finish_preparation(
            &super::tests::connection(),
            "current-owner",
            proofs,
            true,
            writes,
        )
    };
    assert!(revoke(std::slice::from_ref(&valid), published.clone()).is_ok());
    assert!(revoke(&[], published.clone()).is_err());
    for (owner, connection, projection) in [
        (
            "foreign",
            valid.connection_id.as_str(),
            valid.projection_fingerprint.as_str(),
        ),
        (
            "current-owner",
            "other-connection",
            valid.projection_fingerprint.as_str(),
        ),
        (
            "current-owner",
            valid.connection_id.as_str(),
            "stale-projection",
        ),
    ] {
        let mut invalid = valid.clone();
        invalid.owner_id = owner.into();
        invalid.connection_id = connection.into();
        invalid.projection_fingerprint = projection.into();
        assert!(revoke(&[invalid], published.clone()).is_err());
    }
    published[0].before = Some(b"external-change".to_vec());
    assert!(revoke(&[valid], published).is_err());
}

// The transaction sees file-backed copies of the exact prepared bytes on Windows.
// This exercises production journaling/compensation without touching HKCU.
fn transaction_fixture() -> (tempfile::TempDir, Vec<PreparedWrite>) {
    let (root, writes) = fixture();
    let mut writes = deploy(writes, &[]);
    for (index, write) in writes.iter_mut().enumerate() {
        let path = root.path().join(format!("resource-{index}"));
        if let Some(before) = &write.before {
            fs::write(&path, before).unwrap();
        }
        write.resource = Resource::File(path);
    }
    (root, writes)
}

#[test]
fn replacement_retains_exact_foreign_bytes_until_apply_and_for_rollback() {
    let (root, writes) = transaction_fixture();
    let journal = root.path().join("journal.json");
    let mut tx = Transaction::begin(journal, "reviewed-cli-plan", writes.clone()).unwrap();
    for write in &writes {
        assert_eq!(write.resource.read().unwrap(), write.before);
    }
    tx.apply().unwrap();
    for write in &writes {
        assert_eq!(write.resource.read().unwrap(), write.after);
    }
    tx.rollback().unwrap();
    for write in &writes {
        assert_eq!(write.resource.read().unwrap(), write.before);
    }
    tx.clear().unwrap();
}

#[test]
fn replacement_refuses_changes_after_review_before_write_and_before_rollback() {
    for stage in 0..3 {
        let (root, writes) = transaction_fixture();
        let journal = root.path().join("journal.json");
        let path = match &writes[0].resource {
            Resource::File(path) => path,
            #[cfg(windows)]
            _ => unreachable!(),
        };
        if stage == 0 {
            fs::write(path, b"external-edit").unwrap();
            assert!(Transaction::begin(journal, "reviewed-cli-plan", writes.clone()).is_err());
        } else {
            let mut tx = Transaction::begin(journal, "reviewed-cli-plan", writes.clone()).unwrap();
            if stage == 2 {
                tx.apply().unwrap();
            }
            fs::write(path, b"external-edit").unwrap();
            if stage == 1 {
                assert!(tx.apply().is_err());
            } else {
                assert!(tx.rollback().is_err());
            }
        }
        assert_eq!(fs::read(path).unwrap(), b"external-edit");
    }
}

#[cfg(unix)]
#[test]
fn confirmed_replacement_still_rejects_incomplete_shell_blocks() {
    let (root, _) = fixture();
    fs::write(
        root.path().join(".bashrc"),
        format!("{BLOCK_START}\n# incomplete\n"),
    )
    .unwrap();
    assert!(prepare_unix_at(
        root.path(),
        &desired_environment(&super::tests::connection(), None).unwrap()
    )
    .is_err());
}
