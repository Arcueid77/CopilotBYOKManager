# CopilotBYOKManager v{{VERSION}}

Configure one provider. Publish it safely across your Copilot clients.

{{CHANNEL}}

## Core configuration edition

Overview, Providers, Apps and About: central endpoint/key/model profiles, model
catalog discovery or manual entry, native-held previews, owned publication and
revocation, and safe recovery. English / 简体中文 and Light / Dark / System.

Save a provider, publish it to your apps, then select a model in each app.

## Downloads and trust

{{FILES}}

- Windows x64 Setup: **{{WINDOWS_STATUS}}**. Current-user installation; WebView2
  is required and the installer downloads its bootstrapper when missing. Offline
  setup then needs a separately prepared official WebView2 runtime. An unsigned
  file may trigger SmartScreen; do not disable security protections.
- Optional Windows standalone ZIP: extract before running. This is **not fully
  portable**: state, credentials and client configuration still use user storage.
- macOS Universal DMG: **{{MACOS_STATUS}}**. Drag the app to Applications.
  Packaging floor: macOS 15.0.
- Compare the files with `SHA256SUMS.txt`; `release-metadata.json` records the exact
  source, architecture and signing checks. Checksums detect changed bytes, not a
  trusted publisher identity.

## Client and platform acceptance

This candidate's outstanding acceptance is listed in the
[release criteria](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/release-criteria.md).
Windows clean-machine installation, Apple Silicon and Intel Mac checks, and real
provider requests remain **acceptance pending** until a dated per-client record
is linked there.

| Client | Configuration boundary | After publication |
| --- | --- | --- |
| VS Code Stable / Insiders / profiles | Automatic owned group projection; runtime acceptance pending | Select a model in the correct profile; test a minimal request |
| Copilot CLI | Automatic single environment route; runtime acceptance pending | Start a new terminal and session; verify route/model |
| JetBrains GitHub Copilot | Adapter-reviewed exact `1.19.0-252` and `1.19.0-261-{windows,macos,linux}-{x64,arm64}` plugin distributions; runtime acceptance pending | Close/reopen each IDE, sign in separately, choose a model and test |
| Copilot App | Manual guidance only | Configure, select and verify in the App |

## Known limits and safety

- CLI has one active managed environment route, not simultaneous provider routing.
- Unknown JetBrains versions are unsupported. Shared runtime configuration can be
  visible in unselected IDEs. Rider runtime validation remains deferred.
- Usage, Billing, authorization and Resources/MCP/Skills/Instructions are hidden
  and excluded from v0.1 release scope; their existing data and regressions remain.
- Windows close-to-tray has not yet passed final desktop acceptance. macOS close,
  Cmd+Q and relaunch behavior require Mac acceptance; Windows tray promises do not
  apply there.
- Provider master keys use the OS credential store. Some target formats materialize
  provider keys on disk. Do not upload target files, recovery snapshots or logs.
- Client OAuth tokens, cookies, SecretStorage and Password Safe are never copied.
  Changes after planning block writes; rollback cannot overwrite subsequent edits.
  No default telemetry or conversation upload is added.

## 中文摘要

Provider 一次配置，安全发布到多个 Copilot 客户端。本版只开放总览、供应商、应用、关于。
保存供应商，发布到应用，再到客户端选用模型。
Windows 为未签名社区构建；Mac 仅在上文明确写明 Developer ID 签名、公证及票据验证时
才属于正式签名产物。测试 DMG 使用临时签名，未公证。
Copilot App 仅手动指引，JetBrains 仅限已审核的确切插件版本。

## Source and support

Commit: `{{COMMIT}}` · Version: `v{{VERSION}}` · Checksums: `SHA256SUMS.txt`

[English guide](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.md)
· [中文手册](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.zh-CN.md)
· [Issues](https://github.com/Arcueid77/CopilotBYOKManager/issues)
· [Private security reporting](https://github.com/Arcueid77/CopilotBYOKManager/security)

Independent project; not affiliated with or endorsed by GitHub or JetBrains. MIT.
