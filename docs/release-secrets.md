# Apple signing setup and first-release acceptance

This is a **maintainer-operated checklist**, not evidence that an Apple account, certificate, GitHub secret or Mac acceptance already exists. No account purchase or remote settings changes are part of the engineering task. The Windows community build does **not** need Authenticode or Apple credentials.

Formal macOS Draft/publish builds require **Developer ID Application + Hardened Runtime + Apple Notary Service + stapled tickets**. Missing credentials are fatal. Dry-run always uses an ad-hoc testing DMG and receives no Apple secrets, even when secrets exist in the environment. It is not an officially notarized distribution.

## 1. Obtain credentials yourself

1. Enroll as an individual in the paid [Apple Developer Program](https://developer.apple.com/programs/enroll/), if appropriate for the maintainer. Apple enrollment, identity verification, terms and payment must be completed by the account owner. This document neither purchases membership nor quotes a potentially changing price.
2. On a trusted Mac, create a **Developer ID Application** certificate through Apple's certificate/Keychain workflow. This is not a Mac App Distribution or Developer ID Installer certificate. Keep the private key under your control.
3. Export the certificate **with its private key** as a password-protected `.p12`. Exporting only a `.cer` is insufficient. Record the exact identity shown by Keychain / `security find-identity -v -p codesigning` privately; do not paste the account identity or report into an issue.
4. In App Store Connect's Users and Access → Integrations, create a **team API key** with the Developer role (or the least available role Apple documents as sufficient for notarization). Access may require the Account Holder to enable the API. Download its `.p8` once and store it securely, with the key ID and issuer ID. This implementation uses the issuer-based team-key path, not an individual-key flow without an issuer.
5. Base64-encode the P12 and P8 **locally**. Base64 is encoding, not encryption. Never paste their contents into chat, issue, terminal history, workflow source or README. Use a trusted local file/editor or clipboard to transfer the values directly into GitHub's secret-entry UI; clear temporary encoded files/clipboard afterwards according to your workstation policy. Do not print them in command output.
6. Retain secure recovery copies of the original credentials and password. Track expiration/revocation privately. Do not commit either original or encoded files.

Follow [Apple Developer ID](https://developer.apple.com/developer-id/), [App Store Connect API keys](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/) and [Tauri's current macOS signing instructions](https://v2.tauri.app/distribute/sign/macos/). If Apple account permissions or requirements differ, stop and resolve them with the account owner; do not substitute personal login credentials or bypass notarization.

## 2. Configure the GitHub environment manually

Create an environment named **`release`** in `AvaloNero/CopilotBYOKManager`. Configure required reviewers / manual approval when the repository plan supports it; if not available, maintain explicit human approval before dispatching publish and do not present it as an enforced environment gate. Allow the protected main workflow and intended version tags according to your repository's branch/tag policy. Do not approve arbitrary forks or unreviewed source for secrets.

Add these environment secrets with the exact names used by [release.yml](../.github/workflows/release.yml):

| Secret | Meaning | Consumed as |
| --- | --- | --- |
| `APPLE_CERTIFICATE_BASE64` | Base64 of the password-protected Developer ID Application P12 | Decoded private temporary file; imported into a temporary Keychain |
| `APPLE_CERTIFICATE_PASSWORD` | Password protecting the P12 | `security import`, never printed |
| `APPLE_SIGNING_IDENTITY` | Exact Developer ID Application signing identity | Official Tauri `APPLE_SIGNING_IDENTITY`; must start with `Developer ID Application:` |
| `APPLE_API_KEY_ID` | App Store Connect team API key ID | Tauri `APPLE_API_KEY` / notarytool `--key-id` |
| `APPLE_API_ISSUER_ID` | App Store Connect API issuer ID | Tauri `APPLE_API_ISSUER` / notarytool `--issuer` |
| `APPLE_API_PRIVATE_KEY_BASE64` | Base64 of the downloaded P8 private key | Temporary mode-0600 file passed as Tauri `APPLE_API_KEY_PATH` / notarytool `--key` |

There is **no `KEYCHAIN_PASSWORD` secret**: the build generates a fresh random password per job. There is no Apple ID/password authentication fallback, no P12/P8 in artifacts, no updater signing key and no Windows signing secret. `GITHUB_TOKEN` is supplied by Actions only to the narrowly scoped Release operation; do not add a broad personal access token for this workflow.

Only the formal Mac build step receives the six Apple values. The script validates all of them before building, strips unrelated Apple/updater environment variables from the child build, creates a temporary Keychain, preserves/restores the user's Keychain search list and deletes private files/keychain on completion or failure. Secret-bearing subprocess arguments and signing identities are not echoed by its error handler. Hosted runner disposal is the additional cleanup boundary on cancellation/host loss; do not reuse a failed signing runner as a general workstation.

The `release` environment also guards the final Draft/public Release job. Mac dry-run is a separate `build-macos-testing` job with **no environment and no secret mappings**. It does not require or create `release`, so maintainers can inspect a test DMG before setting up Apple credentials. No pull-request event is configured; fork repository and non-main dispatch execution are rejected before signing. These controls still require maintainers to review the committed workflow/scripts.

## 3. Prove the build before public promotion

1. Run `dry-run`, `platform=macos` (or `all`) from the main workflow at a fixed reviewed SHA. Inspect the ad-hoc/testing filenames and metadata. This only proves build/package checks; do not tell ordinary users to bypass Gatekeeper.
2. After the version is aligned and the maintainer explicitly authorizes creating/pushing its strict `vX.Y.Z` tag, run Draft. The tag push defaults to Draft; missing Apple secrets or any failed signature/notarization check must fail the job.
3. Verify both `.app` and DMG checks recorded by the workflow: two architectures, stable Bundle ID/version/executable, Hardened Runtime, strict code signature, Gatekeeper and stapled tickets. Tauri notarizes the app; the script submits the final DMG too. Formal assets must have no `testing-adhoc` suffix.
4. Download the **Draft's actual files**, verify SHA256SUMS and record exact source SHA plus file hashes for the clean-machine matrix below. Actions-generated green status is not real-device acceptance.
5. Only approve publish after that matrix and the [core gates (中文)](release-criteria.md) pass. Publish rechecks the fixed source and verifies the Draft bytes without replacing them. If a Draft is rebuilt/updated, its hashes change and its package acceptance must be revisited.

## 4. Real-machine acceptance matrix

Record **NOT RUN / BLOCKED / FAIL / PASS** separately for Windows 11 x64, Apple Silicon Mac and Intel Mac. Never infer both Mac architectures passed from a Universal binary. For each run, record macOS/Windows version, CPU, exact source SHA, package SHA-256 and exact client/plugin versions. Use an isolated user and a blank project, not private production configuration.

On each Mac architecture:

- Download the final Draft DMG using the normal browser download path; verify SHA256SUMS before opening it.
- Open DMG, drag `CopilotBYOKManager.app` into Applications, eject the disk image, launch from Finder. Verify first-launch/Gatekeeper behavior without disabling protection or removing quarantine to manufacture a pass.
- Confirm the displayed version, four pages, English/Chinese and Light/Dark/System. Check empty/error/busy states and retained form/preview state.
- Save a dedicated test provider key, reopen the app, read/use it through the normal app flow, update it, and delete it. Verify Keychain denial/unavailability handling. Record only status, never the key or a Keychain dump.
- From a **Finder launch**, detect the installed Copilot CLI; terminal PATH is not assumed. Publish a dedicated test route, open a new terminal/session and independently verify its model/request. CLI currently has one managed route.
- Use dedicated VS Code profiles: preview, publish, select a model, make an explicitly authorized minimal request, revoke and verify unrelated configuration remains.
- When authorized, use precisely reviewed JetBrains plugin distributions, record per-IDE login and model visibility, test the request and shared-file behavior; no universal/latest-version claim. Deferred Rider work stays deferred until resumed.
- Verify App manual guidance separately; no automatic App write or authentication claim.
- Exercise closing the last window, Cmd+Q, process termination, Dock/Finder reopen and another launch. Report actual macOS behavior; do not assume Windows close-to-tray semantics.
- Interrupt an isolated publication, review safe recovery and test an external target edit refusing overwrite. Keep private journal/rollback data out of the report.
- Remove the manager app and verify it has not deleted VS Code/CLI/JetBrains or unrelated provider configuration. Document manager-owned state/credential retention; do not call standalone builds fully portable.

On clean Windows, additionally verify current-user install without application-elevation requirements, Start menu/uninstall entries, WebView2 missing/online/offline/permission failure handling, default close-to-tray and Exit preference, tray recovery/fallback/menu language, repeated-launch wakeup and process cleanup.

Real provider requests require a separately approved provider/model/cost boundary. Native/browser fixtures, successful configuration writes, read-only model catalogs, compilation and installers all prove different things; none alone proves a request succeeded.

## 5. Not yet fulfilled by this document

Apple membership, certificate/API key creation, GitHub Secrets/environment settings, formal macOS signing/notarization, clean Windows and both real Macs, live client/provider requests and a functioning private security-report channel remain maintainer verification items. The maintainer-requested replacement icon now has a checked-in high-resolution source and official Tauri exports; it does not change package acceptance. Final screenshot review and any sponsor/contact/payment details still need explicit maintainer input. No sponsor contact or payment link is invented here.
