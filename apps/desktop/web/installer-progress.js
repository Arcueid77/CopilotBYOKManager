(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerInstallProgress = api;
})(globalThis, function () {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const valid = value => Number.isSafeInteger(value) && value >= 0 && value <= 16 * 1024 ** 3;
  function phaseLabel(phase) {
    return { preparing: tr("准备安装"), downloading: tr("下载安装包"), installing: tr("校验并安装"), verifying: tr("检测安装结果"), cancelling: tr("正在停止安装…") }[phase] ?? tr("安装器运行中");
  }
  function size(bytes) {
    const unit = bytes >= 1024 ** 3 ? 3 : bytes >= 1024 ** 2 ? 2 : 1;
    return `${new Intl.NumberFormat(i18n.locale(), { maximumFractionDigits: 1 }).format(bytes / 1024 ** unit)} ${["", "KiB", "MiB", "GiB"][unit]}`;
  }
  function summarize(results = []) {
    const completed = results.filter(item => ["completedAndVerified", "skippedAlreadyReady"].includes(item.status)).length;
    const cancelled = results.filter(item => item.status === "cancelled").length;
    return { completed, cancelled, attention: results.length - completed - cancelled };
  }
  function summaryText(results) {
    const counts = summarize(results);
    return [tr("{0} 个已完成", counts.completed), counts.cancelled ? tr("{0} 个已取消", counts.cancelled) : "", counts.attention ? tr("{0} 个需处理", counts.attention) : ""].filter(Boolean).join(" · ");
  }
  function render(run, { componentName, statusLabel }, now = Date.now()) {
    if (!run) return "";
    const end = run.finishedAt ? Date.parse(run.finishedAt) : now;
    const elapsed = Math.max(0, Math.floor((end - Date.parse(run.startedAt)) / 1000));
    const clock = Number.isFinite(elapsed) ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}` : "—";
    const results = Array.isArray(run.results) ? run.results : [];
    const ids = Array.isArray(run.componentIds) ? run.componentIds.slice(0, 4) : [];
    const done = results.filter(r => ["completedAndVerified", "skippedAlreadyReady"].includes(r.status)).length;
    const progress = run.progress ?? {};
    const known = valid(progress.downloadedBytes) && valid(progress.totalBytes) && progress.totalBytes > 0 && progress.downloadedBytes <= progress.totalBytes;
    return `<div class="install-progress-heading"><span>${tr("已就绪 {0} / {1}", done, ids.length)}</span><span>${tr("已用时 {0}", clock)}</span></div><div class="install-progress-steps">${ids.map(id => {
      const result = results.find(r => r.componentId === id);
      const active = !result && run.status === "running" && run.currentComponentId === id;
      const label = result ? statusLabel(result.status) : active ? phaseLabel(progress.phase ?? "preparing") : run.status === "running" ? tr("等待安装") : tr("未完成");
      const percent = known ? Math.min(100, Math.floor(progress.downloadedBytes / progress.totalBytes * 100)) : null;
      return `<section class="install-progress-step ${active ? "is-active" : ""}"><div><strong>${escape(componentName(id))}</strong><span>${escape(label)}</span></div>${active ? `<progress max="100" ${progress.phase === "downloading" && known ? `value="${percent}"` : ""} aria-label="${escape(label)}"></progress>${progress.phase === "downloading" && known ? `<p>${tr("约 {0} / {1} · {2}%", escape(size(progress.downloadedBytes)), escape(size(progress.totalBytes)), percent)}</p>` : ""}` : ""}</section>`;
    }).join("")}</div>`;
  }
  return { render, phaseLabel, summarize, summaryText };
});
