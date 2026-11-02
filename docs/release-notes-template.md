# CopilotBYOKManager v{{VERSION}}

一次配置供应商，将模型发布到多个 Copilot 客户端。

## 本次修复

- 安装失败时直接显示下载服务器解析失败或连接超时的原因及处理步骤。
- 安装结果增加“重新检测并重试”，重新核对组件并生成新的安装预览。
- 安装器退出码改为标准十六进制；兼容已有安装记录，保留已完成组件。
- 优化 Copilot App 供应商选择弹窗：紧凑列表、正常尺寸复选框、模型与端点摘要、选中计数和行内错误。
- 修正 App 后台运行时误报“其他配置正在写入”的问题，分别提示退出客户端、检查目录权限或等待其他配置操作。

## 功能

- 集中管理供应商地址、API Key 和模型，支持获取模型列表或手动添加。
- 发布到 Copilot Chat（VS Code）和支持的 JetBrains 插件；Copilot CLI 使用 `providers.json` 保存多个供应商及其全部启用模型。
- 新增 Copilot App 实验性自动同步：选择供应商并确认后，保存变更即更新自有供应商和模型。默认关闭，目前支持 Windows x64 App 1.1.25，保留手动配置。
- App 同步支持等待关闭客户端、模型移除复核、冲突重试和单独撤销；关闭同步保留现有配置。
- 改进安装进度和取消结果，保留已完成组件；更新供应商编辑与模型选择流程。
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

This patch makes download name-resolution and connection-timeout failures visible
in installation results, with a concrete next step. **Detect again and retry**
checks the component again and creates a fresh installation preview. Exit codes
use hexadecimal notation. Existing history and completed components are retained.
Copilot App provider selection now uses a compact list with correctly sized
checkboxes, model/endpoint summaries, a selection count and inline errors.
App setup now distinguishes a client still running in the background, unsafe
directory permissions and a competing configuration write, with specific next steps.

Configure providers, API keys and models once, then publish to Copilot Chat in
VS Code and supported JetBrains plugins. Copilot CLI now uses `providers.json`
for multiple providers and all enabled models.

Experimental Copilot App auto-sync is off by default. Select providers and confirm
the setup to synchronize saved changes. Supports the reviewed Windows x64 App
1.1.25 build, with manual setup retained. Includes App-exit waiting, model-removal
review, conflict retry and separate revocation. Turning sync off keeps existing
configuration. Installation progress/cancellation and provider model selection
are improved. English / 简体中文, themes, history and recovery remain available.

Windows: run Setup or extract the standalone ZIP. macOS 15+: open the Universal
DMG and drag the app to Applications. After publishing, select a model in the
client; start a new terminal and session for CLI changes.

## 文档 / Documentation

[中文手册](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.zh-CN.md)
· [English guide](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.md)
· [反馈问题 / Issues](https://github.com/Arcueid77/CopilotBYOKManager/issues)

Source: `{{COMMIT}}` · Version: `v{{VERSION}}`
