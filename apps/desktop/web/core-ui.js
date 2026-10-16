(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./i18n.js") : root.CopilotBYOKManagerI18n);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerCore = api;
})(globalThis, function (i18n) {
  "use strict";
  const tr = i18n.t;
  const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const routeIds = Object.freeze(["overview", "connections", "clients", "about"]);
  const sections = Object.freeze([
    ["dashboard", "get_dashboard"], ["components", "get_installation_status"],
    ["installRuns", "get_install_runs"], ["setup", "get_setup_status"],
    ["windowBehavior", "get_window_behavior"],
  ].map(section => Object.freeze(section)));
  const statuses = () => ({ applied: tr("配置变更已应用"), skipped: tr("未自动处理"), failed: tr("失败，请核对"), rolledBack: tr("已回滚"), "rolled-back": tr("已回滚"), interrupted: tr("已中断，待恢复"), partial: tr("部分完成"), prepared: tr("已准备"), applying: tr("处理中") });
  function recovery(snapshot, native) {
    if (!snapshot.stateRecovery && !snapshot.deploymentRecovery) return "";
    return '<section class="security-note core-recovery" role="alert"><div><h2>' + tr("安全恢复") + '</h2>' +
      (snapshot.stateRecovery ? '<p>' + escape(tr("连接存储处于只读恢复： {0}", snapshot.stateRecovery)) + '</p><p>' + tr("保留原文件，不自动重建。请按使用手册核对状态文件后重新启动。") + '</p>' : '') +
      (snapshot.deploymentRecovery ? '<p>' + escape(snapshot.deploymentRecovery) + '</p><button class="button" data-action="preview-recovery" ' + (native ? '' : 'disabled') + '>' + tr("核对安全恢复") + '</button>' : '') + '</div></section>';
  }
  function history(snapshot) {
    const records = snapshot.deployments.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 100);
    const labels = statuses();
    return '<details class="manager-section core-history" id="publication-history"><summary>' + tr("发布与撤销记录") + '</summary>' +
      (records.length ? '<ul class="manager-result-targets">' + records.map(record => {
        const client = snapshot.clients.find(client => client.id === record.targetId);
        const date = Number.isNaN(Date.parse(record.createdAt)) ? tr("时间未知") : new Date(record.createdAt).toLocaleString(i18n.locale());
        return '<li><strong>' + escape(client?.name ?? record.targetId ?? tr("目标未知")) + '</strong><span>' + escape(labels[record.status] ?? record.status) + '</span><p>' + escape(date) + '</p>' + (record.detail ? '<p>' + escape(record.detail) + '</p>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="manager-meta">' + tr("尚无发布记录") + '</p>') + '</details>';
  }
  function windowBehaviorDescription(data, native) {
    const behavior = data.windowBehavior;
    if (!native) return tr("浏览器试用不提供系统托盘。");
    if (!behavior) return tr("无法读取窗口设置，请刷新后重试。");
    if (behavior.preferencesAvailable === false) return tr("窗口偏好无法读取，原文件保留；本次关闭窗口将正常退出。请核对偏好文件后重新启动。");
    if (behavior.trayAvailable === false) return tr("系统托盘不可用，关闭窗口将正常退出。");
    if (behavior.closeAction === "exit") return tr("关闭窗口将退出程序。也可从托盘菜单退出；普通最小化仍留在任务栏。");
    return behavior.closeToTray === true ? tr("关闭窗口收起到系统托盘；点击托盘图标恢复，右键菜单可退出。普通最小化仍留在任务栏。") : behavior.closeToTray === false ? tr("系统托盘不可用，关闭窗口将正常退出。") : tr("无法读取窗口设置，请刷新后重试。");
  }
  function about(snapshot, data, native, urls) {
    const behavior = windowBehaviorDescription(data, native);
    const closeAction = data.windowBehavior?.closeAction === "exit" ? "exit" : "tray";
    const closeControl = native ? '<label class="appearance-picker"><span>' + tr("关闭窗口时") + '</span><select data-close-action aria-label="' + tr("关闭窗口时") + '" ' + (data.windowBehavior?.preferencesAvailable === true && data.windowBehavior?.trayAvailable === true ? '' : 'disabled') + '><option value="tray" ' + (closeAction === "tray" ? 'selected' : '') + '>' + tr("收起到系统托盘") + '</option><option value="exit" ' + (closeAction === "exit" ? 'selected' : '') + '>' + tr("退出程序") + '</option></select></label>' : '';
    return '<div class="core-about-grid"><section class="manager-section core-about core-about-intro"><img src="assets/app-icon.png" alt="" width="64" height="64" /><div><h2>CopilotBYOKManager</h2><p class="manager-meta">' + tr("一次配置供应商，用于多个 Copilot 应用。") + '</p><p class="manager-meta">' + tr("核心配置版 · 预发布 · 0.1.0") + '</p><p class="manager-boundary">' + tr("独立的 Copilot 配置管理工具，处于预发布阶段，与 GitHub 无隶属关系。") + '</p></div></section>' +
      '<section class="manager-section core-about"><h2>' + tr("界面与窗口") + '</h2><div class="core-window-settings"><label class="appearance-picker"><span>' + tr("外观") + '</span><select data-appearance-select aria-label="' + tr("外观") + '"><option value="system">' + tr("跟随系统") + '</option><option value="light">' + tr("浅色") + '</option><option value="dark">' + tr("深色") + '</option></select></label>' + closeControl + '</div><p class="manager-meta" data-window-explanation>' + behavior + '</p></section>' +
      '<section class="manager-section core-about"><h2>' + tr("帮助与反馈") + '</h2><nav class="manager-help-links" aria-label="' + tr("帮助与反馈") + '">' + [["manual", tr("英文使用手册")], ["manual-zh", tr("中文使用手册")], ["issues", tr("反馈问题")]].map(([key, label]) => '<a data-help-link="' + key + '" href="' + escape(urls[key]) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>').join('') + '</nav><button class="button ghost small" data-action="view-planned-features">' + tr("未推出功能记录") + '</button><p class="manager-meta">' + tr("用量、账单与共享资源暂未开放，已有数据保留。规划记录不承诺上线日期。") + '</p><p class="manager-boundary">' + tr("反馈前请删除密钥、账号认证与对话内容。") + '</p></section>' +
      '<details class="manager-section core-about core-about-storage"><summary>' + tr("本地存储与安全") + '</summary><p class="manager-meta">' + tr("配置保存在本地，登录凭据留在各官方客户端。") + '</p><p class="manager-meta">' + tr("状态文件") + ': ' + escape(snapshot.statePath) + '</p><p class="manager-meta">' + tr("状态版本") + ': v' + escape(snapshot.version) + '</p><p class="manager-meta">' + tr("状态恢复") + ': ' + (snapshot.stateRecovery ? tr("只读恢复") : tr("正常")) + '</p></details></div>';
  }
  function planned() {
    const rows = [
      [tr("官方配额、模型目录和个人账单"), tr("已有实现，入口暂未开放")],
      [tr("本地用量、会话统计、归属和费用估算"), tr("已有实现，入口暂未开放")],
      [tr("MCP、Markdown Skills 和 Instructions"), tr("已有实现，待真实应用消费验收")],
      [tr("独立统一活动页"), tr("页面暂未开放，发布记录本版保留")],
      [tr("Copilot App 直接下载安装策略"), tr("已规划，尚未实现")],
      [tr("正式签名 Windows 安装包"), tr("待正式交付和干净 Windows 验收")],
    ];
    return '<p class="manager-meta">' + tr("仅记录现有规划，不承诺上线日期；隐藏能力的数据和后端测试保留。") + '</p><ul class="manager-result-targets">' + rows.map(([name, state]) => '<li><strong>' + name + '</strong><p>' + state + '</p></li>').join('') + '</ul>';
  }
  return Object.freeze({ routeIds, sections, recovery, history, about, planned, windowBehaviorDescription });
});
