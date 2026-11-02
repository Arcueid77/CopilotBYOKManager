use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
};

pub const VERSION: &str = "1.1.25";
const EXE_SIZE: u64 = 405_381_920;
const EXE_SHA: &str = "1c741981f9b450a17401ab4a8f44bcc556d42bb6a43561c4c9305c39a997e97f";
#[cfg(test)]
thread_local! {pub(crate) static TEST_RUNNING:std::cell::Cell<bool>=const{std::cell::Cell::new(false)};}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Target {
    pub database: PathBuf,
    pub binary: PathBuf,
    pub version: String,
    pub identity: String,
    pub schema: String,
}

pub fn database_path() -> AppResult<PathBuf> {
    #[cfg(feature = "local-e2e")]
    if let Some(root) = crate::test_support::root() {
        return Ok(root.join("work/.copilot/data.db"));
    }
    if std::env::var_os("COPILOT_HOME").is_some_and(|v| !v.is_empty()) || fresh_override()? {
        return Err(AppError::Unsupported(
            "Custom COPILOT_HOME is not reviewed for this App SQLite contract".into(),
        ));
    }
    Ok(crate::platform::home_dir()
        .ok_or_else(|| {
            AppError::Unsupported("Cannot resolve the App configuration directory".into())
        })?
        .join(".copilot/data.db"))
}

#[cfg(windows)]
fn fresh_override() -> AppResult<bool> {
    use winreg::{
        enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ},
        RegKey,
    };
    for (root, path) in [
        (HKEY_CURRENT_USER, "Environment"),
        (
            HKEY_LOCAL_MACHINE,
            "SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment",
        ),
    ] {
        match RegKey::predef(root).open_subkey_with_flags(path, KEY_READ) {
            Ok(key) => match key.get_raw_value("COPILOT_HOME") {
                Ok(value) if value.bytes.len() > 128 * 1024 => {
                    return Err(AppError::Unsupported(
                        "Cannot inspect App configuration-root override".into(),
                    ))
                }
                Ok(_) => return Ok(true),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(_) => {
                    return Err(AppError::Unsupported(
                        "Cannot inspect App configuration-root override".into(),
                    ))
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => {
                return Err(AppError::Unsupported(
                    "Cannot inspect App configuration-root override".into(),
                ))
            }
        }
    }
    Ok(false)
}
#[cfg(not(windows))]
fn fresh_override() -> AppResult<bool> {
    Ok(false)
}

pub fn review() -> AppResult<Target> {
    #[cfg(not(all(windows, target_arch = "x86_64")))]
    {
        Err(AppError::Unsupported(
            "This App SQLite contract has been reviewed only for Windows x64 v1.1.25".into(),
        ))
    }
    #[cfg(all(windows, target_arch = "x86_64"))]
    {
        let binary = super::super::installation_path().ok_or_else(|| {
            AppError::Unsupported(
                "Install the reviewed Copilot App version before enabling SQLite sync".into(),
            )
        })?;
        ensure_closed(&binary)?;
        verify_binary(&binary)?;
        let database = crate::safe_io::resource_path(&database_path()?)?;
        let guard = super::security::open_guard(&database)?;
        let db = super::open_readonly(&database)?;
        let (schema, _) = super::schema::inspect(&db)?;
        Ok(Target {
            database,
            binary,
            version: VERSION.into(),
            identity: super::security::identity(&guard)?,
            schema,
        })
    }
}

impl Target {
    pub fn verify(&self) -> AppResult<File> {
        if self.version != VERSION {
            return Err(AppError::Unsupported(
                "Unsupported Copilot App version".into(),
            ));
        }
        #[cfg(test)]
        if self.binary.as_os_str().is_empty()
            && std::fs::canonicalize(std::env::temp_dir())
                .is_ok_and(|root| self.database.starts_with(root))
        {
            ensure_closed(&self.binary)?;
            let file = super::security::open_guard(&self.database)?;
            if super::security::identity(&file)? != self.identity {
                return Err(AppError::PlanChanged);
            }
            return Ok(file);
        }
        if self.database != crate::safe_io::resource_path(&database_path()?)?
            || super::super::installation_path().as_ref() != Some(&self.binary)
        {
            return Err(AppError::PlanChanged);
        }
        verify_binary(&self.binary)?;
        ensure_closed(&self.binary)?;
        let file = super::security::open_guard(&self.database)?;
        if super::security::identity(&file)? != self.identity {
            return Err(AppError::PlanChanged);
        }
        Ok(file)
    }
}

#[cfg(test)]
pub(crate) fn fixture(database: &Path) -> AppResult<Target> {
    let database = crate::safe_io::resource_path(database)?;
    let guard = super::security::open_guard(&database)?;
    let db = super::open_readonly(&database)?;
    let (schema, _) = super::schema::inspect(&db)?;
    Ok(Target {
        database,
        binary: PathBuf::new(),
        version: VERSION.into(),
        identity: super::security::identity(&guard)?,
        schema,
    })
}

fn verify_binary(path: &Path) -> AppResult<()> {
    use sha2::{Digest, Sha256};
    crate::safe_file::ensure_regular_or_missing(path)?;
    let file = File::open(path)
        .map_err(|_| AppError::Unsupported("Cannot verify the Copilot App executable".into()))?;
    if file.metadata().map_err(|_| AppError::PlanChanged)?.len() != EXE_SIZE {
        return Err(AppError::Unsupported(
            "Copilot App executable does not match the reviewed Windows x64 v1.1.25 build".into(),
        ));
    }
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 65536];
    let mut reader = file.take(EXE_SIZE + 1);
    let mut total = 0;
    loop {
        let count = reader
            .read(&mut buffer)
            .map_err(|_| AppError::PlanChanged)?;
        if count == 0 {
            break;
        }
        total += count as u64;
        hash.update(&buffer[..count]);
    }
    if total != EXE_SIZE || format!("{:x}", hash.finalize()) != EXE_SHA {
        return Err(AppError::Unsupported(
            "Copilot App executable hash is not reviewed; manual setup remains available".into(),
        ));
    }
    Ok(())
}

pub fn ensure_closed(binary: &Path) -> AppResult<()> {
    #[cfg(test)]
    if TEST_RUNNING.with(|flag| flag.get()) {
        return Err(running());
    }
    #[cfg(test)]
    if binary.as_os_str().is_empty() {
        return Ok(());
    }
    #[cfg(feature = "local-e2e")]
    if let Some(root) = crate::test_support::root() {
        if root.join("private/copilot-app-running").exists() {
            return Err(running());
        }
        return Ok(());
    }
    #[cfg(windows)]
    {
        use std::{mem, os::windows::ffi::OsStringExt};
        use windows_sys::Win32::{
            Foundation::{CloseHandle, GetLastError, ERROR_NO_MORE_FILES, INVALID_HANDLE_VALUE},
            System::{
                Diagnostics::ToolHelp::{
                    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                    TH32CS_SNAPPROCESS,
                },
                Threading::{
                    OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
                },
            },
        };
        let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
        if snapshot == INVALID_HANDLE_VALUE {
            return Err(AppError::AppExitUnverified);
        }
        let mut entry: PROCESSENTRY32W = unsafe { mem::zeroed() };
        entry.dwSize = mem::size_of::<PROCESSENTRY32W>() as u32;
        let mut more = unsafe { Process32FirstW(snapshot, &mut entry) };
        let mut blocked = false;
        let mut unverified = false;
        let mut inspected = 0usize;
        while more != 0 {
            inspected += 1;
            if inspected > 65536 {
                unverified = true;
                break;
            }
            let length = entry
                .szExeFile
                .iter()
                .position(|v| *v == 0)
                .unwrap_or(entry.szExeFile.len());
            let name = String::from_utf16_lossy(&entry.szExeFile[..length]).to_ascii_lowercase();
            if [
                "github.exe",
                "github copilot.exe",
                "github-copilot.exe",
                "copilotd.exe",
            ]
            .contains(&name.as_str())
            {
                let process = unsafe {
                    OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, entry.th32ProcessID)
                };
                if process.is_null() {
                    unverified = true;
                } else {
                    let mut path = vec![0u16; 32768];
                    let mut len = path.len() as u32;
                    if unsafe {
                        QueryFullProcessImageNameW(process, 0, path.as_mut_ptr(), &mut len)
                    } == 0
                    {
                        unverified = true;
                    } else {
                        let path =
                            PathBuf::from(std::ffi::OsString::from_wide(&path[..len as usize]));
                        blocked |= path == binary
                            || binary
                                .parent()
                                .is_some_and(|parent| path.starts_with(parent));
                    }
                    unsafe {
                        CloseHandle(process);
                    }
                }
            }
            if blocked || unverified {
                break;
            }
            more = unsafe { Process32NextW(snapshot, &mut entry) };
        }
        if more == 0 && unsafe { GetLastError() } != ERROR_NO_MORE_FILES {
            unverified = true;
        }
        unsafe {
            CloseHandle(snapshot);
        }
        if unverified {
            return Err(AppError::AppExitUnverified);
        }
        if blocked {
            return Err(running());
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = binary;
        Err(AppError::Unsupported(
            "Copilot App process verification is unsupported on this platform".into(),
        ))
    }
}
#[cfg(any(windows, test, feature = "local-e2e"))]
fn running() -> AppError {
    AppError::AppRunning
}

pub(super) fn no_pending_wal(path: &Path) -> AppResult<()> {
    let wal = path.with_file_name(format!(
        "{}-wal",
        path.file_name()
            .and_then(|v| v.to_str())
            .ok_or(AppError::PlanChanged)?
    ));
    crate::safe_file::ensure_regular_or_missing(&wal)?;
    if fs::metadata(&wal).is_ok_and(|m| m.len() != 0) {
        return Err(AppError::Config("Copilot App has an uncheckpointed WAL; open and normally close the App before reviewing sync".into()));
    }
    Ok(())
}
