//! One CLI resolver for discovery, installation verification and runtime use.
//! Re-read Windows user/machine PATH and the reviewed WinGet portable location.
use crate::error::AppResult;
use std::path::PathBuf;

pub(crate) fn executable() -> AppResult<Option<PathBuf>> {
    #[cfg(feature = "local-e2e")]
    if crate::test_support::active() {
        return Ok(crate::test_support::executable("copilot.exe"));
    }
    #[cfg(windows)]
    {
        windows::locate()
    }
    #[cfg(not(windows))]
    {
        Ok(crate::native_process::resolve_on_path(&["copilot"]))
    }
}

pub(crate) fn native_executable() -> Option<PathBuf> {
    executable().ok().flatten().filter(|path| {
        !cfg!(windows)
            || path
                .extension()
                .is_some_and(|e| e.eq_ignore_ascii_case("exe"))
    })
}

#[cfg(windows)]
mod windows {
    use super::*;
    use crate::error::AppError;
    use std::collections::HashSet;
    use windows_sys::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
    use windows_sys::Win32::System::Registry::RegQueryValueExW;
    use winreg::{enums::*, RegKey};

    const MAX_PATH_BYTES: usize = 128 * 1024;
    const PORTABLE: &str =
        "Microsoft/WinGet/Packages/GitHub.Copilot_Microsoft.Winget.Source_8wekyb3d8bbwe";
    fn unavailable() -> AppError {
        AppError::Config("Current Windows CLI search paths could not be read safely".into())
    }

    fn read_path(root: &RegKey, key: &str) -> AppResult<Option<String>> {
        let key = match root.open_subkey_with_flags(key, KEY_READ) {
            Ok(key) => key,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(_) => return Err(unavailable()),
        };
        let mut bytes = vec![0u8; MAX_PATH_BYTES];
        let mut len = bytes.len() as u32;
        let mut kind = 0;
        let name = [80u16, 97, 116, 104, 0];
        let result = unsafe {
            RegQueryValueExW(
                key.raw_handle() as _,
                name.as_ptr(),
                std::ptr::null_mut(),
                &mut kind,
                bytes.as_mut_ptr(),
                &mut len,
            )
        };
        if result == ERROR_FILE_NOT_FOUND {
            return Ok(None);
        }
        if result != ERROR_SUCCESS || len as usize > bytes.len() {
            return Err(unavailable());
        }
        decode(kind, &bytes[..len as usize]).map(Some)
    }

    fn decode(kind: u32, bytes: &[u8]) -> AppResult<String> {
        if !matches!(kind, 1 | 2) || bytes.len() > MAX_PATH_BYTES || !bytes.len().is_multiple_of(2)
        {
            return Err(unavailable());
        }
        let mut units: Vec<_> = bytes
            .chunks_exact(2)
            .map(|b| u16::from_le_bytes([b[0], b[1]]))
            .collect();
        if units.last() == Some(&0) {
            units.pop();
        }
        let text = String::from_utf16(&units).map_err(|_| unavailable())?;
        if text.chars().any(char::is_control) {
            return Err(unavailable());
        }
        Ok(text)
    }

    fn directories(raw: &str) -> Vec<PathBuf> {
        if raw.len() > MAX_PATH_BYTES {
            return Vec::new();
        }
        raw.split(';')
            .take(256)
            .filter_map(|entry| {
                let mut entry = entry.trim().trim_matches('"').to_owned();
                // Expand only public directory variables; never look up arbitrary
                // environment names (which may be credential variables).
                for variable in [
                    "USERPROFILE",
                    "LOCALAPPDATA",
                    "APPDATA",
                    "PROGRAMFILES",
                    "PROGRAMFILES(X86)",
                    "PROGRAMW6432",
                    "SYSTEMROOT",
                    "WINDIR",
                    "SYSTEMDRIVE",
                ] {
                    let needle = format!("%{variable}%");
                    if let Some(value) = std::env::var_os(variable) {
                        while let Some(index) = entry.to_ascii_uppercase().find(&needle) {
                            entry.replace_range(
                                index..index + needle.len(),
                                &value.to_string_lossy(),
                            );
                            if entry.len() > MAX_PATH_BYTES
                                || value
                                    .to_string_lossy()
                                    .to_ascii_uppercase()
                                    .contains(&needle)
                            {
                                return None;
                            }
                        }
                    }
                }
                let path = PathBuf::from(entry);
                (path.is_absolute() && !path.to_string_lossy().contains('%')).then_some(path)
            })
            .collect()
    }

    fn select(directories: impl IntoIterator<Item = PathBuf>) -> Option<PathBuf> {
        let mut seen = HashSet::new();
        for directory in directories {
            if !directory.is_absolute() || !seen.insert(directory.to_string_lossy().to_lowercase())
            {
                continue;
            }
            for name in ["copilot.exe", "copilot.cmd"] {
                if let Some(path) =
                    crate::native_process::resolve_regular_file(directory.join(name))
                {
                    return Some(path);
                }
            }
        }
        None
    }

    pub(super) fn locate() -> AppResult<Option<PathBuf>> {
        let inherited = std::env::var_os("PATH")
            .map(|s| std::env::split_paths(&s).take(256).collect::<Vec<_>>())
            .unwrap_or_default();
        if let Some(path) = select(inherited) {
            return Ok(Some(path));
        }
        let current = (|| {
            let machine = read_path(
                &RegKey::predef(HKEY_LOCAL_MACHINE),
                "SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment",
            )?;
            let user = read_path(&RegKey::predef(HKEY_CURRENT_USER), "Environment")?;
            Ok(select(
                machine
                    .into_iter()
                    .chain(user)
                    .flat_map(|value| directories(&value)),
            ))
        })();
        if let Ok(Some(path)) = &current {
            return Ok(Some(path.clone()));
        }
        // WinGet falls back to appending this directory to PATH if it cannot
        // create Links/copilot.exe. A running GUI must not require a restart.
        if let Some(local) = dirs::data_local_dir() {
            if let Some(path) = select([local.join(PORTABLE), local.join("Microsoft/WinGet/Links")])
            {
                return Ok(Some(path));
            }
        }
        current
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn fresh_paths_and_portable_install_work_without_alias_or_process_path_changes() {
            let temp = tempfile::tempdir().unwrap();
            let old = temp.path().join("old");
            let new = temp.path().join("new");
            assert!(select([old.clone(), new.clone()]).is_none());
            std::fs::create_dir(&new).unwrap();
            std::fs::write(new.join("copilot.exe"), b"fixture").unwrap();
            assert_eq!(
                select([old.clone(), new.clone()]),
                crate::native_process::resolve_regular_file(new.join("copilot.exe"))
            );
            let portable = temp.path().join(PORTABLE);
            std::fs::create_dir_all(&portable).unwrap();
            std::fs::write(portable.join("copilot.exe"), b"fixture").unwrap();
            assert!(select([old, portable]).is_some());
            assert!(!temp
                .path()
                .join("Microsoft/WinGet/Links/copilot.exe")
                .exists());
        }
        #[test]
        fn search_is_bounded_and_relative_entries_and_private_expansions_are_ignored() {
            assert!(directories(".;relative;%API_KEY%\\bin").is_empty());
            assert!(directories(&"x".repeat(MAX_PATH_BYTES + 1)).is_empty());
            assert!(decode(3, b"private").is_err());
            assert!(decode(1, b"x").is_err());
            assert!(decode(1, &[0, 0, 65, 0]).is_err());
            let path = tempfile::tempdir().unwrap();
            assert_eq!(
                directories(&format!("\"{}\"", path.path().display())),
                vec![path.path().to_path_buf()]
            );
        }
    }
}
