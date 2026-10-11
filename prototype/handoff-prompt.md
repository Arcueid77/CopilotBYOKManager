# 任务：应用已确认的 BYOK 管理器领域模型修正与界面简化

> 用途：交给本地 coding agent 执行。以下是产品评审中**已确认**的事实与设计决定，逐条落实。
> 交互参考原型：`prototype/copilot-byok-manager.html`（已通过评审的版本，以此为准的视觉/文案基准）。

## 0. 先读

- `AGENTS.md`（分支策略、硬约束、检查命令、汇报格式）
- `docs/mvp-implementation-spec.md`、`docs/architecture.md`
- 现有实现：`apps/desktop/src-tauri/src/`（重点：`deployment/planner.rs`、`adapters/`）、`apps/desktop/web/`

## 1. 已确认的领域事实（实现依据，附证据）

### 1.1 VS Code / JetBrains / Copilot App 是多供应商共存，不是单活切换

- 这些客户端可同时配置多个供应商，用户**在客户端内的模型选择器**里选用模型。
- 因此「发布」= 在客户端**新增/更新一个供应商组**，保留其他来源；**发布 ≠ 被选中**。
- 证据：VS Code Language Models 编辑器按供应商分组（code.visualstudio.com/docs/agent-customization/language-models）；JetBrains 2025-12 起 BYOK 支持多自定义供应商（blog.jetbrains.com/ai/2025/12/bring-your-own-key-byok-is-now-live-in-jetbrains-ides）。
- 检查现有 planner/adapter 文案与逻辑，把"切换/替换"语义改为"新增/更新供应商组（保留其他来源）"。发布结果的引导语必须包含："请到客户端的模型选择器中选用刚发布的模型"。

### 1.2 Copilot CLI 是单活排他

- 机制：用户环境变量 `COPILOT_PROVIDER_BASE_URL` / `COPILOT_PROVIDER_TYPE` / `COPILOT_PROVIDER_API_KEY`（或 `COPILOT_PROVIDER_BEARER_TOKEN`）/ `COPILOT_PROVIDER_WIRE_API` / `COPILOT_PROVIDER_HEADERS` + `COPILOT_MODEL`（必填）。
- 已在本机 `copilot help providers`（CLI 1.0.81-3）验证；与仓库现有的"用户环境变量激活"实现一致。
- 排他：自定义供应商生效期间 GitHub 官方模型路由不可用；**重启终端会话后生效**。预览中必须用醒目文案说明这两点。
- `~/.copilot/providers.json`：官方配置目录参考里提到（providers/models 键、优先于环境变量），但**无公开字段级 schema**，本版不使用，列为后续调研项。

### 1.3 JetBrains 每个 IDE 配置路径独立（纠正"共享文件"假设）

- 每个 IDE 自己的 options 目录：`%APPDATA%\JetBrains\<Product><Version>\options\github-copilot.xml`（本机实证：IntelliJ、PyCharmCE2023.3、PyCharmCE2024.1、Rider2026.1 各自独立 options 目录）。
- 跨 IDE 共享的只有 agent/认证层（`%LOCALAPPDATA%\github-copilot\`）。
- **检查并移除实现中"多个 JetBrains IDE 共享配置、写一次多处生效"的假设**；改为每个 IDE 独立写入、各自提示重启。

### 1.4 Copilot App 保持手动边界（已调研定案）

- 结论：App 的供应商配置无可写的文档化目标，位于不透明私有存储（`~/.copilot/data.db`）。强行写入违反项目红线（无文档格式、无校验、可能与凭据混存、无回滚路径）。
- UI 文案直接说明原因（"已调研：无可写的文档化配置目标，故保持手动"），不是模糊的"暂不支持"。
- 升级通道：若官方日后文档化 App 的 provider 配置，走 JetBrains 同款"已审核版本"门禁再开放自动写。

### 1.5 「默认模型」改为「首选模型」，语义分层

- CLI：首选模型发布时真实生效（写入 `COPILOT_MODEL`）。
- 选择器类客户端：仅为组内推荐顺序，不能替用户选中。UI 注明这一区别。

## 2. 已确认的界面方向

- 顶部细导航五个入口：**总览 / 连接 / 客户端 / 用量 / 更多**（资源·活动·设置收进"更多"）。
- 状态呈现：小圆点 + 一句话；健康项不染色；每个状态给原因与下一步。
- 总览页结构：待处理项（有才显示）→ 各客户端的模型来源（按客户端一行，来源标签 = 连接名·模型数）→ 连接卡（「发布到客户端」/「编辑」）→ 上次发布结果行。
- 连接页：连接启用开关（停用不出现在总览）、测试连接按钮、获取模型列表后**勾选添加**（不自动全加）、API Key 遮蔽且保存后不回显。
- 预览**页内展开**（非弹窗仪式）；预览/确认严格分离；连接或目标变更后旧预览失效需重新生成。
- 文案风格：短句；原则性说明只保留一处；删除重复解释。

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
