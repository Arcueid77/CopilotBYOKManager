//! Stable IPC failure codes. Diagnostic text is redacted and remains separate from UI copy.
use crate::error::AppError;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FailureCode {
    AppRunning,
    AppExitUnverified,
    UnsafePermissions,
    WriteBusy,
    Unavailable,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandFailure {
    pub code: FailureCode,
    pub message: String,
}

impl From<AppError> for CommandFailure {
    fn from(error: AppError) -> Self {
        let code = match &error {
            AppError::AppRunning => FailureCode::AppRunning,
            AppError::AppExitUnverified => FailureCode::AppExitUnverified,
            AppError::UnsafeAppPermissions => FailureCode::UnsafePermissions,
            AppError::Busy => FailureCode::WriteBusy,
            _ => FailureCode::Unavailable,
        };
        Self {
            code,
            message: crate::redact::redact_text(&error.to_string()),
        }
    }
}
impl CommandFailure {
    pub(super) fn worker_failure() -> Self {
        Self {
            code: FailureCode::Unavailable,
            message: "Copilot App synchronization worker failed".into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn app_lifecycle_permissions_and_write_contention_remain_distinct() {
        assert_eq!(
            CommandFailure::from(AppError::AppRunning).code,
            FailureCode::AppRunning
        );
        assert_eq!(
            CommandFailure::from(AppError::AppExitUnverified).code,
            FailureCode::AppExitUnverified
        );
        assert_eq!(
            CommandFailure::from(AppError::UnsafeAppPermissions).code,
            FailureCode::UnsafePermissions
        );
        let busy = CommandFailure::from(AppError::Busy);
        assert_eq!(busy.code, FailureCode::WriteBusy);
        assert_eq!(serde_json::to_value(busy).unwrap()["code"], "writeBusy");
    }
}
