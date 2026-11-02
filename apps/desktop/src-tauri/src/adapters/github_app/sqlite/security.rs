//! Access checks for the existing App database and its SQLite sidecars.
use crate::error::{AppError, AppResult};
#[cfg(unix)]
use std::fs;
use std::{
    fs::{File, OpenOptions},
    path::Path,
};

fn unsafe_access() -> AppError {
    AppError::UnsafeAppPermissions
}

pub(super) fn open_guard(path: &Path) -> AppResult<File> {
    crate::safe_file::ensure_regular_or_missing(path)?;
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x00200000).share_mode(3);
    }
    let file = options
        .open(path)
        .map_err(|_| AppError::Config("Cannot open the existing Copilot App database".into()))?;
    let metadata = file.metadata().map_err(|_| unsafe_access())?;
    if !metadata.is_file() || metadata.len() > 2 * 1024 * 1024 * 1024 {
        return Err(unsafe_access());
    }
    check_access(&file)?;
    check_directory(path.parent().ok_or_else(unsafe_access)?)?;
    for suffix in ["-wal", "-shm", "-journal"] {
        let sidecar = path.with_file_name(format!(
            "{}{}",
            path.file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(unsafe_access)?,
            suffix
        ));
        crate::safe_file::ensure_regular_or_missing(&sidecar)?;
        if sidecar.exists() {
            let sidecar_file = open_nofollow(&sidecar)?;
            if !sidecar_file
                .metadata()
                .map_err(|_| unsafe_access())?
                .is_file()
            {
                return Err(unsafe_access());
            }
            check_access(&sidecar_file)?;
        }
    }
    crate::safe_file::ensure_regular_or_missing(path)?;
    if identity(&file)? != path_identity(path)? {
        return Err(AppError::PlanChanged);
    }
    Ok(file)
}

pub(super) fn path_identity(path: &Path) -> AppResult<String> {
    crate::safe_file::ensure_regular_or_missing(path)?;
    let file = open_nofollow(path)?;
    identity(&file)
}

#[cfg(unix)]
pub(super) fn identity(file: &File) -> AppResult<String> {
    use std::os::unix::fs::MetadataExt;
    let metadata = file.metadata().map_err(|_| AppError::PlanChanged)?;
    Ok(format!(
        "{}:{}:{}",
        metadata.uid(),
        metadata.dev(),
        metadata.ino()
    ))
}

#[cfg(windows)]
pub(super) fn identity(file: &File) -> AppResult<String> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
    };
    let mut value: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
    if unsafe { GetFileInformationByHandle(file.as_raw_handle(), &mut value) } == 0
        || value.dwFileAttributes & 0x400 != 0
    {
        return Err(AppError::PlanChanged);
    }
    Ok(format!(
        "{}:{}:{}:{}",
        owner_identity(file)?,
        value.dwVolumeSerialNumber,
        value.nFileIndexHigh,
        value.nFileIndexLow
    ))
}

fn open_nofollow(path: &Path) -> AppResult<File> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x00200000).share_mode(3);
    }
    options.open(path).map_err(|_| unsafe_access())
}

#[cfg(windows)]
fn owner_identity(file: &File) -> AppResult<String> {
    use std::{os::windows::io::AsRawHandle, ptr};
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::{
            Authorization::{GetSecurityInfo, SE_FILE_OBJECT},
            GetLengthSid, IsValidSid, OWNER_SECURITY_INFORMATION,
        },
    };
    let mut owner = ptr::null_mut();
    let mut descriptor = ptr::null_mut();
    if unsafe {
        GetSecurityInfo(
            file.as_raw_handle(),
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION,
            &mut owner,
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null_mut(),
            &mut descriptor,
        )
    } != 0
    {
        return Err(unsafe_access());
    }
    let result = (|| {
        if owner.is_null() || unsafe { IsValidSid(owner) } == 0 {
            return Err(unsafe_access());
        }
        let length = unsafe { GetLengthSid(owner) } as usize;
        if length == 0 || length > 256 {
            return Err(unsafe_access());
        }
        Ok(crate::fingerprint::bytes(
            "app-database-owner-v1",
            Some(unsafe { std::slice::from_raw_parts(owner.cast::<u8>(), length) }),
        ))
    })();
    unsafe {
        LocalFree(descriptor);
    }
    result
}

#[cfg(unix)]
fn check_access(file: &File) -> AppResult<()> {
    use std::os::unix::fs::MetadataExt;
    let value = file.metadata().map_err(|_| unsafe_access())?;
    if value.uid() != unsafe { libc::geteuid() } || value.mode() & 0o077 != 0 {
        return Err(unsafe_access());
    }
    Ok(())
}

#[cfg(unix)]
fn check_directory(path: &Path) -> AppResult<()> {
    use std::os::unix::fs::MetadataExt;
    crate::safe_file::ensure_regular_or_missing(&path.join(".copilot-byok-manager-path-check"))?;
    let value = fs::metadata(path).map_err(|_| unsafe_access())?;
    if value.uid() != unsafe { libc::geteuid() } || value.mode() & 0o077 != 0 {
        return Err(unsafe_access());
    }
    Ok(())
}

#[cfg(windows)]
fn check_directory(path: &Path) -> AppResult<()> {
    use std::os::windows::fs::OpenOptionsExt;
    crate::safe_file::ensure_regular_or_missing(&path.join(".copilot-byok-manager-path-check"))?;
    let file = OpenOptions::new()
        .read(true)
        .custom_flags(0x02000000 | 0x00200000)
        .open(path)
        .map_err(|_| unsafe_access())?;
    check_access(&file)
}

#[cfg(windows)]
fn check_access(file: &File) -> AppResult<()> {
    use std::{os::windows::io::AsRawHandle, ptr};
    use windows_sys::Win32::{
        Foundation::{CloseHandle, LocalFree},
        Security::{
            Authorization::{GetSecurityInfo, SE_FILE_OBJECT},
            EqualSid, GetAce, GetTokenInformation, IsValidSid, IsWellKnownSid, TokenUser,
            WinBuiltinAdministratorsSid, WinCreatorOwnerRightsSid, WinLocalSystemSid,
            ACCESS_ALLOWED_ACE, ACL, DACL_SECURITY_INFORMATION, OWNER_SECURITY_INFORMATION, PSID,
            TOKEN_QUERY, TOKEN_USER,
        },
        System::Threading::{GetCurrentProcess, OpenProcessToken},
    };
    let mut token = ptr::null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
        return Err(unsafe_access());
    }
    let mut bytes = vec![0u64; 512];
    let mut length = 0;
    let success = unsafe {
        GetTokenInformation(
            token,
            TokenUser,
            bytes.as_mut_ptr().cast(),
            (bytes.len() * 8) as u32,
            &mut length,
        )
    };
    unsafe {
        CloseHandle(token);
    }
    if success == 0 || length as usize > bytes.len() * 8 {
        return Err(unsafe_access());
    }
    let user = unsafe { &*bytes.as_ptr().cast::<TOKEN_USER>() }.User.Sid;
    let mut owner: PSID = ptr::null_mut();
    let mut acl: *mut ACL = ptr::null_mut();
    let mut descriptor = ptr::null_mut();
    let result = unsafe {
        GetSecurityInfo(
            file.as_raw_handle(),
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            &mut owner,
            ptr::null_mut(),
            &mut acl,
            ptr::null_mut(),
            &mut descriptor,
        )
    };
    if result != 0 {
        return Err(unsafe_access());
    }
    let checked = (|| {
        if owner.is_null()
            || acl.is_null()
            || unsafe { IsValidSid(owner) == 0 || EqualSid(owner, user) == 0 }
        {
            return Err(unsafe_access());
        }
        let count = unsafe { (*acl).AceCount };
        if count == 0 || count > 128 {
            return Err(unsafe_access());
        }
        let mut has_owner = false;
        for index in 0..count {
            let mut ace = ptr::null_mut();
            if unsafe { GetAce(acl, index as u32, &mut ace) } == 0 || ace.is_null() {
                return Err(unsafe_access());
            }
            let value = unsafe { &*ace.cast::<ACCESS_ALLOWED_ACE>() };
            // Inherit-only entries do not apply to this object; deny entries cannot grant access.
            if value.Header.AceFlags & 0x08 != 0 || value.Header.AceType == 1 {
                continue;
            }
            if value.Header.AceType != 0 {
                return Err(unsafe_access());
            }
            let sid = ptr::addr_of!(value.SidStart).cast_mut().cast();
            if unsafe { IsValidSid(sid) } == 0 {
                return Err(unsafe_access());
            }
            let owns = unsafe {
                EqualSid(sid, user) != 0 || IsWellKnownSid(sid, WinCreatorOwnerRightsSid) != 0
            };
            let trusted = owns
                || unsafe {
                    IsWellKnownSid(sid, WinLocalSystemSid) != 0
                        || IsWellKnownSid(sid, WinBuiltinAdministratorsSid) != 0
                };
            if !trusted && value.Mask & 0xf001_01bf != 0 {
                return Err(unsafe_access());
            }
            has_owner |= owns;
        }
        if !has_owner {
            return Err(unsafe_access());
        }
        Ok(())
    })();
    unsafe {
        LocalFree(descriptor);
    }
    checked
}
