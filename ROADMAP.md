# CopilotBYOKManager roadmap

Configure a provider once and keep it usable across Copilot apps. The core workspace has four pages: Overview, Providers, Apps and About.

| Milestone | User outcome | Completion criteria |
| --- | --- | --- |
| **0.2.4 · Client upgrades** | Publish to clients that consume the corresponding JSON format. Stable JetBrains plugins qualify from 1.13.0. Official Windows x64 Copilot App builds qualify by their database schema. Apps checks compatibility before provider selection. | Exercise the floor, a newer compatible build, an older build and an incompatible format. Verify existing ownership, one-shot previews, consent and conditional rollback across upgrades. |
| **0.2.5 · Configuration reuse** | Extract existing providers and models. Save available API keys in the local credential store after confirmation. Manage existing configurations and publish eligible targets through one dialog. | Verify deduplication, consent and rollback. Check default targets, per-target blockers and publication history on all four clients. |
| **0.3 · Provider changes** | After editing a provider, see which app instances need an update, which have local changes and which are already current. Review affected instances together. | Change an endpoint or model, review the differences, update selected instances and retry a failed target. Offer an explicit model request test. |
| **0.4 · Installation and updates** | Find supported clients, see the detected version, recover from a failed installation and find the next manager release. | Verify the official App download fallback, publisher checks, rediscovery and clean upgrade with retained settings. |
| **1.0 · Core release** | Install, publish, select a model in a real client and revoke independently using either language. | Complete clean Windows and Intel/Apple Silicon Mac checks, Windows tray/relaunch and real requests on advertised paths. Aim for four of five first-time users completing the main flow and zero open critical/high defects. |

Native desktop regression on the redesigned workspace and clean-machine checks continue alongside these milestones. The [feature inventory](docs/feature-availability.md) tracks later MCP/Skills/Instructions, opt-in usage and personal Billing work. Each needs its own real-client evidence before the interface offers it.

### Publication compatibility in 0.2.4

| Client | First compatible public release or format | Evidence |
| --- | --- | --- |
| VS Code Custom Endpoint in `chatLanguageModels.json` | Stable 1.122, Insiders 1.121 | [Insiders announcement](https://code.visualstudio.com/updates/v1_121) · [Stable release notes](https://code.visualstudio.com/updates/v1_122) |
| Copilot CLI `providers.json` | 1.0.83 | [CLI contract and adjacent-release check](docs/copilot-cli-support.md#registry-version-boundary) |
| JetBrains custom provider in `byok.json` | Plugin 1.13.0 | [Marketplace release notes](https://plugins.jetbrains.com/api/updates/1103496) · [GitHub announcement](https://github.blog/changelog/2026-07-14-github-copilot-for-jetbrains-expands-byok-capabilities/) |
| Copilot App provider JSON in SQLite | Actual schema, first observed in Windows 1.0.8 | [1.0.7 / 1.0.8 comparison](docs/copilot-app-sqlite-sync.md#json-provider-storage-boundary) |

## 中文路线图

| 版本 | 用户可以做什么 | 验证重点 |
| --- | --- | --- |
| **0.2.4 · 客户端升级兼容** | JetBrains 插件从 1.13.0 起可发布。官方 Windows x64 Copilot App 按现有供应商数据库格式判定，在选择供应商前检查兼容性。 | 低于下限、刚好达到下限、更高兼容版本及格式变化。核对升级后的预览失效、授权、旧配置更新与撤销。 |
| **0.2.5 · 复用已有配置** | 提取已有供应商和模型，经确认后将可提取的密钥保存在本机。管理原配置，并在同一弹窗发布符合条件的目标。 | 核对去重、授权、回滚，以及四个客户端的默认勾选、阻塞原因和发布记录。 |
| **0.3 · 供应商变更** | 保存后看清哪些应用需要更新、哪些有外部修改，一次复核选中的实例，按需发起模型请求测试。 | 修改端点和模型、查看差异、更新、处理单个实例失败。 |
| **0.4 · 安装与更新** | 查看客户端版本，安装失败时使用官方备用下载，在软件内找到新版。 | 校验安装包和发布者、安装后重新检测、升级后保留设置。 |
| **1.0 · 核心配置版** | 独立完成安装、跨应用发布、真实客户端选用模型和撤销。 | 干净 Windows 和两种架构 Mac、托盘与重开、中英文首次使用。目标为 5 位新用户中至少 4 位完成主流程，严重缺陷清零。 |

真实客户端验收按平台和版本记录在[实现状态](docs/implementation-status.md)。后续扩展的开放条件见[功能清单](docs/feature-availability.md)。
