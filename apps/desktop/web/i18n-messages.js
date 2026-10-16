// UI-owned messages only. Values: [Simplified Chinese, English].
// Parameters are positional and are never translated or interpreted as messages.
(function (root, factory) {
  const messages = factory();
  if (typeof module === "object" && module.exports) module.exports = messages;
  else root.CopilotBYOKManagerMessages = messages;
})(globalThis, () => ({
  "供应商": ["供应商", "Providers"],
  "应用": ["应用", "Apps"],
  "外观": ["外观", "Appearance"],
  "跟随系统": ["跟随系统", "System"],
  "浅色": ["浅色", "Light"],
  "深色": ["深色", "Dark"],
  "关闭窗口时": ["关闭窗口时", "When closing the window"],
  "收起到系统托盘": ["收起到系统托盘", "Hide to system tray"],
  "退出程序": ["退出程序", "Exit the app"],
  "关闭窗口将退出程序。也可从托盘菜单退出；普通最小化仍留在任务栏。": ["关闭窗口将退出程序。也可从托盘菜单退出；普通最小化仍留在任务栏。", "Closing the window exits the app. You can also exit from the tray menu. Ordinary minimize stays on the taskbar."],
  "窗口偏好无法读取，原文件保留；本次关闭窗口将正常退出。请核对偏好文件后重新启动。": ["窗口偏好无法读取，原文件保留；本次关闭窗口将正常退出。请核对偏好文件后重新启动。", "Window preferences could not be read; the original file is retained. Closing exits normally this time. Check the preference file, then restart."],
  "关闭选项未保存，仍使用原选择。请刷新或重启后核对。": ["关闭选项未保存，仍使用原选择。请刷新或重启后核对。", "Close preference was not saved; the previous choice is unchanged. Refresh or restart to check it."],
  "托盘菜单语言未更新，窗口中的语言选择不受影响。": ["托盘菜单语言未更新，窗口中的语言选择不受影响。", "Tray menu language could not be updated. The window language is unchanged."],
  "外观偏好无法保存，本次选择仍然有效。": ["外观偏好无法保存，本次选择仍然有效。", "Appearance preference could not be saved. Your choice still works for this session."],
  "安全恢复": ["安全恢复", "Safe recovery"],
  "保留原文件，不自动重建。请按使用手册核对状态文件后重新启动。": ["保留原文件，不自动重建。请按使用手册核对状态文件后重新启动。", "Original files are retained, not rebuilt automatically. Check the state file using the manual, then restart."],
  "发布与撤销记录": ["发布与撤销记录", "Publication and revocation history"],
  "浏览器试用不提供系统托盘。": ["浏览器试用不提供系统托盘。", "System tray is unavailable in browser preview."],
  "关闭窗口收起到系统托盘；点击托盘图标恢复，右键菜单可退出。普通最小化仍留在任务栏。": ["关闭窗口收起到系统托盘；点击托盘图标恢复，右键菜单可退出。普通最小化仍留在任务栏。", "Closing the window hides it to the system tray. Left-click to open the main window, or right-click and choose Exit CopilotBYOKManager. Ordinary minimize stays on the taskbar."],
  "系统托盘不可用，关闭窗口将正常退出。": ["系统托盘不可用，关闭窗口将正常退出。", "System tray is unavailable. Closing the window exits normally."],
  "一次配置供应商，用于多个 Copilot 应用。": ["一次配置供应商，用于多个 Copilot 应用。", "Configure a provider once, reuse it across Copilot apps."],
  "核心配置版 · 预发布 · 0.1.0": ["核心配置版 · 预发布 · 0.1.0", "Core configuration edition · Pre-release · 0.1.0"],
  "界面与窗口": ["界面与窗口", "Appearance and window"],
  "未推出功能记录": ["未推出功能记录", "Planned feature status"],
  "用量、账单与共享资源暂未开放，已有数据保留。规划记录不承诺上线日期。": ["用量、账单与共享资源暂未开放，已有数据保留。规划记录不承诺上线日期。", "Usage, Billing and shared resources are not available in this edition. Existing data is retained. The feature record promises no release dates."],
  "本地存储与安全": ["本地存储与安全", "Local storage and security"],
  "供应商概况": ["供应商概况", "Provider summary"],
  "管理供应商": ["管理供应商", "Manage providers"],
  "{0} 个已启用，{1} 个已停用。配置与模型在供应商页管理。": ["{0} 个已启用，{1} 个已停用。配置与模型在供应商页管理。", "{0} enabled, {1} disabled. Manage configuration and models on Providers."],
  "使用供应商": ["使用供应商", "Provider to use"],
  "{0} 使用的供应商": ["{0} 使用的供应商", "Provider for {0}"],
  "请先添加供应商": ["请先添加供应商", "Add a provider first"],
  "预览配置": ["预览配置", "Preview configuration"],
  "手动配置": ["手动配置", "Manual setup"],
  "应用信息": ["应用信息", "App information"],
  "官方配额、模型目录和个人账单": ["官方配额、模型目录和个人账单", "Official quota, model catalogs and personal Billing"],
  "已有实现，入口暂未开放": ["已有实现，入口暂未开放", "Implemented, not available in this edition"],
  "本地用量、会话统计、归属和费用估算": ["本地用量、会话统计、归属和费用估算", "Local usage, sessions, attribution and estimates"],
  "MCP、Markdown Skills 和 Instructions": ["MCP、Markdown Skills 和 Instructions", "MCP, Markdown Skills and Instructions"],
  "已有实现，待真实应用消费验收": ["已有实现，待真实应用消费验收", "Implemented; real app consumption acceptance pending"],
  "独立统一活动页": ["独立统一活动页", "Standalone unified activity page"],
  "页面暂未开放，发布记录本版保留": ["页面暂未开放，发布记录本版保留", "Page hidden; publication history remains available"],
  "Copilot App 直接下载安装策略": ["Copilot App 直接下载安装策略", "Direct Copilot App installer download"],
  "已规划，尚未实现": ["已规划，尚未实现", "Planned, not implemented"],
  "正式签名 Windows 安装包": ["正式签名 Windows 安装包", "Signed Windows distribution package"],
  "待正式交付和干净 Windows 验收": ["待正式交付和干净 Windows 验收", "Final distribution and clean Windows acceptance pending"],
  "仅记录现有规划，不承诺上线日期；隐藏能力的数据和后端测试保留。": ["仅记录现有规划，不承诺上线日期；隐藏能力的数据和后端测试保留。", "Existing plans only, without promised dates. Hidden capabilities retain their data and backend tests."],
  "请选择供应商": ["请选择供应商", "Choose a provider"],
  "无法读取窗口设置，请刷新后重试。": ["无法读取窗口设置，请刷新后重试。", "Window settings could not be read. Refresh and try again."],
  "模型目录可访问。": [
    "模型目录可访问。",
    "Model catalog available."
  ],
  "本地用量按上方条件筛选。": [
    "本地用量按上方条件筛选。",
    "Local usage follows the filters above."
  ],
  "目录与本地观察的区别": ["目录与本地观察的区别", "Catalogs and local observations"],
  "已勾选 {0} 个新模型，保存连接时一起保存。": [
    "已勾选 {0} 个新模型，保存供应商时一起保存。",
    "{0} new models checked. Save provider saves them together."
  ],
  "获取供应商的模型列表，勾选需要的模型即可加入草稿。": [
    "获取供应商的模型列表，勾选需要的模型即可加入草稿。",
    "Fetch the provider's model list and select models to add to your draft."
  ],
  "端点设置已改变，目录勾选已清除；已配置和手动模型保留。": [
    "端点设置已改变，目录勾选已清除；已配置和手动模型保留。",
    "Endpoint settings changed. Catalog selections cleared; configured and manual models kept."
  ],
  "发布失败或结果不确定。上次预览不可重用，请核对活动与恢复状态，再重新预览。": [
    "发布失败或结果不确定。上次预览不可重用，请核对活动与恢复状态，再重新预览。",
    "Publication failed or the result is uncertain. The previous preview cannot be reused. Check activity and recovery status, then preview again."
  ],
  "另有 {0} 个来源": ["另有 {0} 个来源", "{0} more sources"],
  "查看 {0} 的手动配置步骤": ["查看 {0} 的手动配置步骤", "Manual setup for {0}"],
  "此客户端保持手动配置，请在 App 内添加本次连接。": [
    "此客户端保持手动配置，请在 App 内添加本次连接。",
    "This client requires manual setup. Add this connection inside the App."
  ],
  "配置一个供应商，用于多个 Copilot 客户端": [
    "配置一个供应商，用于多个 Copilot 应用", "One provider configuration, across Copilot apps"
  ],
  "先添加端点、密钥与模型，再选择你要使用的客户端并预览发布。": [
    "先添加端点、密钥与模型，再选择你要使用的应用并预览发布。",
    "Add an endpoint, key and models, then select the apps you use and preview publication."
  ],
  "添加第一个连接": ["添加第一个供应商", "Add your first provider"],
  "选择连接并发布": ["选择供应商并发布", "Choose a provider to publish"],
  "该连接已移除，请重新选择连接。": ["该连接已移除，请重新选择连接。", "This connection was removed. Choose another connection."],
  "本地 Token 汇总与覆盖范围": ["本地 Token 汇总与覆盖范围", "Local token totals and coverage"],
  "筛选仅影响本地观察，不改变官方额度或账单。": [
    "筛选仅影响本地观察，不改变官方额度或账单。", "Filters apply only to local observations, not official quota or Billing."
  ],
  "可左右滚动查看完整指标，模型、路由与来源固定；聚焦表格后也可用左右方向键。": [
    "可左右滚动查看完整指标，模型、路由与来源固定；聚焦表格后也可用左右方向键。",
    "Scroll horizontally for all metrics. Model, route and origin stay visible; focus the table to use the arrow keys."
  ],
  "模型 / 路由 / 来源": ["模型 / 路由 / 来源", "Model / route / origin"],
  "原始模型": ["原始模型", "Raw model"],
  "记录类型": ["记录类型", "Record type"],
  "观察时间": ["观察时间", "Observation time"],
  "价格快照": ["价格快照", "Price snapshot"],
  "查看完整元数据 JSON": ["查看完整元数据 JSON", "View full metadata JSON"],
  "帮助与反馈": ["帮助与反馈", "Help and feedback"],
  "英文使用手册": ["英文使用手册", "English user manual"],
  "中文使用手册": ["中文使用手册", "Chinese user manual"],
  "反馈问题": ["反馈问题", "Report an issue"],
  "反馈前请删除密钥、账号认证与对话内容。": [
    "反馈前请删除密钥、账号认证与对话内容。", "Remove keys, authentication material and conversation content before reporting an issue."
  ],
  "已停止核验，不关闭客户端窗口": [
    "已停止核验，不关闭客户端窗口",
    "Verification stopped; client windows remain open"
  ],
  "时间未知": [
    "时间未知",
    "Time unknown"
  ],
  "核验已过期": [
    "核验已过期",
    "Verification expired"
  ],
  "已取消": [
    "已取消",
    "Canceled"
  ],
  "账号冲突": [
    "账号冲突",
    "Account conflict"
  ],
  "CLI 账号已验证": [
    "CLI 账号已验证",
    "CLI account verified"
  ],
  "失败": [
    "失败",
    "Failed"
  ],
  "不支持": [
    "不支持",
    "Unsupported"
  ],
  "未安装": [
    "未安装",
    "Not installed"
  ],
  "需要操作": [
    "需要操作",
    "Action required"
  ],
  "已打开": [
    "已打开",
    "Opened"
  ],
  "待处理": [
    "待处理",
    "Pending"
  ],
  "已停止后续核验": [
    "已停止后续核验",
    "Further verification stopped"
  ],
  "已中断": [
    "已中断",
    "Interrupted"
  ],
  "已完成": [
    "已完成",
    "Completed"
  ],
  "部分完成": [
    "部分完成",
    "Partially completed"
  ],
  "进行中": [
    "进行中",
    "In progress"
  ],
  "未知": [
    "未知",
    "Unknown"
  ],
  "冲突": [
    "冲突",
    "Conflict"
  ],
  "推断，待确认": [
    "推断，待确认",
    "Inferred; confirmation needed"
  ],
  "已验证": [
    "已验证",
    "Verified"
  ],
  "登录流程结果": [
    "登录流程结果",
    "Sign-in flow results"
  ],
  "官方登录结果": [
    "官方登录结果",
    "Official sign-in results"
  ],
  "关闭": [
    "关闭",
    "Close"
  ],
  "刷新账号状态": [
    "刷新账号状态",
    "Refresh account status"
  ],
  "{0} 重试前请重新生成预览。": [
    "{0} 重试前请重新生成预览。",
    "{0} Generate a new preview before retrying."
  ],
  "登录步骤已准备，请逐个完成": [
    "登录步骤已准备，请逐个完成",
    "Sign-in steps are ready; complete them in each client"
  ],
  "准备中…": [
    "准备中…",
    "Preparing…"
  ],
  "不可用": [
    "不可用",
    "Unavailable"
  ],
  "将打开官方流程": [
    "将打开官方流程",
    "Will open the official flow"
  ],
  "指令": [
    "指令",
    "Instructions"
  ],
  "手动步骤": [
    "手动步骤",
    "Manual steps"
  ],
  "尚未验证": [
    "尚未验证",
    "Not yet verified"
  ],
  "尚未核验统一账号，请按下方步骤逐个确认。": [
    "尚未核验统一账号，请按下方步骤逐个确认。",
    "Account alignment is not verified. Check each client below."
  ],
  "请在每个客户端使用此账号。": [
    "请在每个客户端使用此账号。",
    "Use this account in every client."
  ],
  "我会在所选客户端逐个确认同一 github.com 账号。": [
    "我会在所选客户端逐个确认同一 github.com 账号。",
    "I will confirm the same github.com account in each selected client."
  ],
  "核对官方登录计划": [
    "核对官方登录计划",
    "Review official sign-in plan"
  ],
  "官方登录计划": [
    "官方登录计划",
    "Official sign-in plan"
  ],
  "核对登录步骤": [
    "核对登录步骤",
    "Review sign-in steps"
  ],
  "计划有效至 {0}，仅可使用一次；确认只提交原生计划 ID。": [
    "计划有效至 {0}，仅可使用一次；确认只提交原生计划 ID。",
    "Valid until {0}, for one use only. Confirmation submits only the native plan ID."
  ],
  "目标 github.com 账号": [
    "目标 github.com 账号",
    "Target github.com account"
  ],
  "取消": [
    "取消",
    "Cancel"
  ],
  "继续官方登录": [
    "继续官方登录",
    "Continue official sign-in"
  ],
  "请至少选择一个已安装的客户端": [
    "请至少选择一个已安装的客户端",
    "Select at least one installed client"
  ],
  "请先处理登录历史的只读恢复": [
    "请先处理登录历史的只读恢复",
    "Resolve read-only recovery for sign-in history first"
  ],
  "账号响应格式不受支持": [
    "账号响应格式不受支持",
    "Unsupported account response format"
  ],
  "账号状态已刷新": [
    "账号状态已刷新",
    "Account status refreshed"
  ],
  "不支持的账号试用操作：{0}": [
    "不支持的账号试用操作：{0}",
    "Unsupported account preview action: {0}"
  ],
  "没有可用的登录入口": [
    "没有可用的登录入口",
    "No sign-in entry point available"
  ],
  "仅模拟登录入口，未启动真实客户端": [
    "仅模拟登录入口，未启动真实客户端",
    "Simulated sign-in entry point; no real client was launched"
  ],
  "浏览器试用：已模拟打开登录入口": [
    "浏览器试用：已模拟打开登录入口",
    "Browser preview: simulated opening the sign-in page."
  ],
  "模拟登录计划缺失或已使用，请重新预览": [
    "模拟登录计划缺失或已使用，请重新预览",
    "Simulated sign-in plan is missing or consumed; preview again"
  ],
  "请先安装或修复此客户端，再完成官方登录": [
    "请先安装或修复此客户端，再完成官方登录",
    "Install or repair this client before official sign-in"
  ],
  "浏览器试用：仅模拟固定的官方登录入口": [
    "浏览器试用：仅模拟固定的官方登录入口",
    "Browser preview: simulates only the fixed official sign-in entry point"
  ],
  "打开 {0} 官方登录": [
    "打开 {0} 官方登录",
    "Open official sign-in for {0}"
  ],
  "观察到的 CLI 账号： {0} · github.com": [
    "观察到的 CLI 账号： {0} · github.com",
    "Observed CLI account: {0} · github.com"
  ],
  "无客户端": [
    "无客户端",
    "No client"
  ],
  "核验官方账号": [
    "核验官方账号",
    "Verify official account"
  ],
  "停止核验": [
    "停止核验",
    "Stop verification"
  ],
  "目标账号尚未验证": [
    "目标账号尚未验证",
    "Target account is not verified"
  ],
  "尚无登录记录。": [
    "尚无登录记录。",
    "No sign-in history yet."
  ],
  "最近登录记录": [
    "最近登录记录",
    "Recent sign-in history"
  ],
  "仅保存状态摘要，不保存登录凭据。": [
    "仅保存状态摘要，不保存登录凭据。",
    "Only status summaries are saved, never sign-in credentials."
  ],
  "身份尚未验证": [
    "身份尚未验证",
    "Identity is not verified"
  ],
  "依据": [
    "依据",
    "Evidence"
  ],
  "观察时间 {0}": [
    "观察时间 {0}",
    "Observed {0}"
  ],
  "尚无已验证的 github.com 账号": [
    "尚无已验证的 github.com 账号",
    "No verified github.com account yet"
  ],
  "目标账号尚不可核验，请检查官方登录。": [
    "目标账号尚不可核验，请检查官方登录。",
    "Cannot verify the target account yet. Check official sign-in."
  ],
  "用户 ID 不可用": [
    "用户 ID 不可用",
    "User ID unavailable"
  ],
  "GitHub 用户 ID {0}": [
    "GitHub 用户 ID {0}",
    "GitHub user ID {0}"
  ],
  "目标账号": [
    "目标账号",
    "Target account"
  ],
  "登录历史处于只读恢复": [
    "登录历史处于只读恢复",
    "Sign-in history is in read-only recovery"
  ],
  "刷新账号": [
    "刷新账号",
    "Refresh accounts"
  ],
  "检查中…": [
    "检查中…",
    "Checking…"
  ],
  "浏览器试用，不打开真实登录": [
    "浏览器试用，不打开真实登录",
    "Browser preview; does not open real sign-in"
  ],
  "本地账号观察与官方登录": [
    "本地账号观察与官方登录",
    "Local account observations and official sign-in"
  ],
  "读取账号状态中…": [
    "读取账号状态中…",
    "Reading account status…"
  ],
  "尚未读取账号状态，请刷新。": [
    "尚未读取账号状态，请刷新。",
    "Account status has not been read. Refresh to check."
  ],
  "账号核对": [
    "账号核对",
    "Account review"
  ],
  "通过官方流程登录": [
    "通过官方流程登录",
    "Sign in through official flows"
  ],
  "仅打开官方登录流程，不读取或复制客户端登录凭据。": [
    "仅打开官方登录流程，不读取或复制客户端登录凭据。",
    "Opens official sign-in flows only; never reads or copies client credentials."
  ],
  "查看官方登录步骤{0}": [
    "查看官方登录步骤{0}",
    "View official sign-in steps{0}"
  ],
  "账号观察摘要": [
    "账号观察摘要",
    "Account observations"
  ],
  "待核对": [
    "待核对",
    "Needs review"
  ],
  "个客户端": [
    "个客户端",
    "clients"
  ],
  "请先安装 App，再完成官方登录。": [
    "请先安装 App，再完成官方登录。",
    "Install the app first, then complete official sign-in."
  ],
  "浏览器试用：模拟未安装状态": [
    "浏览器试用：模拟未安装状态",
    "Browser preview: simulated missing installation"
  ],
  "请在 Copilot CLI 内使用 /user 核对所选账号。": [
    "请在 Copilot CLI 内使用 /user 核对所选账号。",
    "Use /user in Copilot CLI to check the selected account."
  ],
  "浏览器试用：模拟 GitHub CLI 身份推断": [
    "浏览器试用：模拟 GitHub CLI 身份推断",
    "Browser preview: simulated identity inferred from GitHub CLI"
  ],
  "请在 VS Code 官方账号界面中选择 github.com。": [
    "请在 VS Code 官方账号界面中选择 github.com。",
    "Select github.com in the official VS Code account UI."
  ],
  "浏览器试用：未检查 VS Code SecretStorage": [
    "浏览器试用：未检查 VS Code SecretStorage",
    "Browser preview: VS Code SecretStorage was not inspected"
  ],
  "仅为模拟数据；原生应用通过受限的 GitHub CLI 查询官方身份接口。": [
    "仅为模拟数据；原生应用通过受限的 GitHub CLI 查询官方身份接口。",
    "Simulated data only. The native app checks the official identity endpoint through a restricted GitHub CLI query."
  ],
  "浏览器试用：模拟 GitHub API 身份": [
    "浏览器试用：模拟 GitHub API 身份",
    "Browser preview: simulated GitHub API identity"
  ],
  "测试模型目录接口…": [
    "测试模型目录接口…",
    "Testing the model catalog endpoint…"
  ],
  "连接已停用，客户端配置仍保留。": [
    "连接已停用，客户端配置仍保留。",
    "Connection disabled; client configuration is retained."
  ],
  "连接已启用，尚未重新发布。": [
    "连接已启用，尚未重新发布。",
    "Connection enabled; not yet redeployed."
  ],
  "{0} 重试前请重新预览。": [
    "{0} 重试前请重新预览。",
    "{0} Preview again before retrying."
  ],
  "恢复已完成，请核对原审计记录": [
    "恢复已完成，请核对原审计记录",
    "Recovery completed; review the original audit records"
  ],
  "现有文件已保留，再次发布前请核对客户端": [
    "现有文件已保留，再次发布前请核对客户端",
    "Current files retained; check clients before deploying again"
  ],
  "核对保留现有文件…": [
    "核对保留现有文件…",
    "Review keeping current files…"
  ],
  "恢复": [
    "恢复",
    "Recover"
  ],
  "保留文件并结束恢复": [
    "保留文件并结束恢复",
    "Keep files and end recovery"
  ],
  "仅恢复没有外部改动的受管写入；再次发生外部改动时保留日志并停止恢复。": [
    "仅恢复没有外部改动的受管写入；再次发生外部改动时保留日志并停止恢复。",
    "Restores only managed writes without external changes. If files change again, recovery stops and retains the journal."
  ],
  "自动恢复已阻塞。处理受影响目标后重新预览，或另行核对保留现有文件。": [
    "自动恢复已阻塞。处理受影响目标后重新预览，或另行核对保留现有文件。",
    "Automatic recovery is blocked. Resolve affected targets and preview again, or separately review keeping current files."
  ],
  "审计已提交，仅清理完成的日志。": [
    "审计已提交，仅清理完成的日志。",
    "The audit is committed; only completed journals will be cleaned up."
  ],
  "记录了 {0} 个物理资源：{1} 个被外部修改，{2} 个无法定位，{3} 个无法安全读取。": [
    "记录了 {0} 个物理资源：{1} 个被外部修改，{2} 个无法定位，{3} 个无法安全读取。",
    "{0} physical resources recorded: {1} externally changed, {2} unlocatable, {3} cannot be read safely."
  ],
  "我已核对并同意执行此恢复操作。": [
    "我已核对并同意执行此恢复操作。",
    "I have reviewed and agree to this recovery operation."
  ],
  "保留全部 {0} 个记录中的资源，移除待恢复日志并解除发布写入阻塞。": [
    "保留全部 {0} 个记录中的资源，移除待恢复日志并解除发布写入阻塞。",
    "Keep all {0} recorded resources, remove the pending recovery journal, and unblock deployment writes."
  ],
  "此操作后，本软件将无法回滚尚未完成的变更。": [
    "此操作后，本软件将无法回滚尚未完成的变更。",
    "After this operation, the app cannot roll back unfinished changes."
  ],
  "再次发布前请核对客户端配置。": [
    "再次发布前请核对客户端配置。",
    "Check client configuration before deploying again."
  ],
  "我确认保留现有文件，并丢弃待恢复的回滚数据。": [
    "我确认保留现有文件，并丢弃待恢复的回滚数据。",
    "I confirm keeping current files and discarding pending rollback data."
  ],
  "核对中断后的恢复": [
    "核对中断后的恢复",
    "Review interrupted deployment recovery"
  ],
  "核对保留现有文件": [
    "核对保留现有文件",
    "Review keeping current files"
  ],
  "预览自动 BYOK": [
    "预览自动 BYOK",
    "Preview automatic BYOK"
  ],
  "我已完成手动配置": [
    "我已完成手动配置",
    "I completed manual setup"
  ],
  "未配置": [
    "未配置",
    "Not configured"
  ],
  "在 Copilot App 中打开": [
    "在 Copilot App 中打开",
    "In Copilot App, open"
  ],
  "设置。": [
    "设置。",
    "settings."
  ],
  "添加": [
    "添加",
    "Add"
  ],
  "，端点": [
    "，端点",
    ", endpoint"
  ],
  "，推荐模型": [
    "，推荐模型",
    ", recommended model"
  ],
  "。如需密钥，请在 App 内输入。": [
    "。如需密钥，请在 App 内输入。",
    ". Enter the key in the app if required."
  ],
  "在 App 内选择供应商和模型，并验证请求。": [
    "在 App 内选择供应商和模型，并验证请求。",
    "Select the provider and model in the app, then verify a request."
  ],
  "完成 App 内配置后，保存你的确认。": [
    "完成 App 内配置后，保存你的确认。",
    "Save your confirmation after completing setup in the app."
  ],
  "手动配置 Copilot App": [
    "手动配置 Copilot App",
    "Set up Copilot App manually"
  ],
  "保存我的确认": [
    "保存我的确认",
    "Save my confirmation"
  ],
  "核对每个客户端显示的账号后，保存你的确认。": [
    "核对每个客户端显示的账号后，保存你的确认。",
    "Check the account shown in each client, then save your confirmation."
  ],
  "GitHub 用户名": [
    "GitHub 用户名",
    "GitHub username"
  ],
  "github.com 用户名": [
    "github.com 用户名",
    "github.com username"
  ],
  "通过 GitHub 公开用户接口解析账号 ID，不需要账单授权。": [
    "通过 GitHub 公开用户接口解析账号 ID，不需要账单授权。",
    "Resolves the account ID through GitHub's public user API; no Billing authorization is needed."
  ],
  "我已逐个核对所有列出的客户端，包括每个检测到的 JetBrains IDE 配置，均显示同一个 github.com 账号。": [
    "我已逐个核对所有列出的客户端，包括每个检测到的 JetBrains IDE 配置，均显示同一个 github.com 账号。",
    "I checked every listed client, including each detected JetBrains IDE profile, and all show the same github.com account."
  ],
  "核对同一 GitHub 账号": [
    "核对同一 GitHub 账号",
    "Confirm the same GitHub account"
  ],
  "模拟 · ": [
    "模拟 · ",
    "Simulated · "
  ],
  "，{0} 个未自动处理": [
    "，{0} 个未自动处理",
    ", {0} not processed automatically"
  ],
  "，{0} 个失败": [
    "，{0} 个失败",
    ", {0} failed"
  ],
  "{0}{1} 个目标配置已写入{2}{3}。请核对下方结果与下一步。": [
    "{0}{1} 个目标配置已写入{2}{3}。请核对下方结果与下一步。",
    "{0}{1} target configurations written{2}{3}. Review the results and next steps below."
  ],
  "请先启用连接再发布。": [
    "请先启用连接再发布。",
    "Enable the connection before deploying."
  ],
  "只读恢复期间不能发布。": [
    "只读恢复期间不能发布。",
    "Deployment is blocked during read-only recovery."
  ],
  "预览撤销并删除": [
    "预览撤销并删除",
    "Preview revoke and delete"
  ],
  "受管配置已撤销，连接已删除": [
    "受管配置已撤销，连接已删除",
    "Managed configuration revoked and connection deleted"
  ],
  "撤销未完成，连接已保留。请查看活动记录或恢复状态。": [
    "撤销未完成，连接已保留。请查看活动记录或恢复状态。",
    "Revocation is incomplete; the connection was retained. Check activity or recovery status."
  ],
  "确认撤销并删除": [
    "确认撤销并删除",
    "Confirm revoke and delete"
  ],
  "没有受管目标记录，不删除客户端文件。": [
    "没有受管目标记录，不删除客户端文件。",
    "No managed targets recorded; no client files will be deleted."
  ],
  "已核验的受管目标：": [
    "已核验的受管目标：",
    "Verified managed targets:"
  ],
  "受管配置与连接一并删除。外部修改会使预览失效；凭据清理失败单独报告。": [
    "受管配置与连接一并删除。外部修改会使预览失效；凭据清理失败单独报告。",
    "Managed configuration and the connection will be removed together. External changes invalidate the preview; credential cleanup failures are reported separately."
  ],
  "仅停止管理…": [
    "仅停止管理…",
    "Stop managing only…"
  ],
  "已停止管理，客户端配置保留": [
    "已停止管理，客户端配置保留",
    "Management stopped; client configuration retained"
  ],
  "确认停止管理": [
    "确认停止管理",
    "Confirm stop managing"
  ],
  "客户端配置及其中已写入的密钥将保留。本软件删除受管证明、发布记录和专用凭据；确认后需自行管理。": [
    "客户端配置及其中已写入的密钥将保留。本软件删除受管证明、发布记录和专用凭据；确认后需自行管理。",
    "Client configuration and keys already written there will remain. The app removes ownership proofs, deployment records and its dedicated credential. You must manage the retained configuration yourself."
  ],
  "移除": [
    "移除",
    "Remove"
  ],
  "？撤销并删除仅移除有本软件受管证明的配置；仅停止管理会保留客户端配置及其中的密钥。": [
    "？撤销并删除仅移除有本软件受管证明的配置；仅停止管理会保留客户端配置及其中的密钥。",
    "? Revoke and delete removes only configuration with this app's ownership proof. Stop managing only retains client configuration and its keys."
  ],
  "移除连接": [
    "移除供应商",
    "Remove provider"
  ],
  "只读恢复期间不能修改连接": [
    "只读恢复期间不能修改连接",
    "Connections cannot be edited during read-only recovery"
  ],
  "模型行须包含模型 ID。": [
    "模型行须包含模型 ID。",
    "Each model row must include a model ID."
  ],
  "请至少添加一个模型。": [
    "请至少添加一个模型。",
    "Add at least one model."
  ],
  "名称过长，请缩短后重试。": [
    "名称过长，请缩短后重试。",
    "The name is too long. Shorten it and try again."
  ],
  "请填写连接名称。": [
    "请填写连接名称。",
    "Enter a connection name."
  ],
  "保存连接": [
    "保存供应商",
    "Save provider"
  ],
  "连接已保存，尚未发布到客户端。": [
    "连接已保存，尚未发布到客户端。",
    "Connection saved; not yet deployed to clients."
  ],
  "保存中…": [
    "保存中…",
    "Saving…"
  ],
  "请填写必填项，并检查端点地址格式。": [
    "请填写必填项，并检查端点地址格式。",
    "Complete required fields and check the endpoint URL format."
  ],
  "连接未保存。{0}": [
    "连接未保存。{0}",
    "Connection not saved. {0}"
  ],
  "允许匿名的端点可留空": [
    "允许匿名的端点可留空",
    "Leave blank if the endpoint allows anonymous access"
  ],
  "留空保留已存密钥，不回读原值": [
    "留空保留已存密钥，不回读原值",
    "Leave blank to retain the saved key; its value is never read back"
  ],
  "移除已保存的密钥": [
    "移除已保存的密钥",
    "Remove the saved key"
  ],
  "自定义": [
    "自定义",
    "Custom"
  ],
  "本地端点": [
    "本地端点",
    "Local endpoint"
  ],
  "OpenAI 兼容": [
    "OpenAI 兼容",
    "OpenAI-compatible"
  ],
  "名称": [
    "名称",
    "Name"
  ],
  "例如：我的供应商": [
    "例如：我的供应商",
    "For example: My provider"
  ],
  "端点地址": [
    "端点地址",
    "Endpoint URL"
  ],
  "填写供应商提供的接口基址，例如 https://api.example.com/v1。不同供应商的协议可在高级选项中核对。": [
    "填写供应商提供的接口基址，例如 https://api.example.com/v1。不同供应商的协议可在高级选项中核对。",
    "Enter the provider's API base URL, such as https://api.example.com/v1. Check its protocol under Advanced options."
  ],
  "API 密钥": [
    "API 密钥",
    "API key"
  ],
  "保存在系统凭据库，不写入连接配置文件。": [
    "保存在系统凭据库，不写入连接配置文件。",
    "Stored in the operating system credential store, not in the connection file."
  ],
  "获取模型目录": [
    "获取模型目录",
    "Discover model catalog"
  ],
  "获取模型": [
    "获取模型",
    "Fetch models"
  ],
  "筛选模型": [
    "筛选模型",
    "Filter models"
  ],
  "按模型名称或 ID 筛选": [
    "按模型名称或 ID 筛选",
    "Filter by model name or ID"
  ],
  "添加已选 (0)": [
    "添加已选 (0)",
    "Add selected (0)"
  ],
  "模型": [
    "模型",
    "Models"
  ],
  "每行一个模型：": [
    "每行一个模型：",
    "One model per line:"
  ],
  "上游模型 ID | 显示名称": [
    "上游模型 ID | 显示名称",
    "upstream-model-id | Display name"
  ],
  "，名称可省略。": [
    "，名称可省略。",
    "; the display name is optional."
  ],
  "首选模型": [
    "首选模型",
    "Preferred model"
  ],
  "CLI 写入 COPILOT_MODEL；其他客户端仅作本软件推荐，仍需在客户端选择。": [
    "CLI 写入 COPILOT_MODEL；其他客户端仅作本软件推荐，仍需在客户端选择。",
    "Writes COPILOT_MODEL for CLI. In other clients this is only a recommendation; select the model in the client."
  ],
  "高级选项：供应商类型、接口协议与请求头": [
    "高级选项：供应商类型、接口协议与请求头",
    "Advanced: provider type, protocol and headers"
  ],
  "供应商类型": [
    "供应商类型",
    "Provider type"
  ],
  "接口协议": [
    "接口协议",
    "API protocol"
  ],
  "按供应商文档选择；更改类型不会自动改写协议或端点。": [
    "按供应商文档选择；更改类型不会自动改写协议或端点。",
    "Follow your provider's documentation. Changing the type does not automatically change the protocol or endpoint."
  ],
  "请求头（可选）": [
    "请求头（可选）",
    "Headers (optional)"
  ],
  "每行一个请求头；用": [
    "每行一个请求头；用",
    "One header per line. Use"
  ],
  "引用密钥，不填写真实密钥值。": [
    "引用密钥，不填写真实密钥值。",
    "to reference the key; do not enter the actual key value."
  ],
  "添加连接": [
    "添加供应商",
    "Add provider"
  ],
  "编辑 {0}": [
    "编辑 {0}",
    "Edit {0}"
  ],
  "尚无连接": [
    "尚无供应商",
    "No providers yet"
  ],
  "添加供应商端点和模型，预览后发布到支持的客户端。": [
    "添加供应商端点和模型，预览后发布到支持的客户端。",
    "Add a provider endpoint and models, then preview deployment to supported clients."
  ],
  "未提供本地路径": [
    "未提供本地路径",
    "Local path not provided"
  ],
  "配置指引": [
    "配置指引",
    "Setup guide"
  ],
  "自动发布 BYOK": [
    "自动发布 BYOK",
    "Automatic BYOK deployment"
  ],
  "核对安全恢复": [
    "核对安全恢复",
    "Review safe recovery"
  ],
  "存储需要核对": [
    "存储需要核对",
    "Storage needs review"
  ],
  "用量数据库不可用： {0}": [
    "用量数据库不可用： {0}",
    "Usage database unavailable: {0}"
  ],
  "连接存储处于只读恢复： {0}": [
    "连接存储处于只读恢复： {0}",
    "Connection storage is in read-only recovery: {0}"
  ],
  "可用（格式 v{0}）": [
    "可用（格式 v{0}）",
    "Available (schema v{0})"
  ],
  "发布仅模拟，数据保留在当前标签页。": [
    "发布仅模拟，数据保留在当前标签页。",
    "Deployment is simulated; data stays in this tab."
  ],
  "配置写入须先预览并确认。": [
    "配置写入须先预览并确认。",
    "Configuration writes require preview and confirmation."
  ],
  "浏览器试用": [
    "浏览器试用",
    "Browser preview"
  ],
  "本地原生后端": [
    "本地原生后端",
    "Local native backend"
  ],
  "运行时": [
    "运行时",
    "Runtime"
  ],
  "只保存非敏感连接、发布记录和版本。": [
    "只保存非敏感连接、发布记录和版本。",
    "Stores only non-sensitive connections, deployment records and the version."
  ],
  "状态文件": [
    "状态文件",
    "State file"
  ],
  "状态版本高于当前程序时拒绝迁移。": [
    "状态版本高于当前程序时拒绝迁移。",
    "Migration is refused when the state version is newer than the app."
  ],
  "状态版本": [
    "状态版本",
    "State version"
  ],
  "状态文件已正常读取，可修改。": [
    "状态文件已正常读取，可修改。",
    "State loaded successfully; editing is available."
  ],
  "正常": [
    "正常",
    "Normal"
  ],
  "只读恢复": [
    "只读恢复",
    "Read-only recovery"
  ],
  "状态恢复": [
    "状态恢复",
    "State recovery"
  ],
  "未提供用量存储状态。": [
    "未提供用量存储状态。",
    "Usage storage status was not provided."
  ],
  "用量数据库": [
    "用量数据库",
    "Usage database"
  ],
  "状态查询不会返回密钥。": [
    "状态查询不会返回密钥。",
    "Status queries never return keys."
  ],
  "模拟密钥保存标记": [
    "模拟密钥保存标记",
    "Simulated saved-key flag"
  ],
  "系统凭据库": [
    "系统凭据库",
    "OS credential store"
  ],
  "凭据存储": [
    "凭据存储",
    "Credential storage"
  ],
  "可检测客户端，不读写私有供应商存储。": [
    "可检测客户端，不读写私有供应商存储。",
    "Detects the client without reading or writing its private provider store."
  ],
  "供应商仅手动配置": [
    "供应商仅手动配置",
    "Manual provider setup only"
  ],
  "尚无活动记录。": [
    "尚无活动记录。",
    "No activity yet."
  ],
  "核对": [
    "核对",
    "Review"
  ],
  "时间": [
    "时间",
    "Time"
  ],
  "操作": [
    "操作",
    "Action"
  ],
  "目标 / 来源": [
    "目标 / 来源",
    "Target / source"
  ],
  "状态": [
    "状态",
    "Status"
  ],
  "详情": [
    "详情",
    "Details"
  ],
  "下一步": [
    "下一步",
    "Next steps"
  ],
  "最近活动": [
    "最近活动",
    "Recent activity"
  ],
  "本地脱敏记录": [
    "本地脱敏记录",
    "Local redacted records"
  ],
  "导入 / 刷新": [
    "导入 / 刷新",
    "Import / refresh"
  ],
  "官方登录": [
    "官方登录",
    "Official sign-in"
  ],
  "安装": [
    "安装",
    "Install"
  ],
  "发布 / 回滚": [
    "发布 / 回滚",
    "Deploy / roll back"
  ],
  "Copilot App 供应商": [
    "Copilot App 供应商",
    "Copilot App provider"
  ],
  "查看手动配置步骤": [
    "查看手动配置步骤",
    "View manual setup steps"
  ],
  "安装与更新": [
    "安装与更新",
    "Installation and updates"
  ],
  "官方登录与账号核对": [
    "官方登录与账号核对",
    "Official sign-in and account review"
  ],
  "逐个核对同一 GitHub 账号": [
    "逐个核对同一 GitHub 账号",
    "Check the same GitHub account in every client"
  ],
  "最近配置操作": [
    "最近配置操作",
    "Recent configuration actions"
  ],
  "浏览器试用 · 示例数据 · 不修改电脑": [
    "浏览器试用 · 示例数据 · 不修改电脑",
    "Browser preview · sample data · no changes to your computer"
  ],
  "独立的 Copilot 配置管理工具，处于预发布阶段，与 GitHub 无隶属关系。": [
    "独立的 Copilot 配置管理工具，处于预发布阶段，与 GitHub 无隶属关系。",
    "An independent Copilot configuration manager, currently pre-release and not affiliated with GitHub."
  ],
  "配置保存在本地，登录凭据留在各官方客户端。": [
    "配置保存在本地，登录凭据留在各官方客户端。",
    "Configuration stays local; sign-in credentials stay in the official clients."
  ],
  "无法读取本地状态": [
    "无法读取本地状态",
    "Cannot read local state"
  ],
  "重试": [
    "重试",
    "Retry"
  ],
  "读取本地状态…": [
    "读取本地状态…",
    "Reading local state…"
  ],
  "不修改电脑": [
    "不修改电脑",
    "No changes to your computer"
  ],
  "写入前须预览确认": [
    "写入前须预览确认",
    "Preview and confirm before writing"
  ],
  "本地模式": [
    "本地模式",
    "Local mode"
  ],
  "未自动处理": [
    "未自动处理",
    "Not processed automatically"
  ],
  "需核对": [
    "需核对",
    "Needs review"
  ],
  "仅手动处理": [
    "仅手动处理",
    "Manual only"
  ],
  "可用": [
    "可用",
    "Available"
  ],
  "不改写未支持的客户端私有状态": [
    "不改写未支持的客户端私有状态",
    "Does not modify unsupported clients' private state"
  ],
  "模拟创建支持回滚的受管配置": [
    "模拟创建支持回滚的受管配置",
    "Simulates creating managed configuration with rollback support"
  ],
  "保留其他来源的配置": [
    "保留其他来源的配置",
    "Preserves configuration from other sources"
  ],
  "发布 {0} 个启用模型": [
    "发布 {0} 个启用模型",
    "Deploy {0} enabled models"
  ],
  "请在客户端供应商设置中手动配置": [
    "请在客户端供应商设置中手动配置",
    "Configure manually in the client's provider settings"
  ],
  "模拟更新 {0}": [
    "模拟更新 {0}",
    "Simulated update of {0}"
  ],
  "发布 {0} 到 {1}": [
    "发布 {0} 到 {1}",
    "Deploy {0} to {1}"
  ],
  "浏览器试用仅模拟此次发布，未写入客户端配置": [
    "浏览器试用仅模拟此次发布，未写入客户端配置",
    "Browser preview only simulates deployment; no client configuration was written"
  ],
  "模拟计划已变化，请重新预览": [
    "模拟计划已变化，请重新预览",
    "Simulated plan changed; preview again"
  ],
  "连接不存在": [
    "连接不存在",
    "Connection does not exist"
  ],
  "预览已过期或已使用，请重新预览": [
    "预览已过期或已使用，请重新预览",
    "Preview expired or consumed; preview again"
  ],
  "待处理预览过多，请关闭旧预览": [
    "待处理预览过多，请关闭旧预览",
    "Too many pending previews; close earlier previews"
  ],
  "发布目标不存在": [
    "发布目标不存在",
    "Deployment target does not exist"
  ],
  "请先启用连接再发布": [
    "请先启用连接再发布",
    "Enable the connection before deploying"
  ],
  "浏览器试用 has no native resource catalog": [
    "浏览器试用 has no native resource catalog",
    "Browser preview has no native resource catalog"
  ],
  "没有已审核的外部接口，不改写 App 私有状态或凭据存储": [
    "没有已审核的外部接口，不改写 App 私有状态或凭据存储",
    "No reviewed external interface; private app state and credential stores are not modified"
  ],
  "模拟检测结果；App 供应商需手动配置": [
    "模拟检测结果；App 供应商需手动配置",
    "Simulated detection; app providers require manual setup"
  ],
  "默认配置的模型目录（模拟）": [
    "默认配置的模型目录（模拟）",
    "Default profile model catalog (simulated)"
  ],
  "浏览器试用 has no native usage database": [
    "浏览器试用 has no native usage database",
    "Browser preview has no native usage database"
  ],
  "浏览器试用 — no filesystem access": [
    "浏览器试用 — no filesystem access",
    "Browser preview — no filesystem access"
  ],
  "本地存储、授权与恢复状态。": [
    "本地存储、授权与恢复状态。",
    "Local storage, authorization and recovery status."
  ],
  "设置": [
    "设置",
    "Settings"
  ],
  "本地操作记录，不含密钥或对话内容。": [
    "本地操作记录，不含密钥或对话内容。",
    "Local activity, without keys or conversation content."
  ],
  "活动记录": [
    "活动记录",
    "Activity"
  ],
  "关于": [
    "关于",
    "About"
  ],
  "通过已审核的公开配置发布 MCP、Skills 与 Instructions。": [
    "通过已审核的公开配置发布 MCP、Skills 与 Instructions。",
    "Deploy MCP, Skills and Instructions through reviewed public configuration."
  ],
  "资源": [
    "资源",
    "Resources"
  ],
  "官方配额、个人账单与本地记录，分别显示覆盖范围。": [
    "官方配额、个人账单与本地记录，分别显示覆盖范围。",
    "Official quota, personal Billing and local records, each with its own coverage."
  ],
  "用量": [
    "用量",
    "Usage"
  ],
  "安装、官方登录与发布能力，按客户端逐个核对。": [
    "检测应用，选择供应商，预览后应用配置。",
    "Check apps, choose a provider, then preview and apply configuration."
  ],
  "客户端": [
    "应用",
    "Apps"
  ],
  "端点、密钥与模型。停用连接不会删除客户端配置。": [
    "统一管理端点、密钥与模型。保存后可发布到多个应用。",
    "Manage endpoints, keys and models centrally. Save once, then publish to multiple apps."
  ],
  "连接": [
    "供应商",
    "Providers"
  ],
  "管理连接，预览后发布。": [
    "一次配置供应商，预览后发布到多个 Copilot 应用。",
    "Configure a provider once, preview and publish to multiple Copilot apps."
  ],
  "总览": [
    "总览",
    "Overview"
  ],
  "Preview the current selection before applying it": [
    "应用前请先预览当前选择",
    "Preview the current selection before applying it"
  ],
  "A deployment request is already in progress": [
    "已有发布请求正在进行",
    "A deployment request is already in progress"
  ],
  "账单能力未知": [
    "账单能力未知",
    "Billing capability unknown"
  ],
  "尚未核验账单能力": [
    "尚未核验账单能力",
    "Billing capability has not been checked"
  ],
  "账单能力核验未完成，请重试": [
    "账单能力核验未完成，请重试",
    "Billing capability check is incomplete; try again"
  ],
  "此账号未提供个人账单访问": [
    "此账号未提供个人账单访问",
    "Personal Billing access is not available for this account"
  ],
  "身份有效，但缺少 Plan read 权限": [
    "身份有效，但缺少 Plan read 权限",
    "Identity is valid, but Plan read permission is missing"
  ],
  "可读取高级请求账单": [
    "可读取高级请求账单",
    "Premium request Billing is readable"
  ],
  "未覆盖": [
    "未覆盖",
    "Not covered"
  ],
  "需要授权": [
    "需要授权",
    "Authorization required"
  ],
  "格式不受支持": [
    "格式不受支持",
    "Unsupported format"
  ],
  "凭据库不可用": [
    "凭据库不可用",
    "Credential store unavailable"
  ],
  "网络错误": [
    "网络错误",
    "Network error"
  ],
  "无权限": [
    "无权限",
    "Permission denied"
  ],
  "授权失效": [
    "授权失效",
    "Authorization expired or invalid"
  ],
  "缺失": [
    "缺失",
    "Missing"
  ],
  "授权已核验": [
    "授权已核验",
    "Authorization verified"
  ],
  "独立 GitHub 授权已清除": [
    "独立 GitHub 授权已清除",
    "Separate GitHub authorization cleared"
  ],
  "清除 GitHub 授权": [
    "清除 GitHub 授权",
    "Clear GitHub authorization"
  ],
  "清除独立 GitHub 授权": [
    "清除独立 GitHub 授权",
    "Clear separate GitHub authorization"
  ],
  "删除本软件的授权记录和专用凭据，不退出任何客户端账号。": [
    "删除本软件的授权记录和专用凭据，不退出任何客户端账号。",
    "Deletes this app's authorization record and dedicated credential; does not sign out any client."
  ],
  "确认清除授权": [
    "确认清除授权",
    "Confirm clearing authorization"
  ],
  "核验并保存": [
    "核验并保存",
    "Verify and save"
  ],
  "独立 GitHub 授权已保存": [
    "独立 GitHub 授权已保存",
    "Separate GitHub authorization saved"
  ],
  "核验中…": [
    "核验中…",
    "Verifying…"
  ],
  "独立 GitHub 授权": [
    "独立 GitHub 授权",
    "Separate GitHub authorization"
  ],
  "独立授权": [
    "独立授权",
    "Separate authorization"
  ],
  "授权本软件": [
    "授权本软件",
    "Authorize this app"
  ],
  "使用你自己的精细权限令牌，授予": [
    "使用你自己的精细权限令牌，授予",
    "Use your own fine-grained token with"
  ],
  "用户权限。先核验身份，再检查个人账单访问；令牌不写入 JSON。": [
    "用户权限。先核验身份，再检查个人账单访问；令牌不写入 JSON。",
    "user permission. Identity is verified first, followed by personal Billing access. The token is not written to JSON."
  ],
  "GitHub 精细权限令牌": [
    "GitHub 精细权限令牌",
    "GitHub fine-grained token"
  ],
  "更换失败不会覆盖原有效令牌。": [
    "更换失败不会覆盖原有效令牌。",
    "A failed replacement will not overwrite the existing valid token."
  ],
  "GitHub 授权响应格式不受支持": [
    "GitHub 授权响应格式不受支持",
    "Unsupported GitHub authorization response format"
  ],
  "GitHub 授权状态已刷新": [
    "GitHub 授权状态已刷新",
    "GitHub authorization status refreshed"
  ],
  "不支持的 GitHub 授权试用操作：{0}": [
    "不支持的 GitHub 授权试用操作：{0}",
    "Unsupported GitHub authorization preview action: {0}"
  ],
  "浏览器试用：没有独立 GitHub 授权": [
    "浏览器试用：没有独立 GitHub 授权",
    "Browser preview: no separate GitHub authorization"
  ],
  "读取个人账单前需要为本软件独立授权": [
    "读取个人账单前需要为本软件独立授权",
    "Authorize this app separately before reading personal Billing"
  ],
  "浏览器试用：仅模拟独立授权，令牌未保存": [
    "浏览器试用：仅模拟独立授权，令牌未保存",
    "Browser preview: separate authorization is simulated; the token was not saved"
  ],
  "浏览器试用：仅模拟个人高级请求账单访问": [
    "浏览器试用：仅模拟个人高级请求账单访问",
    "Browser preview: simulated personal premium request Billing access"
  ],
  "令牌须为单行，且首尾没有空格": [
    "令牌须为单行，且首尾没有空格",
    "The token must be one line with no leading or trailing spaces"
  ],
  "凭据清理需要核对": [
    "凭据清理需要核对",
    "Credential cleanup needs review"
  ],
  "重新核验": [
    "重新核验",
    "Verify again"
  ],
  "更换授权": [
    "更换授权",
    "Replace authorization"
  ],
  "读取独立授权中…": [
    "读取独立授权中…",
    "Reading separate authorization…"
  ],
  "尚未读取授权状态，请刷新。": [
    "尚未读取授权状态，请刷新。",
    "Authorization status has not been read. Refresh to check."
  ],
  "未授权": [
    "未授权",
    "Not authorized"
  ],
  "尚未核验": [
    "尚未核验",
    "Not yet checked"
  ],
  "核验时间 {0}": [
    "核验时间 {0}",
    "Verified {0}"
  ],
  "未提供": [
    "未提供",
    "Not provided"
  ],
  "已核验身份": [
    "已核验身份",
    "Verified identity"
  ],
  "个人账单访问能力": [
    "个人账单访问能力",
    "Personal Billing access"
  ],
  "高级请求账单需要精细权限令牌，用户权限为": [
    "高级请求账单需要精细权限令牌，用户权限为",
    "Premium request Billing requires a fine-grained token with the user permission"
  ],
  "返回的 OAuth 权限": [
    "返回的 OAuth 权限",
    "Returned OAuth scopes"
  ],
  "精细权限令牌可能不返回权限列表，以账单接口核验结果为准。": [
    "精细权限令牌可能不返回权限列表，以账单接口核验结果为准。",
    "Fine-grained tokens may not return a scope list; use the Billing endpoint verification result."
  ],
  "本软件独立授权": [
    "本软件独立授权",
    "This app's separate authorization"
  ],
  "GitHub 个人账单授权": [
    "GitHub 个人账单授权",
    "GitHub personal Billing authorization"
  ],
  "独立于客户端登录。令牌保存在系统凭据库，界面不回读。": [
    "独立于客户端登录。令牌保存在系统凭据库，界面不回读。",
    "Separate from client sign-in. The token stays in the OS credential store and is never read back to the UI."
  ],
  "清除": [
    "清除",
    "Clear"
  ],
  "安全边界": [
    "安全边界",
    "Security boundary"
  ],
  "不读取客户端凭据。更换授权失败时保留原有效授权。": [
    "不读取客户端凭据。更换授权失败时保留原有效授权。",
    "Does not read client credentials. A failed authorization replacement retains the existing valid authorization."
  ],
  "上次预览不可重用，请重新预览后再确认。": [
    "上次预览不可重用，请重新预览后再确认。",
    "The previous preview cannot be reused. Preview again before confirming."
  ],
  "无法生成预览，请核对后重试。": [
    "无法生成预览，请核对后重试。",
    "Cannot generate a preview. Review the configuration and retry."
  ],
  "需手动处理": [
    "需手动处理",
    "Manual action required"
  ],
  "自动写入": [
    "自动写入",
    "Automatic write"
  ],
  "空模型目录：将移除本连接的供应商分组。": [
    "空模型目录：将移除本连接的供应商分组。",
    "Empty model catalog: this connection's provider group will be removed."
  ],
  "写入明细": [
    "写入明细",
    "Write details"
  ],
  "正在核对目标和写入计划…": [
    "正在核对目标和写入计划…",
    "Checking targets and planned writes…"
  ],
  "请至少选择一个目标。": [
    "请至少选择一个目标。",
    "Select at least one target."
  ],
  "目标已改变，请重新生成预览。": [
    "目标已改变，请重新生成预览。",
    "Targets changed; generate a new preview."
  ],
  "模拟发布，不修改客户端": [
    "模拟发布，不修改客户端",
    "Simulated deployment; clients are not modified"
  ],
  "可自动发布": [
    "可自动发布",
    "Automatic deployment supported"
  ],
  "未检测到": [
    "未检测到",
    "Not detected"
  ],
  "单一路由：启用 BYOK 期间不走 GitHub 官方模型；需新开终端和 CLI 会话。请主动勾选。": [
    "单一路由：启用 BYOK 期间不走 GitHub 官方模型；需新开终端和 CLI 会话。请主动勾选。",
    "Single route: while BYOK is active, CLI does not use GitHub's official models. Open a new terminal and CLI session. Select this target explicitly."
  ],
  "发布 {0}": [
    "发布 {0}",
    "Deploy {0}"
  ],
  "收起": [
    "收起",
    "Collapse"
  ],
  "选择目标，生成预览，再确认写入。预览 15 分钟内有效，只能使用一次。": [
    "选择目标，生成预览，再确认写入。预览 15 分钟内有效，只能使用一次。",
    "Select targets, generate a preview, then confirm writes. Previews expire after 15 minutes and can be used only once."
  ],
  "尚未生成预览。": [
    "尚未生成预览。",
    "No preview generated yet."
  ],
  "生成预览": [
    "生成预览",
    "Generate preview"
  ],
  "确认发布": [
    "确认发布",
    "Confirm deployment"
  ],
  "发布预览": [
    "发布预览",
    "Deployment preview"
  ],
  "此任务已经结束": [
    "此任务已经结束",
    "This task has already ended"
  ],
  "已请求取消，已完成的安装保留": [
    "已请求取消，已完成的安装保留",
    "Cancellation requested; completed installations are retained"
  ],
  "安装结果": [
    "安装结果",
    "Installation results"
  ],
  "安装后重新检测": [
    "安装后重新检测",
    "Detect again after installation"
  ],
  "完成": [
    "完成",
    "Done"
  ],
  "所选组件已重新检测并确认就绪": [
    "所选组件已重新检测并确认就绪",
    "Selected components were detected again and verified ready"
  ],
  "安装已结束，仍有项目需要核对": [
    "安装已结束，仍有项目需要核对",
    "Installation ended; some items still need review"
  ],
  "已请求取消，结束后将重新检测": [
    "已请求取消，结束后将重新检测",
    "Cancellation requested; detection will run when the process ends"
  ],
  "取消安装": [
    "取消安装",
    "Cancel installation"
  ],
  "正在处理 {0}": [
    "正在处理 {0}",
    "Processing {0}"
  ],
  "安装中…": [
    "安装中…",
    "Installing…"
  ],
  "核对安装计划": [
    "核对安装计划",
    "Review installation plan"
  ],
  "核对变更": [
    "核对变更",
    "Review changes"
  ],
  "安全说明": [
    "安全说明",
    "Security notes"
  ],
  "安装来源由原生后端固定。计划有效至 {0}，仅可使用一次。": [
    "安装来源由原生后端固定。计划有效至 {0}，仅可使用一次。",
    "Installation sources are fixed by the native backend. This plan expires at {0} and can be used only once."
  ],
  "确认安装并核验": [
    "确认安装并核验",
    "Confirm installation and verify"
  ],
  "所选组件已就绪，不执行安装。": [
    "所选组件已就绪，不执行安装。",
    "Selected components are ready; no installation will run."
  ],
  "当前兼容扩展": [
    "当前兼容扩展",
    "Current compatible extension"
  ],
  "当前用户操作": [
    "当前用户操作",
    "Current-user operation"
  ],
  "可能需要管理员确认": [
    "可能需要管理员确认",
    "Administrator approval may be required"
  ],
  "安装状态已刷新": [
    "安装状态已刷新",
    "Installation status refreshed"
  ],
  "安装检测响应格式不受支持": [
    "安装检测响应格式不受支持",
    "Unsupported installation detection response format"
  ],
  "不支持的安装试用操作：{0}": [
    "不支持的安装试用操作：{0}",
    "Unsupported installation preview action: {0}"
  ],
  "浏览器试用：仅模拟核验结果，未启动真实进程": [
    "浏览器试用：仅模拟核验结果，未启动真实进程",
    "Browser preview: simulated verification only; no real process was started"
  ],
  "浏览器试用：模拟安装完成，未启动安装程序": [
    "浏览器试用：模拟安装完成，未启动安装程序",
    "Browser preview: simulated completion; no installer was started"
  ],
  "浏览器试用仅模拟；真实安装命令及参数由原生后端生成": [
    "浏览器试用仅模拟；真实安装命令及参数由原生后端生成",
    "Browser preview is simulated; real installation commands and arguments are generated by the native backend"
  ],
  "模拟白名单：{0}": [
    "模拟白名单：{0}",
    "Simulated allowlist: {0}"
  ],
  "上次安装": [
    "上次安装",
    "Last installation"
  ],
  "计划 {0}": [
    "计划 {0}",
    "Plan {0}"
  ],
  "完成 ·": [
    "完成 ·",
    "Completed ·"
  ],
  "版本不可用": [
    "版本不可用",
    "Version unavailable"
  ],
  "版本 {0}": [
    "版本 {0}",
    "Version {0}"
  ],
  "修复": [
    "修复",
    "Repair"
  ],
  "刷新状态": [
    "刷新状态",
    "Refresh status"
  ],
  "浏览器试用，不执行安装": [
    "浏览器试用，不执行安装",
    "Browser preview; no installation"
  ],
  "支持的 Windows 组件可审核安装": [
    "支持的 Windows 组件可审核安装",
    "Reviewed installation for supported Windows components"
  ],
  "检测组件中…": [
    "检测组件中…",
    "Detecting components…"
  ],
  "尚未读取组件状态，请刷新。": [
    "尚未读取组件状态，请刷新。",
    "Component status has not been read. Refresh to check."
  ],
  "取消任务": [
    "取消任务",
    "Cancel task"
  ],
  "安装 {0}": [
    "安装 {0}",
    "Install {0}"
  ],
  "环境安装": [
    "环境安装",
    "Environment setup"
  ],
  "安装并核验客户端": [
    "安装并核验客户端",
    "Install and verify clients"
  ],
  "先核对安装计划，再确认执行；安装来源由本地后端固定。": [
    "先核对安装计划，再确认执行；安装来源由本地后端固定。",
    "Review the installation plan before confirming. Installation sources are fixed by the local backend."
  ],
  "安装缺失组件{0}": [
    "安装缺失组件{0}",
    "Install missing components{0}"
  ],
  "安装摘要": [
    "安装摘要",
    "Installation summary"
  ],
  "已就绪": [
    "已就绪",
    "Ready"
  ],
  "已超时，需重新检测": [
    "已超时，需重新检测",
    "Timed out; detect again"
  ],
  "已取消，需重新检测": [
    "已取消，需重新检测",
    "Canceled; detect again"
  ],
  "依赖不可用": [
    "依赖不可用",
    "Dependency unavailable"
  ],
  "已就绪，无需安装": [
    "已就绪，无需安装",
    "Already ready; installation not needed"
  ],
  "安装后核验失败": [
    "安装后核验失败",
    "Post-install verification failed"
  ],
  "安装后已核验": [
    "安装后已核验",
    "Verified after installation"
  ],
  "管理员确认被拒绝": [
    "管理员确认被拒绝",
    "Administrator approval denied"
  ],
  "已结束，请核对各组件": [
    "已结束，请核对各组件",
    "Ended; review each component"
  ],
  "安装中": [
    "安装中",
    "Installing"
  ],
  "检测不可用": [
    "检测不可用",
    "Detection unavailable"
  ],
  "需要修复": [
    "需要修复",
    "Repair needed"
  ],
  "浏览器试用：模拟缺失组件": [
    "浏览器试用：模拟缺失组件",
    "Browser preview: simulated missing component"
  ],
  "浏览器试用：模拟已安装扩展": [
    "浏览器试用：模拟已安装扩展",
    "Browser preview: simulated installed extension"
  ],
  "GitHub Copilot 扩展": [
    "GitHub Copilot 扩展",
    "GitHub Copilot extension"
  ],
  "浏览器试用：模拟已安装组件": [
    "浏览器试用：模拟已安装组件",
    "Browser preview: simulated installed component"
  ],
  "仅检测标准 IDE 目录；自定义与便携路径需手动核对。": [
    "仅检测标准 IDE 目录；自定义与便携路径需手动核对。",
    "Only standard IDE directories are detected. Check custom and portable paths manually."
  ],
  "自动写入需要已审核插件版本、已保存密钥和兼容端点。请核对下方原因。": [
    "自动写入需要已审核插件版本、已保存密钥和兼容端点。请核对下方原因。",
    "Automatic writes require a reviewed plugin version, saved key and compatible endpoint. Review the reasons below."
  ],
  "可自动发布 BYOK。": [
    "可自动发布 BYOK。",
    "Automatic BYOK deployment is supported."
  ],
  "相同配置根路径的 IDE 共用": [
    "相同配置根路径的 IDE 共用",
    "IDEs with the same configuration root share"
  ],
  "，只写一次并保留其他供应商。": [
    "，只写一次并保留其他供应商。",
    "; written once, preserving other providers."
  ],
  "在": [
    "在",
    "In"
  ],
  "中安装或启用 GitHub 发布的": [
    "中安装或启用 GitHub 发布的",
    ", install or enable the GitHub-published"
  ],
  "通过": [
    "通过",
    "Use"
  ],
  "完成官方登录，逐个核对 IDE 账号。": [
    "完成官方登录，逐个核对 IDE 账号。",
    "to complete official sign-in, checking each IDE's account."
  ],
  "打开": [
    "打开",
    "Open"
  ],
  "，添加供应商或 OpenAI 兼容端点；密钥只在客户端中输入。": [
    "，添加供应商或 OpenAI 兼容端点；密钥只在客户端中输入。",
    ", then add a provider or OpenAI-compatible endpoint. Enter the key only in the client."
  ],
  "保存并启用模型，在 Chat 中选用后验证请求。": [
    "保存并启用模型，在 Chat 中选用后验证请求。",
    "Save and enable models, select one in Chat, then verify a request."
  ],
  "关闭使用同一配置根路径的 IDE。": [
    "关闭使用同一配置根路径的 IDE。",
    "Close IDEs that share the configuration root."
  ],
  "选择": [
    "选择",
    "Select"
  ],
  "，核对目标和模型，再确认发布。": [
    "，核对目标和模型，再确认发布。",
    ", review targets and models, then confirm deployment."
  ],
  "本软件自动写入密钥、端点和模型配置，无需在 Manage Models 中重新输入。": [
    "本软件自动写入密钥、端点和模型配置，无需在 Manage Models 中重新输入。",
    "The app writes the key, endpoint and model configuration automatically; no re-entry in Manage Models is needed."
  ],
  "重新打开 IDE，在": [
    "重新打开 IDE，在",
    "Reopen the IDE and use"
  ],
  "中选用模型，再验证请求。": [
    "中选用模型，再验证请求。",
    "to select a model, then verify a request."
  ],
  "请先添加连接，再核对端点和模型。": [
    "请先添加连接，再核对端点和模型。",
    "Add a connection first, then review the endpoint and models."
  ],
  "模型：": [
    "模型：",
    "Models:"
  ],
  "请仅在 IDE 中配置其界面支持的字段。": [
    "请仅在 IDE 中配置其界面支持的字段。",
    "Configure only fields supported by the IDE's UI."
  ],
  "确认发布后仅在原生 BYOK 配置中写入。": [
    "确认发布后仅在原生 BYOK 配置中写入。",
    "Written only to the native BYOK configuration after confirming deployment."
  ],
  "不显示请求头值；{0}": [
    "不显示请求头值；{0}",
    "Header values are not displayed; {0}"
  ],
  "连接：{0}": [
    "连接：{0}",
    "Connection: {0}"
  ],
  "端点：": [
    "端点：",
    "Endpoint:"
  ],
  "· 协议：": [
    "· 协议：",
    "· Protocol:"
  ],
  "不支持自动写入": [
    "不支持自动写入",
    "Automatic writes unsupported"
  ],
  "支持自动发布": [
    "支持自动发布",
    "Automatic deployment supported"
  ],
  "原生写入明细 · {0}": [
    "原生写入明细 · {0}",
    "Native write details · {0}"
  ],
  "目标观察与诊断": [
    "目标观察与诊断",
    "Target observations and diagnostics"
  ],
  "每个 IDE 的分组、显示名称和模型启用偏好保存在独立 XML 中，本软件不改写它们。组织策略或已有偏好可能影响模型可见性。": [
    "每个 IDE 的分组、显示名称和模型启用偏好保存在独立 XML 中，本软件不改写它们。组织策略或已有偏好可能影响模型可见性。",
    "Each IDE stores its groups, display names and model enablement preferences in separate XML. This app does not change them. Organization policies or existing preferences may affect model visibility."
  ],
  "安全边界与登录": [
    "安全边界与登录",
    "Security boundary and sign-in"
  ],
  "查看指引不写入配置、不显示密钥。支持的自动部署在确认发布后，会在专用 BYOK 文件和私有回滚数据中保存供应商密钥。": [
    "查看指引不写入配置、不显示密钥。支持的自动部署在确认发布后，会在专用 BYOK 文件和私有回滚数据中保存供应商密钥。",
    "Viewing this guide writes no configuration and displays no keys. After confirmation, supported automatic deployments store the provider key in the dedicated BYOK file and private rollback data."
  ],
  "请在每个 IDE 中通过 Tools > GitHub Copilot > Login to GitHub 登录并核对账号。": [
    "请在每个 IDE 中通过 Tools > GitHub Copilot > Login to GitHub 登录并核对账号。",
    "In each IDE, sign in through Tools > GitHub Copilot > Login to GitHub and check the account."
  ],
  "官方插件": [
    "官方插件",
    "Official plugin"
  ],
  "官方自定义端点说明": [
    "官方自定义端点说明",
    "Official custom endpoint guide"
  ],
  "浏览器试用 · 示例数据 · 发布仅为模拟，不修改电脑": [
    "浏览器试用 · 示例数据 · 发布仅为模拟，不修改电脑",
    "Browser preview · sample data · simulated deployment only; no changes to your computer"
  ],
  "管理供应商并发布到应用": [
    "管理供应商并发布到应用",
    "Manage providers and publish to apps"
  ],
  "有事项需要核对": [
    "有事项需要核对",
    "Some items need review"
  ],
  "添加端点和模型，预览后再发布。": [
    "添加端点和模型，预览后再发布。",
    "Add an endpoint and models, then preview before deploying."
  ],
  "客户端模型来源": [
    "应用配置状态",
    "App configuration status"
  ],
  "客户端管理": [
    "管理应用",
    "Manage apps"
  ],
  "＋ 添加连接": [
    "＋ 添加供应商",
    "＋ Add provider"
  ],
  "最近一次发布": [
    "最近一次发布",
    "Latest deployment"
  ],
  "请到客户端的模型选择器中选用刚发布的模型。": [
    "请到客户端的模型选择器中选用刚发布的模型。",
    "Select the newly deployed model in the client's model picker."
  ],
  "请先重启此 IDE，再到客户端的模型选择器中选用刚发布的模型。": [
    "请先重启此 IDE，再到客户端的模型选择器中选用刚发布的模型。",
    "Restart this IDE, then select the newly deployed model in its model picker."
  ],
  "请新开终端和 CLI 会话，并核对实际选用的首选模型。": [
    "请新开终端和 CLI 会话，并核对实际选用的首选模型。",
    "Open a new terminal and CLI session, then verify the preferred model actually in use."
  ],
  "此客户端保持手动配置，请到客户端页查看步骤。": [
    "此客户端保持手动配置，请到客户端页查看步骤。",
    "This client requires manual configuration. See the steps on the Clients page."
  ],
  " · {0} 个未自动处理": [
    " · {0} 个未自动处理",
    " · {0} not processed automatically"
  ],
  " · {0} 个失败": [
    " · {0} 个失败",
    " · {0} failed"
  ],
  "目标未知": [
    "目标未知",
    "Unknown target"
  ],
  "状态需核对": [
    "状态需核对",
    "Status needs review"
  ],
  "操作明细": [
    "操作明细",
    "Operation details"
  ],
  "{0}{1} · {2} 个目标配置已处理{3}{4}": [
    "{0}{1} · {2} 个目标配置已处理{3}{4}",
    "{0}{1} · {2} target configurations processed{3}{4}"
  ],
  "查看记录": [
    "查看记录",
    "View history"
  ],
  "处理中": [
    "处理中",
    "Processing"
  ],
  "已准备": [
    "已准备",
    "Prepared"
  ],
  "已中断，待恢复": [
    "已中断，待恢复",
    "Interrupted; recovery pending"
  ],
  "已回滚": [
    "已回滚",
    "Rolled back"
  ],
  "失败，请核对": [
    "失败，请核对",
    "Failed; review required"
  ],
  "配置变更已应用": [
    "配置变更已应用",
    "Configuration changes applied"
  ],
  "尚无发布记录": [
    "尚无发布记录",
    "No deployment history yet"
  ],
  "核对来源": [
    "核对来源",
    "Review sources"
  ],
  "有已发布来源发生变化或无法核验，请先核对客户端。": [
    "有已发布来源发生变化或无法核验，请先核对客户端。",
    "Some deployed sources changed or cannot be verified. Check the clients first."
  ],
  "管理连接": [
    "管理供应商",
    "Manage providers"
  ],
  "没有启用的连接，请添加连接或到连接页重新启用。": [
    "没有启用的连接，请添加连接或到连接页重新启用。",
    "No enabled connections. Add one or enable an existing connection on the Connections page."
  ],
  "核对账号": [
    "核对账号",
    "Review accounts"
  ],
  "客户端账号尚未对齐，请完成官方登录并逐个核对。": [
    "客户端账号尚未对齐，请完成官方登录并逐个核对。",
    "Client accounts are not aligned. Complete official sign-in and check each client."
  ],
  "核对客户端": [
    "核对客户端",
    "Review clients"
  ],
  "部分组件状态未知，请重新检测。": [
    "部分组件状态未知，请重新检测。",
    "Some component states are unknown. Scan again."
  ],
  "查看安装计划": [
    "查看安装计划",
    "View installation plan"
  ],
  "有 {0} 个组件需要安装或修复。": [
    "有 {0} 个组件需要安装或修复。",
    "{0} components need installation or repair."
  ],
  "环境状态无法完整读取，需要核对客户端。": [
    "环境状态无法完整读取，需要核对客户端。",
    "Environment status could not be fully read. Review clients."
  ],
  "核对恢复": [
    "核对恢复",
    "Review recovery"
  ],
  "上次发布中断，请先核对恢复，再进行新的写入。": [
    "上次发布中断，请先核对恢复，再进行新的写入。",
    "The last deployment was interrupted. Review recovery before any new writes."
  ],
  "查看恢复状态": [
    "查看恢复状态",
    "View recovery status"
  ],
  "连接存储进入只读恢复，暂不能修改或发布。": [
    "连接存储进入只读恢复，暂不能修改或发布。",
    "Connection storage is in read-only recovery; editing and deployment are unavailable."
  ],
  "单一环境路由": [
    "单一环境路由",
    "Single environment route"
  ],
  "已移除的连接": [
    "已移除的连接",
    "Removed connection"
  ],
  " · 已停用，配置保留": [
    " · 已停用，配置保留",
    " · Disabled; configuration retained"
  ],
  "无法核验": [
    "无法核验",
    "Cannot verify"
  ],
  "外部改动，待核对": [
    "外部改动，待核对",
    "Externally changed; review needed"
  ],
  "{0} 个模型": [
    "{0} 个模型",
    "Models: {0}"
  ],
  "发布状态暂不可用": [
    "发布状态暂不可用",
    "Publication status is unavailable"
  ],
  "当前版本或配置不支持自动发布，请到客户端页核对": [
    "当前版本或配置不支持自动发布，请到客户端页核对",
    "This version or configuration does not support automatic deployment; check the Clients page"
  ],
  "在 Copilot App 中手动添加供应商": [
    "在 Copilot App 中手动添加供应商",
    "Add the provider manually in Copilot App"
  ],
  "未检测到客户端": [
    "未检测到客户端",
    "Client not detected"
  ],
  "尚无受管供应商": [
    "尚无受管供应商",
    "No managed providers yet"
  ],
  "启用 {0}": [
    "启用 {0}",
    "Enable {0}"
  ],
  " · 已停用，客户端配置保留": [
    " · 已停用，客户端配置保留",
    " · Disabled; client configuration retained"
  ],
  "首选": [
    "首选",
    "Preferred"
  ],
  "空目录：发布将移除本连接分组": [
    "空目录：发布将移除本连接分组",
    "Empty catalog: deployment removes this connection's group"
  ],
  "检查模型目录接口": [
    "检查模型目录接口",
    "Check the model catalog endpoint"
  ],
  "测试连接": [
    "测试模型目录",
    "Test model catalog"
  ],
  "{0} · {1} 个模型": [
    "{0} · {1} 个模型",
    "{0} · Models: {1}"
  ],
  "发布到客户端": [
    "发布到应用",
    "Publish to apps"
  ],
  "编辑": [
    "编辑",
    "Edit"
  ],
  "未保存密钥": [
    "未保存密钥",
    "No saved key"
  ],
  "•••••• · 已保存": [
    "•••••• · 已保存",
    "•••••• · Saved"
  ],
  "密钥存储不可用": [
    "密钥存储不可用",
    "Credential store unavailable"
  ],
  "仅更新本连接的供应商分组，保留其他来源；发布后在客户端的模型选择器中选用。": [
    "仅更新本连接的供应商分组，保留其他来源；发布后在客户端的模型选择器中选用。",
    "Updates only this connection's provider group and retains other sources. Select the model in the client after deployment."
  ],
  "仅更新本连接的供应商分组，保留其他来源；共享 BYOK 配置去重写入。重启相关 IDE 后，在模型选择器中选用。": [
    "仅更新本连接的供应商分组，保留其他来源；共享 BYOK 配置去重写入。重启相关 IDE 后，在模型选择器中选用。",
    "Updates only this connection's provider group and retains other sources. Shared BYOK writes are deduplicated. Restart affected IDEs, then select the model."
  ],
  "请在 Copilot App 中手动添加供应商。": [
    "请在 Copilot App 中手动添加供应商。",
    "Add the provider manually in Copilot App."
  ],
  "本软件使用旧式环境变量方式：替换 CLI 的单一路由，首选模型写入 COPILOT_MODEL。请新开终端和 CLI 会话，此覆盖生效时不要期待使用 GitHub 官方路由。": [
    "本软件使用旧式环境变量方式：替换 CLI 的单一路由，首选模型写入 COPILOT_MODEL。请新开终端和 CLI 会话，此覆盖生效时不要期待使用 GitHub 官方路由。",
    "This app uses the legacy environment route: it replaces CLI's single route and writes the preferred model to COPILOT_MODEL. Open a new terminal and CLI session. Do not expect GitHub's official route while this override is active."
  ],
  "已添加勾选模型，请核对后保存连接。": [
    "已添加勾选模型，请核对后保存连接。",
    "Selected models added. Review them and save the connection."
  ],
  "浏览器试用不请求供应商接口，请手动填写模型 ID。": [
    "浏览器试用不请求供应商接口，请手动填写模型 ID。",
    "Browser preview does not call provider APIs. Enter model IDs manually."
  ],
  "填好端点和密钥后可获取目录；已配置模型会保留。": [
    "填好端点和密钥后可获取目录；已配置模型会保留。",
    "Enter an endpoint and key to fetch the catalog; existing models will be retained."
  ],
  "读取模型目录…": [
    "读取模型目录…",
    "Reading model catalog…"
  ],
  "找到 {0} 个模型。": [
    "找到 {0} 个模型。",
    "Models found: {0}."
  ],
  "添加已选 ({0})": [
    "添加已选 ({0})",
    "Add selected ({0})"
  ],
  "未获得可验证的目录响应。": [
    "未获得可验证的目录响应。",
    "No verifiable catalog response received."
  ],
  "已有目录请求正在运行，请稍后重试。": [
    "已有目录请求正在运行，请稍后重试。",
    "A catalog request is already running. Try again later."
  ],
  "已存密钥缺失或不可访问，请解锁凭据库或重新输入。": [
    "已存密钥缺失或不可访问，请解锁凭据库或重新输入。",
    "The saved key is missing or inaccessible. Unlock the credential store or re-enter it."
  ],
  "连接设置已改变，请重新输入用于该端点的密钥。": [
    "连接设置已改变，请重新输入用于该端点的密钥。",
    "Connection settings changed. Re-enter the key for this endpoint."
  ],
  "请检查端点、密钥和请求头；远程端点须使用 HTTPS。": [
    "请检查端点、密钥和请求头；远程端点须使用 HTTPS。",
    "Check the endpoint, key and headers. Remote endpoints require HTTPS."
  ],
  "目录格式不受支持或超出安全限制，请手动填写模型。": [
    "目录格式不受支持或超出安全限制，请手动填写模型。",
    "The catalog format is unsupported or exceeds safety limits. Enter models manually."
  ],
  "目录请求失败或超时，请检查地址和网络。": [
    "目录请求失败或超时，请检查地址和网络。",
    "Catalog request failed or timed out. Check the URL and network."
  ],
  "供应商限流，请稍后重试。": [
    "供应商限流，请稍后重试。",
    "Provider rate limit reached. Try again later."
  ],
  "目录访问被拒绝，请检查密钥权限。": [
    "目录访问被拒绝，请检查密钥权限。",
    "Catalog access denied. Check key permissions."
  ],
  "该端点不支持此模型目录接口；Azure 请手动填写部署名称。": [
    "该端点不支持此模型目录接口；Azure 请手动填写部署名称。",
    "This endpoint does not support the model catalog API. For Azure, enter deployment names manually."
  ],
  "仅获取了部分模型目录，可添加已返回模型或稍后重试。": [
    "仅获取了部分模型目录，可添加已返回模型或稍后重试。",
    "Only part of the catalog was retrieved. Add returned models or retry later."
  ],
  "模型目录接口已响应，但列表为空。可手动填写模型 ID。": [
    "模型目录接口已响应，但列表为空。可手动填写模型 ID。",
    "The catalog endpoint responded with an empty list. Enter model IDs manually."
  ],
  "模型目录可访问，勾选模型即可添加。": [
    "模型目录可访问，勾选模型即可添加。",
    "Model catalog available. Select models to add."
  ],
  "首选模型不在启用列表中，请重新选择。": [
    "首选模型不在启用列表中，请重新选择。",
    "The preferred model is not enabled. Select it again."
  ],
  "每个连接最多 {0} 个模型，请减少勾选数量。": [
    "每个连接最多 {0} 个模型，请减少勾选数量。",
    "A connection supports at most {0} models. Select fewer models."
  ],
  "目录包含格式不受支持的模型，请手动填写模型 ID。": [
    "目录包含格式不受支持的模型，请手动填写模型 ID。",
    "The catalog contains unsupported model formats. Enter model IDs manually."
  ],
  "请求头名称不能重复（不区分大小写），请合并重复项。": [
    "请求头名称不能重复（不区分大小写），请合并重复项。",
    "Header names must be unique, ignoring case. Merge duplicate entries."
  ],
  "请求头须采用“名称: 值”格式，请检查每一行。": [
    "请求头须采用“名称: 值”格式，请检查每一行。",
    "Headers must use the Name: Value format. Check each line."
  ],
  "Deployment preview expired; generate a new preview": [
    "发布预览已过期，请重新生成",
    "Deployment preview expired; generate a new preview"
  ],
  "Review and confirm a fresh deployment plan": [
    "请核对并确认新的发布计划",
    "Review and confirm a fresh deployment plan"
  ],
  "The native preview returned an invalid plan": [
    "原生后端返回了无效的预览计划",
    "The native preview returned an invalid plan"
  ],
  "已发布到支持的目标，其他客户端仍需手动配置": [
    "已发布到支持的目标，其他客户端仍需手动配置",
    "Deployed to supported targets; other clients still require manual setup"
  ],
  "受管资源配置已移除": [
    "受管资源配置已移除",
    "Managed resource configuration removed"
  ],
  "写入支持的目标，其余客户端请按指引手动配置。": [
    "写入支持的目标，其余客户端请按指引手动配置。",
    "Writes to supported targets. Follow the manual steps for other clients."
  ],
  "仅移除已核验的受管配置，保留用户条目。": [
    "仅移除已核验的受管配置，保留用户条目。",
    "Removes only verified managed configuration and retains user entries."
  ],
  "{0}：写前会重检受管证明和目标指纹。预览 15 分钟有效，仅可使用一次。 {1}": [
    "{0}：写前会重检受管证明和目标指纹。预览 15 分钟有效，仅可使用一次。 {1}",
    "{0}: Ownership proofs and target fingerprints are checked again before writing. The preview expires after 15 minutes and can be used only once. {1}"
  ],
  "请生成预览，逐个核对目标。": [
    "请生成预览，逐个核对目标。",
    "Generate a preview and review each target."
  ],
  "核对资源发布": [
    "核对资源发布",
    "Review resource deployment"
  ],
  "核对资源撤销": [
    "核对资源撤销",
    "Review resource revocation"
  ],
  "资源已保存，发布需另行预览": [
    "资源已保存，发布需另行预览",
    "Resource saved; deployment requires a separate preview"
  ],
  "请填写名称和内容。输入已保留，可修改后重试。": [
    "请填写名称和内容。输入已保留，可修改后重试。",
    "Enter a name and content. Your input is retained for editing and retrying."
  ],
  "资源未保存。{0}": [
    "资源未保存。{0}",
    "Resource not saved. {0}"
  ],
  "保存到本地": [
    "保存到本地",
    "Save locally"
  ],
  "类型": [
    "类型",
    "Type"
  ],
  "内容或不含凭据的 HTTPS MCP 地址": [
    "内容或不含凭据的 HTTPS MCP 地址",
    "Content or a credential-free HTTPS MCP URL"
  ],
  "指令面向全部文件；技能填写 Markdown 正文，脚本与资源手动管理。MCP 不接受请求头、密钥或查询参数。": [
    "指令面向全部文件；技能填写 Markdown 正文，脚本与资源手动管理。MCP 不接受请求头、密钥或查询参数。",
    "Instructions apply to all files. Skills contain Markdown only; manage scripts and assets manually. MCP accepts no headers, keys or query parameters."
  ],
  "添加资源": [
    "添加资源",
    "Add resource"
  ],
  "编辑资源": [
    "编辑资源",
    "Edit resource"
  ],
  "不支持的变更": [
    "不支持的变更",
    "Unsupported change"
  ],
  "受管内容预览": [
    "受管内容预览",
    "Managed content preview"
  ],
  "没有发布记录，仅删除本地条目。": [
    "没有发布记录，仅删除本地条目。",
    "No deployment records; deletes only the local entry."
  ],
  "手动处理 / 不可用": [
    "手动处理 / 不可用",
    "Manual / unavailable"
  ],
  "无需修改": [
    "无需修改",
    "No changes needed"
  ],
  "移除受管配置": [
    "移除受管配置",
    "Remove managed configuration"
  ],
  "更新受管配置": [
    "更新受管配置",
    "Update managed configuration"
  ],
  "新增受管配置": [
    "新增受管配置",
    "Add managed configuration"
  ],
  "浏览器试用不可用，不读取本地目录或客户端文件。": [
    "浏览器试用不可用，不读取本地目录或客户端文件。",
    "Unavailable in browser preview; local directories and client files are not read."
  ],
  "恢复期间暂停写入，请先核对恢复。": [
    "恢复期间暂停写入，请先核对恢复。",
    "Writes are paused during recovery. Review recovery first."
  ],
  "资源存储不可用，请核对恢复状态。": [
    "资源存储不可用，请核对恢复状态。",
    "Resource storage unavailable. Check recovery status."
  ],
  "尚无资源。": [
    "尚无资源。",
    "No resources yet."
  ],
  "尚未发布": [
    "尚未发布",
    "Not yet deployed"
  ],
  "{0} 个最近发布绑定": [
    "{0} 个最近发布绑定",
    "{0} recent deployment bindings"
  ],
  " · 本地修改待发布": [
    " · 本地修改待发布",
    " · Local changes not yet deployed"
  ],
  "尚未写入客户端配置。": [
    "尚未写入客户端配置。",
    "Client configuration has not been written yet."
  ],
  "预览发布": [
    "预览发布",
    "Preview deployment"
  ],
  "撤销并删除…": [
    "撤销并删除…",
    "Revoke and delete…"
  ],
  "共享资源": [
    "共享资源",
    "Shared resources"
  ],
  "资源先保存到本地，再预览发布。App、命名配置与自定义路径保持手动；不导入密钥或客户端认证。": [
    "资源先保存到本地，再预览发布。App、命名配置与自定义路径保持手动；不导入密钥或客户端认证。",
    "Save resources locally, then preview deployment. App, named profiles and custom paths remain manual. No keys or client authentication are imported."
  ],
  "技能": [
    "技能",
    "Skills"
  ],
  "Browser preview · disposable sample data · no computer scan, installation or sign-in": [
    "浏览器试用 · 临时示例数据 · 不扫描电脑、不安装、不登录",
    "Browser preview · disposable sample data · no computer scan, installation or sign-in"
  ],
  "Set up GitHub Copilot on this computer": [
    "在本机设置 GitHub Copilot",
    "Set up GitHub Copilot on this computer"
  ],
  "Your core Copilot setup is ready": [
    "核心 Copilot 配置已就绪",
    "Your core Copilot setup is ready"
  ],
  "Preview": [
    "试用",
    "Preview"
  ],
  "{0} of 4": [
    "{0} / 4",
    "{0} of 4"
  ],
  "Needs attention": [
    "需要核对",
    "Needs attention"
  ],
  "Ready": [
    "已就绪",
    "Ready"
  ],
  "A complete native scan is required to determine readiness.": [
    "需要完整的原生扫描才能判断是否就绪。",
    "A complete native scan is required to determine readiness."
  ],
  "Last scanned {0}": [
    "最近扫描 {0}",
    "Last scanned {0}"
  ],
  "Saved setup preferences are unavailable: {0}": [
    "已保存的设置偏好不可用：{0}",
    "Saved setup preferences are unavailable: {0}"
  ],
  "Component status unavailable": [
    "组件状态不可用",
    "Component status unavailable"
  ],
  "Install": [
    "安装",
    "Install"
  ],
  "Repair": [
    "修复",
    "Repair"
  ],
  "Choose an account in the confirmation dialog": [
    "请在确认窗口中选择账号",
    "Choose an account in the confirmation dialog"
  ],
  "JetBrains GitHub Copilot · each IDE": [
    "JetBrains GitHub Copilot · 每个 IDE",
    "JetBrains GitHub Copilot · each IDE"
  ],
  "Copilot app": [
    "Copilot App",
    "Copilot app"
  ],
  "Copilot CLI": [
    "Copilot CLI",
    "Copilot CLI"
  ],
  "VS Code Copilot": [
    "VS Code Copilot",
    "VS Code Copilot"
  ],
  "Review sign-in": [
    "核对登录",
    "Review sign-in"
  ],
  "VS Code sign-in": [
    "VS Code 登录",
    "VS Code sign-in"
  ],
  "Evidence · {0}": [
    "依据 · {0}",
    "Evidence · {0}"
  ],
  "Confirmed by you {0}. This confirmation expires after 30 days or when observed evidence changes.": [
    "你于 {0} 完成确认。30 天后或观察依据变化时，此确认失效。",
    "Confirmed by you {0}. This confirmation expires after 30 days or when observed evidence changes."
  ],
  "Unlimited": [
    "无限制",
    "Unlimited"
  ],
  "Refresh from the signed-in Copilot runtime in Usage.": [
    "请在用量页从已登录的 Copilot 运行时刷新。",
    "Refresh from the signed-in Copilot runtime in Usage."
  ],
  "{0} · reset {1}": [
    "{0} · 重置时间 {1}",
    "{0} · reset {1}"
  ],
  "Not refreshed": [
    "未刷新",
    "Not refreshed"
  ],
  "Account unavailable": [
    "账号不可用",
    "Account unavailable"
  ],
  " · Stale": [
    " · 已过期",
    " · Stale"
  ],
  "No observations imported": [
    "没有导入的观察记录",
    "No observations imported"
  ],
  "Unavailable": [
    "不可用",
    "Unavailable"
  ],
  "{0} input · {1} output": [
    "{0} 输入 · {1} 输出",
    "{0} input · {1} output"
  ],
  "{0}% of covered input": [
    "已覆盖输入的 {0}%",
    "{0}% of covered input"
  ],
  "Unknown": [
    "未知",
    "Unknown"
  ],
  "{0} – {1} (UTC) · ": [
    "{0} – {1} (UTC) · ",
    "{0} – {1} (UTC) · "
  ],
  "${0} · {1}/{2} records priced": [
    "${0} · {1}/{2} 条已计价",
    "${0} · {1}/{2} records priced"
  ],
  "YOUR COPILOT SETUP": [
    "你的 COPILOT 配置",
    "YOUR COPILOT SETUP"
  ],
  "Install apps, confirm one GitHub account, deploy one model setup, and track usage.": [
    "安装客户端、核对同一 GitHub 账号、发布一套模型配置，并查看用量。",
    "Install apps, confirm one GitHub account, deploy one model setup, and track usage."
  ],
  "Core steps ready": [
    "核心步骤就绪",
    "Core steps ready"
  ],
  "Installation and accounts · {0}": [
    "安装与账号 · {0}",
    "Installation and accounts · {0}"
  ],
  "Scan this computer": [
    "扫描本机",
    "Scan this computer"
  ],
  "Rescan": [
    "重新扫描",
    "Rescan"
  ],
  "Install Copilot apps": [
    "安装 Copilot 客户端",
    "Install Copilot apps"
  ],
  "Install all missing{0}": [
    "安装全部缺失组件{0}",
    "Install all missing{0}"
  ],
  "Verify one GitHub account": [
    "核对同一 GitHub 账号",
    "Verify one GitHub account"
  ],
  "Confirm accounts": [
    "确认账号",
    "Confirm accounts"
  ],
  "Usage insights": [
    "用量概览",
    "Usage insights"
  ],
  "Optional · does not block core setup": [
    "可选 · 不阻塞核心配置",
    "Optional · does not block core setup"
  ],
  "Official runtime quota": [
    "官方运行时配额",
    "Official runtime quota"
  ],
  "Local observations": [
    "本地观察",
    "Local observations"
  ],
  "Cache hit: {0}": [
    "缓存命中：{0}",
    "Cache hit: {0}"
  ],
  "{0}API-equivalent estimate: {1} · {2}": [
    "{0}API 等价估算：{1} · {2}",
    "{0}API-equivalent estimate: {1} · {2}"
  ],
  "Open usage and data sources": [
    "打开用量与数据来源",
    "Open usage and data sources"
  ],
  "No connections yet": [
    "尚无连接",
    "No connections yet"
  ],
  "Add a URL and API key to discover models and create your first connection.": [
    "添加端点和 API 密钥，获取模型并创建首个连接。",
    "Add a URL and API key to discover models and create your first connection."
  ],
  "+{0} more": [
    "还有 {0} 个",
    "+{0} more"
  ],
  "{0} enabled models · Edit connection to add, remove or discover models.": [
    "{0} 个启用模型 · 编辑连接可添加、移除或获取模型。",
    "{0} enabled models · Edit connection to add, remove or discover models."
  ],
  "Preview deployment to {0} clients": [
    "预览发布到 {0} 个客户端",
    "Preview deployment to {0} clients"
  ],
  "Review deployment": [
    "核对发布",
    "Review deployment"
  ],
  "Copilot app: manual setup": [
    "Copilot App：手动配置",
    "Copilot app: manual setup"
  ],
  "Review manual setup": [
    "核对手动配置",
    "Review manual setup"
  ],
  "BYOK guide": [
    "BYOK 指引",
    "BYOK guide"
  ],
  "automatic BYOK": [
    "自动 BYOK",
    "automatic BYOK"
  ],
  " · {0} app manual": [
    " · {0} 个 App 手动处理",
    " · {0} app manual"
  ],
  "Configuration has not been checked": [
    "尚未核对配置",
    "Configuration has not been checked"
  ],
  "Provider setup confirmed by you for this connection": [
    "你已确认此连接的供应商配置",
    "Provider setup confirmed by you for this connection"
  ],
  "Connection and models": [
    "连接与模型",
    "Connection and models"
  ],
  "Choose or edit your provider, then preview the configuration changes for your clients.": [
    "选择或编辑供应商，然后预览各客户端的配置变更。",
    "Choose or edit your provider, then preview the configuration changes for your clients."
  ],
  "Current connection": [
    "当前连接",
    "Current connection"
  ],
  "Edit connection": [
    "编辑连接",
    "Edit connection"
  ],
  "Add connection": [
    "添加连接",
    "Add connection"
  ],
  "Deployment status · {0}/{1} automatic targets in sync{2}": [
    "发布状态 · {0}/{1} 个自动目标已同步{2}",
    "Deployment status · {0}/{1} automatic targets in sync{2}"
  ],
  "Preview and deploy {0}": [
    "预览并发布 {0}",
    "Preview and deploy {0}"
  ],
  "Complete Copilot app setup": [
    "完成 Copilot App 配置",
    "Complete Copilot app setup"
  ],
  "Add a model connection": [
    "添加模型连接",
    "Add a model connection"
  ],
  "Verify the same GitHub account": [
    "核对同一 GitHub 账号",
    "Verify the same GitHub account"
  ],
  "Review component issues": [
    "核对组件问题",
    "Review component issues"
  ],
  "Install {0} missing components": [
    "安装 {0} 个缺失组件",
    "Install {0} missing components"
  ],
  "Review storage recovery": [
    "核对存储恢复",
    "Review storage recovery"
  ],
  "Review interrupted deployment": [
    "核对中断的发布",
    "Review interrupted deployment"
  ],
  "Preview only · open the desktop app": [
    "仅供试用 · 请打开桌面软件",
    "Preview only · open the desktop app"
  ],
  "View usage insights": [
    "查看用量",
    "View usage insights"
  ],
  "Unsupported data schema": [
    "数据格式不受支持",
    "Unsupported data schema"
  ],
  "Network unavailable": [
    "网络不可用",
    "Network unavailable"
  ],
  "Action required": [
    "需要操作",
    "Action required"
  ],
  "Choose and confirm an account": [
    "选择并确认账号",
    "Choose and confirm an account"
  ],
  "Requires confirmation": [
    "需要确认",
    "Requires confirmation"
  ],
  "Same account · verified": [
    "同一账号 · 已验证",
    "Same account · verified"
  ],
  "Same account · user confirmed": [
    "同一账号 · 用户已确认",
    "Same account · user confirmed"
  ],
  "Not installed": [
    "未安装",
    "Not installed"
  ],
  "Out of date": [
    "已过期",
    "Out of date"
  ],
  "Not deployed": [
    "尚未发布",
    "Not deployed"
  ],
  "In sync": [
    "已同步",
    "In sync"
  ],
  "有未保存的修改。关闭后将放弃这些修改；密钥不会保存为草稿。": [
    "有未保存的修改。关闭后将放弃这些修改；密钥不会保存为草稿。",
    "You have unsaved changes. Closing discards them; keys are never saved as drafts."
  ],
  "继续编辑": [
    "继续编辑",
    "Keep editing"
  ],
  "放弃修改并关闭": [
    "放弃修改并关闭",
    "Discard changes and close"
  ],
  "此操作需要桌面软件": [
    "此操作需要桌面软件",
    "This action requires the desktop app"
  ],
  "仅供试用": [
    "仅供试用",
    "Preview only"
  ],
  "本地路径不可用": [
    "本地路径不可用",
    "Local path unavailable"
  ],
  "浏览器试用不读取本地来源": [
    "浏览器试用不读取本地来源",
    "Browser preview does not read local sources"
  ],
  "浏览器试用不提供真实本地数据": [
    "浏览器试用不提供真实本地数据",
    "Browser preview has no real local data"
  ],
  "导入进度不可用： {0}": [
    "导入进度不可用： {0}",
    "Import progress unavailable: {0}"
  ],
  "{0} · {1} · {2} 个文件 · {3} 条观察已处理": [
    "{0} · {1} · {2} 个文件 · {3} 条观察已处理",
    "{0} · {1} · {2} files · {3} observations processed"
  ],
  "清除已导入元数据": [
    "清除已导入元数据",
    "Clear imported metadata"
  ],
  "删除 {0} 条导入记录、该来源游标及导入历史，并停用导入。保留原日志、账单和价格快照；重新导入可从原日志重建记录。": [
    "删除 {0} 条导入记录、该来源游标及导入历史，并停用导入。保留原日志、账单和价格快照；重新导入可从原日志重建记录。",
    "Delete {0} imported records, source cursors and import history, and disable import. Original logs, Billing and price snapshots remain. Records can be rebuilt by reimporting the original logs."
  ],
  "清除 {0} 元数据": [
    "清除 {0} 元数据",
    "Clear {0} metadata"
  ],
  "启用本地元数据导入": [
    "启用本地元数据导入",
    "Enable local metadata import"
  ],
  "启用 {0} 导入": [
    "启用 {0} 导入",
    "Enable {0} import"
  ],
  "{0} 配置": [
    "{0} 配置",
    "{0} configuration"
  ],
  "只显示允许保存的元数据，标识已哈希；不保留原日志行或对话。": [
    "只显示允许保存的元数据，标识已哈希；不保留原日志行或对话。",
    "Shows only allowlisted metadata with hashed identifiers; original log lines and conversations are not retained."
  ],
  "已导入元数据": [
    "已导入元数据",
    "Imported metadata"
  ],
  "App 尚无已审核的独立用量来源，不读取私有存储。": [
    "App 尚无已审核的独立用量来源，不读取私有存储。",
    "No reviewed standalone app usage source yet; private storage is not read."
  ],
  "正常使用官方运行时即可。已结束且含支持的 v1 模型指标的会话可导入；CLI / App 共享记录只计一次，客户端归属保持未知。": [
    "正常使用官方运行时即可。已结束且含支持的 v1 模型指标的会话可导入；CLI / App 共享记录只计一次，客户端归属保持未知。",
    "Use the official runtime normally. Completed sessions with supported v1 model metrics can be imported. Shared CLI / App records are counted once; the originating client remains unknown."
  ],
  "启用导入后，请自行把以下配置加入 VS Code 用户设置并重启。软件只创建自己的接收目录，不改 VS Code 设置；仅影响后续观察。": [
    "启用导入后，请自行把以下配置加入 VS Code 用户设置并重启。软件只创建自己的接收目录，不改 VS Code 设置；仅影响后续观察。",
    "After enabling import, add the following to VS Code user settings yourself and restart. This app creates only its own inbox directory, not VS Code settings. Only future observations are affected."
  ],
  "停止导出请将": [
    "停止导出请将",
    "To stop export, set"
  ],
  "设为": [
    "设为",
    "to"
  ],
  "源日志可能包含对话。本软件只保存模型标识、哈希 ID、计数及时间，不上传日志。停用停止读取；清除移除本软件中的该来源记录与游标。": [
    "源日志可能包含对话。本软件只保存模型标识、哈希 ID、计数及时间，不上传日志。停用停止读取；清除移除本软件中的该来源记录与游标。",
    "Source logs may contain conversations. This app stores only model identifiers, hashed IDs, counts and timestamps, and never uploads logs. Disabling stops reads; clearing removes this app's imported source records and cursors."
  ],
  "浏览器试用 · 不读取真实用量、额度或账单": [
    "浏览器试用 · 不读取真实用量、额度或账单",
    "Browser preview · no real usage, quota or Billing is read"
  ],
  "JetBrains 用量：暂未支持。": [
    "JetBrains 用量：暂未支持。",
    "JetBrains usage: not yet supported."
  ],
  "数据来源 / 价格": [
    "数据来源 / 价格",
    "Sources / prices"
  ],
  "会话 / 详情": [
    "会话 / 详情",
    "Sessions / details"
  ],
  "模型统计": [
    "模型统计",
    "Model statistics"
  ],
  "官方订阅 / 用量": [
    "官方订阅 / 用量",
    "Official subscription / usage"
  ],
  "用量视图": [
    "用量视图",
    "Usage views"
  ],
  "刷新官方 OpenRouter 目录": [
    "刷新官方 OpenRouter 目录",
    "Refresh official OpenRouter catalog"
  ],
  "刷新中…": [
    "刷新中…",
    "Refreshing…"
  ],
  "取消进行中的任务": [
    "取消进行中的任务",
    "Cancel running tasks"
  ],
  "刷新价格目录，将兼容的观察记录绑定到不可变价格快照。": [
    "刷新价格目录，将兼容的观察记录绑定到不可变价格快照。",
    "Refresh the price catalog and bind compatible observations to immutable price snapshots."
  ],
  "尚无价格快照；取得兼容价格和完整 Token 数据后才能估算。": [
    "尚无价格快照；取得兼容价格和完整 Token 数据后才能估算。",
    "No price snapshot yet. Estimates require compatible prices and complete token data."
  ],
  "价格格式不受支持，不生成估算": [
    "价格格式不受支持，不生成估算",
    "Unsupported price format; no estimate generated"
  ],
  "核对时间：{0} · 快照创建：{1} · 解析器 v{2} ·": [
    "核对时间：{0} · 快照创建：{1} · 解析器 v{2} ·",
    "Checked: {0} · Snapshot created: {1} · Parser v{2} ·"
  ],
  "官方来源": [
    "官方来源",
    "Official source"
  ],
  "快照标识": [
    "快照标识",
    "Snapshot ID"
  ],
  "来源版本： {0}": [
    "来源版本： {0}",
    "Source version: {0}"
  ],
  "历史估算保留原价格快照。缺少 Token 或价格档位时显示未知；零价格按免费计。": [
    "历史估算保留原价格快照。缺少 Token 或价格档位时显示未知；零价格按免费计。",
    "Historical estimates retain their price snapshot. Missing tokens or price tiers are shown as unknown; a zero price is treated as free."
  ],
  "查找价格": [
    "查找价格",
    "Find prices"
  ],
  "模型 ID": [
    "模型 ID",
    "Model ID"
  ],
  "查找": [
    "查找",
    "Search"
  ],
  "显示 {0} / {1} 个匹配模型；单位为 USD / 百万文本 Token。": [
    "显示 {0} / {1} 个匹配模型；单位为 USD / 百万文本 Token。",
    "Showing {0} / {1} matching models; prices in USD per million text tokens."
  ],
  "规范模型": [
    "规范模型",
    "Canonical model"
  ],
  "输入门槛": [
    "输入门槛",
    "Input threshold"
  ],
  "输入": [
    "输入",
    "Input"
  ],
  "缓存读取": [
    "缓存读取",
    "Cache read"
  ],
  "缓存写入 / 1 h": [
    "缓存写入 / 1 h",
    "Cache write / 1 h"
  ],
  "输出": [
    "输出",
    "Output"
  ],
  "价格目录与历史估算": [
    "价格目录与历史估算",
    "Price catalog and historical estimates"
  ],
  "导入已启用来源": [
    "导入已启用来源",
    "Import enabled sources"
  ],
  "导入中…": [
    "导入中…",
    "Importing…"
  ],
  "{0}: {1} · {2} 个文件 · {3} 条观察已处理": [
    "{0}: {1} · {2} 个文件 · {3} 条观察已处理",
    "{0}: {1} · {2} files · {3} observations processed"
  ],
  "来源状态不可用，请刷新。": [
    "来源状态不可用，请刷新。",
    "Source status unavailable; refresh to check."
  ],
  "启用导入…": [
    "启用导入…",
    "Enable import…"
  ],
  "停用导入": [
    "停用导入",
    "Disable import"
  ],
  "配置与隐私": [
    "配置与隐私",
    "Configuration and privacy"
  ],
  "清除已导入元数据…": [
    "清除已导入元数据…",
    "Clear imported metadata…"
  ],
  "{0} · 解析器 {1}": [
    "{0} · 解析器 {1}",
    "{0} · Parser {1}"
  ],
  "{0} 条已保存记录 · 最近扫描：{1} · 最近成功扫描：{2}": [
    "{0} 条已保存记录 · 最近扫描：{1} · 最近成功扫描：{2}",
    "{0} saved records · Last scan: {1} · Last successful scan: {2}"
  ],
  "数据来源与覆盖": [
    "数据来源与覆盖",
    "Data sources and coverage"
  ],
  "仅经同意后在本地导入元数据，不保存原日志行或对话内容。": [
    "仅经同意后在本地导入元数据，不保存原日志行或对话内容。",
    "Imports metadata locally only after consent. Original log lines and conversations are not stored."
  ],
  "覆盖限制": [
    "覆盖限制",
    "Coverage limits"
  ],
  "CLI 累计记录的输入分类与来源客户端可能未知。VS Code 使用启用导出后的记录。停用保留数据，清除仅删除本软件的导入数据；停止 VS Code 导出还需关闭 OTel。": [
    "CLI 累计记录的输入分类与来源客户端可能未知。VS Code 使用启用导出后的记录。停用保留数据，清除仅删除本软件的导入数据；停止 VS Code 导出还需关闭 OTel。",
    "Input categories and source clients may be unknown in cumulative CLI records. VS Code uses records exported after opt-in. Disabling retains data; clearing deletes this app's imports. Also disable OTel to stop VS Code export."
  ],
  "查看": [
    "查看",
    "View"
  ],
  "此范围内无导入记录，请到数据来源页核对。": [
    "此范围内无导入记录，请到数据来源页核对。",
    "No imported records in this range. Review the Sources tab."
  ],
  "上一页": [
    "上一页",
    "Previous"
  ],
  "下一页": [
    "下一页",
    "Next"
  ],
  "会话与请求": [
    "会话与请求",
    "Sessions and requests"
  ],
  "{0} 条匹配观察": [
    "{0} 条匹配观察",
    "{0} matching observations"
  ],
  "会话累计值替换旧值，VS Code 请求按稳定标识去重；会话和请求 ID 已哈希。": [
    "会话累计值替换旧值，VS Code 请求按稳定标识去重；会话和请求 ID 已哈希。",
    "Session cumulative values replace previous totals. VS Code requests are deduplicated by stable identifiers. Session and request IDs are hashed."
  ],
  "结束时间": [
    "结束时间",
    "End time"
  ],
  "模型 / 记录类型": [
    "模型 / 记录类型",
    "Model / record type"
  ],
  "来源 / 路由": [
    "来源 / 路由",
    "Source / route"
  ],
  "输入 / 输出": [
    "输入 / 输出",
    "Input / output"
  ],
  "估算": [
    "估算",
    "Estimate"
  ],
  "第 {0} / {1}": [
    "第 {0} / {1}",
    "Page {0} / {1}"
  ],
  "当前筛选下无记录。": [
    "当前筛选下无记录。",
    "No records match the current filters."
  ],
  "分组": [
    "分组",
    "Group"
  ],
  "记录": [
    "记录",
    "Records"
  ],
  "缓存命中": [
    "缓存命中",
    "Cache hit"
  ],
  "估算金额（USD）": [
    "估算金额（USD）",
    "Estimated cost (USD)"
  ],
  "已计价记录": [
    "已计价记录",
    "Priced records"
  ],
  "规范 ID 未确定": [
    "规范 ID 未确定",
    "Canonical ID unresolved"
  ],
  "未观察到": [
    "未观察到",
    "Not observed"
  ],
  "（旧快照）": [
    "（旧快照）",
    "(Older snapshot)"
  ],
  "暂无本地质量观察": [
    "暂无本地质量观察",
    "No local quality observations yet"
  ],
  "无匹配模型。请添加连接、刷新运行时或导入来源。": [
    "无匹配模型。请添加连接、刷新运行时或导入来源。",
    "No matching models. Add a connection, refresh the runtime or import a source."
  ],
  "每日观察（UTC）": [
    "每日观察（UTC）",
    "Daily observations (UTC)"
  ],
  "客户端 / 共享运行时": [
    "客户端 / 共享运行时",
    "Client / shared runtime"
  ],
  "路由": [
    "路由",
    "Route"
  ],
  "来源报告的供应商": [
    "来源报告的供应商",
    "Source-reported provider"
  ],
  "全部来源中的模型": [
    "全部来源中的模型",
    "Models across all sources"
  ],
  "{0} 个模型 / 路由条目": [
    "{0} 个模型 / 路由条目",
    "{0} model / route entries"
  ],
  "模型目录汇总配置、运行时和所选账单月份中的模型；本地用量按上方条件筛选。": [
    "模型目录汇总配置、运行时和所选账单月份中的模型；本地用量按上方条件筛选。",
    "The catalog combines models from configuration, runtime and the selected Billing month. Local usage follows the filters above."
  ],
  "可左右滚动查看完整指标，模型列固定；聚焦表格后也可用左右方向键。": [
    "可左右滚动查看完整指标，模型列固定；聚焦表格后也可用左右方向键。",
    "Scroll horizontally for all metrics; the model column is pinned. Focus the table to use the left and right arrow keys."
  ],
  "模型统计表，可左右滚动": [
    "模型统计表，可左右滚动",
    "Model statistics table; scroll horizontally"
  ],
  "原始 / 规范模型": [
    "原始 / 规范模型",
    "Raw / canonical model"
  ],
  "路由 / 归因置信度": [
    "路由 / 归因置信度",
    "Route / attribution confidence"
  ],
  "客户端 / 来源": [
    "客户端 / 来源",
    "Client / source"
  ],
  "记录 / 请求": [
    "记录 / 请求",
    "Records / requests"
  ],
  "报告输入 / 归一化输入": [
    "报告输入 / 归一化输入",
    "Reported / normalized input"
  ],
  "未缓存输入": [
    "未缓存输入",
    "Uncached input"
  ],
  "缓存读取 / 写入": [
    "缓存读取 / 写入",
    "Cache read / write"
  ],
  "API 等价估算": [
    "API 等价估算",
    "API-equivalent estimate"
  ],
  "官方账单": [
    "官方账单",
    "Official Billing"
  ],
  "覆盖范围 / 质量": [
    "覆盖范围 / 质量",
    "Coverage / quality"
  ],
  "高级请求": [
    "高级请求",
    "Premium requests"
  ],
  "AI 积分": [
    "AI 积分",
    "AI credits"
  ],
  "此账号和月份暂无快照": [
    "此账号和月份暂无快照",
    "No snapshot for this account and month yet"
  ],
  "GitHub 可重试时间： {0}": [
    "GitHub 可重试时间： {0}",
    "GitHub retry time: {0}"
  ],
  " · 显示快照：{0} · API {1} · 时间范围：{2} 至 {3}（不含结束日）": [
    " · 显示快照：{0} · API {1} · 时间范围：{2} 至 {3}（不含结束日）",
    " · Displayed snapshot: {0} · API {1} · Range: {2} to {3} (end exclusive)"
  ],
  "尚无官方金额。": [
    "尚无官方金额。",
    "No official amount available yet."
  ],
  "所选月份暂无个人账单条目。": [
    "所选月份暂无个人账单条目。",
    "No personal billing entries for the selected month."
  ],
  "重置： {0}": [
    "重置： {0}",
    "Reset: {0}"
  ],
  "显示前 {0} / {1} 条，不从部分列表推断总额。": [
    "显示前 {0} / {1} 条，不从部分列表推断总额。",
    "Showing the first {0} / {1} items. Totals are not inferred from a partial list."
  ],
  "模型 / SKU": [
    "模型 / SKU",
    "Model / SKU"
  ],
  "数量": [
    "数量",
    "Quantity"
  ],
  "单位": [
    "单位",
    "Unit"
  ],
  "原始金额（USD）": [
    "原始金额（USD）",
    "Gross amount (USD)"
  ],
  "优惠金额（USD）": [
    "优惠金额（USD）",
    "Discount (USD)"
  ],
  "官方净额（USD）": [
    "官方净额（USD）",
    "Official net amount (USD)"
  ],
  "额度 / 剩余": [
    "额度 / 剩余",
    "Allowance / remaining"
  ],
  "最近尝试：{0}{1}": [
    "最近尝试：{0}{1}",
    "Last attempt: {0}{1}"
  ],
  "刷新额度与模型": [
    "刷新额度与模型",
    "Refresh quota and models"
  ],
  "读取运行时中…": [
    "读取运行时中…",
    "Reading runtime…"
  ],
  "通过本机官方运行时读取，不复用客户端登录凭据。": [
    "通过本机官方运行时读取，不复用客户端登录凭据。",
    "Reads through the local official runtime without reusing client sign-in credentials."
  ],
  "尚未取得额度，请核对运行时及官方登录。": [
    "尚未取得额度，请核对运行时及官方登录。",
    "Quota has not been retrieved. Check the runtime and official sign-in."
  ],
  "账号未知": [
    "账号未知",
    "Account unknown"
  ],
  " · 上次成功快照，当前账号可能不可用": [
    " · 上次成功快照，当前账号可能不可用",
    " · Last successful snapshot; current account may be unavailable"
  ],
  "不限量": [
    "不限量",
    "Unlimited"
  ],
  "运行时暂无额度数据。": [
    "运行时暂无额度数据。",
    "No quota data is currently available from the runtime."
  ],
  "· 运行时 {0} · 观察时间 {1}{2}": [
    "· 运行时 {0} · 观察时间 {1}{2}",
    "· Runtime {0} · Observed {1}{2}"
  ],
  "额度 / 单位标识": [
    "额度 / 单位标识",
    "Quota / unit ID"
  ],
  "已使用": [
    "已使用",
    "Used"
  ],
  "额度": [
    "额度",
    "Allowance"
  ],
  "剩余": [
    "剩余",
    "Remaining"
  ],
  "重置时间": [
    "重置时间",
    "Reset time"
  ],
  "刷新个人账单": [
    "刷新个人账单",
    "Refresh personal Billing"
  ],
  "读取个人账单需要本软件的独立授权。": [
    "读取个人账单需要本软件的独立授权。",
    "Reading personal Billing requires this app's separate authorization."
  ],
  "{0}@{1} · GitHub 用户 ID {2}": [
    "{0}@{1} · GitHub 用户 ID {2}",
    "{0}@{1} · GitHub user ID {2}"
  ],
  "管理授权": [
    "管理授权",
    "Manage authorization"
  ],
  "官方运行时额度": [
    "官方运行时额度",
    "Official runtime quota"
  ],
  "该接口不提供套餐名；额度保留原单位。模型目录： {0}.": [
    "该接口不提供套餐名；额度保留原单位。模型目录： {0}.",
    "This interface does not provide a plan name; quotas retain their original units. Model catalog: {0}."
  ],
  "GitHub 个人账单": [
    "GitHub 个人账单",
    "GitHub personal Billing"
  ],
  "月份": [
    "月份",
    "Month"
  ],
  "仅覆盖个人账单；组织支付或不可访问的数据保持未知。AI 积分与高级请求不相加。": [
    "仅覆盖个人账单；组织支付或不可访问的数据保持未知。AI 积分与高级请求不相加。",
    "Covers personal Billing only; organization-paid or inaccessible data remains unknown. AI credits and premium requests are not added together."
  ],
  "启用支持的来源并导入元数据后查看用量。": [
    "启用支持的来源并导入元数据后查看用量。",
    "Enable a supported source and import metadata to view usage."
  ],
  "无": [
    "无",
    "None"
  ],
  "本地 Token 观察": [
    "本地 Token 观察",
    "Local token observations"
  ],
  "{0}。筛选仅影响本地观察，不改变官方额度或账单。": [
    "{0}。筛选仅影响本地观察，不改变官方额度或账单。",
    "{0}. Filters affect only local observations, not official quota or Billing."
  ],
  "覆盖范围与计算": [
    "覆盖范围与计算",
    "Coverage and calculation"
  ],
  "缓存命中率 = 已知记录的缓存读取 Token 总和 ÷ 归一化输入总和。 {0} 条记录有覆盖；缺失值保持未知。": [
    "缓存命中率 = 已知记录的缓存读取 Token 总和 ÷ 归一化输入总和。 {0} 条记录有覆盖；缺失值保持未知。",
    "Cache hit rate = total cache-read tokens ÷ normalized input across known records. {0} records covered; missing values remain unknown."
  ],
  "已计价请求： {0} · 未计价请求： {1} · 已计价 Token： {2} · 未计价 Token： {3}": [
    "已计价请求： {0} · 未计价请求： {1} · 已计价 Token： {2} · 未计价 Token： {3}",
    "Priced requests: {0} · Unpriced requests: {1} · Priced tokens: {2} · Unpriced tokens: {3}"
  ],
  "观察范围： {0} – {1}. 最近导入： {2}.": [
    "观察范围： {0} – {1}. 最近导入： {2}.",
    "Observation range: {0} – {1}. Last import: {2}."
  ],
  "估算仅按公开 API 文本 Token 价格换算，与 GitHub 账单分开；不按当前配置猜测历史路由。": [
    "估算仅按公开 API 文本 Token 价格换算，与 GitHub 账单分开；不按当前配置猜测历史路由。",
    "Estimates use public API text-token prices and stay separate from GitHub Billing. Historical routes are not inferred from current configuration."
  ],
  "绑定价格快照： {0}": [
    "绑定价格快照： {0}",
    "Bound price snapshots: {0}"
  ],
  "CLI / App 共享运行时": [
    "CLI / App 共享运行时",
    "CLI / App shared runtime"
  ],
  "GitHub 官方": [
    "GitHub 官方",
    "GitHub official"
  ],
  " · 已启用 {0} 项": [
    " · 已启用 {0} 项",
    " · {0} enabled"
  ],
  "精确连接标识": [
    "精确连接标识",
    "Exact connection identity"
  ],
  "来源明确报告": [
    "来源明确报告",
    "Explicitly reported by source"
  ],
  "起始日期（UTC）": [
    "起始日期（UTC）",
    "Start date (UTC)"
  ],
  "结束日期（UTC）": [
    "结束日期（UTC）",
    "End date (UTC)"
  ],
  "高级筛选{0}": [
    "高级筛选{0}",
    "Advanced filters{0}"
  ],
  "选择或输入精确模型 ID": [
    "选择或输入精确模型 ID",
    "Select or enter an exact model ID"
  ],
  "归因置信度": [
    "归因置信度",
    "Attribution confidence"
  ],
  "来源": [
    "来源",
    "Source"
  ],
  "来源最近状态": [
    "来源最近状态",
    "Latest source status"
  ],
  "应用筛选": [
    "应用筛选",
    "Apply filters"
  ],
  "重置筛选": [
    "重置筛选",
    "Reset filters"
  ],
  "缓存命中率": [
    "缓存命中率",
    "Cache hit rate"
  ],
  "缓存写入": [
    "缓存写入",
    "Cache write"
  ],
  "归一化输入": [
    "归一化输入",
    "Normalized input"
  ],
  "来源报告的输入": [
    "来源报告的输入",
    "Source-reported input"
  ],
  "{0}/{1} 条已计价 · {2} 个模型未确定 · {3} 条输入语义未知": [
    "{0}/{1} 条已计价 · {2} 个模型未确定 · {3} 条输入语义未知",
    "{0}/{1} records priced · {2} unresolved models · {3} records with unknown input semantics"
  ],
  "暂无本地观察": [
    "暂无本地观察",
    "No local observations yet"
  ],
  "个人账单": [
    "个人账单",
    "Personal Billing"
  ],
  "配置中已停用": [
    "配置中已停用",
    "Disabled in configuration"
  ],
  "配置中已启用": [
    "配置中已启用",
    "Enabled in configuration"
  ],
  "配置： {0}": [
    "配置： {0}",
    "Configuration: {0}"
  ],
  "策略未提供": [
    "策略未提供",
    "Policy not provided"
  ],
  "运行时目录": [
    "运行时目录",
    "Runtime catalog"
  ],
  "本地观察": [
    "本地观察",
    "Local observations"
  ],
  "全部": [
    "全部",
    "All"
  ],
  "VS Code 元数据导出": [
    "VS Code 元数据导出",
    "VS Code metadata export"
  ],
  "Copilot 共享会话元数据": [
    "Copilot 共享会话元数据",
    "Copilot shared session metadata"
  ],
  "Copilot 共享运行时": [
    "Copilot 共享运行时",
    "Copilot shared runtime"
  ],
  "依赖失败，已跳过": [
    "依赖失败，已跳过",
    "Skipped; dependency failed"
  ],
  "安装程序结束，但核验失败": [
    "安装程序结束，但核验失败",
    "Installer exited, but verification failed"
  ],
  "完成并已核验": [
    "完成并已核验",
    "Completed and verified"
  ],
  "只读": [
    "只读",
    "Read-only"
  ],
  "未安装，已跳过": [
    "未安装，已跳过",
    "Skipped; not installed"
  ],
  "已超时": [
    "已超时",
    "Timed out"
  ],
  "写入中": [
    "写入中",
    "Writing"
  ],
  "已跳过": [
    "已跳过",
    "Skipped"
  ],
  "已写入配置": [
    "已写入配置",
    "Configuration written"
  ],
  "已结束": [
    "已结束",
    "Ended"
  ],
  "运行中": [
    "运行中",
    "Running"
  ],
  "已停用": [
    "已停用",
    "Disabled"
  ],
  "已过期，显示旧快照": [
    "已过期，显示旧快照",
    "Stale; showing an older snapshot"
  ],
  "请求": [
    "请求",
    "Request"
  ],
  "会话 / 模型累计": [
    "会话 / 模型累计",
    "Session / model cumulative"
  ],
  "请求受限，稍后重试": [
    "请求受限，稍后重试",
    "Rate limited; retry later"
  ],
  "权限不足": [
    "权限不足",
    "Insufficient permission"
  ],
  "唯一时间线推断": [
    "唯一时间线推断",
    "Unique timeline inference"
  ],
  "用户已确认": [
    "用户已确认",
    "User confirmed"
  ],
  "仅个人账单": [
    "仅个人账单",
    "Personal Billing only"
  ],
  "读取成功，无记录": [
    "读取成功，无记录",
    "Read succeeded; no records"
  ],
  "本地 Copilot 配置管理": [
    "本地 Copilot 配置管理",
    "Local Copilot configuration"
  ],
  "主导航": [
    "主导航",
    "Primary navigation"
  ],
  "更多": [
    "更多",
    "More"
  ],
  "读取状态中": [
    "读取状态中",
    "Reading status"
  ],
  "检查本地后端": [
    "检查本地后端",
    "Checking local backend"
  ],
  "刷新": [
    "刷新",
    "Refresh"
  ],
  "界面语言": [
    "界面语言",
    "Interface language"
  ],
  "语言偏好无法保存，下次启动将按系统语言选择。": [
    "语言偏好无法保存，下次启动将按系统语言选择。",
    "Language preference could not be saved. The next launch will follow your system language."
  ],
  "请先完成当前操作或关闭表单、发布预览，再切换语言。": [
    "请先完成当前操作或关闭表单、发布预览，再切换语言。",
    "Finish the current action or close the form or deployment preview before switching languages."
  ]
}));
