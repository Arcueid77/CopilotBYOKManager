# Copilot App experimental SQLite synchronization

Updated 2026-11-21 for minimum-version compatibility. Experimental sync starts disabled. Real model-picker and provider-request acceptance is tracked in [implementation status](implementation-status.md).

The maintainer approved direct SQLite provider/model synchronization instead of waiting indefinitely for a documented App write interface. The integration must be **off by default**, require manual enablement and a concrete risk-confirmation dialog, and then automatically synchronize the explicitly selected Connections into the selected Copilot App installation.

Stable official Windows x64 App builds qualify for a read-only compatibility check. The adapter recognizes the JSON provider store by its actual tables, constraints and references. Opening the four-page workspace checks public executable metadata. The common publication preview checks the App installation and database before confirming provider writes. The native preview and apply repeat the checks and bind the actual build.

## Reviewed implementation and storage

- Official [App 1.1.25 Windows release](https://github.com/github/app/releases/tag/v1.1.25): setup SHA-256 `6ca31b9003dceefd434a62d5b58b59e44a07b6083d1628ef5a137039e64b130e`; extracted `github.exe` is 405,381,920 bytes, SHA-256 `1c741981f9b450a17401ab4a8f44bcc556d42bb6a43561c4c9305c39a997e97f`. Its Windows signature was valid. The executable was extracted for schema review, without installing or launching the App.
- Configuration DDL extracted independently from that binary matches the sanitized [v1 fixture](../apps/desktop/src-tauri/tests/fixtures/copilot-app/schema-v1.sql). The adapter pins both provider/model tables, columns, defaults, unique keys and foreign keys, rejects unknown triggers and binds the external reference graph. `sessions.provider_id` can cascade to SET NULL, so temporary connection-local guards abort any cascade into unrelated tables. Session values are never selected.
- The adapter projects OpenAI-compatible Chat Completions and Responses to the default database. See the [manual flow](copilot-app-support.md) for other platforms, formats and providers.
- `app-sync.json` beside the manager's `state.json` stores private versioned consent, target file/owner identity, selected Connection destination hashes and recovery IDs. It contains no keys. Missing files on fresh installs/upgrades mean off; invalid or externally changed consent stops writes and preserves the original file. State remains v2 and the manager's Usage DB remains v3.
- Native workers coalesce saves, serialize through the existing managed-write lock and make fresh one-shot deployment plans. Endpoint/protocol/headers/credential-mode changes require renewed consent. Model removals pause for explicit review and active/default-model confirmation. Database errors/conflicts pause automatic retries; **Check and retry** first checks current owned fingerprints. No background model request is sent.
- Enablement reports separate typed causes for an App still running in the background, an exit that cannot be verified, unsafe database access permissions and an actual competing manager write. Closing the App window can leave its background process running; use its normal Quit/Exit action. A write-lock conflict pauses synchronization for explicit retry rather than being reported as waiting for App exit. The manager does not change shared `.copilot` permissions automatically.
- Recovery uses `deployment-journal.json`, containing only necessary owned-row preimages/postimages plus other explicitly planned resources. It is written privately before mutation and removed after durable success or completed compensation. Interrupted or conflicting recovery retains it until reviewed Restore or Keep current. No whole-database backup is made. Restores remain conditional on the exact owned postimage, current file identity/schema and a closed App, including when sync is disabled.
- [App synchronization service](../apps/desktop/src-tauri/src/app_sync/mod.rs), [SQLite adapter](../apps/desktop/src-tauri/src/adapters/github_app/sqlite/mod.rs) and [bilingual UI](../apps/desktop/web/app-sync-ui.js) implement the vertical slice. [Implementation status](implementation-status.md) separates source/fixture checks from pending real App visibility, selection and request acceptance.

## JSON provider storage boundary

The [1.0.5 release notes](https://github.com/github/app/releases/tag/v1.0.5) and [GitHub announcement](https://github.blog/changelog/2026-06-23-github-copilot-app-support-for-byok/) describe the public Model Providers settings UI. The official [Windows 1.0.7 package](https://github.com/github/app/releases/tag/v1.0.7) still contains the older `byok_providers` / `byok_models` layout. [1.0.8](https://github.com/github/app/releases/tag/v1.0.8) adds `model_providers.settings_json` and `provider_models`. The extracted executable SHA-256 values are `d5a4856a98574b127a6c4df8add23825d91b6822bc86ec3ebc41d4e89daf948b` and `2fe4f885076db223ebdb999ea06f629191bdeeb91a9aa4bf152456da25d49243` respectively.

The native gate checks the existing store. The early JSON layout also stores endpoint, wire API, auth mode and headers in scalar columns. The adapter writes those columns atomically with settings and rejects diverging mirrors. The 1.0.23 layout adds a nullable account reference, and 1.1.0 removes the scalar mirrors. Later releases add supported reasoning efforts and then model vision. Only the manager’s own provider and model rows can be changed. Changing the approved format or references requires a fresh scope review. [Early JSON fixture](../apps/desktop/src-tauri/tests/fixtures/copilot-app/schema-early-json.sql).

## Windows x64 1.4.3 and schema v2

The [official 1.4.3 package](https://github.com/github/app/releases/tag/v1.4.3) has SHA-256 `5617ca68cfb2c2c6815b1584ad496b9956b13dea8584db2694e2bfbfdb17606a`. Its extracted GitHub-signed executable reports product GitHub Copilot, version 1.4.3, SHA-256 `ea5463886513e3335b3a00beb96c294ae08288b8559d2d271d61b066b59fad1f`. The published schema and migration 206 add a checked, non-null `supports_vision` column with default 0. The [migration fixture](../apps/desktop/src-tauri/tests/fixtures/copilot-app/schema-v2-upgrade.sql) exercises existing ownership, vision changes, rollback and revocation. Unknown columns and triggers block writes. The App owns its migrations.

## Evidence and interface boundary

- [GitHub's App BYOK guide](https://docs.github.com/en/copilot/how-tos/github-copilot-app/use-byok-models) describes configuring providers in the App and storing credentials through the operating system.
- [Nexus CLI App SQLite implementation](https://github.com/fw-ai/nexus-cli/blob/b1d5c968e9b9f7e18c2f02e8c631b3b8b3905bdf/packages/setup-cli/lib/harnesses/copilot-app/sqlite.mjs) and [App core](https://github.com/fw-ai/nexus-cli/blob/b1d5c968e9b9f7e18c2f02e8c631b3b8b3905bdf/packages/setup-cli/lib/harnesses/copilot-app/core.mjs) demonstrate provider/model projection into `~/.copilot/data.db`, including `model_providers` and `provider_models`. Its schema commentary refers to App v1.1.17. This is third-party feasibility evidence, not an official stable API or validation of all current versions/platforms.
- The reference implementation materializes an Authorization header in `settings_json.headersJson` with `authKind: "none"`. It reports cross-application keychain-access problems as a reason for that choice. CopilotBYOKManager must independently verify the exact supported schema, platform and request behavior before adopting any mapping.
- The App database is distinct from Copilot CLI's `providers.json` and from the manager's `usage.sqlite3`. Do not reuse the CLI writer or the Usage importer.
- Resolve the App's actual configuration root using a reviewed platform contract, including `COPILOT_HOME` only if verified for that version. Do not guess paths, scan other profiles, or create a partial App database when it does not exist.

A new storage format requires a versioned parser, sanitized success/failure fixtures and renewed scope confirmation. Supported updates with the same destination and format can continue under existing consent. The resource identity retains the v0.2.3 binding for owned rows.

## Opt-in and automatic synchronization

New installations start with the App sync switch off. Enabling the switch keeps an empty provider scope until the user publishes through the standard dialog. The switch alone changes the local preference.

The configuration card reads provider names and model counts from the compatible catalog when App sync is enabled. It includes unowned BYOK providers in the view. The common **Manage configuration** list offers edit and deletion for owned providers through the existing scope and revocation checks.

An enabled App appears as a regular publication target. Review the App database and provider scope in the shared preview. On confirmation the native plan rechecks the provider revision, App build, database identity and settings revision, then reserves the recovery entry. It grants the selected provider's scope after the target write and read-back succeeded. Cancelled and stale plans cannot grant a scope.

The worker synchronizes compatible changes for published providers under their approved scope. Changing credentials mode or provider destination requires a new reviewed publication. A running App blocks writes until it exits. Disabling sync cancels pending work. Reviewed revocation removes owned provider/model entries independently.

## Required risk dialog

Suggested English copy:

> Enable experimental Copilot App sync?
>
> CopilotBYOKManager will update its selected provider and model entries in this App's local SQLite database after you save changes. Close Copilot App before synchronization can run.
>
> This uses an undocumented App database format. An App update may make synchronization unavailable. Your selected provider API keys will be stored as plaintext Authorization headers in the App database, and may also remain in SQLite journals/WAL files and backups. Keeping the manager's original key in the OS credential store does not encrypt these copies. Anyone able to read those files may obtain the keys.
>
> Only this manager's entries are managed. GitHub sign-in credentials, conversations and other providers are not imported or changed. Turning sync off stops future updates; it does not erase keys already written or retained in backups.
>
> Buttons: Cancel / I understand — enable sync

Required Chinese meaning:

> 启用实验性 Copilot App 同步？启用后，管理器会在保存所选连接的变更后同步自己管理的供应商和模型；写入前必须关闭 Copilot App。此功能依赖未公开承诺稳定的数据库格式，App 更新可能导致同步不可用。所选供应商的 API key 会以明文 Authorization header 存入 App 数据库，也可能留在 WAL、日志和备份中；管理器使用系统密钥库并不能加密这些副本。能读取这些文件的人可能获取密钥。关闭同步仅停止后续写入，不会清除已写入或备份中的密钥。不会导入或修改 GitHub 登录凭据、对话或其他供应商。
>
> 按钮：取消 / 我理解风险并启用

Do not soften this to a generic “experimental feature” checkbox. A completed model request may cost money and needs its own explicit initiation; enabling synchronization does not authorize background inference or sending prompts.

## Credential and privacy contract

Synchronization materializes the selected Connection's manager-held provider key in its owned App row after confirmation. The separate provider-extraction review can save a static provider key from the reviewed Bearer Authorization field of a non-account-linked App provider on explicit opt-in. The extraction uses the verified local adapter and stores the key in the system credential store.

- No keys in frontend results, previews, ordinary state/preferences, logs, diagnostics, telemetry, screenshots or exports. Resolve secrets only in the native execution phase and redact errors before crossing IPC.
- Validate endpoint/protocol/header mapping and reject incompatible or ambiguous entries. Do not forward keys to unrelated model-catalog or test endpoints.
- Limit reads to bounded reviewed schema metadata and the minimum configuration rows needed for projection, identity and conflict checks. Never enumerate authentication, account, conversation, session or usage tables.
- Do not dump, upload or automatically back up the entire App database. It may contain unrelated private information. Recovery journals may retain only necessary owned-row preimages, must be private and treated as secret-bearing; document their actual retention and cleanup.
- SQLite files, WAL/journal files and recovery snapshots are sensitive. Verify platform-native restrictive access, including Windows ACLs; POSIX chmod is not a Windows protection claim. Encryption is not implied.
- Removal of a row is not secure erasure of its key from SQLite pages, WAL files, snapshots or external backups. Do not promise secure deletion, run destructive VACUUM/secure-delete maintenance on the user's whole database, or delete unrelated backups. Explain key rotation when exposure is suspected.

## Safe database adapter

- Open only an existing, verified regular database under the selected App root; reject symlinks/reparse points, unsafe ownership/permissions, malformed or oversized inputs, missing dependencies and unknown schema. Do not initialize, migrate or repair App-owned schema.
- Pin allowlisted tables, columns, constraints and supported protocol mappings with versioned parsers. Use parameterized SQL, bounded transactions and lock timeouts.
- Use stable installation/Connection-scoped provider/model identifiers and durable ownership proofs. Repeated desired state is a no-op, not a second provider. Collision with an unmanaged row is a conflict, never adoption.
- Preserve unrelated providers, models, default selection, login state and all other tables. Changing a display label must not change ownership. No whole-table replacement, broad DELETE, foreign-key cascades into unmanaged rows, or automatic schema migration.
- Serialize by physical database and deduplicate logical targets sharing it. Revalidate the App-closed condition, target identity/schema and owned row fingerprints before commit. SQLite transactions/locking remain necessary even after the process check.
- Prepare the full multi-target operation before any target mutation. Persist private recovery intent before mutation; include App row operations in the existing cross-target recovery contract rather than pretending several databases/files share one SQLite transaction.
- Commit provider and model changes atomically within App SQLite; read back the owned projection, then record the exact outcome. A timeout or interrupted acknowledgement is Unknown until read-only reconciliation establishes committed versus not committed; do not blindly replay.
- Rollback/revoke only rows proven owned and still matching the expected postimage. If the App or user edited them, refuse overwrite and show a conflict. Never restore a stale whole-database snapshot over new conversations or other configuration.
- Deleting/retiring managed models requires a reviewed diff and verified referential behavior; if it would affect an active/default or unmanaged reference, stop and ask the user to resolve it in App. Revocation is a separate explicit action, not a side effect of disabling sync.

## State and UX semantics

Use distinct Disabled, ConsentRequired, UnsupportedSchema, ReviewRequired, PendingAppExit, PendingSync, Paused, Synchronizing, SyncedConfiguration, Conflict, Failed and RecoveryRequired states.

“Synced” means the owned configuration was committed and read back. It does **not** mean the App selected the model, authenticated successfully, refreshed its picker, or completed a model request. Show the App restart/model-selection next step and separate request verification. A manual confirmation is not database observation. Unknown cannot become configured or verified.

Keep the switch and results within the existing four-page UI. Do not reopen Usage/Billing/Resources or change sign-in policies for this work. Until implementation passes acceptance, keep the current manual guide and avoid a nonfunctional toggle.

## Acceptance before enabling the feature

- Unit/fixture tests: default-off and upgrade-off; cancel/close has no effects; consent invalidation; selected-scope-only sync; save coalescing; no-op and duplicate handling; unmanaged collisions; multiple providers/models; target-root identity; unknown/new/malformed schema; wrong platform paths; unsafe links/ACLs; App running; busy database; foreign-key/reference conflicts.
- Fault injection: failure before write, between row updates, after DB commit but before manager acknowledgement, cross-target partial completion, restart recovery, external edits before apply/rollback and disable during queued/in-flight work. Preserve existing unrelated state in every case.
- Security fixtures: fake keys never appear in previews/errors/logs/exports; key-bearing database/recovery handling follows the disclosed policy; no account/session/usage table queries or whole-database copies.
- Isolated real-client acceptance per exact App version and OS: add selected provider/models, restart App, confirm model visibility, select model, run one explicitly authorized nonsensitive request, restart again, update models, and revoke only owned entries. Verify original providers, defaults, login and conversations remain intact without collecting their content.
- Record code/fixture checks separately from real App/request acceptance. No live acceptance has been performed for this plan. Do not advertise automatic App support or lift the current adapter's write gate merely because this document was committed.

## 中文决策摘要

已实现默认关闭的 SQLite 同步：用户选择供应商并确认风险后，保存变更会自动同步到已审核的 Windows x64 App 1.1.25。模型移除需额外核对，冲突会暂停，关闭同步保留现有配置，单独撤销保留管理器中的供应商。仅允许上述明文 Authorization header 兼容路径，不导入客户端凭据、会话或用量。精确版本/schema、私有权限、所有权、事务及条件恢复均受原生检查；实际 App 模型可见性、选择和真实请求仍待隔离验收。此前已发布的包没有因这次源码修改而更新。
