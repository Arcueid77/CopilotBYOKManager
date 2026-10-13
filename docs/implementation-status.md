# CopilotBYOKManager implementation status

Updated 2026-10-13 against application commit `3791283` on `main`. This is an implementation and evidence summary, not a declaration that the required MVP or release acceptance is complete. The [MVP specification](mvp-implementation-spec.md) remains normative.

## Current implementation

| Area | Implemented behavior | Current boundary |
| --- | --- | --- |
| Connections and models | Native CRUD, enablement, read-only catalog discovery/probe, checked model addition, preferred-model order, OS-held keys | Catalog access does not prove inference; disabling does not revoke a published source |
| Deployment and recovery | Native one-shot expiring plans, live fingerprints, durable ownership, prepare-all writes, journals, compensation, conditional rollback, revoke-and-delete and detach | External changes or unproven ownership refuse destructive replacement |
| VS Code | Stable/Insiders/profile discovery; owned `chatLanguageModels.json` groups coexist with other suppliers | Select the model in the client; sign-in only focuses an existing Windows editor or gives manual instructions |
| Copilot CLI | One owned legacy environment route plus `COPILOT_MODEL`; CLI target requires explicit selection by default | New terminal/session required; no `providers.json` write; a shadowing registry blocks publication |
| JetBrains | Automatic dedicated shared BYOK projection for reviewed 1.19 distributions, with per-profile proofs and deduplicated writes | Unknown versions unsupported; per-IDE login, picker visibility and actual requests are separate acceptance steps |
| Copilot app | Component discovery, official-flow/manual account steps and provider runbook | Provider writes and a separate private local-usage source are unsupported |
| Installation | Pinned reviewed Windows WinGet/component plans, identity checks, persisted per-component outcomes, scoped cancellation and rediscovery | Direct app asset-download fallback and clean-machine package acceptance are not complete |
| Accounts and GitHub authorization | Official client workflows, protocol-3 CLI identity follow-up, manual/verified distinction, separate OS-held GitHub authorization | No copying client credentials; actual runtime/Billing capability depends on the installed client and account |
| Resources | Native MCP, Markdown-only Skills and Instructions authoring/publication/revoke on reviewed public paths | Named profiles, custom roots, local-command/secret-bearing MCP, app and JetBrains resource gaps remain manual |
| Usage and pricing | Runtime quota/model observations; monthly personal Billing; opt-in CLI/shared-runtime and VS Code imports; decimal estimates and immutable prices | Missing semantics, cache writes, source coverage or Connection attribution remain unknown/partial |
| Persistence | `state.json` schema v2 and separate `usage.sqlite3` schema v3, migration/reopen support and explicit read-only recovery | The UX and repository-name changes do not migrate storage or credentials |

Technical detail: [architecture](architecture.md), [hardening](hardening-handoff.md), [JetBrains](jetbrains-support.md), [usage sources](usage-sources.md), and [model discovery](provider-model-discovery.md).

## Current interface

- Top navigation: **总览 / 连接 / 客户端 / 用量 / 更多**. More contains Resources, Activity, Settings and About.
- Overview: pending actions when needed, one row per client/profile with owned published-source chips, enabled Connection cards, and the latest publication result.
- Connection editor: common fields first; provider/protocol/header options expand separately. Model discovery adds only checked entries. Save errors remain visible and retain the form.
- Dialogs: initial focus, contained Tab/Shift+Tab navigation, Escape, focus restoration, background isolation, and protection against replacing an unsaved editor. Connection/resource editors keep a dirty flag, not a serialized draft or password copy.
- Usage: tabs precede detail; official quota/Billing do not receive local filters. Model/session views have basic and advanced filters, bounded model suggestions, reset, and focus preservation. Model tables retain a fixed first column; missing values and exact decimal amounts keep their semantics.
- Publication: persistent per-target results and client-specific next actions; VS Code/JetBrains model selection, CLI new-session guidance, and app manual setup remain distinct. Disk publication never claims login, selection or successful provider execution.

## Validation evidence

Evidence must stay attached to the source and validation layer that produced it. Tests use temporary data and fake external services; reports and screenshots are retained outside Git.

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

The 2026-10-13 documentation/rename refresh reran the required web, Rust, formatting, Clippy and whitespace checks successfully against unchanged application code. It also checked local documentation paths and heading links. No browser, native-isolated or real-client acceptance result is added by that documentation-only run.

## Remaining work within the required scope

1. Rerun NativeIsolated on the final application source before claiming fresh native UI acceptance for the new navigation and modal behavior.
2. Complete Windows 11 x64 dedicated-user/VM acceptance for installation, publisher/package policy, official account flows, actual runtime/Billing access, supported resource consumption and new opt-in usage observations. The direct app asset strategy remains an implementation gap.
3. Resume JetBrains runtime acceptance only when the maintainer resumes the deferred task: per-IDE official login, restart/model visibility, one approved minimal provider request, and separately evidenced multi-IDE sharing. Prepared Rider files are not a passing result.
4. Broaden usage/identity/resource coverage only after a supported upstream interface is verified. Add versioned parsers and sanitized fixtures for new semantics; do not infer absent CLI input semantics, VS Code cache-write counters, app-local usage or ambiguous Connection attribution.

Use [local validation](local-validation-plan.md) for execution details. Historical handoffs remain evidence records rather than unchecked to-do lists.

## Repository rename

The public project is **CopilotBYOKManager**, at [AvaloNero/CopilotBYOKManager](https://github.com/AvaloNero/CopilotBYOKManager). The prior PilotWeave name remains in compatible internal identifiers and old evidence records. Repository metadata/documentation changes do not rename the package, executable, configuration directory, credential service, ownership marker or environment flags; see [compatibility notes](../README.md#naming-and-compatibility).
