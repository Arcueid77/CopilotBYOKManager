# CopilotBYOKManager v{{VERSION}}

一次配置供应商，将模型发布到多个 Copilot 客户端。

## 本版功能

- 集中管理供应商地址、API Key 和模型，支持获取模型列表或手动添加。
- 一键发布到 Copilot Chat（VS Code）、Copilot CLI 和支持的 JetBrains 插件；Copilot App 提供手动配置指引。
- 刷新后直接显示客户端当前配置；应用按支持情况和配置状态排序。
- 总览、供应商、应用、关于四个页面，支持简体中文、英文和明暗主题。
- 保留发布记录、撤销和恢复功能；发布时保留其他供应商的配置。

## 下载与安装

{{FILES}}

- **Windows x64**：运行 `setup.exe` 安装，或解压 `standalone.zip` 后运行。安装器会在需要时下载 WebView2。
- **macOS 15+（Intel / Apple Silicon）**：打开 Universal DMG，将应用拖入 Applications。
- `SHA256SUMS.txt` 提供文件校验和；`release-metadata.json` 记录构建来源。

保存供应商并发布后，在客户端选择相应模型。CLI 配置在新终端和新会话中生效；JetBrains 仅支持应用中标示的插件版本。

## English

Configure providers, API keys and models once, then publish to Copilot Chat in
VS Code, Copilot CLI and supported JetBrains plugins. Copilot App includes manual
setup guidance. Refresh reads the current client configuration, with supported
and configured apps listed first. Includes English / 简体中文, themes, publication
history, revocation and recovery.

Windows: run Setup or extract the standalone ZIP. macOS 15+: open the Universal
DMG and drag the app to Applications. After publishing, select a model in the
client; start a new terminal and session for CLI changes.

## 文档 / Documentation

[中文手册](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.zh-CN.md)
· [English guide](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.md)
· [反馈问题 / Issues](https://github.com/Arcueid77/CopilotBYOKManager/issues)

Source: `{{COMMIT}}` · Version: `v{{VERSION}}`
