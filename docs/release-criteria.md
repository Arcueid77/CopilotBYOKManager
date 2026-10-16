# CopilotBYOKManager v0.1 发布标准

更新：2026-10-15。维护者已将首次公开发行范围确定为**四页核心配置版**：总览、供应商、应用、关于。这是版本范围调整，不是将未执行项目改成 PASS。当前结论仍为 **NO-GO：安装包和真实客户端验收尚未完成**。本次工程工作不创建远程标签、Release 或仓库设置。

核心承诺：**Provider 一次配置，安全发布到多个 Copilot 客户端。** 保存 Provider、发布客户端配置、客户端选中模型、实际请求成功是四个不同状态。Copilot App 只提供手动指引；JetBrains 固定版本代码审查不能代替真实 IDE 验收。

[规范 §21](mvp-implementation-spec.md#21-final-acceptance)定义本版范围；本文定义证据门槛。[发行工程](release-engineering.md)是英文操作入口，[实现状态](implementation-status.md)记录结果，[本机验证](local-validation-plan.md)记录分层测试方法。

## 1. 版本和支持承诺

| 阶段 | 对外状态 | 准入条件 |
| --- | --- | --- |
| 开发 / dry-run | Actions 临时测试附件，不创建 Release | 版本、锁文件、源码检查、所选平台构建和附件校验通过 |
| Draft `vX.Y.Z` | 私有发布草稿，不公开 | 同一固定 tag/SHA 的双平台检查及全部正式产物通过，Mac 必须正式签名和公证 |
| 公开 v0.1 候选 | GitHub Pre-release，不设为 Latest | G0–G7 全部通过，维护者审核证据后明确执行 publish |
| 扩大推广 / 稳定承诺 | 独立维护者决定 | G8 完成；不是当前流水线自动执行的操作 |

所有发布标签严格采用 `vX.Y.Z`，例如 `v0.1.0`；不使用 `-rc.N` 标签。候选状态由 GitHub Pre-release 和发布说明表达。修复已公开版本时递增版本，不能复用标签或替换公开附件。本流水线不会直接产生 Latest 稳定版。

最小正式产物为 Windows x64 current-user NSIS Setup、macOS Universal DMG 和 `SHA256SUMS.txt`，另含源码/工具链元数据与发布说明；Windows standalone ZIP 可选。没有 Linux、Windows ARM64、MSI、商店发行或自动更新。

Windows 验收基线是 Windows 11 x64。macOS 最低版本设为 15.0，与官方 `macos-15` 构建/测试 runner 对齐；Intel 和 Apple Silicon 分别验收。

## 2. 发布门槛

每项证据须记录源码 SHA、日期、环境、步骤、结果和脱敏产物位置。NOT RUN、BLOCKED、FAIL 都不是 PASS。仅可对实际通过的客户端/系统路径作支持宣传。

| Gate | 必须满足的条件 | 最低证据 |
| --- | --- | --- |
| G0 范围与身份 | 四页及对外能力一致；产品、包、Bundle ID、可执行文件、配置目录和凭据服务稳定；所有版本与 tag 一致 | 版本检查、包内元数据、全新用户首次启动；不迁移其他应用凭据 |
| G1 源码质量 | 固定同一 SHA，锁定依赖，必需检查全部通过；无真实密钥、数据库、日志、安装器混入 Git | Release 自己的测试 job 和本地摘要；不能只引用普通 CI 或另一 SHA |
| G2 发布与恢复安全 | 原生持有、到期、一次性预览；写前指纹重检；全目标先准备；日志先落盘；外部修改拒绝覆盖；失败只读恢复 | 临时目录回归和当前核心 UI 的原生 IPC 验收；并发、重放、中断、回滚冲突、脱敏及受管项撤销 |
| G3 安装与桌面 | 最终包在无开发环境的新用户中安装、启动、关闭、再启动、卸载；卸载不删除客户端配置 | Windows 开始菜单/卸载项/WebView2 在线及失败路径；Mac DMG/Applications/Finder/Keychain/Cmd+Q；双架构分别记录 |
| G4 实际客户端 | 每条宣称支持的路径有真实登录观察、模型可见、选择及最小请求结果 | 精确客户端和插件版本；仅保存结果元数据，不保存密钥或会话内容；见下表 |
| G5 核心隔离与数据保留 | Usage、Billing、独立授权、Resources、MCP、Skills、Instructions 不挂载、不自动查询、不阻碍核心启动；旧数据不删除 | 四页路由/隐藏查询回归，已有数据重开和恢复检查；保留后端安全/迁移测试 |
| G6 双语与可用性 | 中英文、主题、错误/忙/空状态和键盘流程可用；切换不丢草稿/预览、不触发客户端动作 | 隔离浏览器 + 最终原生窗口；960×640/1180×760、100%/150%、长名称、偏好损坏/写入失败 |
| G7 交付与信任 | 必需附件齐全；精确 SHA、版本、架构、校验和、签名披露和文档一致；安全上报入口可用 | Windows 明确 Unsigned community build；Mac Developer ID + Hardened Runtime + 公证 + stapled ticket；从 Draft 下载后再验哈希 |
| G8 小范围试用 | 广泛推广前至少 5 人自愿试用，含中英文；至少 80% 且不少于 4 人无需代操作完成主流程；连续 7 天无未解决 P0/P1 | 分母含所有实际开始流程的人；逐步结果、耗时、失败记录；无默认遥测；严重修复后重启观察期 |

G5 不要求隐藏功能通过真实 Billing、用量或资源消费验收。那些结果保留为扩展版待办，不计本版通过率；但隐藏模块引发启动失败、数据损坏或安全问题仍阻塞 v0.1。Copilot App 直接资产下载安装策略也属于扩展版待办，不得对外承诺已实现。

Windows G3/G6 必须实际检查：关闭至托盘/直接退出选项及重启保存、普通最小化在任务栏、左键恢复、右键本语言菜单和退出、重复启动唤回、退出后进程和托盘消失。托盘不可用、隐藏失败或偏好损坏须正常关闭，损坏文件保留。macOS 不宣传 Windows 托盘行为，另验关闭窗口、Dock/Finder 再次启动与 Cmd+Q。

### G1 必跑检查

```bash
npm ci
npm run check:version
npm run test:release
npm run check:web
npm run check
cargo fmt --all -- --check
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
git diff --check
```

`npm run check` 汇总版本、发行负向用例、Web、fmt、Rust 测试及严格 Clippy；上面展开的命令也可单独复核。还需 actionlint、隔离浏览器、核心原生 IPC 和最终包验收。旧 B00–B32 含隐藏页面，应按本版范围更新原生用例并记录结果。

### G4 客户端逐项验收

| 客户端 | 正向路径 | 必测边界 |
| --- | --- | --- |
| VS Code Stable / Insiders / profiles | 一次配置后预览发布，模型可见、选用、经授权的最小请求 | 用户/其他供应商项保留，陈旧预览拒绝，撤销仅移除受管项，检测不意外打开编辑器 |
| Copilot CLI | 显式选择 CLI，发布后新终端/新会话核对路由和请求 | 单一路由；`providers.json` 遮蔽拒绝；环境恢复；Finder 启动的 Mac 上单独检查 CLI 检测 |
| JetBrains 固定插件版本 | 至少两个真实 IDE/profile 分别登录，关闭后发布，重开后选用和请求 | 固定版本表；共享文件只写一次，未勾选 IDE 可能可见；未知/禁用插件不写；保留其他供应商 |
| Copilot App 手动指引 | 在 App 内手动配置、选用和请求 | 不声称自动写入或自动验证；不读私有数据库或登录凭据 |

JetBrains 目前只有已审核版本的适配实现，真实验收仍待完成；Rider 工作保持维护者此前的暂停决定。未恢复授权前不自行继续，不把它宣传成已验收支持。实际请求须另行明确供应商、模型和费用边界，仅用不含项目内容的短消息。

## 3. 安全、签名和产物要求

- Windows 本体和安装器本版**不要求 Authenticode**；验证 x64 payload、版本、源码 SHA、SHA-256，并明确标记 **Unsigned community build**。不保证无 SmartScreen 提示，不建议关闭系统安全防护。
- 正式 Mac 必须 Developer ID Application、Hardened Runtime、Apple Notary Service、公证票据 stapled；`.app` 和最终 DMG 均验证。缺 Apple 凭据即失败，不降级。dry-run 仅有 `testing-adhoc.dmg`，明确 **Ad-hoc signed, not notarized; testing only**。
- `standalone.zip` 是免安装版，不是完全便携版。状态、凭据和目标配置仍可能写入用户目录、OS 凭据库或客户端配置。
- 无自动更新，不生成或把 updater `.sig` 当作发布者签名。应用自有 Windows unsigned 策略**不放宽外部组件安装器原有 publisher/hash/架构验证**。
- 日志、截图、issue、附件不得含密钥、证书、令牌、原始会话、代码或私人路径。恢复/回滚文件可能敏感，不上传。Apple 凭据仅在受保护 job 使用临时 Keychain；见 [Secrets 手册（英文）](release-secrets.md)。
- tag push 只进入 Draft；publish 必须固定已有 tag 和双平台正式附件，下载 Draft 重新验证后才公开为 Pre-release。公开版本不覆盖。

最小附件名、元数据、锁文件和操作方法见[发行工程](release-engineering.md)。用户入口为[英文手册](user-guide.md)和[中文手册](user-guide.zh-CN.md)。Actions 测试附件不是正式下载入口。

## 4. 缺陷与停止条件

| 级别 | 例子 | 处理 |
| --- | --- | --- |
| P0 | 密钥泄露、越权读认证、任意执行、数据破坏或覆盖外部修改 | 立即停止发布和推广，私下处理 |
| P1 | 错误端点/模型、无法恢复、核心客户端不可用、包无法启动、签名/来源误导 | 阻止候选公开；修复后重跑相关及完整核心门槛 |
| P2 | 非核心流程存在有说明的绕行方式 | 记录影响、替代步骤和负责人；不能掩盖主流程或安全问题 |
| P3 | 不影响理解和操作的排版/文案 | 可后续修订；危险操作误译不属于 P3 |

公开后发现 P0/P1 时暂停宣传，停止推荐受影响版本，保留哈希证据并发新版本；不覆盖原资产、不自动降级客户端、不上传敏感库。首次发行没有“上一正式版”可回退。

## 5. 当前缺口与执行顺序

1. 发布状态以[实现状态](implementation-status.md)和每次 CI 的固定 SHA 结果为准。
2. Mac dry-run 已在 `dad7bd4` 的[测试构建](https://github.com/AvaloNero/CopilotBYOKManager/actions/runs/38706651589)通过，包括最终 DMG 内应用校验；正式签名流水线仍待验证。Apple 账号、证书、API key 和 release environment 仍由维护者另行配置；本轮没有购买或修改外部设置。
3. 完成当前原生 IPC/Windows 托盘、干净 Windows、Apple Silicon 和 Intel Mac 的最终包验收，以及拟宣传的真实客户端请求。
4. G0–G7 通过并由维护者批准后公开候选；G8 后才扩大推广。隐藏功能留待未来版本，不阻塞核心版。

## 6. 每次发布的决策记录

```text
版本 / tag / source SHA：
操作系统、架构、构建工具链：
客户端与插件精确版本：
安装器路径 / 大小 / SHA-256 / 签名和公证状态：
G0 / G1 / G2 / G3 / G4 / G5 / G6 / G7 / G8：PASS / FAIL / BLOCKED / NOT RUN
逐项证据、日期、执行者：
扩展版延期项（不得混入 PASS）：
未解决缺陷及级别：
对外支持表与明确未验收项：
安全反馈入口检查：
结论：GO-CANDIDATE / NO-GO
维护者 / 日期：
```
