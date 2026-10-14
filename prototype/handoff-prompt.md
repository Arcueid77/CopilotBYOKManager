# CopilotBYOKManager：已确认的领域模型与界面交接

> 状态更新：核心领域修正与界面简化已落实，后续 UX 收尾已提交为 `3791283`（2026-10-13）。本文保留已确认的设计决定；继续工作前先读 `docs/implementation-status.md`，不要把历史交接重放为尚未实现的任务。
> 交互参考原型：`prototype/copilot-byok-manager.html` 是已评审的视觉方向；当前交互行为以 `apps/desktop/web/`、实现规范与最新验证记录为准。
> 2026-10-14 更新：当前采用四页核心配置版 **总览 / 供应商 / 应用 / 关于**，不再采用下文历史五入口导航。隐藏功能、外观与 Windows 关闭至托盘的边界见 `docs/feature-availability.md`。本文历史原型不作为恢复隐藏页面的依据。

## 0. 先读

- `AGENTS.md`（分支策略、硬约束、检查命令、汇报格式）
- `docs/mvp-implementation-spec.md`、`docs/architecture.md`
- 现有实现：`apps/desktop/src-tauri/src/`（重点：`deployment/planner.rs`、`adapters/`）、`apps/desktop/web/`

## 1. 已确认的领域事实（实现依据，附证据）

### 1.1 VS Code / JetBrains / Copilot App 是多供应商共存，不是单活切换

- 这些客户端可同时配置多个供应商，用户**在客户端内的模型选择器**里选用模型。
- 因此「发布」= 在客户端**新增/更新一个供应商组**，保留其他来源；**发布 ≠ 被选中**。
- 证据：VS Code Language Models 编辑器按供应商分组（code.visualstudio.com/docs/agent-customization/language-models）；GitHub Copilot JetBrains 自定义端点公告（github.blog/changelog/2026-07-14-github-copilot-for-jetbrains-expands-byok-capabilities）。原引用的 JetBrains BYOK 文章介绍 AI Assistant，不是 GitHub Copilot 插件。
- 检查现有 planner/adapter 文案与逻辑，把"切换/替换"语义改为"新增/更新供应商组（保留其他来源）"。发布结果的引导语必须包含："请到客户端的模型选择器中选用刚发布的模型"。

### 1.2 本版 Copilot CLI 环境路由是单活排他

- 机制：用户环境变量 `COPILOT_PROVIDER_BASE_URL` / `COPILOT_PROVIDER_TYPE` / `COPILOT_PROVIDER_API_KEY`（或 `COPILOT_PROVIDER_BEARER_TOKEN`）/ `COPILOT_PROVIDER_WIRE_API` / `COPILOT_PROVIDER_HEADERS` + `COPILOT_MODEL`（必填）。
- 已在本机 `copilot help providers`（CLI 1.0.81-3）验证；与仓库现有的"用户环境变量激活"实现一致。
- 排他：自定义供应商生效期间 GitHub 官方模型路由不可用；**重启终端会话后生效**。预览中必须用醒目文案说明这两点。
- 发布目标中 CLI 默认不勾选，卡片提前说明排他范围；结果保留“新终端 + 新 CLI 会话”的下一步。这描述本版适配器，不代表当前 CLI 所有接口都不支持供应商共存。
- `~/.copilot/providers.json`：官方配置目录参考里提到（providers/models 键、优先于环境变量），但**无公开字段级 schema**，本版不使用，列为后续调研项。

### 1.3 JetBrains 是两层存储（2026-10-12 发布包复核修正）

- **供应商配置层共享**：已审核的 GitHub Copilot 1.19 语言服务器以 `byok` 命名空间保存供应商密钥、端点、协议及模型配置。Windows 默认目标为 `%USERPROFILE%\AppData\Local\github-copilot\byok.json`；绝对 `XDG_CONFIG_HOME` 可改变根路径。同一用户、同一配置根路径的 IDE 共用该文件，继续去重写入，不能改成逐 IDE 重复保存密钥。
- **IDE 偏好层独立**：各 IDE 的 `options/github-copilot.xml` 保存 `CopilotBYOKGroupNames`、`CopilotBYOKProviderLabels`、`CopilotModelEnabledState`、`CopilotContextWindows` 和 `CopilotReasoningEfforts` 等偏好。它不是完整供应商配置文件，也不证明每个 IDE 的 BYOK 端点互相隔离。
- 插件通过语言服务器的 `listCustomProviderConfigs` 获取供应商组名，并协调 IDE 本地分组。保留各 IDE 的官方登录、重启、模型可见性和请求验收，不把写入共享文件当作全部 IDE 已选用模型。
- 本轮**不读写真实 IDE XML、认证材料或对话**，不重置用户的启用/显示偏好。未知版本保持不支持。静态证据见 `docs/jetbrains-support.md`；隔离真机验收见 `docs/local-validation-plan.md` 的“JetBrains 隔离真机验收”章节。

### 1.4 Copilot App 保持手动边界（已调研定案）

- 结论：尚未建立已审核、可安全写入的 App 供应商配置接口。任何不透明私有存储均不作为自动写入目标；不通过读取真实凭据或数据库来补齐支持。
- UI 文案直接说明原因（"已调研：无可写的文档化配置目标，故保持手动"），不是模糊的"暂不支持"。
- 升级通道：若官方日后文档化 App 的 provider 配置，走 JetBrains 同款"已审核版本"门禁再开放自动写。

### 1.5 「默认模型」改为「首选模型」，语义分层

- CLI：首选模型发布时真实生效（写入 `COPILOT_MODEL`）。
- 选择器类客户端：仅为组内推荐顺序，不能替用户选中。UI 注明这一区别。

## 2. 已确认的界面方向

### 2.1 当前四页核心配置版（2026-10-14）

- 只显示总览、供应商、应用、关于。用量/账单、独立授权、资源和统一活动页不加载或查询，代码、数据和后台测试保留。
- 总览显示下一步、应用来源和供应商摘要；编辑与发布集中在供应商页。应用页每张卡片可明确选择供应商并预览单个目标，多供应商时不替用户选择；安装与账号详情折叠。
- 发布/撤销记录收进供应商与应用页，可展开；恢复提示在四页均可见。
- 外观提供浅色、深色、跟随系统，独立保存选择；仅改样式，不重建草稿或旧预览。关于可离线查看已规划未开放功能。
- Windows 托盘采用 CC Switch 式规则：默认关闭至托盘，在关于页可保存“直接退出”；左键打开主窗口，右键显示本语言的打开/退出菜单，重复启动唤回已有窗口。普通最小化仍进任务栏。仅在偏好可读、选择托盘、托盘可恢复且隐藏成功时保留后台运行；其他主窗口关闭使用正常退出流程，损坏偏好保留。真实托盘操作未通过验收，不能以编译或浏览器测试替代。

### 2.2 历史已确认方向（四页版取代导航与页面开放范围）

- 顶部细导航五个入口：**总览 / 连接 / 客户端 / 用量 / 更多**（资源·活动·设置收进"更多"）。
- 状态呈现：小圆点 + 一句话；健康项不染色；每个状态给原因与下一步。
- 总览页结构：无连接时先显示「添加第一个连接」，恢复阻塞优先；有连接时提供「选择连接并发布」快捷定位。其后保留待处理项（有才显示）→ 各客户端的模型来源（按客户端一行，来源标签 = 连接名·模型数，额外来源可展开）→ 连接卡（「发布到客户端」/「编辑」）→ 上次发布结果。核对定位到对应客户端，App 的手动指引绑定本次连接。
- 连接页：连接启用开关（停用不出现在总览）、测试连接按钮、模型目录**勾选即入同一个草稿，保存连接时一起保存**（无第二次添加、不会自动全加）、API Key 遮蔽且保存后不回显。更改端点使未保存目录勾选失效，原有和手动模型保留。
- 预览**页内展开**（非弹窗仪式）；预览/确认严格分离；连接或目标变更后旧预览失效需重新生成。
- 文案风格：短句；原则性说明只保留一处；删除重复解释。
- UX 收尾：弹窗焦点/键盘/未保存保护；保存失败保留输入并持续显示错误；异步回调绑定实际弹窗实例；发布中阻止离开、刷新或误取消，失败后重新预览，收起和完成都恢复到合理焦点。账号面板固定在客户端的账号区域；用量结果优先、完整汇总折叠在结果之后，官方与本地筛选分开，保留高级选项、模型建议、重置及固定模型/路由/来源列；会话详情先显示带标签的元数据。健康项保持中性色，重要状态字不小于 12px，空状态使用当前浅色主题。

Rider 真机操作已由维护者暂缓；不得把隔离浏览器或此前原生替身的通过结果当作 IDE 模型选择器/真实请求通过。代码与验收范围见 `docs/implementation-status.md`。

## 3. 明确不做（本次范围外）

- Visual Studio 客户端条目（已确认暂不做）。
- 「连接 × 客户端」发布矩阵首页（提出过但未确认，悬置）。
- 解析或写入 Copilot App 的任何私有存储。
- 读取客户端"当前选中模型"的私有状态（只引导用户自己去选择器选用）。
- AGENTS.md 范围边界里列出的全部排除项（企业账单、云同步、超额购买等）。

## 4. 必须保留的硬约束（AGENTS.md，复述关键点）

- preview/apply 分离；plan 原生持有、过期、一次性；写前重检目标指纹；全部目标准备好才开始写；journal/回滚数据先于变更持久化；外部修改的目标拒绝覆盖。
- 不复制客户端认证材料；API Key 存 OS 密钥库，不回显、不进日志/预览。
- 缺失/不可获取数据显示"不可用"而非零；官方金额与 API 等价估算分开、不相加；金额用十进制运算。
- 本地用量只存元数据，不存提示词/回答/代码/工具内容。

## 5. 交付要求

- 在 `main` 上直接提交（不开分支/PR），每个垂直切片后保持可构建。
- 完成后从仓库根运行：`npm run check:web`、`cargo fmt --all -- --check`、`cargo test --workspace`、`cargo clippy --workspace --all-targets -- -D warnings`、`git diff --check`。
- 按 AGENTS.md「Completion report format」汇报（Implemented / Security properties / Tests / Known blockers）。
