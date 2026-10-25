# Windows installer discovery, progress and cancellation

Reviewed 2026-10-23. Installation keeps the native-held, expiring, one-shot plan and compiled WinGet package/version/source/architecture allowlist. Installer success still requires fresh component detection. This change adds no application dependencies; it enables the Console and Pipes features of the existing `windows-sys` dependency.

## Finding a newly installed CLI

Windows processes retain the PATH inherited at startup. WinGet portable installation may fail to create `Microsoft/WinGet/Links/copilot.exe` and instead append the package directory to the user PATH. Searching only the running manager's old PATH then reports a successful installation as unverified.

All CLI discovery consumers now share one resolver: Apps/publication, installation verification and plan binding, account launch and runtime observation. It first honors the inherited search path, then reads current machine/user PATH and the reviewed default WinGet portable directory. It neither changes the manager's global environment nor writes the registry. Native runtime/account execution still requires a native executable; shell wrappers remain manual for identity verification.

Registry reads are bounded UTF-16 string observations. Relative directories are ignored; only known public directory variables may be expanded, never arbitrary credential variables. An unreadable/malformed fresh path with no independently discovered candidate produces an unknown/error observation and blocks installation. Version checks disable CLI auto-update and allow initial startup time.

The installed official CLI v1.0.90 was also checked with an isolated configuration/cache and the read-only version command. Its product/version header ends in a period. The parser accepts exactly one terminal sentence period while retaining the product prefix, bounded output and strict version grammar. A sanitized version fixture covers this independent source of false detection failures.

## Progress contract

WinGet suppresses its spinner and progress bar when stdout is redirected to a pipe. A hidden Windows pseudoconsole provides a terminal to the allowlisted child. It has no visible console window. `STARTF_USESTDHANDLES` with null handles prevents inheritance of the GUI host's diagnostic pipes. The child starts suspended, joins a task-owned Job Object, then resumes; its environment follows the existing secret-removal policy. Arguments are quoted for CreateProcess, not interpreted by a shell.

The versioned terminal parser recognizes the compiled package URL before accepting download counters, so source-index refresh progress cannot be mistaken for the installer download. It strips bounded VT sequences, handles split/in-place frames, and accepts only bounded binary byte units. English and Simplified Chinese phase markers identify verification/extraction/installation. Unknown output leaves an indeterminate display. Displayed byte counts are approximate because WinGet rounds its terminal output; the UI labels them accordingly. A download percentage never marks installation successful.

Only a typed phase, numeric download counters and elapsed seconds cross IPC. Raw output remains a bounded native buffer and is never written to history or sent to the UI. Live progress is held in memory and merged into the existing run snapshots/events; installation-history schema v1, state v2 and Usage DB v3 remain unchanged.

## Cancellation and results

Cancel sends Ctrl+C into the child's own pseudoconsole, giving WinGet an opportunity to abort its Delivery Optimization job. If it does not exit within three seconds, only that child job is terminated. Output drains on a separate thread throughout teardown. The manager is not attached to this console or child job.

Post-stop discovery reconciles completed effects. A verified component stays completed even if cancellation arrives late. Cancelling later components yields Partial when earlier components succeeded; a fully completed plan remains Complete. The UI keeps completed, active and queued components visible, disables duplicate cancellation, and protects the active dialog from Escape/replacement and late updates. Result rows distinguish cancellation, timeout and failure. No automatic uninstall or downgrade occurs.

## Fixed upstream evidence

- [WinGet reporter at bc1e9ff8b982798ab346b61416b76ae738038e57](https://github.com/microsoft/winget-cli/blob/bc1e9ff8b982798ab346b61416b76ae738038e57/src/AppInstallerCLICore/ExecutionReporter.cpp): progress suppression for redirected output.
- [WinGet progress formatting at the same commit](https://github.com/microsoft/winget-cli/blob/bc1e9ff8b982798ab346b61416b76ae738038e57/src/AppInstallerCLICore/ExecutionProgress.cpp): binary byte units and terminal frames.
- [WinGet Delivery Optimization cleanup](https://github.com/microsoft/winget-cli/blob/bc1e9ff8b982798ab346b61416b76ae738038e57/src/AppInstallerCommonCore/DODownloader.cpp): finalization/abort on normal cleanup.
- [Microsoft pseudoconsole lifecycle](https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session), [Microsoft Terminal child startup](https://github.com/microsoft/terminal/blob/main/src/cascadia/TerminalConnection/ConptyConnection.cpp) and [node-pty startup](https://github.com/microsoft/node-pty/blob/main/src/win/conpty.cc).
- Versioned official manifests reviewed for the existing allowlist: [Copilot CLI v1.0.90](https://github.com/microsoft/winget-pkgs/blob/master/manifests/g/GitHub/Copilot/v1.0.90/GitHub.Copilot.installer.yaml), [Copilot App 1.1.25](https://github.com/microsoft/winget-pkgs/blob/master/manifests/g/GitHub/CopilotApp/1.1.25/GitHub.CopilotApp.installer.yaml), [VS Code 1.140.0](https://github.com/microsoft/winget-pkgs/blob/master/manifests/m/Microsoft/VisualStudioCode/1.140.0/Microsoft.VisualStudioCode.installer.yaml).

Regression coverage uses temporary paths, raw registry-value fixtures, sanitized terminal frames, harmless child processes, fake installation services and isolated WebView/browser data. Real downloads and installed-client behavior are recorded separately from those tests.
