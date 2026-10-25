//! Hidden ConPTY for the allowlisted WinGet process. WinGet suppresses progress
//! on redirected pipes. This terminal belongs only to this child, so Ctrl+C
//! cannot reach the GUI. A scoped Job Object bounds forced cleanup afterwards.
use super::progress::{InstallPhase, InstallProgress, Parser};
use crate::error::{AppError, AppResult};
use crate::native_process::{self, CapturedOutput};
use std::ffi::{OsStr, OsString};
use std::fs::File;
use std::io::{Read, Write};
use std::os::windows::{
    ffi::OsStrExt,
    io::{AsRawHandle, FromRawHandle, OwnedHandle},
    process::ExitStatusExt,
};
use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc, Mutex,
};
use std::time::{Duration, Instant};
use windows_sys::Win32::{
    Foundation::*,
    System::{Console::*, JobObjects::*, Pipes::CreatePipe, Threading::*},
};

const CAPTURE_LIMIT: usize = 128 * 1024;
const CANCEL_GRACE: Duration = Duration::from_secs(3);
fn error() -> AppError {
    AppError::Config(format!(
        "Cannot run the hidden installer terminal (Windows error {})",
        unsafe { GetLastError() }
    ))
}

fn pipe() -> AppResult<(OwnedHandle, OwnedHandle)> {
    let mut read = std::ptr::null_mut();
    let mut write = std::ptr::null_mut();
    if unsafe { CreatePipe(&mut read, &mut write, std::ptr::null(), 0) } == 0 {
        return Err(error());
    }
    // SAFETY: successful CreatePipe transfers two unique handles to us.
    Ok(unsafe {
        (
            OwnedHandle::from_raw_handle(read),
            OwnedHandle::from_raw_handle(write),
        )
    })
}
struct Console(HPCON);
impl Drop for Console {
    fn drop(&mut self) {
        unsafe { ClosePseudoConsole(self.0) };
    }
}
struct Attributes(Vec<usize>);
impl Attributes {
    fn new(console: HPCON) -> AppResult<Self> {
        let mut size = 0;
        unsafe { InitializeProcThreadAttributeList(std::ptr::null_mut(), 1, 0, &mut size) };
        if size == 0 || size > 65536 {
            return Err(error());
        }
        let mut value = Self(vec![0; size.div_ceil(std::mem::size_of::<usize>())]);
        if unsafe { InitializeProcThreadAttributeList(value.pointer(), 1, 0, &mut size) } == 0 {
            // An uninitialized attribute list must not be passed to Delete.
            value.0.clear();
            return Err(error());
        }
        if unsafe {
            UpdateProcThreadAttribute(
                value.pointer(),
                0,
                PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE as usize,
                console as *const _,
                std::mem::size_of::<HPCON>(),
                std::ptr::null_mut(),
                std::ptr::null(),
            )
        } == 0
        {
            return Err(error());
        }
        Ok(value)
    }
    fn pointer(&mut self) -> LPPROC_THREAD_ATTRIBUTE_LIST {
        self.0.as_mut_ptr().cast()
    }
}
impl Drop for Attributes {
    fn drop(&mut self) {
        if !self.0.is_empty() {
            unsafe { DeleteProcThreadAttributeList(self.pointer()) };
        }
    }
}

fn job(process: HANDLE) -> AppResult<OwnedHandle> {
    let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
    if handle.is_null() {
        return Err(error());
    }
    let handle = unsafe { OwnedHandle::from_raw_handle(handle) };
    let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if unsafe {
        SetInformationJobObject(
            handle.as_raw_handle(),
            JobObjectExtendedLimitInformation,
            (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
            std::mem::size_of_val(&limits) as u32,
        )
    } == 0
        || unsafe { AssignProcessToJobObject(handle.as_raw_handle(), process) } == 0
    {
        return Err(error());
    }
    Ok(handle)
}

// CreateProcess argument quoting, never shell interpolation.
fn quote(value: &OsStr) -> AppResult<Vec<u16>> {
    let mut output = vec![b'"' as u16];
    let mut slashes = 0;
    for unit in value.encode_wide() {
        if unit == 0 {
            return Err(AppError::InvalidInput("Invalid installer argument".into()));
        }
        if unit == b'\\' as u16 {
            slashes += 1;
            continue;
        }
        output.extend(std::iter::repeat_n(
            b'\\' as u16,
            if unit == b'"' as u16 {
                slashes * 2 + 1
            } else {
                slashes
            },
        ));
        slashes = 0;
        output.push(unit);
    }
    output.extend(std::iter::repeat_n(b'\\' as u16, slashes * 2));
    output.push(b'"' as u16);
    Ok(output)
}
fn environment() -> AppResult<Vec<u16>> {
    let mut values: Vec<(OsString, OsString)> = std::env::vars_os().collect();
    let mut policy = std::process::Command::new("not-executed");
    native_process::sanitize_child_environment(&mut policy, false);
    for (key, value) in policy.get_envs() {
        values.retain(|(name, _)| {
            !name
                .to_string_lossy()
                .eq_ignore_ascii_case(&key.to_string_lossy())
        });
        if let Some(value) = value {
            values.push((key.to_owned(), value.to_owned()));
        }
    }
    values.sort_by_key(|(key, _)| key.to_string_lossy().to_uppercase());
    let mut block = Vec::new();
    for (key, value) in values {
        block.extend(key.encode_wide());
        block.push(b'=' as u16);
        block.extend(value.encode_wide());
        block.push(0);
        if block.len() > 128 * 1024 {
            return Err(AppError::InvalidInput(
                "Installer environment exceeds its limit".into(),
            ));
        }
    }
    block.push(0);
    Ok(block)
}

pub(super) fn run(
    executable: &Path,
    args: &[&OsStr],
    expected_url: &'static str,
    timeout: Duration,
    cancel: &AtomicBool,
    progress: &mut dyn FnMut(InstallProgress),
) -> AppResult<CapturedOutput> {
    if cancel.load(Ordering::Acquire) {
        return Err(AppError::Cancelled);
    }
    if timeout.is_zero() || timeout > Duration::from_secs(20 * 60) {
        return Err(AppError::InvalidInput(
            "Invalid installer time limit".into(),
        ));
    }
    let executable = native_process::resolve_regular_file(executable)
        .ok_or_else(|| AppError::Config("Installer executable is unavailable".into()))?;
    let application: Vec<u16> = executable
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let mut command = quote(executable.as_os_str())?;
    for arg in args {
        command.push(b' ' as u16);
        command.extend(quote(arg)?);
    }
    if command.len() > 32766 {
        return Err(AppError::InvalidInput(
            "Installer arguments exceed their limit".into(),
        ));
    }
    command.push(0);
    let environment = environment()?;
    let (input_read, input_write) = pipe()?;
    let (output_read, output_write) = pipe()?;
    let mut hpc = 0;
    if unsafe {
        CreatePseudoConsole(
            COORD { X: 240, Y: 30 },
            input_read.as_raw_handle(),
            output_write.as_raw_handle(),
            0,
            &mut hpc,
        )
    } < 0
    {
        return Err(error());
    }
    let console = Console(hpc);
    let parser = Arc::new(Mutex::new(Parser::new(expected_url)));
    let reader_parser = parser.clone();
    let (sender, receiver) = mpsc::sync_channel(1);
    // Always drain on a separate thread, including the final frame emitted by
    // ClosePseudoConsole. Never block the reader on progress consumers.
    std::thread::spawn(move || {
        let mut file = File::from(output_read);
        let mut captured = Vec::new();
        let mut buffer = [0u8; 8192];
        let mut truncated = false;
        loop {
            match file.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(count) => {
                    let keep = count.min(CAPTURE_LIMIT - captured.len());
                    captured.extend_from_slice(&buffer[..keep]);
                    truncated |= keep < count;
                    if let Ok(mut p) = reader_parser.lock() {
                        p.feed(&buffer[..count]);
                    }
                }
            }
        }
        let _ = sender.send((captured, truncated));
    });
    let mut attributes = Attributes::new(hpc)?;
    let mut startup = STARTUPINFOEXW::default();
    startup.StartupInfo.cb = std::mem::size_of::<STARTUPINFOEXW>() as u32;
    // Same contract as Microsoft Terminal/node-pty: null standard handles with
    // USESTDHANDLES prevent inheriting the GUI host's redirected diagnostics.
    startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
    startup.lpAttributeList = attributes.pointer();
    let mut info = PROCESS_INFORMATION::default();
    if cancel.load(Ordering::Acquire) {
        return Err(AppError::Cancelled);
    }
    if unsafe {
        CreateProcessW(
            application.as_ptr(),
            command.as_mut_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            0,
            EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT | CREATE_SUSPENDED,
            environment.as_ptr().cast(),
            std::ptr::null(),
            &startup.StartupInfo,
            &mut info,
        )
    } == 0
    {
        return Err(error());
    }
    let process = unsafe { OwnedHandle::from_raw_handle(info.hProcess) };
    let thread = unsafe { OwnedHandle::from_raw_handle(info.hThread) };
    drop(input_read);
    drop(output_write);
    let child_job = match job(process.as_raw_handle()) {
        Ok(job) => job,
        Err(e) => {
            unsafe { TerminateProcess(process.as_raw_handle(), 1) };
            return Err(e);
        }
    };
    if cancel.load(Ordering::Acquire) {
        return Err(AppError::Cancelled);
    }
    if unsafe { ResumeThread(thread.as_raw_handle()) } == u32::MAX {
        return Err(error());
    }
    drop(thread);
    let mut input = File::from(input_write);
    let started = Instant::now();
    let mut last_report = started - Duration::from_secs(1);
    let mut stopped: Option<(Instant, bool)> = None;
    let outcome = loop {
        match unsafe { WaitForSingleObject(process.as_raw_handle(), 50) } {
            WAIT_OBJECT_0 => {
                let mut code = 0;
                if unsafe { GetExitCodeProcess(process.as_raw_handle(), &mut code) } == 0 {
                    break Err(error());
                }
                break Ok(std::process::ExitStatus::from_raw(code));
            }
            WAIT_TIMEOUT => {}
            _ => break Err(error()),
        }
        let requested = cancel.load(Ordering::Acquire);
        if stopped.is_none() && (requested || started.elapsed() >= timeout) {
            stopped = Some((Instant::now(), requested));
            let _ = input.write_all(&[3]); // Child-local Ctrl+C; WinGet can abort its DO job.
            last_report = started;
        }
        if last_report.elapsed() >= Duration::from_millis(500) {
            if let Ok(p) = parser.lock() {
                let mut update = p.progress.clone();
                update.elapsed_seconds = started.elapsed().as_secs();
                if stopped.is_some() {
                    update.phase = InstallPhase::Cancelling;
                }
                progress(update);
            }
            last_report = Instant::now();
        }
        if stopped.is_some_and(|(at, _)| at.elapsed() >= CANCEL_GRACE) {
            break Err(if stopped.unwrap().1 {
                AppError::Cancelled
            } else {
                AppError::TimedOut
            });
        }
    };
    drop(child_job); // Only the reviewed child and descendants, never the GUI.
    drop(console);
    drop(input);
    let captured = receiver.recv_timeout(Duration::from_secs(2));
    if let Some((_, user_cancel)) = stopped {
        return Err(if user_cancel {
            AppError::Cancelled
        } else {
            AppError::TimedOut
        });
    }
    let (stdout, truncated) = captured.map_err(|_| AppError::TimedOut)?;
    Ok(CapturedOutput {
        status: outcome?,
        stdout: String::from_utf8_lossy(&stdout).into_owned(),
        stderr: String::new(),
        stdout_truncated: truncated,
        stderr_truncated: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn shell() -> PathBuf {
        crate::native_process::resolve_on_path(&["node.exe"])
            .expect("The repository test toolchain includes Node")
    }
    use std::path::PathBuf;
    #[test]
    fn quoting_handles_empty_spaces_quotes_and_trailing_slashes() {
        for (input, output) in [
            ("", "\"\""),
            ("a b", "\"a b\""),
            ("a\\", "\"a\\\\\""),
            ("a\"b", "\"a\\\"b\""),
        ] {
            assert_eq!(
                String::from_utf16(&quote(OsStr::new(input)).unwrap()).unwrap(),
                output
            );
        }
    }
    #[test]
    fn in_place_terminal_updates_keep_the_latest_download_count() {
        let mut values = Vec::new();
        let output = run(&shell(), &[OsStr::new("-e"),OsStr::new("console.log('Downloading https://example.test/fixture.zip');let n=2;const t=setInterval(()=>{process.stdout.write('\\r  ### '+n+'.00 MB / 10.0 MB');if(++n>4){clearInterval(t);setTimeout(()=>process.exit(0),1200)}},350)")], "https://example.test/fixture.zip", Duration::from_secs(10), &AtomicBool::new(false), &mut |p| { if let Some(bytes)=p.downloaded_bytes {values.push(bytes);} }).unwrap();
        assert!(output.status.success());
        assert!(
            values.contains(&(4 * 1024 * 1024)),
            "captured fixture output: {:?}; values={values:?}",
            output.stdout
        );
    }
    #[test]
    fn cancellation_bounds_a_child_that_ignores_ctrl_c() {
        let cancel = AtomicBool::new(false);
        let started = Instant::now();
        let mut seen = false;
        let result = run(&shell(), &[OsStr::new("-e"),OsStr::new("process.on('SIGINT',()=>{});console.log('Downloading https://example.test/fixture.zip');console.log('  2.00 MB / 10.0 MB');setInterval(()=>{},1000)")], "https://example.test/fixture.zip", Duration::from_secs(10), &cancel, &mut |p| { if p.downloaded_bytes.is_some() { seen=true;cancel.store(true,Ordering::Release); } });
        assert!(seen);
        assert!(matches!(result, Err(AppError::Cancelled)));
        assert!(started.elapsed() >= CANCEL_GRACE);
        assert!(started.elapsed() < Duration::from_secs(8));
    }
    #[test]
    fn real_hidden_child_reports_progress_and_cancellation_leaves_parent_alive() {
        let cancel = AtomicBool::new(false);
        let mut seen = false;
        let started = Instant::now();
        let result = run(&shell(), &[OsStr::new("-e"),OsStr::new("console.log('Downloading https://example.test/fixture.zip'); process.stdout.write('  2.00 MB / 10.0 MB\\r\\n'); setTimeout(()=>{},60000)")], "https://example.test/fixture.zip", Duration::from_secs(12), &cancel, &mut |p| {
            if p.downloaded_bytes == Some(2*1024*1024) { seen=true; cancel.store(true,Ordering::Release); }
        });
        assert!(seen);
        assert!(matches!(result, Err(AppError::Cancelled)));
        assert!(started.elapsed() < Duration::from_secs(12));
        let result = run(
            &shell(),
            &[
                OsStr::new("-e"),
                OsStr::new("console.log('tty='+Boolean(process.stdout.isTTY));console.log('fixture-alive')"),
            ],
            "",
            Duration::from_secs(12),
            &AtomicBool::new(false),
            &mut |_| {},
        )
        .unwrap();
        assert!(result.status.success());
        assert!(result.stdout.contains("tty=true"), "{}", result.stdout);
        assert!(result.stdout.contains("fixture-alive"));
    }
}
