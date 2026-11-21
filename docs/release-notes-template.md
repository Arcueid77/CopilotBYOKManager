# CopilotBYOKManager v{{VERSION}}

一次配置供应商，把模型发布到多个 Copilot 应用。

- VS Code 稳定版从 **1.122**、Insiders 从 **1.121** 起支持 Custom Endpoint。Copilot CLI 从 **1.0.83** 起读取 `providers.json`。发布时核对选定客户端的版本。
- JetBrains GitHub Copilot 稳定版从 **1.13.0** 起支持自动发布。升级后，共享 BYOK 配置格式兼容即可继续使用已有供应商。
- 官方 Windows x64 Copilot App 按实际数据库格式开放可选同步，支持从 **1.0.8** 首次出现的供应商 JSON 表开始的兼容结构。在应用页点击 **检查并启用同步**，核对数据库格式后选择供应商。支持 App 1.4.3 的模型视觉能力字段。
- 更新客户端后，打开的预览需要重新核对。原有供应商可以更新和撤销。App 数据库格式变化时，重新确认同步范围。

### 下载与安装 / Downloads

{{FILES}}

Windows x64 用户可运行安装器，或解压便携 ZIP。macOS 15+ 用户可打开 Universal DMG，将应用拖入 Applications。`SHA256SUMS.txt` 提供校验和。

### English

Configure providers once and publish to Copilot Chat in VS Code, Copilot CLI, JetBrains and the Copilot App.

- Publication checks the client that consumes the file: VS Code Stable **1.122** or Insiders **1.121** for Custom Endpoint, and Copilot CLI **1.0.83** for `providers.json`.
- Stable JetBrains plugin **1.13.0 and newer** can publish to a compatible shared BYOK store. Existing managed providers survive compatible plugin updates.
- Official Windows x64 Copilot App builds with a compatible JSON provider database support opt-in sync. The first observed release with this format was **1.0.8**. Choose **Check and enable sync** to check your installation before selecting providers. App 1.4.3 model vision settings are supported.
- Review again after a client update before applying a pending plan. A change to the approved App storage format asks you to confirm its scope again.

Run Windows Setup or extract the standalone ZIP. On macOS 15 or later, open the Universal DMG and drag the app to Applications.

[English guide](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.md) · [中文手册](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.zh-CN.md) · [Roadmap / 路线图](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/ROADMAP.md)

Source: `{{COMMIT}}` · Version: `v{{VERSION}}`
