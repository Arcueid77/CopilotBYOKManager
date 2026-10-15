# CopilotBYOKManager implementation status

Updated 2026-10-15 for the maintainer-approved v0.1 four-page release scope, icon refresh and unsigned Mac preview. Initial release engineering started at `83a82db3555eb0defa278bd6e042b7c55a76088f`; current package source and evidence are recorded below. This is an implementation/evidence summary, not complete-MVP or release acceptance. The [specification §21](mvp-implementation-spec.md#21-final-acceptance) and [feature availability](feature-availability.md) separate core release gates from the retained extended milestone. The product has not had a public release.

## Current implementation

| Area | Implemented behavior | Current boundary |
| --- | --- | --- |
| Connections and models | Native CRUD, enablement, read-only catalog discovery/probe, checkbox-to-draft model selection saved with the form, preferred-model order, OS-held keys | Catalog access does not prove inference; disabling does not revoke a published source |
| Deployment and recovery | Native one-shot expiring plans, live fingerprints, durable ownership, prepare-all writes, journals, compensation, conditional rollback, revoke-and-delete and detach | External changes or unproven ownership refuse destructive replacement |
| VS Code | Stable/Insiders/profile discovery; owned `chatLanguageModels.json` groups coexist with other suppliers | Select the model in the client; sign-in only focuses an existing Windows editor or gives manual instructions |
| Copilot CLI | One owned legacy environment route plus `COPILOT_MODEL`; CLI target requires explicit selection by default | New terminal/session required; no `providers.json` write; a shadowing registry blocks publication |
| JetBrains | Automatic dedicated shared BYOK projection for reviewed 1.19 distributions, with per-profile proofs and deduplicated writes | Unknown versions unsupported; per-IDE login, picker visibility and actual requests are separate acceptance steps |
| Copilot app | Component discovery, official-flow/manual account steps and provider runbook | Provider writes and a separate private local-usage source are unsupported |
| Installation | Pinned reviewed Windows WinGet/component plans, identity checks, persisted per-component outcomes, scoped cancellation and rediscovery | Direct app asset-download fallback and clean-machine package acceptance are not complete |
| Accounts and GitHub authorization | Official client workflows, protocol-3 CLI identity follow-up, manual/verified distinction, separate OS-held GitHub authorization | No copying client credentials; actual runtime/Billing capability depends on the installed client and account |
| Resources | Native MCP, Markdown-only Skills and Instructions authoring/publication/revoke on reviewed public paths | Named profiles, custom roots, local-command/secret-bearing MCP, app and JetBrains resource gaps remain manual |
| Usage and pricing | Runtime quota/model observations; monthly personal Billing; opt-in CLI/shared-runtime and VS Code imports; decimal estimates and immutable prices | Missing semantics, cache writes, source coverage or Connection attribution remain unknown/partial |
| Persistence | `state.json` schema v2 and separate `usage.sqlite3` schema v3, migration/reopen support and explicit read-only recovery | Dedicated `CopilotBYOKManager` configuration root and `io.github.avalonero.copilotbyokmanager.connections` credential service; no automatic adoption of another app's namespace |
| Interface language | English / Simplified Chinese, system-language default, saved preference, localized dates and explicit message catalog | User-authored names, IDs, URLs and native/upstream diagnostics remain original; language switching cannot replace an open form or deployment review |

Technical detail: [architecture](architecture.md), [hardening](hardening-handoff.md), [JetBrains](jetbrains-support.md), [usage sources](usage-sources.md), and [model discovery](provider-model-discovery.md).

## Current interface

- Top navigation: **Overview / Providers / Apps / About**, or **总览 / 供应商 / 应用 / 关于**. No More menu. Usage/Billing/authorization/Resources UI is not loaded or queried by the core shell; implementations/data and backend tests remain.
- Overview: first-provider or publication next steps, needed actions, app/profile owned-source rows, a provider summary and persistent per-target result. Full provider cards belong on Providers. Recovery is visible on every page and precedes normal writes; Review locates the exact app.
- Connection editor: common fields first; provider/protocol/header options expand separately. Catalog checkboxes immediately join the editable draft and are saved by Save connection, without a second Add selected step or automatic full selection. Original/manual entries, disabled flags, identities and capabilities are preserved. Save errors remain visible and retain the form.
- Dialogs: initial focus, contained Tab/Shift+Tab navigation, Escape when idle, focus restoration, background isolation, and protection against replacing an unsaved editor. Async callbacks belong to the actual dialog instance; resource preview/apply prevents misleading dismissal. Dirty tracking never serializes passwords or other form contents.
- Apps: direct per-app provider selection and single-target preview; multiple providers require an explicit selection. Choices survive language redraw/navigation; changing a choice invalidates idle review. App manual setup binds that exact provider. Installation/account detail is expandable, not a mandatory large preamble. Publication/revocation history is expandable on Providers and Apps.
- Extended Usage/Resources: their implementations, unknown/decimal/privacy contracts and tests remain, but their controls are not exposed in the core edition. The [feature record](feature-availability.md) has no promised launch dates.
- Publication: pending apply blocks navigation/refresh/dismissal, and failures retain guidance with a consumed preview. Closing an idle preview restores its opener; completion focuses persistent per-target results. VS Code/JetBrains model selection, CLI new-session guidance, and the exact Connection's App manual guide remain distinct. Disk publication never claims login, selection or successful provider execution.
- Appearance/help: Light/Dark/System, early saved preference and live system following only in System mode. Changes are CSS-only, preserving drafts and previews without IPC. About includes manual/feedback links, an offline planned-feature record and local storage/recovery details.
- Windows window lifetime: default close-to-tray with a saved Tray/Exit choice on About; left-click restore, localized right-click Open main window / Exit menu, and repeat-launch wakeup. Only a readable Tray preference, registered tray and successful hide retain background execution; other main close paths use normal Tauri exit. Ordinary minimize uses the taskbar. Preference damage keeps the original file and exits; unknown observations remain unknown. Unrestricted menu/tray permissions are excluded from the WebView.

## Validation evidence

Evidence must stay attached to the source and validation layer that produced it. Tests use temporary data and fake external services. Private runtime reports remain outside Git; the reviewed, synthetic README screenshots are checked in with [provenance](images/README.md) and are not runtime acceptance evidence.

### Icon refresh and unsigned Mac preview — 2026-10-15

Package source: `dad7bd49b383338ef299d3e313eaca1c7836d268`. The maintainer requested a Copilot-related mark; the new locally packaged icon combines a Copilot-inspired robot/goggle outline and a key. The high-resolution transparent source, official Tauri PNG/ICO/ICNS exports, app header/favicon and bilingual README screenshots are updated. [Artwork provenance and final edit prompt](../apps/desktop/src-tauri/icons/README.md) record use of the built-in image-generation tool. Product identity, native configuration/ownership/recovery logic, credentials, migrations and window/tray behavior are unchanged.

The maintainer explicitly authorized pushing the local engineering/icon commits and running only a Mac dry-run. Its separate job has no GitHub environment or Apple secret mappings; formal signing and public publication remain protected and are not authorized by a preview. No tag, GitHub Release, repository setting, secret, environment or Apple account was created or changed.

The [first Mac attempt](https://github.com/AvaloNero/CopilotBYOKManager/actions/runs/38704585598) passed both platform test suites and built the Universal DMG, but failed the subsequent standalone-app identity check: locked Tauri cleaned its intermediate `.app` for a DMG-only build. The wrapper now requests standard `app,dmg` outputs, retains the app for verification, and still distributes only the DMG. A regression guard preserves both app checks and strict signature verification; no check was skipped. The [corrected dry-run](https://github.com/AvaloNero/CopilotBYOKManager/actions/runs/38706651589) passed all selected checks, Mac packaging and checksum assembly. Formal signing, Windows cloud packaging and public Release jobs were skipped as requested. [Normal three-platform CI](https://github.com/AvaloNero/CopilotBYOKManager/actions/runs/38706650798) also passed on this exact source.

| Check | Current evidence |
| --- | --- |
| Local source checks | `npm run check` and whitespace check passed: 19 release-policy/icon tests, 69 web tests, 275 Windows library + 6 integration tests, formatting and strict Clippy |
| Browser layout | 18 header/icon combinations passed: English/Chinese, Light/Dark/System, 960/1180/1440px; six sanitized screenshots regenerated; no native writes |
| Hosted strict-link tests | Both dry-runs passed with `COPILOT_BYOK_MANAGER_TEST_REQUIRE_LINKS=1`; platform suites contain Windows 275 + 6 Rust tests and Mac 268 + 6. Local Windows error 1314 remains a host limitation, not a passed local branch |
| Windows packages | Clean `dad7bd4` source produced unsigned x64 NSIS and standalone ZIP; architecture, versions, metadata and SHA-256 verified locally |
| Mac package | Universal DMG produced on `macos-15`, Node 22, Rust 1.88. Retained app and final mounted-DMG app passed identity/version/minimum-OS, x86_64+arm64 and strict code-signature/Hardened Runtime checks. Ad-hoc, **not notarized**; testing artifacts only |

The verified Mac set is the run's `release-dry-run-dad7bd49b383338ef299d3e313eaca1c7836d268` Actions artifact (ID `11959232397`, ZIP size 17,529,162 bytes). GitHub reports archive SHA-256 `9b28314e19dfca9dfb39a7f5852ff232366b6d28e2b570665b4597ddc23aaa12`; this is the **artifact ZIP digest, not the inner DMG digest**. The ZIP includes the DMG, `SHA256SUMS.txt`, metadata and release notes. Files are retained for 14 days under the current workflow policy. The engineering Windows host's GitHub CLI download stalled and a bounded direct HTTP retry timed out; no local Mac copy or independent local rehash is claimed. Download from the successful run and verify its included checksum list before testing.

Mac first launch, Keychain behavior, Intel/Apple Silicon runtime, clean Windows and real client/provider-request acceptance remain separate and uncompleted. Rider remains deferred. A successful build or a new icon does not make the core release GO.

### Initial local v0.1 release engineering — 2026-10-15

The packaging identity, data/credential namespaces, native write/ownership/recovery logic and four-page application code remain unchanged. Tauri Bundler is enabled: Windows current-user x64 NSIS plus standalone ZIP; Mac universal DMG with a conservative 15.0 candidate floor. Formal Mac requires Developer ID/Hardened Runtime/notarization/stapling; Windows is explicitly unsigned. A new independent release workflow freezes source SHA, reruns locked checks and defaults tags to Draft. Publish preserves the exact reviewed Draft bytes. It does not publish automatically on tag push.

The bilingual README is now a product overview; full procedures moved to [English](user-guide.md) / [Chinese](user-guide.zh-CN.md) guides. Six current-browser screenshots use fictional providers and no keys, clearly labeled simulated. [Release engineering](release-engineering.md), [Apple setup](release-secrets.md), [release gates](release-criteria.md) and notes now use core v0.1 rather than hidden full-MVP features as the release scope.

At this initial local stage, Windows NSIS/ZIP build and metadata verification succeeded; Mac packaging/signing/notarization and hosted workflow execution had **not** run. That stage did not push or change remote state. The later, explicitly authorized remote preview is recorded above. Core native-isolated UI/tray, clean Windows, Intel/Apple Silicon and live client requests remain NOT RUN/BLOCKED as applicable; no prior native run is promoted to current acceptance.

| Engineering check | Observed result and limit |
| --- | --- |
| Dependencies / versions | `npm ci` passed; all 10 application version sources agree at 0.1.0; local Node 24.15.0 and explicitly selected Rust 1.88.0, without changing the default toolchain |
| Release policy / locked Tauri schema | 16 tests passed, including version/ref/fork/PR rejection, all required Apple secrets, missing/tampered assets, fixed source, Draft-only mutation and immutable promotion bytes; GitHub CLI is fake in tests |
| Web | 998 bilingual messages / 973 explicit keys; 63 desktop + 6 retained tests passed (69) |
| Default Rust checks | `npm run check` passed: fmt, 275 library + 6 integration tests, strict Clippy. One existing file-symlink test takes its documented privilege-unavailable return on this account; the count is not proof that branch ran |
| Strict link-capability run | With `COPILOT_BYOK_MANAGER_TEST_REQUIRE_LINKS=1`, 274 library tests passed and the symlink fixture failed with Windows error 1314 (missing privilege), before integration/Clippy. No test or CI requirement was weakened; rerun on a link-capable runner |
| Isolated browser / docs | 18 current core scenario groups passed; six synthetic screenshots visually inspected. Local Markdown file/anchor checks passed; no real client writes or requests |
| Workflow / scripts | Task-local checksum-verified actionlint 1.7.12 passed both workflows; Node script and PowerShell parser checks passed. Hosted workflow execution is still unverified |
| Packaging | Local x64 NSIS and standalone ZIP generated, version/PE/unsigned checks passed. This does not prove installation, WebView2 failure behavior, tray interaction or Mac support |

### CC Switch tray conventions — 2026-10-14

The behavior follows [CC Switch's pinned Windows source](https://github.com/farion1231/cc-switch/blob/74b98ca9405d8b526c67a16e44a6d0658f2dede5/src-tauri/src/lib.rs), with fixed localized labels rather than a mixed-language menu. `window-preferences.json` v1 stores only the close choice; existing `state.json` v2 and Usage SQLite v3 are unchanged. The official Windows single-instance plugin 2.4.5 registers before store recovery, ignores secondary launch payloads and uses independent hashed identifiers for isolated roots. No real IDE/account/provider configuration is changed by validation.

| Check | Result and limit |
| --- | --- |
| `npm run check:web` | Passed: 998 bilingual messages / 973 explicit keys; 63 desktop-web + 6 retained web tests (69 total) |
| `cargo test --workspace --locked --quiet` | Passed: 275 library + 6 integration tests (281 total); new preference default/reopen, invalid/newer/oversized preservation, external changes/write failure/exclusion, exit choice, typed locale and isolated identity coverage |
| Formatting / Clippy / documentation | `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings` and `git diff --check` passed after the final close/exit logic; 22 Markdown files / 153 local links checked without broken targets |
| Isolated browser | Passed 18 scenario groups; includes saved-choice success, failed-save retention, refresh race, unavailable preferences, coalesced rapid locale switches and failed native-label update without changing window language |
| Visual inspection | English light and Chinese dark About layouts inspected; close choice is next to appearance, no new navigation page |
| `npm run build -- --no-bundle` | Passed after final native changes; default-feature `target/release/copilot-byok-manager.exe`, 18,252,800 bytes, ProductVersion `0.1.0`, SHA-256 `8b53b57e7a1ff753b29ab1ef8801b81cb032a2534b52dc7afc59089c7f6a9dc8` |
| Production argument guard | Current EXE rejects isolated-test arguments with exit 2 and the production-only diagnostic, before opening any store or window |
| Native Windows interaction | Not rerun: actual close/restore/Exit, locale menu display, repeat launch and process/tray cleanup are not proved by these tests. The earlier Computer Use path error remains recorded below; no native UI input occurred |

Final browser fixture evidence is retained outside Git under temporary `copilot-byok-manager-ui-y5KbGW`. A compiled EXE is not an installed/signed package or release acceptance; the full NativeIsolated suite, clean Windows and real-client gates remain separate.

### Initial four-page core edition — 2026-10-14

The UI uses unchanged Connection/client IDs, `state.json` v2 and Usage SQLite v3. No records, keys or imported metadata are deleted. Only the existing Windows Tauri tray feature is enabled; native plans, ownership, journals and rollback remain unchanged.

| Check | Result and limit |
| --- | --- |
| `npm run check:web` | Passed: 991 bilingual messages / 966 explicit keys, 61 desktop-web + 6 retained web tests (67 total) |
| `cargo test --workspace --locked` | Passed: 268 library + 6 integration tests (274 total), including close policy, hide failure, fixed tray actions and availability serialization |
| Formatting / strict Clippy / whitespace | Passed: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings` and `git diff --check` on the final application changes |
| Core isolated browser | Passed 16 scenario groups: four routes, dual language/themes, contrast/system preference/persistence, hidden-query and route rejection, draft/focus/save failure, checked model save, exact app/provider publication, busy/failure/fresh review, history and global recovery |
| Visual inspection | Two batched rounds: dark Overview/Providers/Apps; Apps made compact with two columns, collapsed account detail and no duplicate App guide |
| `npm run build -- --no-bundle` | Passed after the final interface and native capability changes; `target/release/copilot-byok-manager.exe`, ProductName `CopilotBYOKManager`, ProductVersion `0.1.0`, default production features |
| Repository documentation | Checked 22 Markdown files and 153 local file/heading links, with no broken targets; both manuals and promotion/handoff guidance reflect the four-page scope |
| Windows tray interaction | Not passed. Computer Use initialization and one reset/retry both returned `failed to write kernel assets: 系统找不到指定的路径。 (os error 3)`. No real close/restore/Quit clicks occurred |
| NativeIsolated / clean Windows / real apps | Full native UI suite not rerun; its hidden-page cases need adaptation. Clean Windows, real accounts/requests remain unaccepted; Rider remains deferred |

That earlier executable was 18,296,320 bytes with SHA-256 `4282b6ad404a23b0fc61538f328df07cde4e3050adb88383743785983f299caf`; the later tray-conventions artifact above supersedes it. It was a compiled EXE, not an installer, signed release or tray-interaction proof. Its browser screenshots are retained under a temporary `copilot-byok-manager-ui-Zhxmek` directory; they use fixture data, not real workstation observations.

### First-release identity and bilingual interface — 2026-10-13

These checks recorded the identity/bilingual work before the audit closeout below, on uncommitted changes based on `5a63e26`; they are not the earlier UX or documentation-only revisions.

| Check | Result and limit |
| --- | --- |
| `npm run check:web` | Passed: 920 bilingual messages checked, 47 desktop-web tests and 6 retained web tests (53 total) |
| `cargo test --workspace --locked` | Passed: 261 library tests and 6 integration tests (267 total) |
| Formatting, strict Clippy and whitespace | `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings`, and `git diff --check` passed |
| `npm run build -- --no-bundle` | Passed against the final application changes; produced `target/release/copilot-byok-manager.exe`. This is a compiled executable, not an installed, signed or release-accepted package |
| Isolated browser regression | Passed 27 scenario groups, including all English routes, Chinese/English switching, preference persistence, draft/filter preservation, form/preview guards, no native calls from switching, keyboard behavior and responsive navigation at 960 / 600 / 360 px widths |
| NativeIsolated harness tests | `node --test tests/native-e2e/tests/*.test.mjs` passed 12 tests; these test the harness, not the compiled application's NativeIsolated B00–B32 suite. The suite now explicitly selects Chinese for its text assertions, independently of Windows language; syntax checked, not run against native UI |
| Repository documentation | Local paths and heading links checked; English remains the default README, with a separate Chinese manual |
| NativeIsolated / real-client / clean Windows acceptance | Not rerun or passed by this change; these remain release gates |

The browser run uses fixture responses, never real credentials, IDE configurations or provider requests. Its screenshots and report are temporary local evidence, not release artifacts. Language switching changes presentation only; sensitive form drafts and reviewed deployment plans cannot be replaced by a language change. See [localization](localization.md) for the catalog and test contract.

### Combined code and design audit closeout — 2026-10-13

These fixes extend the uncommitted identity/localization work above. No state/SQLite schema migration, credential-store change, new dependency or release is introduced.

| Finding | Implemented resolution / evidence |
| --- | --- |
| JSON5 errors could echo credentials | VS Code uses bounded checked reads and fixed parse-error guidance, never raw parser excerpts. Production planner fixtures cover own/foreign, camelCase/unfamiliar, multiline and private-text values through central redaction |
| Production IO accepted parent junctions | Shared strict ancestor checks run before canonicalization and again around sensitive IO. Production planner/transaction tests reject Windows junctions and parent substitution after preview/journal without writing into the redirected directory |
| CLI provider label overrode protocol | Explicit Chat Completions / Responses / Messages determines the runtime type/wire format; Azure + Messages is rejected. A provider-kind × protocol regression matrix verifies the projection without real environment writes |
| Checked models were silently omitted by Save | One editable draft, checkbox unchecking/invalidation ownership, no automatic full selection; browser Save submits checked models while preserving manual/original/disabled metadata |
| Late modal/apply responses could lose drafts or errors | Actual dialog-instance ownership, busy resource review/apply and publication navigation guards. Delayed failures retain feedback, disable old apply and require fresh preview; collapse/completion restore meaningful focus |
| Main tasks/results were below the fold | First-Connection / publish jump are discoverable above reminders. Model/session filters are compact, results precede collapsed complete totals; bilingual 960 × 640 table headers are checked at scroll origin |
| Costs lost row identity; manual steps lost context | Fixed model/route/confidence/origin, exact client-card review and exact publication-Connection manual guide. Separate same-name routes and all metrics remain |
| Empty/status/detail/help readability | Light-theme empty-state contrast, 12px important badges/scopes, labeled metadata with expandable JSON, trusted manual/help links via the existing native opener |

| Check | Result and limit |
| --- | --- |
| `npm run check:web` | Passed: 949 bilingual messages, 50 desktop-web tests + 6 retained web tests (56 total) |
| `cargo test --workspace --locked` | Passed: 264 library + 6 integration tests (270 total); new junction cases executed on Windows, not skipped |
| Formatting, Clippy, whitespace | `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings` and `git diff --check` passed |
| Isolated browser regression | Passed existing 27 scenario groups plus `checkAuditFixes`: checked-save/uncheck/endpoint invalidation, original disabled-model preservation, slow/failing apply guards, focus, exact target/Connection follow-ups, bilingual result-first layouts, collapsed summary/locale preservation, fixed identity, metadata, resource failures/retry, status contrast and help links |
| Visual inspection | Batched English/Chinese screenshots at 1180 × 760 / 960 × 640, one confirming round after compacting filters; critical empty/body/badge/table contrast is checked, not a claim of a full accessibility certification |
| NativeIsolated harness | 12 harness tests passed and suite syntax checked; B09/B27 updated to expand totals and save checked models without an Add step. B00–B32 itself was not rerun |
| `npm run build -- --no-bundle` | Passed after the final interface changes; compiled `target/release/copilot-byok-manager.exe` with ProductName / FileDescription `CopilotBYOKManager` and ProductVersion `0.1.0`. No installer, signing, native UI or release acceptance is implied |
| Repository documentation | 21 Markdown files / 141 local file and heading links checked, no broken targets; both manuals, specification, architecture, security review and handoff reflect the selected design |
| Native/real-client release acceptance | NativeIsolated replay, clean Windows, actual account/model/provider/resource consumption remain separate release gates; Rider remains deferred |

### Earlier evidence

| Date / source | Check | Recorded result and limit |
| --- | --- | --- |
| 2026-10-13 / application changes committed as `3791283` | `npm run check:web` | 46 passed: 42 desktop-web tests and 4 retained web plan tests |
| 2026-10-13 / same application changes | `cargo test --workspace` | 267 passed: 261 library tests and 6 integration tests |
| 2026-10-13 / same application changes | `cargo fmt --all -- --check`, strict Clippy, `git diff --check` | Passed |
| 2026-10-13 / same application changes | Isolated browser regression and final menu-focus check | Passed keyboard/draft/save-failure/busy handling, account placement, filter/reset focus, CLI opt-in and result guidance; 1180 × 760 and 960 × 640 layouts inspected |
| 2026-10-12 / closeout later committed as `6a7020e` | NativeIsolated B00–B32 | 33 cases passed on that earlier source, with cleanup/source-stability checks; see [the dated validation record](local-validation-plan.md#jetbrains-隔离真机验收) |
| 2026-10-13 / `3791283` | NativeIsolated suite | B04/B09 navigation and target selection updated; syntax checked only. The 33-case native suite was not rerun for this UX change |
| Current acceptance state | Real IDE/provider requests and clean Windows C2 | Not passed; Rider work was explicitly deferred by the maintainer |

The browser regression uses native-response fixtures, not live Tauri IPC. NativeIsolated uses the compiled app and real IPC but substitutes clients, credentials, installers and network services. Neither layer proves a real user's account, client model picker or billable request.

The earlier 2026-10-13 documentation/rename refresh reran the required web, Rust, formatting, Clippy and whitespace checks successfully against unchanged application code. It also checked local documentation paths and heading links. That documentation-only run preceded the application identity and bilingual-interface work above and added no browser, native-isolated or real-client acceptance result.

## Remaining work within the v0.1 core scope

1. Establish fresh core NativeIsolated/desktop evidence on the final source, adapting old hidden-page cases without claiming an unchanged full B00–B32 run. Verify Windows tray/Exit/relaunch against the real isolated desktop.
2. Complete clean Windows 11 x64 final-NSIS install/start/reopen/uninstall, WebView2 and user configuration preservation. Authenticode is not required; unsigned/source/hash disclosure is.
3. Mac ad-hoc packaging is verified above. For formal distribution, have the maintainer configure Apple credentials and the protected release environment, verify the formal pipeline, then accept the actual Draft DMG separately on Apple Silicon and Intel. Universal build alone is insufficient.
4. Verify exact advertised VS Code/CLI/manual App paths and authorized provider requests. Resume JetBrains runtime work only when the maintainer resumes it: per-IDE official login, model visibility, minimal request and multi-IDE sharing. Prepared Rider files and reviewed plugin bytes are not passing runtime results.
5. Review Draft attachment hashes, notes, real support matrix and security-report availability; approve public candidate promotion only after core gates. No automation result alone gives this approval.

## Deferred extended milestone, not v0.1 blockers

- Direct Copilot App asset-download fallback remains unimplemented; do not advertise it.
- Runtime quota/personal Billing, opt-in CLI/VS Code usage, resource consumption and their dedicated-user UI acceptance remain unaccepted and hidden, not PASS.
- Broaden usage/identity/resource coverage only after supported upstream interfaces are verified, with versioned parsers and sanitized fixtures. Missing semantics, cache-write counters, app-local usage and ambiguous attribution remain unknown.

Existing persistence, migration and security regressions still run; hidden modules must not query their services from the core shell, break startup or delete retained data.

Use [local validation](local-validation-plan.md) for execution details. Historical handoffs remain evidence records rather than unchecked to-do lists.

## First-release decisions

Use the [release criteria](release-criteria.md) for GO / NO-GO, not an earlier build or fixture result. The [promotion plan](promotion-plan.md) starts with opt-in testing and only expands after the corresponding release gate. Neither document authorizes publication or paid promotion.
