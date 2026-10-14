# CopilotBYOKManager architecture

## Authority and scope

This document describes the checked-in native services and the architecture required by [the MVP contract](mvp-implementation-spec.md). The [implementation status](implementation-status.md) records current coverage and validation dates.

The repository implements deployment/recovery, reviewed installation, account orchestration, resources, official usage, local import, attribution and pricing slices. Sections labeled **required** remain acceptance contracts; implemented modules and passing isolated tests do not establish clean-machine or real-client acceptance. The unreleased product uses its own CopilotBYOKManager storage and credential namespace, without historical-brand aliases or automatic adoption.

## Product model

### Application identity and interface language

The product/window/configuration directory is `CopilotBYOKManager`; the package and executable stem is `copilot-byok-manager`, Rust library `copilot_byok_manager_lib`, application ID `io.github.avalonero.copilotbyokmanager`, and credential service `io.github.avalonero.copilotbyokmanager.connections`. Owned projection fields use `copilotByokManager*`; app-specific environment options use `COPILOT_BYOK_MANAGER_*`. These are the first-release identities. Normal state/SQLite schema migrations stay in the product's own directory; no other namespace is adopted.

The webview uses an explicit bilingual message catalog and a bounded `en` / `zh-CN` preference in local storage. This is presentation state, not a native plan or domain field. Switching languages redraws without IPC, retains allowlisted Usage filter drafts and is blocked while a form or deployment preview is open. User data, keys, model IDs, endpoints and original diagnostics are never passed through message lookup. Dates use the active locale; UTC persistence and exact decimal money stay unchanged. See [localization](localization.md).

The current core shell exposes Overview / Providers / Apps / About. `core-ui.js` owns fixed route/refresh allowlists, global recovery, bounded publication history and About. It does not load/mount Usage/Resources/GitHub-authorization modules. Native APIs, schema versions and data remain intact; initialization is not an import or refresh. `appearance.js` runs before styles/body, validates System/Light/Dark, follows system changes only in System mode and saves only that preference. Theme changes update CSS/selectors, not forms, queries or plans.

`window_shell.rs` owns Windows tray and close interception. Its interaction follows [CC Switch's Windows implementation](https://github.com/farion1231/cc-switch/blob/74b98ca9405d8b526c67a16e44a6d0658f2dede5/src-tauri/src/lib.rs): default close-to-tray with an explicit exit-on-close choice, left-click restore, right-click menu and single-instance wakeup. Fixed Open main window / separator / Exit entries and the existing icon remain native-owned. `set_tray_locale` accepts only `en` or `zh-CN` and replaces these fixed labels in memory; it cannot remove actions, execute commands, access credentials or persist locale. Ordinary minimize is unchanged; restore explicitly clears skip-taskbar state. Quit uses Tauri's normal exit lifecycle. Initialization/hide failure keeps normal close; unsupported platforms report unavailable.

`window_preferences.rs` saves only version 1 and a typed Tray/Exit choice in the dedicated `window-preferences.json`; existing state/Usage schemas are unchanged. Reads are bounded to 4 KiB with strict regular-file/ancestor checks. Shared native write exclusion, an exact prior-byte check and private atomic replacement prevent adopting external edits. Missing preferences default to Tray; corrupt/newer/unreadable preferences remain intact and use Exit with a disabled preference control. A failed save keeps the live choice unchanged. `get_window_behavior` distinguishes actual tray registration, preferred close action and preference availability.

The Windows-only official `tauri-plugin-single-instance` is pinned to 2.4.5 to preserve the workspace's Rust 1.88 minimum; its purpose is reliable native wakeup, not another application feature. It registers before other plugins and before stores open/recover. Secondary arguments and working directory are ignored: a second launch only restores the existing window. Isolated builds append a native-held root hash to their validation identifier, separating production and independent fixtures. The capability lists existing non-menu/tray core permission sets individually, rather than `core:default`: the WebView cannot arbitrarily hide/remove the tray or edit away recovery/Exit entries. Sources: [Tauri system tray](https://v2.tauri.app/learn/system-tray/), [official single-instance plugin](https://v2.tauri.app/plugin/single-instance/), [pinned plugin source](https://github.com/tauri-apps/plugins-workspace/tree/single-instance-v2.4.5/plugins/single-instance).

### Optional JetBrains BYOK adapter

`adapters/jetbrains` reads bounded public standard plugin directories, `disabled_plugins.txt`, and `META-INF/plugin.xml` in the public plugin JAR, not every dependency JAR. ID/vendor is metadata identity, not signature or live-IDE verification. Profile hashes give distinct target IDs; metadata digests invalidate reviews. `jetbrains/byok` owns reviewed 1.19 namespace/root selection, bounded duplicate-key rejecting JSON parsing and narrow provider projection. Automatic deployment publishes endpoint, protocol, models, capabilities, headers and the Connection's own provider key through existing native plans/transactions. Unmanaged values/precision survive; shared writes are deduplicated with per-profile proofs/audit. Proofs bind owner, Connection, resource and the three owned provider keys. Global fingerprints reject stale reviews and externally changed rollback; recovery recognizes the dedicated path even after plugin removal. Unknown versions/incompatible endpoints refuse writing. No authentication files or Password Safe are opened; publication is not model-picker refresh/provider execution. Accounts remain official per-IDE flows; resource/usage coverage remains explicit pending separate verified interfaces. Existing state/ownership and old account history stay compatible without a SQLite migration. See `jetbrains-support.md`.

JetBrains has two storage layers: supplier keys/endpoints/models in the shared language-server BYOK namespace, and independent IDE XML preferences for group labels, enablement, context and reasoning. The plugin fetches supplier metadata from the server and reconciles local groups. CopilotBYOKManager neither publishes credentials to XML nor resets local preferences; sharing is conditional on the same user and runtime root. Per-profile proofs remain publication evidence, not selected-model, authentication or successful-request evidence.

CopilotBYOKManager is not organized as an application switcher. The source of truth is client-neutral and is projected into concrete client targets.

```text
Connection
  ├─ provider type and protocol
  ├─ endpoint and request headers
  ├─ credential reference
  └─ model catalog
          ↓
Client target
          ↓
Deployment plan
          ↓
Prepared change / rollback snapshot
          ↓
Journaled apply result
```

The application also implements these control loops, with the source and platform limits described below:

```text
Environment
  discover → preview install → apply allowlisted operations → rediscover

Account
  inspect safe identity evidence → choose target account → launch official flows
  → verify each surface → detect conflicts → deploy shared configuration

Usage
  refresh official quota/Billing + import local observations
  → normalize → deduplicate → attribute route/model
  → bind immutable price snapshot → aggregate with explicit coverage
```

These loops share stable client identities and dashboard summaries, but they do not share secrets or silently reinterpret one another's data.

## Stable identities

Use identifiers rather than display names:

- `installation_owner_id`: this CopilotBYOKManager installation's ownership identity.
- `connection_id`: a BYOK connection.
- `client_target_id`: a concrete target such as VS Code Stable default profile, a named profile, CLI environment, or Copilot app installation.
- `deployment_plan_id`: one native-held deployment intent.
- `install_plan_id` and `install_operation_id`: native-held installation intent and operation.
- `login_run_id`: one login orchestration run.
- `(host, login, user_id?)`: a GitHub identity; numeric user ID is stronger evidence where available.
- `usage_source_id`: one observable source and parser contract.
- `usage_record_id`: a stable source-specific identity derived without exposing sensitive raw paths or session IDs.
- `price_snapshot_id`: immutable price data used by an estimate.

Display labels may change without changing these identities. The MVP account-reconciliation boundary is `github.com`; another host is represented as unsupported rather than interpolated into commands or URLs.

## Trust boundaries

### Frontend

The frontend is a presentation and intent layer. All payloads are untrusted.

It may request a component, target, date range, filter, or confirmation. It may not provide:

- executable paths or command strings;
- package IDs or release repositories;
- authoritative install success;
- GitHub account verification;
- route attribution;
- official Billing totals;
- token prices;
- a completed deployment/login/usage status.

The backend enforces all bounds and invariants independently.

### Native state

`state.json` stores compact non-secret application state: connections, credential references, client summaries, deployment records, install/login summaries, settings, and database metadata.

Required behavior:

- schema versioning and explicit migrations;
- atomic replacement appropriate to each platform;
- a validated `state.json.last-good` copy;
- bounded collection and string sizes;
- no API-key or GitHub-token values;
- explicit read-only recovery when primary and last-known-good state are both invalid.

### Credential store

Secrets are separated by purpose:

- BYOK provider API keys;
- CopilotBYOKManager's separate least-privilege GitHub personal-usage authorization.

CopilotBYOKManager never extracts or reuses client-owned OAuth tokens, cookies, VS Code SecretStorage values, passwords, passkeys, refresh tokens, or private Copilot credential databases.

Credential state is not a Boolean. It must distinguish at least stored, missing, unavailable, locked, and permission denied.

### Usage database

Use a separate transactional `usage.sqlite3` for:

- schema migrations;
- sync runs and source status;
- source cursors and parser versions;
- normalized usage records;
- official quota snapshots;
- personal GitHub Billing snapshots/items;
- model aliases;
- immutable price snapshots/rows;
- stored historical estimates.

Usage-database failure must not disable Connection management. The database stores allowlisted metadata only, never prompt/response/tool/code content or authentication material.

### External processes and network

Process execution and HTTP clients are backend-owned adapters with fixed strategy types, allowlisted hosts/IDs, separate argument arrays, timeouts, response-size limits, redirect policies, and redacted errors.

## Current backend layout

The current backend is organized around these modules (supporting helpers and tests omitted):

```text
apps/desktop/src-tauri/src/
├── commands.rs
├── domain.rs
├── state.rs / secrets.rs / usage_db.rs / decimal.rs
├── deployment.rs / deployment/ / transaction.rs
├── installer.rs / installer/
├── account.rs / account/ / github_auth.rs
├── github_billing.rs / github_billing_store.rs
├── setup.rs / model_discovery.rs
├── resources/
├── usage/
├── safe_io.rs / safe_file.rs / write_lock.rs / redact.rs
└── adapters/
    ├── vscode.rs
    ├── vscode_install.rs / vscode_window.rs
    ├── copilot_cli.rs / copilot_cli/
    ├── github_app.rs
    └── jetbrains.rs / jetbrains/
```

Do not continue expanding `commands.rs` and `domain.rs` indefinitely. Move behavior into focused services and adapters.

### Setup and usage services

`setup.rs` retains component/account/deployment observations and legacy setup progress. User account confirmations, their original evidence and time, the Connection used for manual guidance, and manual provider confirmation are persisted in `setup_preferences`; that preference is not a globally active supplier or a client's selected model. Home now renders owned per-client publication sources independently. A saved confirmation never becomes automatically verified. New deployment audit records include optional target and Connection fingerprints; legacy records remain readable but cannot prove current synchronization.

`usage/` contains separate command, parser, import, query, runtime, price, store, and DTO modules. `github_billing.rs` and `github_billing_store.rs` are registered separately. SQLite v3 preserves v1/v2 data, tracks the currently observed price catalog separately from immutable snapshots, and enables WAL; blocking import/query workers open their own native-owned database connection so reading local logs does not hold the Connection-store lock or the frontend's shared usage handle. Cursor and observation metadata commit together. Price updates compare the original observation before writing, and cumulative updates refuse to replace a concurrent historical price binding.

Frontend `setup-ui.js` and `usage-ui.js` render explicit app routes. Installation, account and authorization modules receive loaded state and mount into explicit containers. They do not watch page-title text or inject panels through MutationObserver. Runtime quota, monthly Billing, local observations and price catalogs keep independent source/status/freshness. Usage jobs have native exclusion, cancellation, time limits and persisted outcomes. Counter and money values cross IPC as exact decimal strings when required by their DTOs.

Concrete source schemas, limits, provenance and remaining upstream limitations are recorded in [usage-sources.md](usage-sources.md). The module tree below remains the normative target decomposition for later milestones, not a claim that every listed file exists.

### Ownership, Resources, and operation lifecycle hardening

`state.json` schema v2 retains v1 compatibility and adds native-owned projection proofs, authored resources, and resource bindings. Existing deployment records without a durable proof are not adopted as owned. Ownership binds installation, Connection/resource identity, canonical physical target identity, and projection digest. Markers alone are insufficient. Revoke-and-delete uses the same one-shot plan, prepare-all transaction, stale checks, compensation, and audit commit as deployment; detach-only never mutates a client.

`resources/` owns validation, public-path adapters, native plan storage, commands, and fixtures. Skills are Markdown-only under the shared personal `.copilot/skills` root. Instructions and credential-free HTTPS MCP entries use reviewed public CLI/default VS Code paths. App configuration, named profiles, custom roots, local commands, MCP headers/secrets, and arbitrary supporting files are not projected. MCP changes preserve unknown/user entries; semantic no-ops preserve source bytes. Archived resource identities retain bounded recovery tombstones with cleared authored bodies.

`installer/history.rs` persists a prepared run before execution and per-component results without process output. Active cancellation is scoped to the exact native run ID; bounded capture kills the owned process tree. Restarted or abandoned runs are Interrupted, not automatically retried. Reviewed package versions/architecture/dependencies are compiled into `installer/catalog.rs`. Windows package-manager identity uses registered App Installer paths and the OS Authenticode trust result, not the PATH name alone. Native plans bind executable bytes and have a monotonic TTL as well as a display expiry. Installation never uninstalls or downgrades as compensation.

`account/lifecycle.rs` reconciles explicit login follow-up against only official protocol-3 `connect` and `auth.getStatus`. It records a bounded CLI login, rejects unsupported authentication modes, separates account conflicts, and never promotes VS Code/app or manual evidence. A recent CLI observation expires after five minutes; verification runs expire after fifteen. Cancellation stops follow-up without closing or signing out official clients. Login history uses compare-before-replace writes so external changes are not overwritten. See [hardening handoff](hardening-handoff.md) for remaining platform boundaries.

## Required target modules

One acceptable layout is:

```text
src/
├── commands/
│   ├── dashboard.rs
│   ├── deployment.rs
│   ├── install.rs
│   ├── login.rs
│   └── usage.rs
├── domain/
│   ├── connection.rs
│   ├── client.rs
│   ├── deployment.rs
│   ├── install.rs
│   ├── account.rs
│   └── usage.rs
├── persistence/
│   ├── state.rs
│   ├── migrations.rs
│   └── usage_db.rs
├── deployment/
│   ├── planner.rs
│   ├── transaction.rs
│   ├── journal.rs
│   ├── rollback.rs
│   └── ownership.rs
├── install/
│   ├── planner.rs
│   ├── runner.rs
│   ├── catalog.rs
│   ├── download.rs
│   └── signature.rs
├── account/
│   ├── orchestrator.rs
│   └── github_auth.rs
├── usage/
│   ├── official_runtime.rs
│   ├── github_billing.rs
│   ├── import.rs
│   ├── normalize.rs
│   ├── attribution.rs
│   ├── pricing.rs
│   └── queries.rs
├── adapters/
│   ├── vscode/
│   ├── copilot_cli/
│   └── github_app/
├── process.rs
├── network.rs
├── redact.rs
└── error.rs
```

The exact filenames may vary, but the responsibility boundaries are required.

## Required deployment lifecycle

The native plan, transaction and ownership services implement this lifecycle. Installation/login workflows must not bypass it; each change must retain its invariants and regression coverage.

### 1. Preview

- Resolve concrete client targets.
- Validate the Connection and stored credential state.
- Capture the connection/state version and each target fingerprint.
- Calculate supported changes without returning secrets.
- Store the complete plan in native memory with a 15-minute TTL.
- Return only a non-secret DTO and `plan_id`.

### 2. Consume

- The frontend submits only `plan_id` plus explicit confirmation.
- Remove the plan from the pending map before application so it is one-shot.
- Reject expired, replayed, wrong-installation, or mismatched plans.
- Revalidate connection version, operation set, plan digest, credential state, and live target fingerprints.

### 3. Prepare all targets

Before the first write:

- read and parse every target;
- reject symlinks, junction/reparse points, non-regular files, oversized files, malformed JSON5, incomplete shell blocks, and ownership conflicts;
- inspect every existing ancestor before canonicalization and recheck file/parent boundaries before reads and replacement; only exact supported macOS system aliases are allowed;
- never return raw JSON5 parser diagnostics, which may echo own or foreign credentials; return a safe file location and repair/fresh-preview guidance;
- build before/after snapshots for every writable target;
- identify semantic no-ops without rewriting user formatting.

### 4. Journal

Persist:

- Prepared deployment records;
- a private rollback manifest containing bounded before/after data or references;
- Applying state before mutation.

### 5. Apply and rollback

- Recheck the relevant before-state immediately before each target write.
- Apply targets in deterministic order.
- On failure, roll back successful prior targets in reverse order.
- Refuse rollback if a target changed externally after CopilotBYOKManager's write.
- Use platform-appropriate atomic replacement; Windows must not use delete-then-rename.

### 6. Commit audit state

- Persist Applied, Skipped, Failed, or RolledBack results.
- If audit persistence fails after client writes, attempt to restore applied targets.
- On startup, surface incomplete journal entries as Interrupted and offer safe recovery information.

## Environment installation architecture

### Observation model

A surface may require more than one component:

- VS Code Copilot: VS Code installation plus an available Copilot capability/extension.
- Copilot CLI: official CLI executable/runtime.
- GitHub Copilot app: official desktop installation.

Observed states include installed, missing, broken, unsupported, unknown, and update-required. A shared package may satisfy more than one surface and must be deduplicated in the plan.

Windows VS Code capability detection separates bundled Copilot metadata from user-installed extensions. CLI probes and extension installs run the installed CLI entry point in child-local Electron Node mode, never the GUI entry point alone. Probe errors remain Unknown and block installation plans. See [VS Code detection](vscode-detection.md) for versioned schemas and evidence boundaries.

### Install plan

The backend owns an immutable plan containing:

- platform and architecture;
- observed component fingerprints;
- exact strategy and allowlisted package/repository/asset identity;
- fixed executable and argument vector;
- source and expected publisher;
- download limits, digest/signature policy, elevation, dependencies, and expected post-install observation;
- plan digest, creation time, expiry, and one-shot state.

The frontend never supplies a shell command.

### Supported MVP path

Windows 11 x64 is the primary acceptance platform. The implemented path uses pinned package-manager plans with reviewed identity checks. The direct GitHub Copilot app asset fallback remains unimplemented; if added, it must use the official release API and strict asset-name/architecture policy, bounded size, redirects, authoritative digest when available and Authenticode publisher checks. See [hardening](hardening-handoff.md) for the exact current package policy.

An exit code is not success. Re-run discovery and verify the component identity/version. Bulk installation reports one result per component; partial remains partial. No automatic uninstall or downgrade is performed as rollback.

## Account architecture

### Safe observations

Each client adapter returns non-secret evidence:

```text
Verified(login, host, user_id?, evidence)
Inferred(login, host, evidence)
ActionRequired
Unknown(reason)
Unsupported(reason)
Conflict(details)
```

A login display name alone is insufficient. Inferred identity requires confirmation. Conflicting verified identities block completion.

### Login orchestration

`Sign in and sync` means:

1. discover installed/ready clients;
2. choose a target GitHub identity from a verified observation or explicit user choice;
3. launch each client's official browser/device/application sign-in path;
4. poll or request safe re-observation;
5. verify identity consistency;
6. only after consistency, offer configuration deployment.

CopilotBYOKManager does not silently sign out a client and never copies authentication material between clients.

Clients exposes reviewed official sign-in actions; Home shows a concise account-alignment action when needed. On Windows, VS Code account actions only focus an existing visible editor window whose process executable matches the resolved installation. They never spawn VS Code: an initial launch can restore multiple saved windows and hot-exit backups, even with `--new-window`. If no matching window exists (or on another platform), the result gives manual Accounts instructions and remains ActionRequired. No window titles, editor state, authentication stores, or restore settings are read or changed. Other clients retain their bounded, backend-owned official launch plans. An installed client without a safe launcher is Unsupported, distinct from NotInstalled. See [local validation](local-validation-plan.md) for the failure and regression scope.

Home shows onboarding/publication next steps, needed pending actions, one row per app/profile with owned sources, a concise provider summary and the latest result. Full provider cards belong on Providers; per-app provider selection, installation/account details and expandable publication history belong on Apps. About contains presentation preferences, help and local storage. There is no Connection-by-client matrix or selected-model claim. The prototype and extended Usage sections remain references, not the current navigation.

Connection `enabled` is a compatible `state.json` field defaulting to true for old records. Toggling uses the managed write mutex/lease, pending-journal guard and persisted-state checks, without credential access or client writes. Disabled Connections remain editable and attributable, are hidden from Home cards, cannot generate deployment plans, and can still use reviewed revoke-and-delete. Editing preserves enablement. The changed state revision invalidates old previews; no SQLite migration is required.

`get_dashboard.publishedSources` verifies durable owner/Connection/resource/projection proofs against bounded public catalogs. VS Code groups and reviewed JetBrains provider namespaces are checked independently, so adding another supplier or editing foreign groups does not invalidate unchanged owned sources. Shared catalogs are read once per physical path. CLI is a single legacy user-environment route, verified against its recorded target fingerprint and known resource identity. Each source is Published / Changed / Unavailable with a nullable observed model count; counts do not come from a newly edited Connection catalog. Read-only recovery yields Unavailable. No model-selection cache, authentication XML, opaque App store or conversation is read.

Editing/saving and deployment are separate; catalog checkboxes belong to the editable Connection draft. Saving does not select a globally active supplier or publish. The preferred model is the first enabled model in the saved recommendation order; CLI writes it to `COPILOT_MODEL`, but picker-based clients still require the user to choose a model and may impose their own ordering. The explicitly chosen protocol determines the CLI wire projection, not the provider display label; Azure + Messages is rejected rather than rewritten. Preview expands inline with separate Preview and Confirm controls; refresh, navigation, edits, enablement and target changes discard idle or late reviews. Once apply starts, navigation, refresh, editing and dismissal are blocked until the response. Failed or uncertain apply consumes the old review and retains visible guidance. Native TTL, one-shot consumption, prepare-all, journal, ownership and rollback invariants remain authoritative. App configuration stays manual because no reviewed documented write interface is available.

The shared frontend lifecycle moves focus into dialogs, makes the app background inert, traps keyboard navigation and restores the invoking control. Async callbacks hold the actual dialog instance, not a permanent modal-root node; late completion cannot close a replacement editor. Connection/resource editors track only an in-memory dirty Boolean, ask before discarding edits, and never serialize passwords into a draft. Saving and resource review/apply prevent misleading cancellation until the native result; failures retain input or the consumed-plan warning with a persistent alert. Closing an idle inline preview restores its invoking control; completed publication focuses the persistent result. Account mounting updates its explicit container without moving it into installation details. Local usage filters are progressively disclosed inside model/session views, remain separate from official quota/Billing, and preserve focus on redraw. Results precede the collapsed complete Token summary; fixed row identity includes route/confidence and origin. Resetting local filters does not reset the Billing month. Per-target operation results are reconstructed from existing native audit records; client review carries the exact target and App manual guidance carries the exact Connection, without claiming authentication, model selection or request success. CLI's exclusive environment route requires an explicit target selection by default. No state/SQLite migration or credential-store behavior changes are introduced by these UI refinements.

### CopilotBYOKManager GitHub authorization

Official personal usage/Billing retrieval uses CopilotBYOKManager-owned authorization, separate from all client sign-ins. Store the token in the OS credential store and persist only host, login, scopes/capabilities, last validation, and secret reference.

## Official usage architecture

Keep three datasets separate:

1. Copilot runtime quota/entitlement observations.
2. Authoritative personal GitHub Billing usage/amounts.
3. Locally observed model/token usage.

They may be displayed together but never substituted for one another.

Each official snapshot stores source, account, covered period, fetched time, units, status, schema/parser version, and raw unknown fields only when safe and bounded. Unauthorized, forbidden, unsupported, network error, schema error, not covered, successful empty, stale, and numeric zero are distinct.

AI credits and legacy premium requests are different units and must not be summed. Personal Billing does not claim organization/enterprise coverage.

## Local usage import architecture

### Import lifecycle

1. Discover bounded candidate files or supported runtime endpoints.
2. Reject symlinks/reparse points and non-regular files.
3. Compare source identity, size, modification time, parser version, and stored cursor.
4. Read only the bounded new range when possible.
5. Tolerate an incomplete actively written final JSONL line.
6. Parse only model, session/request identity, timestamps, token counters, and explicit route/cost metadata.
7. Convert cumulative snapshots to replacement/delta semantics before persistence.
8. Normalize tokens without unsigned underflow.
9. Attribute route only when supported by evidence.
10. Bind an immutable price snapshot only when token semantics and price selection are adequate.
11. Batch-upsert records and advance the cursor in one database transaction.
12. Record source-level errors without blocking independent sources.

Stable unique keys make repeated scans idempotent. Truncation, rotation, schema drift, and parser-version changes enter explicit recovery paths.

### Privacy

Do not persist raw log lines, prompts, responses, tool payloads, source code, environment values, cookies, headers, or authentication data. Hash raw session/request identifiers before frontend exposure where they may reveal private context.

## Token semantics

Canonical fields include:

- source-reported total input, when present;
- fresh input, when derivable;
- cache read;
- cache write;
- output;
- an explicit semantic enum.

Suggested semantic enum:

```text
FreshOnly
TotalIncludesCacheRead
TotalIncludesCacheReadAndWrite
SeparateBucketsWithNoTotal
Unknown
```

For known semantics:

```text
normalized total input = fresh input + cache read + cache write
cache hit rate = cache read / normalized total input
```

Aggregate token counts first, then calculate percentages. Unknown or missing buckets remain unknown; they do not become zero merely to complete a chart.

## Route attribution

Route is:

```text
OfficialGithub
ByokConnection(connection_id)
Unknown
```

Evidence priority:

1. explicit route/provider from the supported source;
2. stable CopilotBYOKManager connection identity in the request/session;
3. unique deployment timeline + client + model match, marked inferred;
4. unknown.

A model name alone is insufficient when the model may be available through both GitHub and BYOK. Unknown records are never assigned to the currently active connection for convenience.

## Model identity

Keep both `raw_model` and optional `canonical_model_id`. Model aliases are exact, source-scoped records. Ambiguous aliases remain unresolved. Re-normalization may update canonical fields but never rewrites raw identity.

The model list is the union of configured BYOK models, official runtime models, local token observations, and official Billing items. A model remains visible when one metric family is unavailable.

## Pricing and reporting

Never collapse these into one value:

```text
official_net_amount_usd        authoritative personal GitHub Billing amount
estimated_api_equivalent_usd   local tokens × immutable price snapshot
```

Provider invoice APIs are outside the required milestone.

A price snapshot preserves provider, canonical model, source, source version, currency, effective/fetched times, threshold/tier, and all available input/cache/output rates. Use exact decimal arithmetic.

An estimate is available only when token semantics are known, required rates are available or explicitly not applicable, and the appropriate pricing tier can be selected. Unknown price is null, not zero. Historical records remain bound to the price snapshot used at calculation time; a current-price comparison is a separate query.

## Adapter ownership

### VS Code

Adapters own installation/profile discovery, safe account evidence, supported usage sources, and `chatLanguageModels.json` projection.

Managed configuration must include installation-owner and connection identity. A similarly named group or a marker created by another CopilotBYOKManager installation is not owned. Semantic no-op must not rewrite JSON5 comments/formatting.

### Copilot CLI

Separate adapters/services own environment projection, executable discovery/version verification, official sign-in launch/evidence, official runtime quota/model data, and local usage import.

CopilotBYOKManager refuses to overwrite unmanaged or foreign-owner provider overrides. Unix changes across managed environment and shell files form one prepared transaction.

### GitHub Copilot app

Provider projection remains detection/manual guidance until a stable external interface exists. CopilotBYOKManager may launch official sign-in and consume supported non-secret identity/usage interfaces. Missing support remains unknown/partial; it does not justify parsing private credential state.

CLI and app may share runtime/session data. Deduplication must use physical source identity so the same record is not counted twice.

## Command boundary

Connection catalog discovery is a separate read-only native module. The editor can query an unsaved endpoint; checked results immediately join its existing editable model draft and are saved by the same form submission. Only unchanged checkbox-added lines can be removed by unchecking or endpoint invalidation; original/manual entries remain. There is no persistence migration or implicit deployment. Its saved-credential binding, provider schemas, bounds and failure states are documented in [provider model discovery](provider-model-discovery.md).

Tauri commands are thin, validated entry points. Long-running install, login, and usage sync operations expose:

- backend-generated run ID;
- bounded progress events;
- cancellation;
- per-step status;
- final persisted summary;
- redacted diagnostics.

List/detail queries enforce backend maximum ranges, page sizes, and sort keys. Frontend input cannot cause an unbounded directory walk, database scan, process launch, or network allocation.

## Concurrency and failure isolation

- Only one environment-mutating install run executes at a time.
- Only one login-sync run targets the same client set/account at a time.
- Deployment uses its own transaction lock.
- Usage imports serialize per physical source; independent sources may run concurrently within a bounded worker limit.
- Runtime quota and GitHub Billing refresh independently.
- Usage-database failure does not disable Connection management.
- Install/login partial failure does not rewrite deployment history.
- Shutdown cancels or marks active runs interrupted; startup exposes recovery status.

## Architecture invariants

The required MVP is architecturally complete only when:

- backend-owned plans, commands, identities, prices, and attribution cannot be replaced by frontend payloads;
- install success is verified through rediscovery;
- login orchestration never copies client credentials;
- conflicting verified identities block completion;
- official GitHub monetary values and local API-equivalent estimates remain distinct;
- unavailable, unknown, partial, stale, conflict, action-required, and zero remain distinct;
- local import is bounded, incremental, idempotent, deduplicated, and content-minimizing;
- historical price snapshots are immutable;
- unknown token semantics or price data do not become zero;
- deployment validation, ownership, journaling, rollback, redaction, and recovery satisfy the required contract.

A blocked deployment recovery offers a separate native-held Keep current files review. The action removes only the bounded, validated pending journal, after matching its reviewed digest and taking the managed write locks. It never follows journal target paths or records success. Restore continues to require native-discovered resources and refuses external changes. Unknown and unreadable resources are explicit preview counts; a missing client cannot trap the user in a repeated restore failure. The confirmation warns that pending rollback data is discarded.
