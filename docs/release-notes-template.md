# CopilotBYOKManager v{{VERSION}}

Reuse provider configurations across Copilot Chat in VS Code and JetBrains, Copilot CLI and the Copilot App.

- **Extract existing providers.** Bring in endpoints and models from supported app configurations, individually or together. With confirmation, you can also save available API keys in the local system credential store and fill in missing keys on saved providers. Extraction runs locally without uploads.
- **Manage existing configurations.** Open **Manage configuration** in an app instance. Edit or delete supported entries in VS Code, CLI and JetBrains. Manage synchronized Copilot App providers from the same entry.
- **Review one publication plan.** Global publication preselects eligible targets, including CLI and a compatible Copilot App with sync enabled. Each card shows its own result or blocker, and the publication history retains the reason.
- **Publish to an enabled Copilot App alongside other targets.** The shared review handles first-time provider consent and shows when Copilot App needs to be closed.

### 下载与安装 / Downloads

{{FILES}}

Run Windows x64 Setup or extract the standalone ZIP. On macOS 15 or later, open the Universal DMG and drag the app to Applications. Verify package hashes with `SHA256SUMS.txt`.

### 简体中文

- **提取已有供应商。** 可单独或批量提取端点和模型。用户确认后，可将明文 API Key 保存到本机系统凭据库，也能为已保存的供应商补齐密钥。提取不上传。
- **管理原有配置。** 在应用实例中打开「管理配置」。VS Code、CLI 和 JetBrains 支持编辑或删除适配的配置，已同步到 Copilot App 的供应商也从同一入口管理。
- **统一发布预览。** 全局发布默认勾选符合条件的应用，包括 CLI 和已启用同步的兼容 Copilot App。各目标的阻塞原因直接显示在卡片上，并保留到发布记录。
- **一并发布到 Copilot App。** 首次同步供应商在同一预览中确认。App 在后台运行时，对应目标会提示退出后重新核对。

Windows x64 用户可运行安装器或解压便携 ZIP。macOS 15 及以上用户可打开 Universal DMG，将应用拖入 Applications。可用 `SHA256SUMS.txt` 核对文件。

[English guide](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.md) · [中文手册](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.zh-CN.md) · [Roadmap / 路线图](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/ROADMAP.md)

Source: `{{COMMIT}}` · Version: `v{{VERSION}}`
