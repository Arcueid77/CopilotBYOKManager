//! Typed WinGet download failures, without parsing or exposing installer output.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallFailureKind {
    NameResolution,
    NetworkTimeout,
}

#[cfg(any(windows, test))]
pub fn from_exit_code(code: Option<i32>) -> Option<InstallFailureKind> {
    // WinINet/WinHTTP HRESULTs are signed by Windows' process API.
    match code.map(|value| value as u32) {
        Some(0x8007_2ee7) => Some(InstallFailureKind::NameResolution),
        Some(0x8007_2ee2) => Some(InstallFailureKind::NetworkTimeout),
        _ => None,
    }
}

#[cfg(any(windows, test))]
pub fn exit_code_label(code: Option<i32>) -> String {
    code.map_or_else(
        || "unavailable".into(),
        |value| format!("0x{:08X}", value as u32),
    )
}

#[cfg(any(windows, test))]
pub(super) fn process_result(
    component_id: &str,
    process_ok: bool,
    code: Option<i32>,
    verified: bool,
) -> super::InstallOperationResult {
    use super::{InstallOperationResult, InstallResultStatus};
    InstallOperationResult {
        component_id: component_id.into(),
        status: match (process_ok, verified) {
            (_, true) => InstallResultStatus::CompletedAndVerified,
            (true, false) => InstallResultStatus::ProcessSucceededVerificationFailed,
            (false, false) => InstallResultStatus::Failed,
        },
        failure_kind: if verified { None } else { from_exit_code(code) },
        detail: if verified {
            "Installation completed and the component was re-detected".into()
        } else {
            format!(
                "Installer exited with code {}; component verification did not pass",
                exit_code_label(code)
            )
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::installer::{InstallOperationResult, InstallResultStatus};

    #[test]
    fn signed_dns_hresult_and_timeout_are_typed_without_classifying_unknown_codes() {
        assert_eq!(
            from_exit_code(Some(-2147012889)),
            Some(InstallFailureKind::NameResolution)
        );
        assert_eq!(
            from_exit_code(Some(0x8007_2ee2_u32 as i32)),
            Some(InstallFailureKind::NetworkTimeout)
        );
        assert_eq!(exit_code_label(Some(-2147012889)), "0x80072EE7");
        for code in [None, Some(0), Some(1), Some(12007)] {
            assert_eq!(from_exit_code(code), None);
        }
    }

    #[test]
    fn existing_history_without_failure_metadata_is_preserved() {
        let old =
            br#"{"componentId":"github-copilot-app","status":"failed","detail":"old diagnostic"}"#;
        let result: InstallOperationResult = serde_json::from_slice(old).unwrap();
        assert_eq!(result.status, InstallResultStatus::Failed);
        assert!(result.failure_kind.is_none());
        assert_eq!(
            serde_json::to_value(result).unwrap()["detail"],
            "old diagnostic"
        );
    }

    #[test]
    fn network_exit_cannot_report_success_and_verified_component_wins_over_late_exit_errors() {
        let failed = process_result("github-copilot-app", false, Some(-2147012889), false);
        assert_eq!(failed.status, InstallResultStatus::Failed);
        assert_eq!(
            failed.failure_kind,
            Some(InstallFailureKind::NameResolution)
        );
        assert!(failed.detail.contains("0x80072EE7"));
        assert!(!failed.detail.contains("Some("));
        let verified = process_result("github-copilot-app", false, Some(-2147012889), true);
        assert_eq!(verified.status, InstallResultStatus::CompletedAndVerified);
        assert!(verified.failure_kind.is_none());
        let unknown = process_result("github-copilot-app", true, Some(0), false);
        assert_eq!(
            unknown.status,
            InstallResultStatus::ProcessSucceededVerificationFailed
        );
    }
}
