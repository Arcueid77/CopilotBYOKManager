# CopilotBYOKManager v{{VERSION}}

一次配置供应商，将模型发布到多个 Copilot 应用。

## 本次更新

- 重新设计总览、供应商、应用和关于四个页面，采用侧栏导航与统一控件。
- 供应商改为列表与详情双栏；通过编辑抽屉管理端点、密钥、模型勾选、推荐模型和手动添加。
- 应用按类型分组，展开查看各 IDE 和配置档案，仍可逐个选择发布目标。
- 发布使用统一弹窗，保留变更复核、逐项结果、撤销和恢复；写入路径与范围集中在变更明细中。
- Copilot App 主行提供启用／管理同步入口，保留默认关闭的风险确认与手动指引。
- 统一应用名称和配置状态，独立展示同步进度；放大居中图标，增强按钮、链接和展开入口的可辨识度。
- 补充 GitHub Copilot JetBrains 插件 **1.20.0-261-windows-x64** 自动发布支持，保留已审核的 1.19 版本。
- 改善发布草稿创建后的查询重试，减少短暂不可见造成的上传中断。

## 功能与支持

- 集中管理多个供应商、API Key 和模型，支持获取模型列表或手动添加。
- 发布到 Copilot Chat（VS Code）及已审核的 JetBrains 插件；Copilot CLI 通过 `providers.json` 保存多个供应商和模型。
- 实验性 Copilot App 自动同步目前支持 Windows x64 App **1.1.25**；选择供应商并确认后，保存变更即可同步。支持等待关闭客户端、模型移除复核、冲突重试及单独撤销。
- 简体中文／英文，浅色／深色／跟随系统，Windows 关闭到托盘。
- 保留发布记录、其他供应商配置，以及各客户端的模型选择指引。

## 下载与安装

{{FILES}}

- **Windows x64**：运行 `setup.exe`，或解压 `standalone.zip` 后运行。安装器会在需要时下载 WebView2。
- **macOS 15+（Intel / Apple Silicon）**：打开 Universal DMG，将应用拖入 Applications。
- `SHA256SUMS.txt` 提供文件校验和；`release-metadata.json` 记录构建来源。

发布后在客户端选择模型。CLI 使用新会话并通过 `/model` 选择；JetBrains 发布后重启相关 IDE。

## English

Configure providers once and publish models across your Copilot apps.

- Redesigned four-page workspace with sidebar navigation and consistent controls.
- Searchable provider list and details, plus an editing drawer for endpoints, keys, model selection, recommendations and manual entries.
- App families expand into concrete IDE installations and profiles, each retaining its own publication target.
- Shared publication dialog with change review, per-target results, revocation and recovery. Paths and write scope appear in change details.
- Primary Enable sync / Manage sync actions for Copilot App, with opt-in confirmation and manual guidance retained.
- Consistent app names and configuration states, separate synchronization progress, centered larger icons and clearly visible interactive controls.
- Reviewed JetBrains **1.20.0-261-windows-x64** support alongside the previously supported 1.19 distributions.
- Bounded visibility retries after Draft creation improve release upload reliability.

Manage endpoints, API keys and models for VS Code, supported JetBrains plugins and
Copilot CLI. CLI publication preserves multiple providers and models in
`providers.json`. Experimental Copilot App synchronization is off by default and
supports the reviewed Windows x64 App **1.1.25** build. English / 简体中文,
themes, Windows close-to-tray, history and recovery are included.

Windows: run Setup or extract the standalone ZIP. macOS 15+: open the Universal
DMG and drag the app into Applications. After publishing, choose a model in the
client; start a new CLI session or restart the relevant JetBrains IDE.

## 文档 / Documentation

[中文手册](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.zh-CN.md)
· [English guide](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.md)
· [反馈问题 / Issues](https://github.com/Arcueid77/CopilotBYOKManager/issues)

Source: `{{COMMIT}}` · Version: `v{{VERSION}}`
