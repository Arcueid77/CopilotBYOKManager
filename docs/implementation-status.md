# CopilotBYOKManager implementation status

Updated 2026-11-01 for default-off Copilot App SQLite synchronization. Initial release engineering started at `83a82db3555eb0defa278bd6e042b7c55a76088f`; source and evidence are recorded below. The [specification §21](mvp-implementation-spec.md#21-final-acceptance) and [feature availability](feature-availability.md) separate the core release from the retained extended milestone. Public versions and their exact build metadata are on [Releases](https://github.com/Arcueid77/CopilotBYOKManager/releases).

## 2026-11-02 v0.2.0 release preparation

The maintainer authorized submission and publication as `v0.2.0` Pre-release. Application manifests, lock metadata, About labels, README and bilingual release notes are aligned to 0.2.0. The four-page scope and state v2 / Usage DB v3 stay unchanged. The release workflow must check the exact committed source using Node 22 / Rust 1.88.0, build Windows x64 and macOS Universal, and verify the Draft's original bytes before promotion. The Release's metadata, SHA256SUMS and Actions provide final package evidence; the previous dirty-tree 0.1.0 local preview is not a release artifact. Browser/native UI automation, clean-system installation and real-client requests remain separately tracked quality work.

## 2026-11-01 experimental App synchronization

Implemented the [approved SQLite contract](copilot-app-sqlite-sync.md) in the working tree based on `3de949f`. Missing consent on new installs/upgrades leaves the feature off. Native-held one-shot scope previews and the bilingual risk dialog authorize only selected saved providers, the pinned Windows x64 App 1.1.25 executable, default database identity/owner/schema and reviewed destinations. Saved changes coalesce through the existing managed-write lock, deployment plans, scoped row journals, exact readback and conditional compensation. Running App waits; changed destinations require renewed consent; model removals require review. Other errors/conflicts halt automatic retries pending reconciliation. Disable preserves committed rows; separate App revocation retains the manager provider/key. The four core pages and manual fallback remain.

Schema review used the signed official App binary without installing/running it. The exact hashes, mapping and sanitized schema fixture are in the adapter contract. Session-reference tests prove cascading deletion is blocked; production SQL never selects account/session content. Consent/state and frontend results contain no provider keys. Only owned row preimages/postimages can enter the private recovery journal, retained on interrupted/conflicting recovery and cleared after durable completion. Existing state v2 and Usage DB v3 need no migration; only features on existing SQLite/Windows dependencies were enabled.

Checks: 318 Rust unit tests + 6 integration tests, 91 web tests, 24 release tests, version consistency, bilingual catalog, formatting and strict Clippy passed on this source. New fixtures cover cancel/expiry/replay/stale consent, saved-only selected scope, coalescing/no-op, model review, destination changes, App-running state, restart/revocation, unknown schema/triggers, unsafe ACL/file identity, lock contention/collisions/bounds, external edits, precommit cancellation, commit acknowledgement interruption, native schema binding during restart recovery and cross-target compensation. Web tests exercise the real dialog controllers through synthetic DOM/API boundaries in both languages.

These are source/fixture tests. Browser/native UI automation, clean Windows/macOS installation, actual App model visibility/selection and a provider request have not been rerun for this change. No new real-client or request PASS is claimed. Earlier Release bytes remain unchanged; local package provenance is kept with the ignored build artifacts.

## Current implementation

| Area | Implemented behavior | Current boundary |
| --- | --- | --- |
| Connections and models | Native CRUD, enablement, read-only catalog discovery/probe, checkbox-to-draft model selection saved with the form, preferred-model order, OS-held keys | Model-catalog lookup; disabling preserves published configuration |
| Deployment and recovery | Native one-shot expiring plans, live fingerprints, durable ownership, prepare-all writes, journals, compensation, conditional rollback, revoke-and-delete and detach | Changes after preview require a new review; ownership required outside confirmed CLI publication |
| VS Code | Stable/Insiders/profile discovery; owned `chatLanguageModels.json` groups coexist with other suppliers | Select the model in the client; sign-in only focuses an existing Windows editor or gives manual instructions |
| Copilot CLI | Confirmed merge of each provider and all enabled models into `providers.json`; independent durable claims, current multi-provider observations and scoped revoke; same-Connection owned legacy-route upgrade | Default path only; start a new session and select with `/model`; custom-root overrides unsupported; saved default unchanged |
| JetBrains | Automatic dedicated shared BYOK projection for reviewed 1.19 distributions, with per-profile proofs and deduplicated writes | Unknown versions unsupported; per-IDE login, picker visibility and actual requests are separate acceptance steps |
| Copilot app | Discovery/manual flow plus risk-confirmed, selected-provider SQLite auto-sync, model removal review, status/retry, separate revoke and recovery | Exact Windows x64 App 1.1.25/default-root/OpenAI-compatible contract; real picker/request acceptance open. Private usage/authentication extraction excluded |
| Installation | Pinned WinGet plans and identity checks; fresh PATH/portable CLI discovery, hidden-terminal phase/download progress, scoped cancellation, preserved partial results and rediscovery | Unknown progress is indeterminate; direct app asset-download fallback and clean-machine package acceptance are not complete |
| Accounts and GitHub authorization | Official client workflows, protocol-3 CLI identity follow-up, manual/verified distinction, separate OS-held GitHub authorization | No copying client credentials; actual runtime/Billing capability depends on the installed client and account |
| Resources | Native MCP, Markdown-only Skills and Instructions authoring/publication/revoke on reviewed public paths | Named profiles, custom roots, local-command/secret-bearing MCP, app and JetBrains resource gaps remain manual |
| Usage and pricing | Runtime quota/model observations; monthly personal Billing; opt-in CLI/shared-runtime and VS Code imports; decimal estimates and immutable prices | Missing semantics, cache writes, source coverage or Connection attribution remain unknown/partial |
| Persistence | `state.json` schema v2 and separate `usage.sqlite3` schema v3, migration/reopen support and explicit read-only recovery | Dedicated `CopilotBYOKManager` configuration root and `io.github.avalonero.copilotbyokmanager.connections` credential service; no automatic adoption of another app's namespace |
| Interface language | English / Simplified Chinese, system-language default, saved preference, localized dates and explicit message catalog | User-authored names, IDs, URLs and native/upstream diagnostics remain original; language switching cannot replace an open form or deployment review |

Technical detail: [architecture](architecture.md), [hardening](hardening-handoff.md), [JetBrains](jetbrains-support.md), [usage sources](usage-sources.md), and [model discovery](provider-model-discovery.md).

## Current interface

- Top navigation: **Overview / Providers / Apps / About**, or **总览 / 供应商 / 应用 / 关于**. No More menu. Usage/Billing/authorization/Resources UI is not loaded or queried by the core shell; implementations/data and backend tests remain.
- Overview: first-provider or publication next steps, needed actions, app/profile current-configuration rows, a provider summary and persistent per-target result. Full provider cards belong on Providers. Recovery is visible on every page and precedes normal writes; View app locates the exact app. Component detection/install states remain on Apps with their details and read-only Detect again controls, without an Overview task.
- Connection editor: common fields first; provider/protocol/header options expand separately. Catalog checkboxes immediately join the editable draft and are saved by Save connection, without a second Add selected step or automatic full selection. Original/manual entries, disabled flags, identities and capabilities are preserved. Save errors remain visible and retain the form.
- Dialogs: initial focus, contained Tab/Shift+Tab navigation, Escape when idle, focus restoration, background isolation, and protection against replacing an unsaved editor. Async callbacks belong to the actual dialog instance; resource preview/apply prevents misleading dismissal. Dirty tracking never serializes passwords or other form contents.
- Apps: direct per-app provider selection and single-target publication with optional View changes; multiple providers require an explicit selection. Choices survive language redraw/navigation; changing a choice invalidates idle review. App manual setup binds that exact provider. Installation/account detail is expandable, not a mandatory large preamble. Publication/revocation history is expandable on Providers and Apps.
- Installation: separate completed/current/queued component rows with phase, approximate byte progress and elapsed time. Active dialogs reject replacement/dismissal and repeated cancellation. Results retain completed components after cancellation. Live counters remain in memory, with no persistence schema migration. [Implementation and provenance](installer-support.md).
- Extended Usage/Resources: their implementations, unknown/decimal/privacy contracts and tests remain, but their controls are not exposed in the core edition. The [feature record](feature-availability.md) has no promised launch dates.
- Publication: pending apply blocks navigation/refresh/dismissal, and failures retain guidance with a consumed preview. Closing an idle preview restores its opener; completion focuses persistent per-target results. VS Code/JetBrains model selection, CLI new-session guidance, and the exact Connection's App manual guide remain distinct.
- Appearance/help: Light/Dark/System, early saved preference and live system following only in System mode. Changes are CSS-only, preserving drafts and previews without IPC. About includes manual/feedback links, an offline planned-feature record and local storage/recovery details.
- Windows window lifetime: default close-to-tray with a saved Tray/Exit choice on About; left-click restore, localized right-click Open main window / Exit menu, and repeat-launch wakeup. Only a readable Tray preference, registered tray and successful hide retain background execution; other main close paths use normal Tauri exit. Ordinary minimize uses the taskbar. Preference damage keeps the original file and exits; unknown observations remain unknown. Unrestricted menu/tray permissions are excluded from the WebView.
- Layout: shared header/content gutters and equal-height toolbar controls; bottom-aligned provider actions; app identity, status, provider selector/action and information footer use consistent rows. Overview has a grouped app-status panel and paired summary/result panels; About groups identity, preferences and help. Dialog headers/footers stay visible while the form body scrolls. The four routes and explicit target selection remain; ordinary publication uses one click, while CLI publication and group removal retain review/confirmation.

## Validation evidence

Evidence must stay attached to the source and validation layer that produced it. Tests use temporary data and fake external services. Private runtime reports remain outside Git; the reviewed, synthetic README screenshots are checked in with [provenance](images/README.md).

### Copilot App workflow documentation — 2026-10-31

Documented the existing `dcc5a8f` App workflow in both user guides, the READMEs, documentation index and a dedicated [App contract](copilot-app-support.md). Coverage includes installation/account entry points, the selected-provider guide, confirmation read/save and retry states, independent records, revision invalidation, mixed publication versus App-only setup, guide cancellation, and removal of manual App entries. The architecture now distinguishes local confirmation records from public catalogs and automatic publication history. No application code, persistence schema or client configuration changed. Real App sign-in/model/request acceptance remains the open quality work recorded below.

Documentation-only validation passed: `npm run check` (24 release tests, 87 Web tests, 302 Rust library + 6 integration tests, version checks, formatting and strict Clippy), 31 Markdown files / 309 local links and anchors, and `git diff --check`. App button/status wording was compared with the bilingual message catalog. No App installation, sign-in or request was performed for this documentation update.

### Four-page product consistency — 2026-10-24

Working tree based on `65891b5ba7f19803671ec6132d8a4ee08df00692`. Overview no longer singles out CLI's shared multi-provider capability or repeats a generic status slogan; its publish action is in the header. Apps shows current supplier names and model counts separately from the next publication selection, with distinct empty/unreadable/unsupported/missing states. Publication results/history identify provider and target. Allow publishing and Recommended model describe their actual effect. The editor shows the current protocol before model discovery. About keeps one window-behavior control while the shared toolbar owns appearance. Installation titles follow the phase; cancelled components are counted separately from failures.

Core dashboard loading no longer awaits component/version or account/network probes. Explicit expansion loads those details, generation guards reject late responses, and language changes do not trigger probes. Manual App confirmation is a bounded per-Connection record in the existing preference payload, with native revision matching, write/recovery guards, exact legacy matching and no invented timestamps. A changed provider requires reconfirmation. State remains v2, SQLite v3 and install history v1; no credential adoption, client authentication access or new dependency.

- `npm run check` passed: 10 version sources, 24 release tests, 87 Web tests (81 desktop + 6 retained), 302 Rust library + 6 integration tests, docs, fmt and strict Clippy. `local-e2e` Rust passed 303 + 6 tests and strict Clippy. Whitespace checks passed.
- New regression coverage reproduces multi-provider state/result distinctions, independent and stale async reads, cancellation categories, manual-confirmation persistence/change/legacy/bounds, and full shell startup/navigation against a synthetic DOM/API boundary. These are CLI-run tests, not browser automation.
- Browser/native UI scripts were updated and syntax-checked only. No desktop or browser automation was used, and no new native-UI or visual-layout PASS is claimed. The 2026-10-23 NativeCore evidence below belongs to the previous source. README screenshots retain their dated provenance.
- User manuals, feature availability, architecture and SECURITY now agree with the maintainer's optional-signing policy and the current UI terminology. Local package source/content hashes and startup checks are recorded in its ignored build directory. No commit, push, Tag or Release is part of this local preview.

### Windows installation recovery and progress — 2026-10-23

Working tree based on `65891b5ba7f19803671ec6132d8a4ee08df00692`: one shared CLI resolver re-reads Windows user/machine PATH and the known WinGet portable location. The version parser accepts the observed `GitHub Copilot CLI 1.0.90.` output. Pinned WinGet execution uses a hidden pseudoconsole with bounded, typed phase/byte progress and a child-scoped cancellation job. Rediscovery runs after completion and cancellation; verified components survive partial cancellation. Dialog callbacks remain scoped to the active plan and modal, with cancellation sticky across polling. [Contract and official sources](installer-support.md).

- `npm run check` passed: 10 version sources, 24 release tests, 76 Web tests, documentation links, fmt, 299 Rust library plus 6 integration tests, and strict Clippy. `local-e2e` Rust tests passed 300 library plus 6 integration tests, with strict Clippy. Windows terminal tests cover live counters, graceful cancellation and a child that ignores Ctrl+C; the parent remains usable.
- Isolated browser smoke passed 24 scenario groups, including English/Chinese download progress, guarded dialog dismissal, sticky cancellation and retained completed-component results. Both progress layouts were visually inspected at 800px dialog width.
- NativeCore run `installer-fix-20261023-r2` passed 20 core cases, with 14 extended cases SKIPPED. B33 exercised progress and partial cancellation through real WebView2/Tauri IPC using fake installers; CLI completion survived App cancellation and the native window remained responsive. Cleanup and source stability passed at tree digest `323a26ab0870c409111c124b24c575ec4f2671dc8ffd57c2c8e184b0a12e8797`. Subsequent changes added test coverage and documentation only. The first run's Windows namespace-path assertion failure remains recorded; the harness now resolves both paths before checking containment.
- Live diagnosis found that WinGet completed CLI installation but the old app retained its pre-install PATH. The installed CLI's read-only version probe confirmed the trailing period. The later cancellation left the old window responsive; the original reported disappearance was not reproduced. No provider request, credential copying or real installation was performed by the regression tests.

Install history remains schema v1, state v2 and Usage DB v3. Progress counters stay in memory; raw terminal output is neither persisted nor returned to the UI. Production packages and their exact source/content hashes are recorded in each local build directory. Clean-machine installation and real-client request acceptance remain open.

### CLI registry update — 2026-10-22

Working tree based on `65891b5ba7f19803671ec6132d8a4ee08df00692`: public multi-provider/model projection, independent claims in one file, current catalog observations, scoped revoke, transactional same-Connection legacy cleanup and registry recovery resources. State v2 and Usage DB v3 remain unchanged. Both UI languages and user manuals now describe registry publication and client-side model selection. [Pinned contract and reproduction](copilot-cli-support.md).

- `npm run check` passed: version consistency, 24 release tests, documentation links, 75 Web tests, fmt, 289 Rust library tests plus 6 integration tests, and strict Clippy. Seven Windows-executed registry groups cover coexistence/update/revoke/no-op/protocols/schemas/precision/plan/rollback. An additional Unix-only permission regression is checked in but was not run on this Windows host.
- Isolated browser smoke passed 23 scenario groups, including two sequential CLI publications preserving a manual provider, every enabled model, cancel-without-write and bilingual confirmation/results. Three CLI-focused screenshots were captured with fake data. Layout regression passed 48 route/locale/theme/viewport combinations plus editor/long-name/review checks.
- `scripts/check-cli-registry.cjs` passed all four pinned official-CLI cases: three loopback-only synthetic requests routed to the correct provider/wire model, including duplicate model IDs across providers and slash/colon IDs; map-shaped providers were rejected before a request. No real account or provider credentials were used.
- The native WebView suite now tests registry coexistence/scoped revoke in B04 and mutates the actual attempted file for B08 crash recovery. This updated suite passed syntax checking only; the earlier 2026-10-17 NativeCore run below is not new-source native acceptance. Clean-machine/native-window and real-provider/client acceptance remain separate work.

### Release readiness review — 2026-10-17

Fixed an existing Unix-only Clippy error in the CLI transaction fixture, a browser-preview refresh failure when its session predates `clientConfigurations`, and layout/native selectors that still expected the old preview workflow or empty-provider screen. Native fault injection now counts actual mutations rather than resource positions, so an unchanged ownership marker cannot accidentally bypass the interruption/partial-write tests. This fault hook is compiled only with `local-e2e`; production transaction behavior and persisted schemas are unchanged.

`NativeCore` now executes the current four-page cases without reopening extended features. Run `20261017-core-review-4` passed all 19 core cases (B00–B08, B19–B22, B26–B29, B31–B32), with 14 extended cases explicitly SKIPPED. It exercised real WebView2/Tauri IPC, synthetic credentials/clients/HTTP services, exact rollback, stale plans, process interruption, recovery conflicts, corrupt state/database handling, current configuration reads, one-click publication and owned revoke after manual edits. Cleanup and source-stability checks passed. Earlier failed attempts remain in private reports; their failures exposed stale selectors/driver extraction and the ineffective positional fault hook, rather than being counted as passes.

Local checks passed: `npm run check` (22 release tests, 75 web tests, 284 Rust library + 6 integration tests, version/docs/fmt/strict Clippy), `local-e2e` Rust tests (285 + 6) and strict Clippy, 12 native-tooling tests, 22 isolated browser scenario groups, 48 layout combinations plus editor/publication checks, actionlint 1.7.12 for both workflows, and whitespace checks. The official actionlint archive was checksum-verified; no global tool installation was needed. Browser coverage includes an older demo session retaining its provider after refresh.

The maintainer subsequently authorized release on 2026-10-17 without publisher signing or completed manual acceptance, and requested no signing/acceptance notices in release notes or download copy. The workflow now defaults to a credentials-free Mac Universal build, retains explicit optional Developer ID builds and promotes verified Draft bytes without rebuilding. Internal manual results remain open, not PASS. No authentication material was copied and no real provider request or client installation was performed.

Release-policy validation: `npm run check` passed with 23 release tests, 75 web tests and 284 Rust library + 6 integration tests, plus version/docs/fmt/strict Clippy. Actionlint 1.7.12 and `git diff --check` passed. New coverage permits ad-hoc release packages, preserves truthful metadata and dry-run isolation, rejects inconsistent signing metadata, and checks that promotion skips rebuilding while retaining source checks and downloaded-byte verification. No application code, dependencies or persisted schemas changed in this release-policy update.

The fixed `v0.1.0` package source is `bd4e9d31fa714499946f3670af2aa8d058701239`; its [three-platform CI](https://github.com/Arcueid77/CopilotBYOKManager/actions/runs/39008376536) passed. The [release build](https://github.com/Arcueid77/CopilotBYOKManager/actions/runs/39008379574) passed both platform checks and Mac Universal packaging. Windows produced an NSIS package but failed its post-build source-cleanliness check; those runner bytes were not used. A local build of the same clean tag passed the unchanged packaging checks and supplied Windows NSIS/ZIP, with its actual toolchain recorded in metadata. The Mac artifact archive matched GitHub's digest; both platforms were assembled and hashed together. The extracted Windows ZIP also passed x64/GUI and production-only startup checks.

First Draft publication exposed that GitHub's by-tag REST endpoint omits Drafts. The publisher now finds the authenticated repository's Draft through a bounded listing and verifies/promotes its stable numeric ID, rejecting changed identity/tag or attachments. Windows packaging now prints changed file names on a source-cleanliness failure, without printing their contents or weakening that gate. `npm run check` passed again with 24 release tests, 75 web tests and 284 + 6 Rust tests; these tooling fixes do not alter the fixed tag or package bytes.

### Concrete app actions — 2026-10-17

Overview app rows now say View app. Missing, broken, unsupported, unknown and failed component observations no longer create general review reminders; their details remain in Apps. Unknown components offer Detect again, using the existing read-only discovery command. Missing components remain optional installation choices. Genuine recovery remains visible with View recovery options; application detection errors say Detection unavailable. Native writes, confirmation rules and persisted schemas are unchanged.

Validation: `npm run check:web` (75 tests), `npm run check:version`, `npm run test:release` (22 tests), `cargo fmt --all -- --check`, `cargo test --workspace --locked --offline` (284 library + 6 integration tests), `cargo clippy --workspace --all-targets --locked --offline -- -D warnings`, `npm run check:docs` and `git diff --check` passed. The isolated browser regression covers the renamed navigation, absence of general pending prompts, visible unknown-component diagnostics, bilingual Detect again and no installer calls on retry; the Chinese Overview render was inspected. The local Windows release build (`npm run build -- --no-bundle -- --locked --offline`) and GUI PE check passed; the rebuilt desktop opened with a responding main window, no captured startup errors and empty stderr. No new blocker in this UI slice; real-client requests and clean-machine acceptance remain separate.

### Current configuration and manual edits — 2026-10-17

Dashboard refresh now reads current VS Code/JetBrains public provider catalogs and the supported CLI environment route, including manual providers. Names and model counts reflect current data, an empty catalog means unconfigured, and failed/unsupported reads remain explicit. Historical publication fingerprints no longer produce source-change warnings or block ordinary edits to owned providers. Provider writes/revocation retain durable owner/Connection/resource bindings and live markers; new plans snapshot current bytes. Changes after plan creation still refuse writes, and changes after application still refuse rollback. Unrelated providers remain untouched. Compact localized failure feedback keeps original redacted diagnostics in collapsed details. No persistence migration or new dependency.

Regression coverage includes field reordering, edited names/models, removed catalogs, malformed data, current counts, shared Chat/Agents, unknown identity filtering, secret redaction, foreign ownership rejection, stale-plan refusal and exact rollback to manually edited bytes. Browser fixtures verify refresh after edits/deletion/read failures and collapsed localized failure feedback. Tests use isolated data; actual provider requests and macOS runtime behavior are not claimed.

Validation on these local changes: `npm run check:web` (75 tests), `npm run check:version`, `npm run test:release` (22 tests), `cargo fmt --all -- --check`, `cargo test --workspace --locked --offline` (284 library + 6 integration tests), `cargo clippy --workspace --all-targets --locked --offline -- -D warnings`, the isolated browser regression (22 scenario groups), `npm run check:docs` and `git diff --check` all passed. The local Windows release build (`npm run build -- --no-bundle -- --locked --offline`) and x64 GUI PE check passed. The rebuilt executable was started from `target/release` with a responding CopilotBYOKManager main window; captured startup output had no errors and stderr was empty. This is a local executable; no installer publication or real-client provider request is claimed.

### Direct publication and shared app configuration — 2026-10-17

Historical validation before the current-configuration change above. Its projection-based source-status behavior is superseded.

Ordinary publication now obtains and applies one native plan from a user click. Optional View changes, explicit CLI/group-removal confirmation, failed-preflight refusal, duplicate prevention and fresh-plan retry are covered by isolated browser checks. Shared Agents/Chat catalog observations use live owned projections; changed/unavailable/recovery/foreign-owner and independent-profile cases have Rust regressions. Apps sorts supported configured targets first, keeps JetBrains cards separate and shows plugin support. The default VS Code label is Copilot Chat; only the redundant shared Agents card is hidden. Account checks are optional and remain manual. No persistence migration or new dependency. No real-client request acceptance is claimed.

Validation on the local changes: `npm run check:web` passed (75 tests, bilingual catalog/syntax); `npm run check:version` and `npm run test:release` passed (22 release tests); `cargo fmt --all -- --check`, `cargo test --workspace --locked --offline` (288 tests), and `cargo clippy --workspace --all-targets --locked --offline -- -D warnings` passed. The browser regression passed with in-memory native fixtures, including shared Chat display, optional account checks, direct publication, failed preflight, duplicate apply refusal, fresh-plan retry and CLI/removal confirmation. `npm run check:docs` and `git diff --check` passed. This does not substitute for native client/request acceptance. Local Windows build: `npm run build -- --no-bundle -- --locked --offline` passed; the x64 GUI PE check passed. The resulting executable was launched from `target/release`, with a responding CopilotBYOKManager main window and no startup errors in captured output. This is a local executable, not a packaged or published release.

### Confirmed CLI replacement — 2026-10-16

Based on `20562b2`, CLI publication accepts unmanaged, foreign-owner, legacy and externally edited environment configuration after preview and explicit confirmation. It records new ownership after application; revocation and other clients keep their ownership checks. Before/after snapshots, stale-plan checks, private journals, conditional rollback and credential redaction remain. No persistence migration or new dependency is needed. Bilingual confirmation copy, README and user guides describe the replacement directly.

- `npm run check` passed: 22 release tests, 72 web tests, 994 bilingual messages / 970 UI keys, 279 library + 6 integration Rust tests, formatting and strict Clippy. Documentation links and whitespace checks passed.
- New isolated Rust fixtures cover replacement without prior ownership, fresh ownership markers, unchanged revocation checks, exact foreign-byte rollback (including Windows registry type), and edits before transaction/write/rollback. An additional Unix incomplete-block fixture is included for platform CI.
- Isolated browser regression passed 20 scenario groups, including bilingual CLI review, cancellation with no apply call and exactly one explicitly confirmed apply. README screenshot capture passed 18 header combinations.
- [Official environment fields](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-byok-models) and [configuration roots](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference) were rechecked on 2026-10-16. The adapter still uses the existing environment projection; provider-registry/custom-root support is unchanged.

Validation used temporary files, fake registry values and isolated browser fixtures. Current native packaging and real-client acceptance remain in the release checklist.

### Concise interface and documentation copy — 2026-10-16

Based on `a2639b8`, the interface now reports direct results and actionable next steps. Model-catalog success reads “模型目录可访问。” / “Model catalog available.” Repeated caveats were removed from both languages, the READMEs, guides, release/architecture documents and historical handoffs. Credential, deletion, overwrite and charge warnings remain; native status handling, persistence and deployment behavior are unchanged.

- `npm run check` passed: 22 release tests, 72 web tests, 994 bilingual messages / 970 UI keys, 281 Rust tests, formatting and strict Clippy; documentation links and `git diff --check` passed.
- Isolated browser regression passed 19 scenario groups, including exact bilingual catalog success/denied results, fixed-message redaction and a catalog-only command check. Layout passed 48 combinations plus editor/preview scenarios.
- Six README screenshots were recaptured and inspected; bilingual catalog-result screenshots use fictional providers. Copy regression tests and the contributor convention cover future changes.

### Layout polish and console-free Windows launch — 2026-10-16

Validation baseline: `0255a7d09e08fb8909907724645f2653a6959813` plus the then-local changes described here. The subsequent commits are `b337419` (console fix) and `a2639b8` (layout polish).

The Windows preview's unexpected console was confirmed in its PE header (Console subsystem 3). The release entry point now selects Windows GUI subsystem 2; debug builds retain their console. Packaging and the Windows CI build validate the compiled x64/PE32+ GUI header, rejecting console, malformed and truncated payloads. Three new regression tests cover the header and build-path contract. Native tray behavior, stores, credentials, migrations and deployment logic are unchanged.

Before the later layout edits, a local dirty-source Windows dry-run produced NSIS and standalone ZIP artifacts. The extracted payload passed the GUI-header check, rejected test-only startup flags and opened a responding `CopilotBYOKManager` main window without the old console. That package contains the console fix and predates the layout changes. The standalone app was launched; the installer was not run.

The layout changes use the real current frontend with fresh isolated browser contexts and fictional key-free providers. `scripts/check-layout.cjs` preserves before/after captures at 1180 × 860 and checks 48 combinations of four pages, two languages, two explicit themes and 960/1180/1440px widths (960 × 640 is the smallest window). Geometry checks cover header/content alignment, toolbar heights, card action rows and overflow; additional scenarios cover long names, modal-body scrolling, draft retention, fake-data save, publication preview and synthetic native-only window preferences. No real provider, account, IDE or key was read or modified.

| Check | Result and limit |
| --- | --- |
| Source checks | `npm run check` passed: 10 version sources, 22 release tests, 69 web tests, 998 bilingual messages / 973 explicit keys, Rust fmt, 275 library + 6 integration tests, strict Clippy. The existing local link-privilege limitation is unchanged |
| Existing browser regression | All 18 core scenario groups passed, including contrast, system theme, draft/focus/save guards, preview lifecycle, recovery and hidden-feature boundaries; native calls remain fixtures |
| Layout regression | 48 page/locale/theme/viewport checks plus editor/long-name/preview/synthetic-window checks passed; before/after screenshots retained locally under ignored `target/ui-polish-20261016/` |
| README images | Six current-browser screenshots recaptured and visually inspected; icon/header checks passed for 18 locale/theme/width combinations |

Release gates remain separate: current native-isolated acceptance, clean Windows install/uninstall and real client/provider requests are still required. Rider remains deferred.

### Icon refresh and unsigned Mac preview — 2026-10-15

Package source: `dad7bd49b383338ef299d3e313eaca1c7836d268`. The maintainer requested a Copilot-related mark; the new locally packaged icon combines a Copilot-inspired robot/goggle outline and a key. The high-resolution transparent source, official Tauri PNG/ICO/ICNS exports, app header/favicon and bilingual README screenshots are updated. [Artwork provenance and final edit prompt](../apps/desktop/src-tauri/icons/README.md) record use of the built-in image-generation tool. Product identity, native configuration/ownership/recovery logic, credentials, migrations and window/tray behavior are unchanged.

The maintainer explicitly authorized pushing the local engineering/icon commits and running only a Mac dry-run. Its separate job has no GitHub environment or Apple secret mappings; formal signing and public publication require separate maintainer approval. No tag, GitHub Release, repository setting, secret, environment or Apple account was created or changed.

The [first Mac attempt](https://github.com/Arcueid77/CopilotBYOKManager/actions/runs/38704585598) passed both platform test suites and built the Universal DMG, but failed the subsequent standalone-app identity check: locked Tauri cleaned its intermediate `.app` for a DMG-only build. The wrapper now requests standard `app,dmg` outputs, retains the app for verification, and still distributes only the DMG. A regression guard preserves both app checks and strict signature verification; no check was skipped. The [corrected dry-run](https://github.com/Arcueid77/CopilotBYOKManager/actions/runs/38706651589) passed all selected checks, Mac packaging and checksum assembly. Formal signing, Windows cloud packaging and public Release jobs were skipped as requested. [Normal three-platform CI](https://github.com/Arcueid77/CopilotBYOKManager/actions/runs/38706650798) also passed on this exact source.

| Check | Current evidence |
| --- | --- |
| Local source checks | `npm run check` and whitespace check passed: 19 release-policy/icon tests, 69 web tests, 275 Windows library + 6 integration tests, formatting and strict Clippy |
| Browser layout | 18 header/icon combinations passed: English/Chinese, Light/Dark/System, 960/1180/1440px; six sanitized screenshots regenerated; no native writes |
| Hosted strict-link tests | Both dry-runs passed with `COPILOT_BYOK_MANAGER_TEST_REQUIRE_LINKS=1`; platform suites contain Windows 275 + 6 Rust tests and Mac 268 + 6. The local Windows symlink case was skipped due to missing privilege (error 1314) |
| Windows packages | Clean `dad7bd4` source produced unsigned x64 NSIS and standalone ZIP; architecture, versions, metadata and SHA-256 verified locally |
| Mac package | Universal DMG produced on `macos-15`, Node 22, Rust 1.88. Retained app and final mounted-DMG app passed identity/version/minimum-OS, x86_64+arm64 and strict code-signature/Hardened Runtime checks. Ad-hoc, **not notarized**; testing artifacts only |

The verified Mac set is the run's `release-dry-run-dad7bd49b383338ef299d3e313eaca1c7836d268` Actions artifact (ID `11959232397`, ZIP size 17,529,162 bytes). GitHub reports archive SHA-256 `9b28314e19dfca9dfb39a7f5852ff232366b6d28e2b570665b4597ddc23aaa12`; this is the **artifact ZIP digest**; DMG checksums are inside `SHA256SUMS.txt`. The ZIP includes the DMG, `SHA256SUMS.txt`, metadata and release notes. Files are retained for 14 days under the current workflow policy. The engineering Windows host's GitHub CLI download stalled and a bounded direct HTTP retry timed out; the Mac archive was not downloaded locally. Download from the successful run and verify its included checksum list before testing.

Mac first launch, Keychain behavior, Intel/Apple Silicon runtime, clean Windows and real client/provider-request acceptance remain separate and uncompleted. Rider remains deferred.

### Initial local v0.1 release engineering — 2026-10-15

The packaging identity, data/credential namespaces, native write/ownership/recovery logic and four-page application code remain unchanged. Tauri Bundler is enabled: Windows current-user x64 NSIS plus standalone ZIP; Mac universal DMG with a conservative 15.0 candidate floor. Formal Mac requires Developer ID/Hardened Runtime/notarization/stapling; Windows is explicitly unsigned. A new independent release workflow freezes source SHA, reruns locked checks and defaults tags to Draft. Publish preserves the exact reviewed Draft bytes. It does not publish automatically on tag push.

The bilingual README is now a product overview; full procedures moved to [English](user-guide.md) / [Chinese](user-guide.zh-CN.md) guides. Six current-browser screenshots use fictional providers and no keys, clearly labeled simulated. [Release engineering](release-engineering.md), [Apple setup](release-secrets.md), [release gates](release-criteria.md) and notes now use core v0.1 rather than hidden full-MVP features as the release scope.

At this initial local stage, Windows NSIS/ZIP build and metadata verification succeeded; Mac packaging/signing/notarization and hosted workflow execution had **not** run. That stage did not push or change remote state. The later, explicitly authorized remote preview is recorded above. Core native-isolated UI/tray, clean Windows, Intel/Apple Silicon and live client requests remain NOT RUN/BLOCKED as applicable.

| Engineering check | Observed result and limit |
| --- | --- |
| Dependencies / versions | `npm ci` passed; all 10 application version sources agree at 0.1.0; local Node 24.15.0 and explicitly selected Rust 1.88.0, without changing the default toolchain |
| Release policy / locked Tauri schema | 16 tests passed, including version/ref/fork/PR rejection, all required Apple secrets, missing/tampered assets, fixed source, Draft-only mutation and immutable promotion bytes; GitHub CLI is fake in tests |
| Web | 998 bilingual messages / 973 explicit keys; 63 desktop + 6 retained tests passed (69) |
| Default Rust checks | `npm run check` passed: fmt, 275 library + 6 integration tests, strict Clippy. One file-symlink test was skipped on this account due to missing privilege (error 1314) |
| Strict link-capability run | With `COPILOT_BYOK_MANAGER_TEST_REQUIRE_LINKS=1`, 274 library tests passed and the symlink fixture failed with Windows error 1314 (missing privilege), before integration/Clippy. No test or CI requirement was weakened; rerun on a link-capable runner |
| Isolated browser / docs | 18 current core scenario groups passed; six synthetic screenshots visually inspected. Local Markdown file/anchor checks passed; no real client writes or requests |
| Workflow / scripts | Task-local checksum-verified actionlint 1.7.12 passed both workflows; Node script and PowerShell parser checks passed. Hosted workflow execution is still unverified |
| Packaging | Local x64 NSIS and standalone ZIP generated, version/PE/unsigned checks passed |

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
| Native Windows interaction | Not rerun: close/restore/Exit, localized menus, repeat launch and process/tray cleanup. The earlier Computer Use path error is recorded below |

Final browser fixture evidence is retained outside Git under temporary `copilot-byok-manager-ui-y5KbGW`.

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

That earlier executable was 18,296,320 bytes with SHA-256 `4282b6ad404a23b0fc61538f328df07cde4e3050adb88383743785983f299caf`; the later tray-conventions artifact above supersedes it. Its browser screenshots are retained under a temporary `copilot-byok-manager-ui-Zhxmek` directory; they use fixture data.

### First-release identity and bilingual interface — 2026-10-13

These checks recorded the identity/bilingual work before the audit closeout below, on uncommitted changes based on `5a63e26`.

| Check | Result and limit |
| --- | --- |
| `npm run check:web` | Passed: 920 bilingual messages checked, 47 desktop-web tests and 6 retained web tests (53 total) |
| `cargo test --workspace --locked` | Passed: 261 library tests and 6 integration tests (267 total) |
| Formatting, strict Clippy and whitespace | `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings`, and `git diff --check` passed |
| `npm run build -- --no-bundle` | Passed against the final application changes; produced `target/release/copilot-byok-manager.exe` |
| Isolated browser regression | Passed 27 scenario groups, including all English routes, Chinese/English switching, preference persistence, draft/filter preservation, form/preview guards, no native calls from switching, keyboard behavior and responsive navigation at 960 / 600 / 360 px widths |
| NativeIsolated harness tests | `node --test tests/native-e2e/tests/*.test.mjs` passed 12 tests. The suite now explicitly selects Chinese for its text assertions, independently of Windows language; syntax checked, not run against native UI |
| Repository documentation | Local paths and heading links checked; English remains the default README, with a separate Chinese manual |
| NativeIsolated / real-client / clean Windows acceptance | Not rerun or passed by this change; these remain release gates |

The browser run uses fixture responses, never real credentials, IDE configurations or provider requests. Screenshots and the report are retained in a temporary local directory. Language switching changes presentation only; sensitive form drafts and reviewed deployment plans cannot be replaced by a language change. See [localization](localization.md) for the catalog and test contract.

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
| Visual inspection | Batched English/Chinese screenshots at 1180 × 760 / 960 × 640, one confirming round after compacting filters; empty/body/badge/table contrast checked |
| NativeIsolated harness | 12 harness tests passed and suite syntax checked; B09/B27 updated to expand totals and save checked models without an Add step. B00–B32 itself was not rerun |
| `npm run build -- --no-bundle` | Passed after the final interface changes; compiled `target/release/copilot-byok-manager.exe` with ProductName / FileDescription `CopilotBYOKManager` and ProductVersion `0.1.0`. |
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

The browser regression uses native-response fixtures. NativeIsolated uses the compiled app and real IPC with fake clients, credentials, installers and network services.

The earlier 2026-10-13 documentation/rename refresh reran the required web, Rust, formatting, Clippy and whitespace checks successfully against unchanged application code. It also checked local documentation paths and heading links. That documentation-only run preceded the application identity and bilingual-interface work above and added no browser, native-isolated or real-client acceptance result.

## Remaining work within the v0.1 core scope

1. NativeCore's 20 current core IPC cases passed on 2026-10-23, including installer progress and partial cancellation. Verify Windows tray/Exit/relaunch against the real isolated desktop and retain exact final-source/package evidence.
2. Continue clean Windows 11 x64 final-NSIS install/start/reopen/uninstall, WebView2 and user configuration preservation checks as quality follow-up.
3. Continue final Draft DMG checks on Apple Silicon and Intel. Default distribution needs no Apple credentials; optional Developer ID builds require separate setup.
4. Verify exact advertised VS Code/CLI/manual App paths and authorized provider requests. Resume JetBrains runtime work only when the maintainer resumes it: per-IDE official login, model visibility, minimal request and multi-IDE sharing.
5. Verify exact Draft attachment hashes, notes and metadata before maintainer-authorized public promotion. Manual results remain separately tracked under the 2026-10-17 release decision.

## Deferred extended milestone, not v0.1 blockers

- Direct Copilot App asset-download fallback remains unimplemented; do not advertise it.
- Runtime quota/personal Billing, opt-in CLI/VS Code usage, resource consumption and their dedicated-user UI acceptance remain unaccepted and hidden, not PASS.
- Broaden usage/identity/resource coverage only after supported upstream interfaces are verified, with versioned parsers and sanitized fixtures. Missing semantics, cache-write counters, app-local usage and ambiguous attribution remain unknown.

Existing persistence, migration and security regressions still run; hidden modules must not query their services from the core shell, break startup or delete retained data.

Use [local validation](local-validation-plan.md) for execution details. Historical handoffs remain evidence records rather than unchecked to-do lists.

## First-release decisions

Use the [release criteria](release-criteria.md) for GO / NO-GO. The [promotion plan](promotion-plan.md) starts with opt-in testing and only expands after the corresponding release gate. Publication and paid promotion require maintainer approval.
