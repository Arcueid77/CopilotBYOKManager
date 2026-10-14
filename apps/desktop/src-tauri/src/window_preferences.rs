//! Window preferences only; never provider, client or credential state.
use crate::error::{AppError, AppResult};
use crate::{safe_io, write_lock::WriteLock};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const LIMIT: u64 = 4096;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CloseAction {
    Tray,
    Exit,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Preferences {
    version: u32,
    close_action: CloseAction,
}

pub struct WindowPreferences {
    path: Option<PathBuf>,
    original: Option<Vec<u8>>,
    close_action: CloseAction,
    available: bool,
}

impl WindowPreferences {
    pub fn open() -> Self {
        match crate::platform::config_dir() {
            Some(root) => Self::open_at(root.join("CopilotBYOKManager/window-preferences.json")),
            None => Self::unavailable(None),
        }
    }

    fn unavailable(path: Option<PathBuf>) -> Self {
        Self {
            path,
            original: None,
            close_action: CloseAction::Exit,
            available: false,
        }
    }

    fn open_at(path: PathBuf) -> Self {
        let Ok(original) = safe_io::read_optional(&path, LIMIT) else {
            return Self::unavailable(Some(path));
        };
        let action = match original.as_deref() {
            None => CloseAction::Tray,
            Some(bytes) => match serde_json::from_slice::<Preferences>(bytes) {
                Ok(value) if value.version == 1 => value.close_action,
                _ => return Self::unavailable(Some(path)),
            },
        };
        Self {
            path: Some(path),
            original,
            close_action: action,
            available: true,
        }
    }

    pub fn close_action(&self) -> CloseAction {
        self.close_action
    }

    pub fn available(&self) -> bool {
        self.available
    }

    pub fn set(&mut self, action: CloseAction) -> AppResult<()> {
        if !self.available {
            return Err(AppError::Config("Window preferences are read-only".into()));
        }
        let path = self
            .path
            .as_ref()
            .ok_or_else(|| AppError::Config("Window preferences are unavailable".into()))?;
        // Share native mutation exclusion, but never rewrite state.json or a client.
        let _lock = WriteLock::acquire(path)?;
        if safe_io::read_optional(path, LIMIT)? != self.original {
            return Err(AppError::Config(
                "Window preferences changed externally".into(),
            ));
        }
        if action == self.close_action {
            return Ok(());
        }
        let bytes = serde_json::to_vec(&Preferences {
            version: 1,
            close_action: action,
        })
        .map_err(|error| AppError::json(path, error))?;
        safe_io::write_private(path, &bytes)?;
        self.original = Some(bytes);
        self.close_action = action;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_close_to_tray_and_explicit_exit_reopen_without_other_data() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("app/window-preferences.json");
        let mut store = WindowPreferences::open_at(path.clone());
        assert_eq!(store.close_action(), CloseAction::Tray);
        assert!(store.available());
        assert!(!path.exists());
        store.set(CloseAction::Exit).unwrap();
        let reopened = WindowPreferences::open_at(path.clone());
        assert_eq!(reopened.close_action(), CloseAction::Exit);
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&std::fs::read(&path).unwrap()).unwrap(),
            serde_json::json!({"version":1,"closeAction":"exit"})
        );
        store.set(CloseAction::Tray).unwrap();
        assert_eq!(
            WindowPreferences::open_at(path).close_action(),
            CloseAction::Tray
        );
    }

    #[test]
    fn invalid_newer_or_oversized_preferences_are_preserved_and_do_not_hide() {
        for bytes in [
            b"invalid".to_vec(),
            br#"{"version":2,"closeAction":"tray"}"#.to_vec(),
            br#"{"version":1,"closeAction":"unknown"}"#.to_vec(),
            br#"{"version":1,"closeAction":"tray","command":"arbitrary"}"#.to_vec(),
            vec![b' '; LIMIT as usize + 1],
        ] {
            let root = tempfile::tempdir().unwrap();
            let path = root.path().join("window-preferences.json");
            std::fs::write(&path, &bytes).unwrap();
            let mut store = WindowPreferences::open_at(path.clone());
            assert!(!store.available());
            assert_eq!(store.close_action(), CloseAction::Exit);
            assert!(store.set(CloseAction::Tray).is_err());
            assert_eq!(std::fs::read(path).unwrap(), bytes);
        }
    }

    #[test]
    fn external_changes_and_write_failure_never_change_the_live_choice() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("window-preferences.json");
        let mut store = WindowPreferences::open_at(path.clone());
        std::fs::write(&path, b"external").unwrap();
        assert!(store.set(CloseAction::Exit).is_err());
        assert_eq!(store.close_action(), CloseAction::Tray);
        assert_eq!(std::fs::read(&path).unwrap(), b"external");
        let another = root.path().join("missing/window-preferences.json");
        let mut blocked = WindowPreferences::open_at(another.clone());
        std::fs::write(root.path().join("missing"), b"not a directory").unwrap();
        assert!(blocked.set(CloseAction::Exit).is_err());
        assert_eq!(blocked.close_action(), CloseAction::Tray);
    }

    #[test]
    fn concurrent_writer_is_rejected_and_release_allows_retry() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("window-preferences.json");
        let mut store = WindowPreferences::open_at(path.clone());
        let lock = WriteLock::acquire(&path).unwrap();
        assert!(matches!(store.set(CloseAction::Exit), Err(AppError::Busy)));
        drop(lock);
        store.set(CloseAction::Exit).unwrap();
    }
}
