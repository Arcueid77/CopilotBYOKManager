# CopilotBYOKManager feature availability

Updated 2026-10-14. The current **core configuration edition** has four pages: **Overview, Providers, Apps and About**. Its main task is to configure a provider once, preview publication to selected Copilot apps, inspect results and safely revoke owned configuration. The product remains pre-release.

## Available in the current interface

- Provider endpoint, OS-held key and model management; catalog discovery, preferred model, enablement and explicit deletion choices.
- App detection, reviewed installation and official account steps; supported provider preview/publication and manual App guidance.
- Persistent per-target publication results, publication/revocation history and safe recovery, within the four pages.
- English and Simplified Chinese; Light, Dark and System appearance, with a bounded saved preference.
- Windows close-to-tray by default, saved Tray/Exit choice on About, left-click restore, localized right-click Open main window / Exit menu and repeated-launch wakeup. Ordinary minimize stays on the taskbar. Unavailable tray, hide failure or unreadable preferences keep normal close. Browser preview and other platforms do not claim Windows tray behavior.

Writing configuration is not proof of authentication, model selection or a successful request. See [implementation status](implementation-status.md) for the evidence attached to this source.

## Planned capabilities not offered in this edition

These are existing required-scope plans, not new product promises. There are no promised dates. Hiding a capability does not delete its implementation, tests, authorization metadata or imported records; the interface does not load or invoke it.

This is a frontend availability change, not removal of native services. Normal store opening, schema/recovery checks and the dashboard's database-health metadata remain; hidden feature queries and actions are not started by the four-page interface.

| Capability | Implementation status | Before it can be offered |
| --- | --- | --- |
| Official runtime quota and model observations | Native service, persistence and extended UI implemented; entry hidden | Confirm authoritative runtime coverage and typed unavailable/stale states in real accounts |
| Personal GitHub Billing and separate manager authorization | Native service and OS-held authorization implemented; both entry points hidden | Verify endpoint/account permissions; organization-paid or inaccessible data stays NotCovered, not zero |
| Local model/session usage and opt-in source management | Metadata-only import, deduplication and extended UI implemented; entry hidden | Validate dedicated-user new records, source privacy, unknown counters and shared-runtime deduplication |
| Model attribution and API-equivalent estimates | Versioned aliases, exact decimals and immutable price snapshots implemented; entry hidden | Verify source semantics and coverage without presenting estimates as charges |
| MCP, Markdown Skills and Instructions | Reviewed public-path authoring/publication/revocation implemented; entry hidden | Real app consumption/revocation for advertised paths; not universal synchronization |
| Unified activity page | Extended renderer implemented; standalone page hidden | Reconcile operation records in one comprehensible view; core publication records stay accessible |
| Direct Copilot App installer download fallback | Required policy specified; strategy not implemented | Official assets, size/architecture/hash/publisher verification and post-install rediscovery |
| Signed distributed Windows package | Packaging hooks exist; final signed package and clean-user acceptance incomplete | Installer, WebView2, signature/checksums, clean install/reopen/uninstall and support evidence |

## Acceptance work is not another feature

Current-source native integration, Windows tray behavior, clean Windows installation and real app/provider requests require their own evidence. JetBrains/Rider runtime acceptance remains deferred until the maintainer resumes it. A browser fixture, passing unit test or compiled EXE cannot substitute for these checks.

Extended NativeIsolated UI cases that navigate to hidden Usage/Resources/Settings are not current core-interface tests. Keep backend regressions; adapt the UI suite before claiming a fresh full run. See [local validation](local-validation-plan.md) and [release criteria](release-criteria.md).

## Scope that is not planned

Organization/enterprise Billing, provider invoices, cloud usage synchronization, multi-user allocation, purchasing/changing overage settings, uploading logs, copying client credentials and undocumented private App writes remain excluded. Do not list them as coming soon.

## 中文功能记录

当前为四页核心配置版：**总览、供应商、应用、关于**。先做好供应商配置、选择应用、预览发布、结果核对和安全撤销。中英文、浅色/深色/跟随系统，以及 Windows 关闭到托盘属于本版界面能力。托盘采用 CC Switch 式规则：默认关闭至托盘，可在关于页改为直接退出；左键打开主窗口，右键显示本语言菜单，再次启动唤回已有实例。托盘和真实应用是否通过验收，以[实现状态](implementation-status.md)为准。

| 已规划未开放的能力 | 当前状态 | 开放前要完成什么 |
| --- | --- | --- |
| 官方配额和模型目录 | 已有实现，入口隐藏 | 真实账号和运行时覆盖验证，未知/过期状态清楚 |
| GitHub 个人账单及独立授权 | 已有实现，两处入口隐藏 | 权限和个人账单接口验证，不把组织付费或不可访问当成零 |
| 本地用量、模型/会话统计和来源管理 | 已有实现，入口隐藏 | 专用用户新数据、隐私、缺失字段和共享去重验收 |
| 模型归属与 API 等价费用估算 | 已有实现，入口隐藏 | 数据语义、历史价格绑定和覆盖范围验证，不冒充扣费 |
| MCP、Markdown Skills、Instructions | 已有实现，入口隐藏 | 受支持路径上的真实应用消费和撤销验收 |
| 独立统一活动页 | 已有实现，页面隐藏 | 综合操作记录的易用性；发布/撤销记录本版仍可查看 |
| Copilot App 直接下载安装策略 | 已有规范，尚未实现 | 官方资产、大小/架构/散列/签名校验和重新检测 |
| 正式签名 Windows 安装包 | 打包入口已有，正式交付未完成 | 最终安装包、WebView2、签名/校验和和干净 Windows 验收 |

隐藏入口不会删除已有数据，也不会在四页刷新时加载这些模块。规划记录不承诺日期，验收缺口不算通过。组织/企业账单、Provider 发票、云同步、超额付费设置和复制客户端凭据不属于计划。

这是界面开放范围的调整，不是删除原生服务：正常打开存储、检查版本与恢复状态、返回数据库健康元数据仍保留；四页界面不会自动发起隐藏功能的查询或操作。
