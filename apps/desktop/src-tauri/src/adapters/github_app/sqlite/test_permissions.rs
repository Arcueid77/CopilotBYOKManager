//! Test-thread default file ownership, including elevated Windows CI runners.
//! The identity stays the process user; the process token and real files are untouched.
use std::{cell::RefCell, mem, ptr};
use windows_sys::Win32::{
    Foundation::{CloseHandle, GetLastError, ERROR_NO_TOKEN, HANDLE},
    Security::{
        DuplicateTokenEx, GetTokenInformation, RevertToSelf, SecurityImpersonation,
        SetTokenInformation, TokenImpersonation, TokenOwner, TokenUser, TOKEN_ADJUST_DEFAULT,
        TOKEN_DUPLICATE, TOKEN_IMPERSONATE, TOKEN_OWNER, TOKEN_QUERY, TOKEN_USER,
    },
    System::Threading::{
        GetCurrentProcess, GetCurrentThread, OpenProcessToken, OpenThreadToken, SetThreadToken,
    },
};

struct Handle(HANDLE);
impl Drop for Handle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

struct ThreadOwner {
    previous: Option<Handle>,
    _token: Handle,
}
impl Drop for ThreadOwner {
    fn drop(&mut self) {
        unsafe {
            if let Some(previous) = &self.previous {
                SetThreadToken(ptr::null(), previous.0);
            } else {
                RevertToSelf();
            }
        }
    }
}

thread_local! {static OWNER:RefCell<Option<ThreadOwner>>=const{RefCell::new(None)};}

pub(super) fn prepare_thread() {
    OWNER.with(|slot| {
        if slot.borrow().is_some() {
            return;
        }
        let mut process = ptr::null_mut();
        assert_ne!(
            unsafe {
                OpenProcessToken(
                    GetCurrentProcess(),
                    TOKEN_QUERY | TOKEN_DUPLICATE,
                    &mut process,
                )
            },
            0
        );
        let process = Handle(process);
        let mut user = vec![0u64; 512];
        let mut length = 0;
        assert_ne!(
            unsafe {
                GetTokenInformation(
                    process.0,
                    TokenUser,
                    user.as_mut_ptr().cast(),
                    (user.len() * 8) as u32,
                    &mut length,
                )
            },
            0
        );
        assert!(length as usize <= user.len() * 8);
        let sid = unsafe { &*user.as_ptr().cast::<TOKEN_USER>() }.User.Sid;
        let mut duplicate = ptr::null_mut();
        assert_ne!(
            unsafe {
                DuplicateTokenEx(
                    process.0,
                    TOKEN_QUERY | TOKEN_ADJUST_DEFAULT | TOKEN_IMPERSONATE,
                    ptr::null(),
                    SecurityImpersonation,
                    TokenImpersonation,
                    &mut duplicate,
                )
            },
            0
        );
        let duplicate = Handle(duplicate);
        let owner = TOKEN_OWNER { Owner: sid };
        assert_ne!(
            unsafe {
                SetTokenInformation(
                    duplicate.0,
                    TokenOwner,
                    ptr::from_ref(&owner).cast(),
                    mem::size_of::<TOKEN_OWNER>() as u32,
                )
            },
            0
        );
        let mut previous = ptr::null_mut();
        let opened = unsafe {
            OpenThreadToken(
                GetCurrentThread(),
                TOKEN_QUERY | TOKEN_IMPERSONATE,
                1,
                &mut previous,
            )
        };
        let previous = if opened != 0 {
            Some(Handle(previous))
        } else {
            assert_eq!(unsafe { GetLastError() }, ERROR_NO_TOKEN);
            None
        };
        assert_ne!(unsafe { SetThreadToken(ptr::null(), duplicate.0) }, 0);
        *slot.borrow_mut() = Some(ThreadOwner {
            previous,
            _token: duplicate,
        });
    });
}
