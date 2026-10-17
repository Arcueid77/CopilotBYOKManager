<p align="center">
  <img src="apps/desktop/src-tauri/icons/icon.png" width="80" alt="CopilotBYOKManager logo">
</p>

<h1 align="center">CopilotBYOKManager</h1>

<p align="center"><strong>Configure one provider. Publish it safely across your Copilot clients.</strong></p>

<p align="center">Manage your endpoint, API key and models once, then publish to VS Code, Copilot CLI and supported JetBrains plugins.</p>

<p align="center">
  <a href="https://github.com/Arcueid77/CopilotBYOKManager/actions/workflows/ci.yml"><img src="https://github.com/Arcueid77/CopilotBYOKManager/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/status-v0.1%20candidate-purple" alt="v0.1 candidate">
  <img src="https://img.shields.io/badge/interface-English%20%7C%20简体中文-blue" alt="English and Simplified Chinese">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#download">Download status</a> · <a href="#quick-start">Quick Start</a> · <a href="#supported-clients">Supported Clients</a> · <a href="#security">Security</a> · <a href="docs/README.md">Documentation</a> · <a href="https://github.com/Arcueid77/CopilotBYOKManager/issues">Issues</a> · <a href="README.zh-CN.md">简体中文</a>
</p>

> **v0.1** — [Download Windows and macOS packages](https://github.com/Arcueid77/CopilotBYOKManager/releases).

![Overview — current browser preview with simulated data](docs/images/overview-en.png)

*Current four-page interface, simulated browser preview. No real accounts, keys or client writes. [Capture details](docs/images/README.md).*

## Why CopilotBYOKManager

- **One place for providers.** Maintain endpoint, key and models together, then choose where to publish them.
- **Publish across clients.** Choose apps and publish in one step, with optional change details.
- **Respect existing configuration.** Keep unrelated providers intact and recheck current configuration before each write.

## How it works

**Add a provider → Choose apps and publish → Select the model in each client.**

Sign in to each client, then select the published model and start using it.

<a id="supported-clients"></a>

## Supported clients

Configure providers in these clients:

| Client | Mode | Current boundary and next step |
| --- | --- | --- |
| VS Code Stable / Insiders / profiles | Automatic | Owned provider groups. Select the model in the correct profile, then test. [Detection details](docs/vscode-detection.md) |
| GitHub Copilot CLI | Automatic | Replaces the current environment route after confirmation. Open a new terminal/session. [Client guide](docs/user-guide.md#5-select-and-verify-the-model-in-each-client) |
| Reviewed JetBrains GitHub Copilot distributions | Automatic, version-pinned | Close/reopen IDEs, sign in separately, select and test. [Exact reviewed versions](docs/jetbrains-support.md#version-and-compatibility-boundary) |
| GitHub Copilot App | Manual | No automatic provider writes or verification. Configure and verify inside the App. [Guide](docs/user-guide.md#5-select-and-verify-the-model-in-each-client) |

JetBrains supports the exact plugin distributions listed above; IDEs sharing a runtime directory may see the same configuration. Client policies, subscriptions and provider access requirements still apply.

<a id="download"></a>

## Download and install

Choose a package from [Releases](https://github.com/Arcueid77/CopilotBYOKManager/releases):

| Platform | Package | Installation |
| --- | --- | --- |
| Windows 11 x64 | `CopilotBYOKManager-vX.Y.Z-windows-x64-setup.exe` | Run Setup; installs for the current user |
| Windows 11 x64 | `CopilotBYOKManager-vX.Y.Z-windows-x64-standalone.zip` | Extract and run; WebView2 required |
| macOS 15+, Intel / Apple Silicon | `CopilotBYOKManager-vX.Y.Z-macos-universal.dmg` | Drag the app to Applications |

Windows Setup downloads WebView2 when needed.

Check `SHA256SUMS.txt` and the source SHA before installing. The standalone package runs without installation; state, OS credentials and client configuration use user storage. [Package guide](docs/release-engineering.md).

To explore now, open [the current browser frontend](apps/desktop/web/index.html) from a local source checkout. It uses sample data and performs no native writes. Use fictitious values, not real keys.

<a id="quick-start"></a>
<a id="getting-started"></a>
<a id="first-connection"></a>

## Quick start

1. In **Providers**, add the provider endpoint and API key.
2. Fetch models or enter model IDs manually; save the provider.
3. Select your apps/profiles. CLI requires explicit selection.
4. Click **Publish configuration** and read each target's result. **View changes** is optional; CLI replacement and removing a provider group require confirmation.
5. Select the model in the client and send a minimal, non-sensitive test request.

Requests may incur charges. See the [English user guide](docs/user-guide.md) or [中文手册](docs/user-guide.zh-CN.md) for fields, client steps, updates, revocation and recovery.

## Core features

| Feature | What it gives you |
| --- | --- |
| Central provider profiles | Endpoint, protocol, key reference, catalog and preferred model |
| Multi-client publication | Explicit targets and persistent per-target results |
| Review before write | Native-held, expiring, one-use plans and live target checks |
| Ownership-aware revoke | Remove owned configuration, preserve other providers |
| Crash-safe recovery | Private write-ahead records, conditional rollback and explicit recovery |
| Local credentials and bilingual UI | OS-held master keys; English / 简体中文; Light / Dark / System |

**Overview · Providers · Apps · About.** [Window and appearance behavior](docs/user-guide.md#current-pages) includes the Windows tray preference.

<a id="security"></a>

## Safety and privacy

- Never copies client OAuth tokens, cookies, SecretStorage or Password Safe.
- Stores provider master keys in the OS credential store.
- Some client formats require provider keys in on-disk configuration.
- Previews natively and rechecks targets before writing.
- Refuses changes made after plan creation and conflicts during rollback.
- Recovery data may contain sensitive configuration: do not upload it.
- No default telemetry or conversation upload.

Read [SECURITY.md](SECURITY.md) before sharing diagnostics. Use the [security page](https://github.com/Arcueid77/CopilotBYOKManager/security) for vulnerabilities, privately when that channel is enabled.

<a id="usage"></a>

## Known limits

- CLI uses one managed environment route, not simultaneous provider routing.
- Copilot App is manual; JetBrains is limited to exact reviewed distributions.
- Usage, Billing and Resources/MCP/Skills/Instructions are outside this edition. Existing data remains intact. [Feature availability](docs/feature-availability.md).

## Screenshots

All images show the current browser frontend with **simulated data**. Overview appears above.

| Provider editor · Light | Publication preview · Dark |
| --- | --- |
| ![Example endpoint and empty API key](docs/images/provider-en.png) | ![Simulated publication review; no native writes](docs/images/publication-en.png) |

## Sponsors

No sponsors or payment links are currently listed. Sponsorship will not determine compatibility results or make a provider the default.

<a id="everyday-use"></a>
<a id="faq"></a>

## Documentation and support

[User guide](docs/user-guide.md) · [中文手册](docs/user-guide.zh-CN.md) · [Documentation index](docs/README.md) · [Model catalogs](docs/provider-model-discovery.md) · [Implementation evidence](docs/implementation-status.md) · [Release engineering](docs/release-engineering.md)

Use [Issues](https://github.com/Arcueid77/CopilotBYOKManager/issues) with versions, steps and redacted statuses. The [release criteria](docs/release-criteria.md), [local validation plan](docs/local-validation-plan.md) and [promotion plan](docs/promotion-plan.md) are in Chinese; the [release guide](docs/release-engineering.md) covers maintainer steps in English.

<details>
<summary>Development / Build from source</summary>

CI uses Node 22, Rust 1.88.0 and [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/). Windows needs MSVC/WebView2; macOS needs Xcode command-line tools. Read [AGENTS.md](AGENTS.md), [the specification](docs/mvp-implementation-spec.md) and [architecture](docs/architecture.md).

```bash
git clone https://github.com/Arcueid77/CopilotBYOKManager.git
cd CopilotBYOKManager
npm ci
npm run dev
npm run check
git diff --check
```

`main` is the development branch. `npm run build -- --no-bundle -- --locked` builds only the app. NSIS / Universal DMG and dry-run instructions: [release engineering](docs/release-engineering.md).

</details>

## License and disclaimer

[MIT](LICENSE). Independent community project; not affiliated with, sponsored by or endorsed by GitHub or JetBrains. Their names and marks belong to their respective owners. The manager does not host models, supply subscriptions or provide free credits.
