# CopilotBYOKManager v{{VERSION}}

Configure a provider once for Copilot Chat in VS Code and JetBrains, Copilot CLI and the Copilot App. This release improves provider management in the Windows x64 Copilot App with experimental sync enabled.

- **Delete a provider you added in Copilot App.** Quit Copilot App, open **Apps → Copilot App → Manage configuration** in the manager, then select **Delete**. The confirmation shows the model count and the endpoint host when available. Providers with the same name have separate entries. If another App record still uses the provider or a model, the manager explains what is blocking deletion.
- **Republish a provider you deleted in the App.** Choose **Publish configuration** for the saved provider. The preview now offers to recreate it and its enabled models. Background sync waits for your confirmation.

### 下载与安装 / Downloads

{{FILES}}

Run Windows x64 Setup or extract the standalone ZIP. On macOS 15 or later, open the Universal DMG and drag the app to Applications. Verify package hashes with `SHA256SUMS.txt`.

### 简体中文

一次配置供应商，即可发布到 VS Code 和 JetBrains 的 Copilot Chat、Copilot CLI 和 Copilot App。本版改进适用于已开启实验性同步的 Windows x64 Copilot App。

- **删除在 Copilot App 里手动添加的供应商。** 退出 Copilot App，在管理器的 **应用 → Copilot App → 管理配置** 中选择条目，点 **删除**。确认框显示模型数和可读取的端点主机。同名条目可以分别删除。如果 App 中仍有记录引用该供应商或模型，界面会提示原因。
- **重新发布在 App 里删掉的受管供应商。** 对已保存的供应商点 **发布配置**，预览会提示重新创建供应商及其已启用的模型。后台同步会等待你确认。

Windows x64 用户可运行安装器或解压便携 ZIP。macOS 15 及以上用户可打开 Universal DMG，将应用拖入 Applications。可用 `SHA256SUMS.txt` 核对文件。

[English guide](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.md) · [中文手册](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/docs/user-guide.zh-CN.md) · [Roadmap / 路线图](https://github.com/Arcueid77/CopilotBYOKManager/blob/{{COMMIT}}/ROADMAP.md)

Source: `{{COMMIT}}` · Version: `v{{VERSION}}`
