# CopilotBYOKManager user guide

**English** | [简体中文](user-guide.zh-CN.md)

[Project overview](../README.md) · [Release and package guide](release-engineering.md)

**Configure one provider. Publish it safely across your Copilot clients.**

Save your AI provider's endpoint, API key, and models in one place, then review publication to **VS Code, Copilot CLI, and reviewed JetBrains plugin versions**. Copilot App is covered through guided manual setup.

You do not need to maintain a separate provider configuration for every client. When you change an endpoint or key, or add or remove models, edit the connection, preview the changes, and publish them to the clients you want to update.

[Get started](#getting-started) · [Supported clients](#supported-clients) · [First connection](#first-connection) · [Everyday use](#everyday-use) · [Planned features](#usage) · [FAQ](#faq)

Download desktop packages from [Releases](https://github.com/Arcueid77/CopilotBYOKManager/releases). See the selected version's installation instructions and checksums.

The interface supports **English and Simplified Chinese**. It follows your system language on first launch; choose **Interface language** at the top to switch and save your preference. Other system languages fall back to English. Finish or close an open form or deployment preview before switching. Connection names, model IDs, endpoints and original diagnostic messages are not translated.

## Current pages

| Page | What to do here |
| --- | --- |
| Overview | Check configuration status, next actions and the latest publication result |
| Providers | Manage endpoint, key and models; preview publication or revoke owned configuration |
| Apps | Choose a provider per app; review detection, installation, official sign-in and publication history |
| About | Window behavior, help, offline planned-feature record and local storage/recovery information |

Use **Appearance** at the top to choose **System, Light or Dark**. The preference is saved independently of language. Switching appearance keeps open drafts and reviewed previews intact.

On Windows, closing the window hides it to the tray by default. In **About → When closing the window**, choose **Hide to system tray** or **Exit the app**; the choice is saved. Left-click the tray icon or choose **Open main window** to restore it; right-click **Exit CopilotBYOKManager** to quit. Ordinary minimize stays on the taskbar. Opening the app again restores the existing window instead of starting another instance. The tray menu follows the interface language.

If the tray cannot be created, hiding fails, or window preferences cannot be read, closing exits normally. Damaged preferences are retained instead of overwritten. See About for the observed behavior. Browser preview has no system tray.

## What you can do

- **Manage providers centrally:** save multiple providers, fetch or manually enter models, and choose a recommended model.
- **Apply configuration to multiple clients:** select targets, review changes, confirm publication, and check each target's result and next steps.
- **Set up clients:** check installation status, install supported Windows components through reviewed plans, and complete official sign-in and account checks for each client.
- **Keep the core workflow focused:** Overview, Providers, Apps and About. Usage, Billing and resource entry points are temporarily hidden; existing data is retained.

A **provider entry** is a reusable endpoint/key/model configuration. **Publishing** writes it to the selected clients. Save a provider, publish it to the selected apps, then select the model in each app.

<a id="supported-clients"></a>

## Supported clients

| Client | Provider configuration | Before you use it |
| --- | --- | --- |
| VS Code Stable / Insiders and detected profiles | Automatically adds or updates this connection's provider group while preserving other providers | After publishing, select the model in Copilot's model picker in the corresponding profile |
| GitHub Copilot CLI | Publishes multiple providers and models to `providers.json` | Unchecked by default; confirm publication, start a new session and choose with `/model` |
| GitHub Copilot plugin in JetBrains IDEs | Automatically writes shared BYOK configuration for reviewed plugin versions | Close the relevant IDEs first; reopen them after publishing, sign in, and select a model |
| GitHub Copilot App | Provides setup instructions; does not automatically write provider configuration | Add the provider and verify it manually in the app |

The JetBrains adapter is limited to the [1.19 plugin distributions in the version table](jetbrains-support.md#version-and-compatibility-boundary). IDEs using the same runtime directory share the configuration, including IDEs you did not select.

Accepted protocols, endpoints, and model capabilities can differ between clients; review the publication preview. This app manages configuration. It does not provide model hosting, subscriptions, or free credits, and it does not replace a client's own access requirements.

<a id="getting-started"></a>

## Get started

### Install the desktop app

Choose your version on [Releases](https://github.com/Arcueid77/CopilotBYOKManager/releases): run the Windows x64 Setup, or extract the standalone ZIP and run `copilot-byok-manager.exe`. On macOS 15+, open the Universal DMG and drag the app into Applications. Windows Setup downloads WebView2 when needed. The standalone app uses the same user data locations as Setup.

### Try the interface without changing your configuration

1. On this repository's GitHub page, select **Code → Download ZIP** and extract the source.
2. Open the local [apps/desktop/web/index.html](../apps/desktop/web/index.html) file in your browser.
3. Try adding a connection, selecting clients, and reviewing a publication preview.

The page displays **Browser preview (浏览器试用)**. This mode uses simulated data: it does not write to real clients, run installers, sign you in, or send requests to providers. Use sample data, not real API keys. Usage, Billing and resource management are not offered in this core edition.

The [interactive design prototype](../prototype/copilot-byok-manager.html) is retained separately as a design reference. Use the frontend entry point above to try the current interface.

### Run the desktop app to configure real clients

Prepare Git, Node.js 22+, Rust 1.88+, and the [Tauri 2 system dependencies](https://v2.tauri.app/start/prerequisites/). Windows also requires the MSVC C++ build tools and WebView2. For macOS/Linux, follow the official dependency instructions.

Run in a terminal:

```bash
git clone https://github.com/Arcueid77/CopilotBYOKManager.git
cd CopilotBYOKManager
npm ci
npm run dev
```

The active development branch is `main`. The first launch downloads dependencies and compiles the app; a successful launch opens the CopilotBYOKManager desktop window.

To build the desktop executable without an installer, run `npm run build -- --no-bundle -- --locked`. For Windows NSIS / standalone ZIP and Mac test-DMG commands, see [release engineering](release-engineering.md). The standalone package runs without installation; state, OS credentials and target configuration use user storage.

<a id="first-connection"></a>

## First setup: one provider, multiple Copilot clients

### 1. Check the clients you want to use

Open **Apps (应用)** to view detected apps and profiles. Each Overview row's **View app (查看应用)** opens the matching app. You only need the clients you intend to use; missing, unsupported or unavailable detection does not create an Overview task. Under **Installation and updates**, use **Detect again (重新检测)** to refresh status. Components with unavailable detection retain their reason and offer the same read-only action.

- If an installed component's status is outdated, open **Installation and updates (安装与更新)** and click **Detect again (重新检测)**.
- For a missing supported Windows component, click its **Install (安装)** button, review the plan, and confirm. Install clients without an automatic installation path yourself.

The installation window shows each component separately, including its stage, approximate downloaded amount, percentage when available, and elapsed time. Unknown download sizes use an indeterminate bar. **Cancel installation** stops the remaining work and keeps completed components visible. A newly installed Copilot CLI is detected without restarting the manager; **Detect again** also checks the current Windows search paths.
- Expand **Sign-in and account checks (optional) / 登录与账号检查（可选）** and follow the official sign-in steps in each client. The manager never copies one client's sign-in credentials to another.

Use **Record checked account (记录已核对的账号)** only after checking the clients yourself. This does not sign in or switch their accounts. Provider publication does not require account alignment. Manual confirmation and software-verified identity are shown separately. **Provider setup does not require granting this manager access to personal Billing.** Billing authorization is separate and is not offered in this core edition.

### 2. Add a provider

Go to **Providers (供应商) → Add provider (添加供应商)** and fill in:

| Field | What to enter |
| --- | --- |
| Name (名称) | A recognizable name, such as “Work provider” |
| Endpoint URL (端点地址) | The API base URL supplied by your provider, not its website or dashboard URL |
| API key (API 密钥) | That provider's key. Leave it blank only if the endpoint permits anonymous access and the target client supports it |
| Models (模型) | Fetch models with the corresponding button, or enter upstream model IDs manually |

`https://api.example.com/v1` is only an example of the URL format, not a working endpoint. Remote endpoints require HTTPS; local loopback endpoints may use HTTP.

Check **Current protocol (当前协议)** before fetching models. Use **Change protocol (更改协议)** to open **Advanced options: provider type, protocol, and headers (高级选项：供应商类型、接口协议与请求头)** if the default OpenAI-compatible Chat Completions interface is not appropriate:

- Select **Chat Completions, Responses, or Messages** according to the provider's documentation.
- Changing the provider type does not automatically change the URL or protocol; check them separately.
- Add headers only when needed, one `Name: Value` per line. Reference the key with `${apiKey}`; do not put a real key directly in the header text.

The manager stores API keys in the operating-system credential store and does not display saved keys in the form. During publication, some client formats require the key to be written into their configuration. Do not share those files publicly.

### 3. Add models and save

Start with **Fetch models (获取模型)**. Filter by name or ID and check the models you want: they immediately join the same editable draft. **Save provider (保存供应商)** saves checked and manually entered models together; there is no separate Add selected step. Nothing is selected automatically, and existing manual names and disabled-model settings are preserved. Unchecking removes an unchanged catalog-added draft line. Changing endpoint or credential settings clears uncommitted catalog selections, not existing or manually edited models.

If the provider has no model catalog endpoint, enter one model per line in **Models (模型)**:

```text
your-model-id | Work model
another-model-id | Backup model
```

Replace these example IDs with the actual IDs supplied by your provider. The display name after the vertical bar is optional. For Azure connections, manually enter the actual deployment name, not the underlying model name.

Choose a **Recommended model (推荐模型)**, then click **Save provider (保存供应商)**:

- Choose the actual model in each client after publishing.
- Clients with model pickers, such as VS Code and JetBrains, require you to select the model inside the client.

Fetch models and **Test model catalog (测试模型目录)** query the provider's model list. After saving, publish the provider to your apps.

### 4. Publish configuration

Apps shows the current provider names and model counts separately from **Provider to publish (本次发布)**. That selector chooses what to add or update; it does not select the client's active provider. Empty, unreadable and unsupported configurations have distinct labels. Results identify both the provider and target app.

1. On the connection card, click **Publish to apps (发布到应用)**.
2. Review each target and uncheck any clients or profiles you do not want to update. **Copilot CLI is unchecked by default**; select it explicitly to publish its providers and models.
3. If JetBrains is included, close the relevant IDEs using that shared configuration first.
4. Click **Publish configuration (发布配置)**. Ordinary publication checks and applies the selected targets, then shows the result. Use **View changes (查看变更)** first to review details. Targets marked **Manual action required (需手动处理)** remain manual.
5. Publishing to CLI or removing a provider group stops at a preview. Check it, then click **Confirm publication (确认发布)**.

Every publication uses a native plan valid for 15 minutes and usable once. Changed or expired plans are refused. Check any error and retry to obtain a fresh plan; CLI publication and group removal require confirmation again.

Afterward, check each target's result under **Overview (总览) → Latest publication (最近一次发布)** or **Providers (供应商) → Recent configuration operations (最近配置操作)**. Restart instructions, manual steps, and model-selection guidance remain visible after the notification disappears.

Overview offers **Add your first provider** for an empty catalog and **Publish to apps** in the header once a provider is available. **View app** focuses the selected app card. Supported configured apps sort first, followed by supported unconfigured apps. JetBrains cards show plugin support individually. Copilot Chat is the VS Code default profile; a built-in Agents profile sharing its catalog uses the same card. Changing the publication selection invalidates an idle preview; language changes preserve the selection. During publication, navigation, refresh and dismissal are blocked. On failure, check publication/recovery and generate a fresh preview.

### 5. Select and verify the model in each client

**VS Code**

Open the profile you selected when publishing, then choose the published model in Copilot's model picker. Multiple providers can remain in separate groups; the client determines which model is actually used.

**Copilot CLI**

The provider and every enabled model are written to `~/.copilot/providers.json` (`%USERPROFILE%\.copilot\providers.json` on Windows). Publish providers one at a time to keep them together, then start a new CLI session and choose with `/model`. The same model ID can belong to different providers. Updating one provider preserves the others and the saved default model. Without GitHub sign-in, start with `copilot --model <provider-id>/<model-id>`; the IDs appear in the publication preview details. Chat Completions, Responses and Messages are supported; local interfaces such as Ollama can omit a key.

Custom `COPILOT_HOME` or `COPILOT_PROVIDERS_CONFIG` paths are not automatically published yet. Republishing a provider also clears that same Connection's manager-owned legacy environment route; open a new terminal after this upgrade. Other legacy environment configuration is preserved. See [the CLI contract](copilot-cli-support.md).

**JetBrains**

Reopen the relevant IDE, complete official GitHub Copilot sign-in, and select the published model in Copilot Chat's model picker. Sign in and select a model in each IDE. Unknown plugin versions are not written automatically. See [JetBrains usage and compatibility](jetbrains-support.md) for further limits.

**Copilot App**

The steps below describe the current release. [Experimental SQLite sync](copilot-app-sqlite-sync.md) is approved but not implemented: it will be off by default and require manual enablement plus a risk confirmation before automatic synchronization. Do not look for an enable switch in v0.1.0.

On its Apps card, choose **Provider to configure manually (本次手动配置)**, then **Manual setup (手动配置)**. Confirmations are saved separately for each provider and displayed as **Confirmed by you (你已确认)**. Editing a provider changes its record to **Confirm updated configuration (修改后待确认)**. Reopen the guide after updating the App and confirm again.

In the App's **Model providers**, add the provider using the displayed endpoint and model, and enter its key inside the App. Then click **I have completed manual setup (我已完成手动配置)** in the manager's guide.

If App was included in a publication, use its result's **Manual setup for [connection]** button to open instructions for that specific connection, even when another connection is selected elsewhere.

Finally, send a short request containing no sensitive project content from the client you intend to use, and confirm that the model responds. Real requests may incur provider charges.

<a id="everyday-use"></a>

## Everyday use

### Change an endpoint, key, or model list

Find the provider under **Providers (供应商)** and click **Edit (编辑)**:

1. Update the relevant fields. Leave an existing key blank to keep it, enter a new key to replace it, or check **Remove saved key (移除已保存的密钥)** to remove it.
2. Click **Save provider (保存供应商)**.
3. Use **Publish to apps → Publish configuration** again to update the intended targets; confirm CLI publication or group removal when prompted.
4. Reopen clients or create new sessions as instructed by the publication results.

Editing a connection does not automatically synchronize it to all clients in the background. If fetching models asks for credentials after you change the endpoint, protocol, or headers, enter the key for the current endpoint again. Catalog discovery will not silently send the stored key to a changed destination.

### Add or switch providers

Add another connection under **Providers (供应商)**, then publish it to the clients you want:

- **VS Code / JetBrains:** multiple provider groups can coexist. Switch using the client's model picker.
- **Copilot CLI:** multiple providers and models coexist in `providers.json`. Select a provider, review and confirm to update only its group; manual configuration and other providers are preserved. Start a new CLI session and choose a model afterward. If configuration changes after preview, generate a fresh preview and confirm again.
- **Copilot App:** add or switch providers manually inside the app.

Select the active model in each client's model picker.

### Disable, stop managing, or revoke: which should you choose?

| Action | What changes in the manager | What changes in the client |
| --- | --- | --- |
| Turn off the provider's Allow publishing switch | Keeps the provider and pauses new publication | Published configuration remains |
| **Remove (移除) → Stop managing only (仅停止管理…) → Confirm (确认停止管理)** | Removes the connection, publication records, ownership proofs, and its dedicated credential | Configuration and any materialized keys remain; you are responsible for managing them afterward |
| **Remove (移除) → Preview revocation and deletion (预览撤销并删除) → Confirm (确认撤销并删除)** | Removes the connection after successful revocation | Removes only configuration verified as managed by this app, not other providers |

**To remove this configuration from clients, choose revocation and deletion rather than simply disabling the connection.** Review every target in the preview: revocation covers this connection's published managed configuration, not just one client.

Overview and Apps read the current configuration on refresh: manual edits appear immediately, deleted providers disappear, and read errors remain distinct from an empty catalog. Publishing or revoking an owned provider uses its current content. Changes after the plan is created stop the write; changes after a write stop rollback. Ownership conflicts still require review. Check **Apps (应用) → Publication and revocation history (发布与撤销记录)** and the recovery status under **About → Local storage and security (本地存储与安全)** first. Do not delete configuration files or backups directly.

<a id="usage"></a>

## Planned features not offered in this edition

Official quota, personal Billing and its separate authorization, local model/session usage, estimates, and MCP/Skills/Instructions are temporarily hidden. Existing implementation and data are retained, but the four-page interface does not load these modules or run their actions.

See the [feature availability record](feature-availability.md) for implemented-but-hidden capabilities, genuinely unimplemented work and acceptance gaps. A short offline record is also available from **About → Planned feature status**. There are no promised dates.

<a id="faq"></a>

## Frequently asked questions

### I saved a connection. Why has nothing changed in my client?

Saving only updates the manager. You must also click **Publish to apps**, generate a preview, and confirm it. Then select the model, restart the IDE, or open a new terminal as required by that client. The same process applies when updating an existing connection.

### Test connection succeeded. Why does chat still fail?

The test only checks the model catalog endpoint. Check the model ID, protocol, client capabilities, account access, and available provider quota, then verify a request in the actual client.

### Can I continue if fetching models does not work?

Yes. If the provider does not expose a compatible catalog endpoint, enter model IDs manually; use deployment names for Azure. If access is denied, a network error occurs, or the response format is unsupported, check the endpoint, key, and provider documentation.

### I published the configuration but still cannot see the model. What should I check?

Start with the per-target results under **Overview → Latest publication**, then check:

1. Whether you published to the VS Code profile or JetBrains runtime directory you are actually using.
2. Whether the target was written successfully or still requires manual setup.
3. Whether the IDE needs reopening, or the CLI is running in a new terminal and session.
4. Whether the client and plugin version are supported; JetBrains requires the exact reviewed versions.
5. Whether you completed official sign-in and explicitly selected the model in the client.

**App configuration status (应用配置状态)** only checks configuration published by this manager.

### What if the CLI reports a configuration conflict, or I want to return to the official route?

Check that `providers.json` contains valid provider/model arrays and that no custom configuration path is set. Unsupported schemas, unreadable files or edits after preview stop publication. Resolve the reported issue and generate a fresh preview.

Use **Preview revocation and deletion** on the relevant provider, review the targets and confirm. Only its managed group is removed; other providers remain. Start a new session and select a remaining model or a GitHub-hosted model. If the registry is empty, preserved independent environment routes may become active again, so check those too.

### Why is my JetBrains version unsupported?

Automatic writes are enabled only for exact reviewed plugin distributions. Newer, unknown, disabled, or custom-path plugins may require manual handling. Report compatibility issues with the IDE and plugin versions; do not change version markers to bypass checks.

### Why is publishing disabled, or why must I generate another preview?

Check whether the provider is enabled and whether a read-only recovery notice is displayed. A changed target, changed configuration, used preview, or preview older than 15 minutes requires a new review. For interrupted operations, use **Review safe recovery (核对安全恢复)**. Details remain in **About → Local storage and security** and **Apps → Publication and revocation history**.

### Why are Usage and Resources missing?

This core edition focuses on provider configuration and publication. Those entries are temporarily hidden; existing records are not deleted. See [planned features](feature-availability.md).

### Where are keys and data stored? Can I share configuration files for troubleshooting?

Check **About → Local storage and security** for the actual state-file location. The manager's API keys and separate GitHub authorization are stored in the operating-system credential store. Published client configuration and private rollback data may contain keys.

Do not share complete configuration files, databases, environment variables, rollback files, or raw session logs. Reports should contain versions, reproduction steps, and redacted errors and statuses only. See the [security policy](../SECURITY.md) for complete guidance.

## Privacy and current limits

- No copying client OAuth tokens, browser cookies, VS Code SecretStorage, or JetBrains Password Safe.
- Usage imports persist only allowlisted metadata. They do not retain or upload prompts, responses, source code, tool content, or raw log lines.
- Publication displays changes before writing and retains recovery information for managed writes. Rollback does not force an overwrite after an external change.
- Organization/enterprise Billing, provider invoice retrieval, cloud usage synchronization, overage settings, and full macOS/Linux one-click installation are not provided.
- See [implementation status](implementation-status.md) for implemented capabilities and validation progress.

## Help and contributing

Report usage problems through [GitHub Issues](https://github.com/Arcueid77/CopilotBYOKManager/issues). Include your operating system, application commit, relevant client and plugin versions, reproduction steps, expected and actual behavior, and redacted status information. Report security issues privately as described in [SECURITY.md](../SECURITY.md).

Further reading: [Documentation index](README.md) · [Model catalog compatibility](provider-model-discovery.md) · [JetBrains support](jetbrains-support.md) · [Usage sources](usage-sources.md) · [Release engineering](release-engineering.md) · [Release criteria (中文)](release-criteria.md) · [Launch plan (中文)](promotion-plan.md).

<details>
<summary>Development, builds, and checks</summary>

The desktop app uses Tauri, Rust, and a lightweight web frontend. Before implementing changes, read [AGENTS.md](../AGENTS.md), the [MVP specification](mvp-implementation-spec.md), and the [architecture](architecture.md).

Run from the repository root:

```bash
npm run check:web
npm run check:version
npm run test:release
npm run check:docs
cargo fmt --all -- --check
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
git diff --check
```

`npm run check` includes version, release-policy, documentation-link, web and locked Rust checks; run the whitespace check separately. Normal CI checks Ubuntu, Windows and macOS; the separate release workflow builds Windows NSIS and Mac Universal DMG at the same fixed SHA.

The optional browser regression entry point is `node apps/desktop/web/tests/browser-smoke.cjs`. If needed, set `COPILOT_BYOK_MANAGER_PLAYWRIGHT` to an installed Playwright module path and `COPILOT_BYOK_MANAGER_BROWSER` to the browser executable. These tests use isolated profiles, simulated data, and temporary screenshots.

Source locations:

- [Native backend and adapters](../apps/desktop/src-tauri/)
- [Desktop frontend](../apps/desktop/web/)
- [Interactive design reference](../prototype/)
- [Validation and packaging scripts](../scripts/)

See the [local validation plan](local-validation-plan.md) and [validation records](implementation-status.md#validation-evidence) for test and acceptance boundaries.

</details>

## License

[MIT](../LICENSE).

This is an independent community project, not affiliated with, sponsored by, or endorsed by GitHub or JetBrains. GitHub, GitHub Copilot, and JetBrains product names belong to their respective owners.
