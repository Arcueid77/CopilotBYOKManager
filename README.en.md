# CopilotBYOKManager

[简体中文](README.md) | **English**

**Configure your provider once. Use it across Copilot clients.**

Save your AI provider's endpoint, API key, and models in one place, then apply the same configuration to **VS Code, Copilot CLI, and supported JetBrains IDEs**. Copilot App is covered through guided manual setup.

You do not need to maintain a separate provider configuration for every client. When you change an endpoint or key, or add or remove models, edit the connection, preview the changes, and publish them to the clients you want to update.

[Get started](#getting-started) · [Supported clients](#supported-clients) · [First connection](#first-connection) · [Everyday use](#everyday-use) · [Usage and costs](#usage) · [FAQ](#faq)

> This is a pre-release application with no published GitHub Releases installers yet. You can try the browser interface or run the desktop app from source. Clean-Windows installation, real-account access, and actual client requests still require acceptance testing; see [implementation and validation status](docs/implementation-status.md).

The app's current interface is in Chinese. This manual provides English instructions and includes the Chinese labels for key controls; it does not imply that the app has an English-language interface.

## What you can do

- **Manage providers centrally:** save multiple connections, fetch or manually enter models, and choose a preferred model.
- **Apply configuration to multiple clients:** select targets, review changes, confirm publication, and check each target's result and next steps.
- **Set up clients:** check installation status, install supported Windows components through reviewed plans, and complete official sign-in and account checks for each client.
- **Inspect usage:** view official quota, personal GitHub Billing, local token records, and API-equivalent estimates separately.
- **Reuse resources:** manage MCP, Skills, and Instructions, then preview and publish them to supported public configuration locations.

A **connection** is a reusable provider configuration. **Publishing** writes it to the selected clients. **Saving is not publishing, and publishing does not mean a client has selected the model.**

<a id="supported-clients"></a>

## Supported clients

| Client | Provider configuration | Before you use it |
| --- | --- | --- |
| VS Code Stable / Insiders and detected profiles | Automatically adds or updates this connection's provider group while preserving other providers | After publishing, select the model in Copilot's model picker in the corresponding profile |
| GitHub Copilot CLI | Automatically configures one environment-variable route and the preferred model | Unchecked by default; only one such route is active at a time. Open a new terminal and CLI session afterward |
| GitHub Copilot plugin in JetBrains IDEs | Automatically writes shared BYOK configuration for reviewed plugin versions | Close the relevant IDEs first; reopen them after publishing, sign in, and select a model |
| GitHub Copilot App | Provides setup instructions; does not automatically write provider configuration | Add the provider and verify it manually in the app |

JetBrains support is limited to the [1.19 plugin distributions in the version table](docs/jetbrains-support.md#version-and-compatibility-boundary), not every 1.19 or newer release. IDEs using the same runtime directory share the configuration, including IDEs you did not select.

Accepted protocols, endpoints, and model capabilities can differ between clients; review the publication preview. This app manages configuration. It does not provide model hosting, subscriptions, or free credits, and it does not replace a client's own access requirements.

<a id="getting-started"></a>

## Get started

### Try the interface without changing your configuration

1. On this repository's GitHub page, select **Code → Download ZIP** and extract the source.
2. Open the local [apps/desktop/web/index.html](apps/desktop/web/index.html) file in your browser.
3. Try adding a connection, selecting clients, and reviewing a publication preview.

The page displays **Browser preview (浏览器试用)**. This mode uses simulated data: it does not write to real clients, run installers, sign you in, or send requests to providers. Use sample data, not real API keys. Resource management and real usage imports require the desktop app.

The [interactive design prototype](prototype/copilot-byok-manager.html) is retained separately as a design reference. Use the frontend entry point above to try the current interface.

### Run the desktop app to configure real clients

Prepare Git, Node.js 22+, Rust 1.88+, and the [Tauri 2 system dependencies](https://v2.tauri.app/start/prerequisites/). Windows also requires the MSVC C++ build tools and WebView2. For macOS/Linux, follow the official dependency instructions.

Run in a terminal:

```bash
git clone https://github.com/AvaloNero/CopilotBYOKManager.git
cd CopilotBYOKManager
npm ci
npm run dev
```

The active development branch is `main`. The first launch downloads dependencies and compiles the app; a successful launch opens a desktop window. Its title may still show the former name, PilotWeave; see [naming and compatibility](#naming-and-compatibility).

To build the desktop executable without an installer, run `npm run build -- --no-bundle`. See [local validation](docs/local-validation-plan.md) for packaging details. A successful build is not proof of clean-machine installation acceptance.

<a id="first-connection"></a>

## First setup: one provider, multiple Copilot clients

### 1. Check the clients you want to use

Open **Clients (客户端)** and review the detected apps and profiles. You only need the clients you intend to use, not every supported app.

- If an installed component's status is outdated, open **Installation and updates (安装与更新)** and click **Refresh status (刷新状态)**.
- For a missing supported Windows component, click its **Install (安装)** button, review the plan, and confirm. Install clients without an automatic installation path yourself.
- Expand **Official sign-in and account checks (官方登录与账号核对)** and follow the official sign-in steps in each client. The manager never copies one client's sign-in credentials to another.

Use **Check the same GitHub account in each client (逐个核对同一 GitHub 账号)** to record your own confirmation. Manual confirmation and software-verified identity are shown separately. **Provider setup does not require granting this manager access to personal Billing.** Billing authorization is a separate, optional step.

### 2. Add a connection

Go to **Connections (连接) → Add connection (添加连接)** and fill in:

| Field | What to enter |
| --- | --- |
| Name (名称) | A recognizable name, such as “Work provider” |
| Endpoint URL (端点地址) | The API base URL supplied by your provider, not its website or dashboard URL |
| API key (API 密钥) | That provider's key. Leave it blank only if the endpoint permits anonymous access and the target client supports it |
| Models (模型) | Fetch models with the corresponding button, or enter upstream model IDs manually |

`https://api.example.com/v1` is only an example of the URL format, not a working endpoint. Remote endpoints require HTTPS; local loopback endpoints may use HTTP.

If your provider does not use the default OpenAI-compatible Chat Completions interface, first expand **Advanced options: provider type, protocol, and headers (高级选项：供应商类型、接口协议与请求头)**:

- Select **Chat Completions, Responses, or Messages** according to the provider's documentation.
- Changing the provider type does not automatically change the URL or protocol; check them separately.
- Add headers only when needed, one `Name: Value` per line. Reference the key with `${apiKey}`; do not put a real key directly in the header text.

The manager stores API keys in the operating-system credential store and does not display saved keys in the form. During publication, some client formats require the key to be written into their configuration. Do not share those files publicly.

### 3. Add models and save

Start with **Fetch models (获取模型)**. Filter by name or ID, select the models you want, then click **Add selected (添加已选)**. The manager does not automatically select the entire catalog or overwrite existing manual entries.

If the provider has no model catalog endpoint, enter one model per line in **Models (模型)**:

```text
your-model-id | Work model
another-model-id | Backup model
```

Replace these example IDs with the actual IDs supplied by your provider. The display name after the vertical bar is optional. For Azure connections, manually enter the actual deployment name, not the underlying model name.

Choose a **Preferred model (首选模型)**, then click **Save connection (保存连接)**:

- Copilot CLI uses the preferred model for `COPILOT_MODEL`.
- Clients with model pickers, such as VS Code and JetBrains, still require you to select the model inside the client. This preference does not force an open session to switch models.

**You have only saved the connection; no client configuration has changed yet.** Both Fetch models and the connection card's **Test connection (测试连接)** check catalog access only. They do not verify chat, tool calling, or vision support.

### 4. Preview and publish

1. On the connection card, click **Publish to clients (发布到客户端)**.
2. Review each target and uncheck any clients or profiles you do not want to update. **Copilot CLI is unchecked by default**; select it explicitly if you want its single-route environment configuration.
3. If JetBrains is included, close the relevant IDEs using that shared configuration first.
4. Click **Generate preview (生成预览)** and check how each target will be handled. Expand **Write details (写入明细)** when needed. Targets marked **Manual action required (需手动处理)** will not be configured automatically.
5. When the preview is correct, click **Confirm publication (确认发布)**.

Generate a new preview after changing the connection or targets, after the preview expires, or if another program changes the target configuration. Previews are valid for 15 minutes and can be used only once.

Afterward, check each target's result under **Overview (总览) → Latest publication (最近一次发布)** or **Connections (连接) → Recent configuration operations (最近配置操作)**. Restart instructions, manual steps, and model-selection guidance remain visible after the notification disappears.

### 5. Select and verify the model in each client

**VS Code**

Open the profile you selected when publishing, then choose the published model in Copilot's model picker. Multiple providers can remain in separate groups; the client determines which model is actually used.

**Copilot CLI**

Open a new terminal, start a new CLI session, and check the selected model. An existing terminal does not automatically receive updated environment variables. This adapter currently uses a legacy environment-variable configuration method, not `providers.json`. While this BYOK route is active, do not expect to use the GitHub official model route at the same time.

**JetBrains**

Reopen the relevant IDE, complete official GitHub Copilot sign-in, and select the published model in Copilot Chat's model picker. Shared configuration does not mean shared sign-in state; check each IDE separately. Unknown plugin versions are not written automatically. See [JetBrains usage and compatibility](docs/jetbrains-support.md) for further limits.

**Copilot App**

Go to **Clients (客户端) → Copilot App providers (Copilot App 供应商) → View manual setup steps (查看手动配置步骤)**. In the app's **Model providers**, add the provider using the displayed endpoint and model, and enter the required key inside the app. You can then click **I have completed manual setup (我已完成手动配置)** to record your confirmation. This is not an automatic verification result.

Finally, send a short request containing no sensitive project content from the client you intend to use, and confirm that the model responds. Real requests may incur provider charges. **Configuration written, account signed in, model selected, and request successful are four different states.**

<a id="everyday-use"></a>

## Everyday use

### Change an endpoint, key, or model list

Find the provider under **Connections (连接)** and click **Edit (编辑)**:

1. Update the relevant fields. Leave an existing key blank to keep it, enter a new key to replace it, or check **Remove saved key (移除已保存的密钥)** to remove it.
2. Click **Save connection (保存连接)**.
3. Use **Publish to clients → Generate preview → Confirm publication** again to update the intended targets.
4. Reopen clients or create new sessions as instructed by the publication results.

Editing a connection does not automatically synchronize it to all clients in the background. If fetching models asks for credentials after you change the endpoint, protocol, or headers, enter the key for the current endpoint again. Catalog discovery will not silently send the stored key to a changed destination.

### Add or switch providers

Add another connection under **Connections (连接)**, then publish it to the clients you want:

- **VS Code / JetBrains:** multiple provider groups can coexist. Switch using the client's model picker.
- **Copilot CLI:** this environment-variable method uses one route at a time. Check the current ownership first; conflicting configuration from another connection or an external source is not overwritten directly. If necessary, revoke the old connection's managed configuration as described below before publishing the new connection.
- **Copilot App:** add or switch providers manually inside the app.

This is not automatic failover or load balancing. Changing a preferred model also does not force other clients to switch the model they are currently using.

### Disable, stop managing, or revoke: which should you choose?

| Action | What changes in the manager | What changes in the client |
| --- | --- | --- |
| Turn off the connection's enable switch | Keeps the connection but prevents new publication | Published configuration remains; clients do not automatically return to official models |
| **Remove (移除) → Stop managing only (仅停止管理…) → Confirm (确认停止管理)** | Removes the connection, publication records, ownership proofs, and its dedicated credential | Configuration and any materialized keys remain; you are responsible for managing them afterward |
| **Remove (移除) → Preview revocation and deletion (预览撤销并删除) → Confirm (确认撤销并删除)** | Removes the connection after successful revocation | Removes only configuration verified as managed by this app, not other providers |

**To remove this configuration from clients, choose revocation and deletion rather than simply disabling the connection.** Review every target in the preview: revocation covers this connection's published managed configuration, not just one client.

If a target has been changed externally, revocation or rollback refuses to overwrite it, and the connection may remain so you can resolve the issue. Check **More (更多) → Activity (活动记录)** and the recovery status under **More → Settings (设置)** first. Do not delete configuration files or backups directly.

<a id="usage"></a>

## View usage and costs

Open **Usage (用量)** and choose a view:

| View | What it shows | Data requirements |
| --- | --- | --- |
| Official subscription / usage (官方订阅 / 用量) | Official runtime quota and personal monthly GitHub Billing | A readable runtime; personal Billing also requires separate authorization for this manager |
| Model statistics (模型统计) | Tokens, cache data, estimates, and coverage by model | Supported local records must be imported; filter by date, client, and route |
| Sessions / details (会话 / 详情) | Individual imported usage metadata records | No conversation text; additional conditions are under Advanced filters (高级筛选) |
| Data sources / prices (数据来源 / 价格) | Import sources and the price catalog | Enable sources explicitly; prices are fetched through a separate refresh action |

### Enable local usage imports

1. Open **Usage (用量) → Data sources / prices (数据来源 / 价格)**.
2. On the source card, click **Setup and privacy (配置与隐私)** and read the scope and setup requirements.
3. Click **Enable import (启用导入…)**, confirm, then click **Import enabled sources (导入已启用来源)**.
4. Return to **Model statistics** or **Sessions / details** to inspect the results.

The VS Code source also requires you to configure OTel file export manually according to the displayed instructions and restart VS Code. Only observations generated after enabling export are available. CLI / App shared-runtime records are counted once, not once for each client. Standalone JetBrains usage is not currently covered, and Copilot App has no separately reviewed usage source.

**Disable import (停用导入)** stops reading while keeping imported records. **Clear imported metadata (清除已导入元数据…)** removes that source's records from this manager and disables its import; it does not delete the original logs. To stop VS Code itself from exporting, also turn off OTel as instructed.

### View personal GitHub Billing

In **Official subscription / usage**, click **Manage authorization (管理授权)**, or go to **More → Settings → GitHub personal Billing authorization (GitHub 个人账单授权)**. Follow the instructions to authorize this manager, then return to Usage, select a month, and refresh Billing.

This authorization is separate from VS Code, CLI, or IDE sign-in. Being signed into a client does not grant the manager Billing access. Missing permissions, organization-paid coverage, or unavailable endpoints do not mean your cost is zero.

### Understand amounts and missing values

- **Official Billing** is personal Billing data returned by GitHub. It does not include third-party provider invoices or actual charges.
- **API-equivalent estimates** are reference values calculated from a price catalog, not actual bills or claims about money saved.
- Under **Data sources / prices**, click **Refresh official OpenRouter catalog (刷新官方 OpenRouter 目录)** to update prices. Historical estimates retain their original price snapshots.
- Missing tokens, prices, or attribution evidence remain unknown, partially covered, or unavailable rather than becoming 0. The current CLI source also lacks some input-token semantics, so a complete cost estimate is not guaranteed.

See [usage sources](docs/usage-sources.md) for detailed coverage.

## Manage MCP, Skills, and Instructions

Go to **More (更多) → Resources (资源)**:

1. Click **Add resource (添加资源)** and enter its name, type, and content.
2. Click **Save locally (保存到本地)**. This does not change clients yet.
3. On the resource card, choose **Preview publication (预览发布) → Generate preview (生成预览)**, review each target and its content, then **Confirm publication (确认发布)**.
4. When the resource is no longer needed, choose **Revoke and delete (撤销并删除…)**, review the preview, and confirm removal of the managed content.

Currently supported resources are credential-free HTTPS MCP URLs and Markdown-only Skills and Instructions. Manage MCP headers, keys, local commands, skill scripts, and supporting assets manually. Unsupported targets such as the app, named profiles, and custom paths are not reported as successfully published.

<a id="faq"></a>

## Frequently asked questions

### I saved a connection. Why has nothing changed in my client?

Saving only updates the manager. You must also click **Publish to clients**, generate a preview, and confirm it. Then select the model, restart the IDE, or open a new terminal as required by that client. The same process applies when updating an existing connection.

### Test connection succeeded. Why does chat still fail?

The test only checks the model catalog endpoint. Check the model ID, protocol, client capabilities, account access, and available provider quota, then verify a request in the actual client. A model appearing in the catalog does not prove support for tools, images, or a particular context length.

### Can I continue if fetching models does not work?

Yes. If the provider does not expose a compatible catalog endpoint, enter model IDs manually; use deployment names for Azure. If access is denied, a network error occurs, or the response format is unsupported, check the endpoint, key, and provider documentation. Failure to read the catalog does not by itself prove that inference is unavailable.

### I published the configuration but still cannot see the model. What should I check?

Start with the per-target results under **Overview → Latest publication**, then check:

1. Whether you published to the VS Code profile or JetBrains runtime directory you are actually using.
2. Whether the target was written successfully or still requires manual setup.
3. Whether the IDE needs reopening, or the CLI is running in a new terminal and session.
4. Whether the client and plugin version are supported; JetBrains requires the exact reviewed versions.
5. Whether you completed official sign-in and explicitly selected the model in the client.

**Client model sources (客户端模型来源)** only checks configuration published by this manager. It does not read the client's currently selected model.

### What if the CLI reports a configuration conflict, or I want to return to the official route?

The current adapter does not take over an existing `providers.json` registry. If that registry takes precedence over the environment route, publication is refused. Review the CLI's existing configuration yourself; do not simply delete credential-bearing files.

To remove this manager's override, use **Preview revocation and deletion** on the relevant connection. Review all affected published targets, confirm, then open a new terminal and CLI session. This only revokes configuration owned by the manager. Any independently configured routes remain, so check the effective route inside the CLI afterward.

### Why is my JetBrains version unsupported?

Automatic writes are enabled only for exact reviewed plugin distributions. Newer, unknown, disabled, or custom-path plugins may require manual handling. Report compatibility issues with the IDE and plugin versions; do not change version markers to bypass checks. Detecting an IDE configuration directory does not prove that the IDE can run or make a request.

### Why is publishing disabled, or why must I generate another preview?

Check whether the connection is enabled and whether a read-only recovery notice is displayed. A changed target, changed configuration, used preview, or preview older than 15 minutes requires a new review. If the app reports an interrupted operation, follow **Review safe recovery (核对安全恢复)** first. Details are under **More → Settings** and **Activity**.

### Why is usage empty, unknown, or only partially covered?

Check that the source is enabled and imported, the date filters are correct, and VS Code has generated supported export records. An active CLI session may not have written its importable shutdown statistics yet. Unsupported sources, missing fields, and inaccessible Billing retain their actual states. An empty view does not mean no usage or no charges.

### Where are keys and data stored? Can I share configuration files for troubleshooting?

Check **More → Settings** for the actual state-file and usage-database locations. The manager's API keys and separate GitHub authorization are stored in the operating-system credential store. Published client configuration and private rollback data may contain keys.

Do not share complete configuration files, databases, environment variables, rollback files, or raw session logs. Reports should contain versions, reproduction steps, and redacted errors and statuses only. See the [security policy](SECURITY.md) for complete guidance.

<a id="naming-and-compatibility"></a>

### Why do some places still say PilotWeave?

The project has been renamed to CopilotBYOKManager, but existing configuration directories, credential services, ownership markers, `dev.pilotweave.desktop`, `pilotweave` executable/package names, and `PILOTWEAVE_*` options retain their compatibility identifiers. Window titles or locally built artifacts may also use the former name. **Do not rename these data directories or credential identifiers manually.**

Existing clones can update their remote URL without rebuilding user configuration:

```bash
git remote set-url origin https://github.com/AvaloNero/CopilotBYOKManager.git
```

## Privacy and current limits

- No copying client OAuth tokens, browser cookies, VS Code SecretStorage, or JetBrains Password Safe.
- Usage imports persist only allowlisted metadata. They do not retain or upload prompts, responses, source code, tool content, or raw log lines.
- Publication displays changes before writing and retains recovery information for managed writes. Rollback does not force an overwrite after an external change.
- Organization/enterprise Billing, provider invoice retrieval, cloud usage synchronization, overage settings, and full macOS/Linux one-click installation are not provided.
- Automated and isolated tests do not replace real-client acceptance. See [implementation status](docs/implementation-status.md) for implemented capabilities, coverage gaps, and validation records.

## Help and contributing

Report usage problems through [GitHub Issues](https://github.com/AvaloNero/CopilotBYOKManager/issues). Include your operating system, application commit, relevant client and plugin versions, reproduction steps, expected and actual behavior, and redacted status information. Report security issues privately as described in [SECURITY.md](SECURITY.md).

Further reading: [Documentation index](docs/README.md) · [Model catalog compatibility](docs/provider-model-discovery.md) · [JetBrains support](docs/jetbrains-support.md) · [Usage sources](docs/usage-sources.md).

<details>
<summary>Development, builds, and checks</summary>

The desktop app uses Tauri, Rust, and a lightweight web frontend. Before implementing changes, read [AGENTS.md](AGENTS.md), the [MVP specification](docs/mvp-implementation-spec.md), and the [architecture](docs/architecture.md).

Run from the repository root:

```bash
npm run check:web
cargo fmt --all -- --check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
git diff --check
```

`npm run check` includes the web and Rust checks; run the whitespace check separately. CI checks Ubuntu, Windows, and macOS, and builds the native app on Windows.

The optional browser regression entry point is `node apps/desktop/web/tests/browser-smoke.cjs`. If needed, set `PILOTWEAVE_PLAYWRIGHT` to an installed Playwright module path and `PILOTWEAVE_BROWSER` to the browser executable. These tests use isolated profiles, simulated data, and temporary screenshots. They are not real-client acceptance.

Source locations:

- [Native backend and adapters](apps/desktop/src-tauri/)
- [Desktop frontend](apps/desktop/web/)
- [Interactive design reference](prototype/)
- [Validation and packaging scripts](scripts/)

See the [local validation plan](docs/local-validation-plan.md) and [validation records](docs/implementation-status.md#validation-evidence) for test and acceptance boundaries.

</details>

## License

[MIT](LICENSE).

This is an independent community project, not affiliated with, sponsored by, or endorsed by GitHub or JetBrains. GitHub, GitHub Copilot, and JetBrains product names belong to their respective owners.
