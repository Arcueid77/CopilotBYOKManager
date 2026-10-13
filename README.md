# CopilotBYOKManager

**Configure your AI provider once. Use it across Copilot clients.**

Save your provider's endpoint, API key, and model catalog in one place, then publish the same configuration to GitHub Copilot in **VS Code, Copilot CLI, and supported JetBrains IDEs**. **Copilot app** is covered through guided provider setup.

When your endpoint or model list changes, update the saved connection, select the clients that should receive it, and preview and confirm the changes. CopilotBYOKManager handles each supported client's configuration format and keeps the publication results together.

Client setup, account checks, and usage views support this configure-once workflow. The desktop app is built with Tauri, Rust, and a lightweight web interface.

[Documentation](docs/README.md) · [Current implementation and validation](docs/implementation-status.md) · [Security policy](SECURITY.md)

> **Pre-release:** native functionality and isolated regression coverage are implemented. Clean Windows installation, real-account access, and actual client requests still require acceptance testing. Publishing configuration does not prove that a client selected or successfully used a model.

CopilotBYOKManager was formerly named PilotWeave. The repository and public documentation now use the new name; existing storage, credential references, build identifiers, and executable names retain their compatibility identifiers. See [Naming and compatibility](#naming-and-compatibility).

This is an independent community project, not affiliated with, sponsored by, or endorsed by GitHub or JetBrains. GitHub, GitHub Copilot, and JetBrains product names belong to their respective owners.

## Supported clients

One saved provider connection can be published to multiple client targets. Each client's publication method and follow-up steps are listed below:

| Client | BYOK publication | After publication |
| --- | --- | --- |
| VS Code Stable / Insiders and detected profiles | Automatically adds or updates the owned supplier group in `chatLanguageModels.json`; preserves other suppliers | Select the model in the client's model picker |
| GitHub Copilot CLI | Automatically projects one owned legacy user-environment route and `COPILOT_MODEL`; the CLI target is unchecked by default | Open a new terminal and CLI session; this route is exclusive |
| JetBrains GitHub Copilot | Automatically writes the shared `github-copilot/byok.json` namespace for [reviewed 1.19 plugin distributions](docs/jetbrains-support.md); deduplicates shared writes | Restart the relevant IDE, complete its official sign-in, then select and test the model |
| GitHub Copilot app | Detection and manual provider setup; no reviewed automatic provider-write interface | Follow the in-app instructions and verify the model manually |

JetBrains profiles are optional and are not required for the original three-surface setup. Unknown plugin versions stay unsupported until reviewed. The CLI limitation describes this adapter's environment projection, not every interface offered by the current CLI. It does not write `providers.json` and refuses a registry that shadows the environment.

## What you can do

- **Configure a provider once:** keep its endpoint, key, protocol, header templates and model catalog in one reusable connection. Fetch models, add the ones you want, and choose a preferred model.
- **Apply it across Copilot clients:** select VS Code profiles, Copilot CLI, and reviewed JetBrains targets from the same connection; preview and confirm publication to the selected clients. Update the connection centrally and republish when needed. Copilot app uses guided manual setup.
- **Keep provider keys local:** keys use the operating-system credential store and are never read back into the form. Saved header templates reference the key at deployment time.
- **Preview and publish:** native-held, expiring, one-shot plans enforce live fingerprints, ownership, prepare-all writes, private journals and conditional rollback. Detaching a connection and revoking its owned configuration are separate operations.
- **Set up clients and accounts:** inspect components, review pinned Windows installation plans, use official client sign-in actions, and distinguish verified identity from manual confirmation or unavailable evidence. VS Code sign-in focuses an existing editor window; if none exists, it gives manual instructions.
- **Inspect usage:** keep official runtime quota, personal GitHub Billing, local token observations, and API-equivalent estimates separate. Opt-in CLI/shared-runtime and VS Code OTel imports persist metadata only. Prices and monetary calculations use exact decimals.
- **Manage shared resources:** author and publish MCP, Markdown-only Skills, and Instructions through reviewed public paths with ownership and rollback. Unsupported profiles, paths and secret-bearing resources remain manual.

The [implementation status](docs/implementation-status.md) lists current coverage and remaining acceptance work. Adapter versions and source limitations are recorded in [usage sources](docs/usage-sources.md), [model discovery](docs/provider-model-discovery.md), and [JetBrains support](docs/jetbrains-support.md).

## Interface and workflow

The main navigation is **总览 / 连接 / 客户端 / 用量 / 更多**. Resources, Activity, Settings, and About are under More.

1. **Overview:** see pending actions, each client's owned published sources, enabled connections, and the latest publication result.
2. **Configure once:** add the provider's endpoint, key and models as a connection. Provider type, protocol and headers are under Advanced options. This saved connection is reusable across client targets. Saving is local; the connection test checks catalog access, not inference.
3. **Apply across clients:** choose where the saved connection should be published, review the inline preview, then confirm. Changing the connection, targets, route or loaded state invalidates the review. Select the CLI target explicitly when its exclusive route is wanted.
4. **Follow the result:** per-target next steps remain visible after the notification disappears. VS Code and JetBrains need client-side model selection; CLI needs a new terminal/session; the app stays manual.
5. **Clients:** inspect configuration and component state, installation plans, and official sign-in/account checks.
6. **Usage:** choose Official subscription/usage, Model statistics, Sessions/details, or Data sources/pricing. Local filters stay in model/session views; less common fields expand under Advanced filters. Model suggestions and Reset filters are available without changing the selected Billing month.

Dialogs support keyboard focus containment, Escape, and focus restoration. Connection/resource editors confirm before discarding unsaved edits, retain input after save errors, and show persistent error messages. Passwords are never serialized into a draft. Tables use readable light surfaces and a fixed model column for horizontal comparisons.

## Run from source

Prerequisites: Node.js 22+, Rust 1.88+, and the platform build requirements for Tauri 2. Windows development also needs the MSVC toolchain and WebView2.

```bash
git clone https://github.com/AvaloNero/CopilotBYOKManager.git
cd CopilotBYOKManager
npm ci
npm run dev
```

The active development branch is `main`.

For a frontend-only review, open `apps/desktop/web/index.html` directly. Browser mode uses disposable simulated data and does not perform native writes or real authentication. `prototype/copilot-byok-manager.html` is the approved interactive design reference, not the current native application.

Build the desktop executable without an installer:

```bash
npm run build -- --no-bundle
```

Windows packaging and layered acceptance procedures are described in [local validation](docs/local-validation-plan.md). A successful build is not clean-machine installation acceptance.

## Development and checks

Read [AGENTS.md](AGENTS.md), the [MVP contract](docs/mvp-implementation-spec.md), and the [architecture](docs/architecture.md) before implementation.

```bash
npm run check:web
cargo fmt --all -- --check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
git diff --check
```

`npm run check` runs the web and Rust gates; run the whitespace check separately. CI runs the required checks on Ubuntu, Windows, and macOS, and builds the native app on Windows.

The optional browser regression is `node apps/desktop/web/tests/browser-smoke.cjs`. Set `PILOTWEAVE_PLAYWRIGHT` to an installed Playwright module path if needed; `PILOTWEAVE_BROWSER` can select the browser executable. It uses a fresh headless profile, in-memory native fixtures, and temporary screenshots. Coverage includes modal keyboard/draft/error handling, account-panel placement, usage navigation/filtering, publication guidance, CLI opt-in, and 1180 × 760 / 960 × 640 layouts.

Automated tests use temporary directories, fake credentials/processes, sanitized schemas, and local HTTP servers. Real clients, accounts, installers and provider requests belong to separately authorized acceptance runs. See [recorded validation and its limits](docs/implementation-status.md#validation-evidence).

## Safety and limits

- Never copy client OAuth tokens, browser cookies, VS Code SecretStorage, JetBrains Password Safe, or private Copilot app databases.
- Local usage stores only allowlisted metadata, not prompts, responses, source code, tool content or raw logs.
- Unknown, unavailable, partial, stale, manual, verified and zero remain distinct.
- Official GitHub monetary amounts and API-equivalent estimates remain separate; missing counters or prices reduce coverage.
- Installation uses backend-owned reviewed plans and post-install rediscovery. The direct Copilot app asset-download fallback is not implemented.
- Organization/enterprise Billing, provider invoice APIs, cloud usage sync, overage settings, and full macOS/Linux one-click installation are outside the required milestone.

The [security policy](SECURITY.md) explains sensitive-data handling and private reporting. The [MVP specification](docs/mvp-implementation-spec.md) remains the acceptance contract.

## Naming and compatibility

The public repository is [AvaloNero/CopilotBYOKManager](https://github.com/AvaloNero/CopilotBYOKManager). Existing clones can update their remote:

```bash
git remote set-url origin https://github.com/AvaloNero/CopilotBYOKManager.git
```

This rename does not migrate user data. The `PilotWeave` configuration directory, credential services and ownership markers, `dev.pilotweave.desktop` identifier, `pilotweave` package/binary names, `PILOTWEAVE_*` environment options, and existing validation paths remain compatible. Native package/window labels may still show PilotWeave in this build. Do not rename these persisted identifiers or folders manually.

## Repository layout

```text
apps/desktop/src-tauri/     Native backend, adapters, persistence and tests
apps/desktop/web/           Desktop frontend and browser regressions
docs/                      Documentation index, implementation status and contracts
prototype/                 Reviewed interactive design reference and handoff
scripts/                   Local validation and packaging tools
tests/                     Cross-cutting web and native-isolated suites
AGENTS.md                  Coding-agent entry point
SECURITY.md                Disclosure and sensitive-data policy
```

## License

[MIT](LICENSE)
