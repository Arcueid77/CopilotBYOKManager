# Copilot App experimental SQLite synchronization

Decision: 2026-10-31. Implementation: 2026-11-01. **Experimental, default-off; real-client request acceptance remains open.**

The maintainer approved direct SQLite provider/model synchronization instead of waiting indefinitely for a documented App write interface. The integration must be **off by default**, require manual enablement and a concrete risk-confirmation dialog, and then automatically synchronize the explicitly selected Connections into the selected Copilot App installation.

The native adapter and Apps panel now implement this contract for the pinned Windows x64 App 1.1.25 build. Discovery alone remains manual. Only a confirmed, destination-scoped consent record enables writes for its saved Connections. Earlier published packages remain manual; this source change does not update those packages or grant consent.

## Reviewed implementation and storage

- Official [App 1.1.25 Windows release](https://github.com/github/app/releases/tag/v1.1.25): setup SHA-256 `6ca31b9003dceefd434a62d5b58b59e44a07b6083d1628ef5a137039e64b130e`; extracted `github.exe` is 405,381,920 bytes, SHA-256 `1c741981f9b450a17401ab4a8f44bcc556d42bb6a43561c4c9305c39a997e97f`. Its Windows signature was valid. The executable was extracted for schema review, without installing or launching the App.
- Configuration DDL extracted independently from that binary matches the sanitized [v1 fixture](../apps/desktop/src-tauri/tests/fixtures/copilot-app/schema-v1.sql). The adapter pins both provider/model tables, columns, defaults, unique keys and foreign keys, rejects unknown triggers and binds the external reference graph. `sessions.provider_id` can cascade to SET NULL, so temporary connection-local guards abort any cascade into unrelated tables. Session values are never selected.
- Only OpenAI-compatible Chat Completions and Responses are mapped. Other protocols, Windows ARM64, macOS/Linux, unknown executable hashes/schema and custom `COPILOT_HOME` are unsupported. The App must have created its own database at `~/.copilot/data.db`; it must be closed, with no pending WAL, for review. The adapter never initializes App tables.
- `app-sync.json` beside the manager's `state.json` stores private versioned consent, target file/owner identity, selected Connection destination hashes and recovery IDs. It contains no keys. Missing files on fresh installs/upgrades mean off; invalid or externally changed consent stops writes and preserves the original file. State remains v2 and the manager's Usage DB remains v3.
- Native workers coalesce saves, serialize through the existing managed-write lock and make fresh one-shot deployment plans. Endpoint/protocol/headers/credential-mode changes require renewed consent. Model removals pause for explicit review and active/default-model confirmation. Database errors/conflicts pause automatic retries; **Check and retry** first checks current owned fingerprints. No background model request is sent.
- Recovery uses `deployment-journal.json`, containing only necessary owned-row preimages/postimages plus other explicitly planned resources. It is written privately before mutation and removed after durable success or completed compensation. Interrupted or conflicting recovery retains it until reviewed Restore or Keep current. No whole-database backup is made. Restores remain conditional on the exact owned postimage, current file identity/schema and a closed App, including when sync is disabled.
- [App synchronization service](../apps/desktop/src-tauri/src/app_sync/mod.rs), [SQLite adapter](../apps/desktop/src-tauri/src/adapters/github_app/sqlite/mod.rs) and [bilingual UI](../apps/desktop/web/app-sync-ui.js) implement the vertical slice. [Implementation status](implementation-status.md) separates source/fixture checks from pending real App visibility, selection and request acceptance.

## Evidence and interface boundary

- [GitHub's App BYOK guide](https://docs.github.com/en/copilot/how-tos/github-copilot-app/use-byok-models) describes configuring providers in the App and storing credentials through the operating system.
- [Nexus CLI App SQLite implementation](https://github.com/fw-ai/nexus-cli/blob/b1d5c968e9b9f7e18c2f02e8c631b3b8b3905bdf/packages/setup-cli/lib/harnesses/copilot-app/sqlite.mjs) and [App core](https://github.com/fw-ai/nexus-cli/blob/b1d5c968e9b9f7e18c2f02e8c631b3b8b3905bdf/packages/setup-cli/lib/harnesses/copilot-app/core.mjs) demonstrate provider/model projection into `~/.copilot/data.db`, including `model_providers` and `provider_models`. Its schema commentary refers to App v1.1.17. This is third-party feasibility evidence, not an official stable API or validation of all current versions/platforms.
- The reference implementation materializes an Authorization header in `settings_json.headersJson` with `authKind: "none"`. It reports cross-application keychain-access problems as a reason for that choice. CopilotBYOKManager must independently verify the exact supported schema, platform and request behavior before adopting any mapping.
- The App database is distinct from Copilot CLI's `providers.json` and from the manager's `usage.sqlite3`. Do not reuse the CLI writer or the Usage importer.
- Resolve the App's actual configuration root using a reviewed platform contract, including `COPILOT_HOME` only if verified for that version. Do not guess paths, scan other profiles, or create a partial App database when it does not exist.

Before implementation, pin the relevant upstream commit and exact App versions, add sanitized fixtures, and record tested OS/architecture combinations. Unknown versions or schema drift remain Unsupported/SchemaError, never best-effort writes.

## Opt-in and automatic synchronization

1. New installations and upgrades start with App SQLite sync **disabled**. App discovery, existing manual confirmations, general provider publication and enabling another client cannot turn it on.
2. The user explicitly chooses **Enable experimental Copilot App sync**. Show the target App/database location in the local UI, selected Connections, permitted operation scope and the risk dialog below. No key value appears in the dialog.
3. Cancel, Escape or closing the dialog leaves the option disabled and performs no target writes. Only affirmative confirmation records a versioned, native-owned consent record bound to this installation, target root, adapter/schema contract and selected Connections.
4. After confirmation, synchronize the selected provider/model projections initially and after relevant saved Connection changes. Coalesce repeated saves and serialize operations per physical database; never sync unsaved drafts. Each operation uses a fresh native-held one-shot plan, live target checks, prepare-all, journal and conditional recovery. Automatic synchronization preserves the complete deployment safety contract.
5. The enable dialog authorizes this bounded automatic-sync mode, not arbitrary client operations. Adding another Connection/target, changing endpoint destination, changing credential-storage mode, expanding data scope or accepting a new schema contract requires renewed explicit review/confirmation. Ordinary model-list updates inside the approved scope may synchronize without repeating the same warning on every save.
6. If App is running, show **Pending — close Copilot App to sync**. Do not kill it, close windows, lose unsaved work, or write concurrently. Resume only after a fresh safe-state check; if closure cannot be established, remain blocked/manual. Bounded lock contention or any uncertain commit outcome stops automatic retries until read-only reconciliation.
7. Disabling the option cancels queued work and prevents subsequent writes. A transaction already committed remains committed; disabling must not falsely report rollback. Existing App configuration remains until separately reviewed revocation. Turning the feature back on requires the risk confirmation again.

Consent stores only bounded IDs, scope, risk-text version and timestamps, never keys or authorization headers. It is not portable across machines and must not silently survive changed target identity or schema.

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

The approved compatibility route permits materializing **only the selected Connection's manager-held provider key** into its owned App provider row after the above confirmation. It does not permit importing keys from App rows or borrowing any client's login credentials. Prefer a verified native credential integration if one becomes available, but do not claim cross-app keychain access without platform evidence or silently switch storage modes.

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
