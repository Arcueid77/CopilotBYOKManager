(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerAppSync = api;
})(globalThis, function () {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  function label(phase) {
    return ({ disabled: tr("未开启"), consentRequired: tr("需要重新确认范围"), unsupportedSchema: tr("版本或配置暂不支持"), reviewRequired: tr("模型移除需要确认"), pendingAppExit: tr("等待关闭 Copilot App"), pendingSync: tr("等待同步"), paused: tr("所选供应商已暂停"), synchronizing: tr("正在同步"), syncedConfiguration: tr("配置已同步"), conflict: tr("配置有冲突"), failed: tr("同步未完成"), recoveryRequired: tr("需要核对恢复") })[phase] ?? tr("状态未知");
  }
  function removalReview(plan) {
    if (!plan.appModelRemovals?.length) return "";
    return `<div class="app-sync-removal"><p>${tr("将从 Copilot App 移除这些模型：{0}", escape(plan.appModelRemovals.join(", ")))}</p><label class="checkbox-row"><input type="checkbox" data-app-models-resolved><span>${tr("我已在 App 中将当前和默认模型切换到其他模型，并关闭 App。")}</span></label></div>`;
  }
  function riskBody(preview) {
    return `<p>${tr("保存所选供应商后，将自动更新 App 中由本管理器管理的供应商和模型。写入前须关闭 Copilot App。")}</p>
      <p class="app-sync-risk">${tr("供应商密钥会以明文 Authorization header 存入 App 数据库，也可能留在 SQLite WAL、日志和备份中。系统密钥库不会加密这些副本；可读取这些文件的人可能获取密钥。")}</p>
      <p>${tr("此功能使用未承诺稳定的 App 数据库格式，App 更新可能使同步不可用。关闭同步只停止后续更新，不会清除已写入或备份中的密钥。")}</p>
      <p>${tr("仅管理所选供应商的自有条目，保留其他供应商、默认选择、登录和会话。")}</p>
      <dl class="app-sync-target"><dt>${tr("App 版本")}</dt><dd>${escape(preview.appVersion)}</dd><dt>${tr("写入位置")}</dt><dd><code>${escape(preview.databasePath)}</code></dd></dl>
      <ul>${preview.providers.map(provider => `<li><strong>${escape(provider.name)}</strong> · ${tr("{0} 个模型", provider.modelCount)}<br><code>${escape(provider.endpoint)}</code> · ${escape(provider.protocol)}</li>`).join("")}</ul>`;
  }
  function panel(status, error, snapshot, native) {
    const frozen = Boolean(snapshot.stateRecovery || snapshot.deploymentRecovery);
    const disabled = !native || frozen;
    const owned = status?.ownedConnectionIds ?? [];
    const selected = status?.selectedConnectionIds ?? [];
    return `<section class="app-sync-panel" data-app-sync-panel><div class="manager-section-head"><strong>${tr("实验性自动同步")}</strong><span class="manager-meta" role="status">${status ? label(status.phase) : error ? tr("同步状态读取失败") : tr("读取同步状态…")}</span></div>
      <p class="manager-meta">${status?.enabled ? tr("所选供应商保存后自动同步；关闭 App 后执行。") : tr("默认关闭。开启前选择供应商并核对密钥存储方式。")}</p>
      ${selected.length ? `<p class="manager-meta">${tr("已选：{0}", escape(selected.map(id => snapshot.connections.find(c => c.id === id)?.name ?? id).join(", ")))}</p>` : ""}
      ${status?.diagnostic ? `<details><summary>${tr("详细原因")}</summary><p>${escape(status.diagnostic)}</p></details>` : ""}
      ${status?.results?.length ? `<p class="manager-meta">${tr("最近同步结果")}</p><ul class="app-sync-results">${status.results.map(result => `<li><span>${escape(result.name)}</span><span>${label(result.phase)}${Number.isInteger(result.modelCount) ? ` · ${tr("{0} 个模型", result.modelCount)}` : ""}${Number.isNaN(Date.parse(result.observedAt)) ? "" : ` · ${escape(new Date(result.observedAt).toLocaleString(i18n.locale()))}`}</span></li>`).join("")}</ul>` : ""}
      ${status?.phase === "syncedConfiguration" ? `<p class="manager-meta">${tr("重新启动 App，在模型选择器中选择已同步的模型。")}</p>` : ""}
      <div class="app-sync-actions">${status?.enabled ? `<button class="button ghost small" data-action="app-sync-disable" ${!native ? "disabled" : ""}>${tr("关闭自动同步")}</button><button class="button ghost small" data-action="app-sync-retry" ${disabled ? "disabled" : ""}>${tr("核对后重试")}</button>` : `<button class="button ghost small" data-action="app-sync-enable" ${disabled || !status || !snapshot.connections.some(c => c.enabled !== false) ? "disabled" : ""}>${tr("开启实验性同步")}</button>`}
      <button class="button ghost small" data-action="app-sync-status" ${!native ? "disabled" : ""}>${tr("更新状态")}</button></div>
      ${status?.enabled ? selected.map(id => `<button class="button ghost small" data-action="app-sync-review" data-id="${escape(id)}" ${disabled || !snapshot.connections.some(c => c.id === id && c.enabled !== false) ? "disabled" : ""}>${tr("核对 {0} 的变更", escape(snapshot.connections.find(c => c.id === id)?.name ?? id))}</button>`).join("") : ""}
      ${owned.length ? `<details class="app-sync-revoke"><summary>${tr("移除 App 中的受管配置")}</summary><p class="manager-meta">${tr("关闭同步会保留配置。移除需单独预览，管理器中的供应商会保留。")}</p>${owned.map(id => `<button class="button ghost small" data-action="app-sync-revoke" data-id="${escape(id)}" ${disabled ? "disabled" : ""}>${tr("移除 {0}", escape(snapshot.connections.find(c => c.id === id)?.name ?? id))}</button>`).join("")}</details>` : ""}</section>`;
  }
  function create({ invoke, snapshot, setStatus, openModal, closeModal, setBusy, refresh, onError, openDeployment }) {
    let busy = false;
    async function perform(task) {
      if (busy) return;
      busy = true;
      try { await task(); }
      catch (error) { onError(error); }
      finally { busy = false; }
    }
    function risk(preview) {
      openModal({ title: tr("启用实验性 Copilot App 同步？"), body: riskBody(preview), footer: `<button class="button ghost" data-modal-close>${tr("取消")}</button><button class="button primary" data-sync-confirm>${tr("我理解风险并启用")}</button>`, onOpen(root) {
        let planId = preview.id;
        root.querySelector("[data-sync-confirm]").addEventListener("click", () => perform(async () => {
          if (!planId || !root.isConnected) return;
          const id = planId; planId = null; setBusy(true);
          try { setStatus(await invoke("enable_app_sync", { planId: id, confirmed: true })); setBusy(false); closeModal(); await refresh(); }
          catch (error) { setBusy(false); closeModal(); throw error; }
        }));
      } });
    }
    function choose() {
      const providers = snapshot().connections.filter(c => c.enabled !== false);
      openModal({ title: tr("选择自动同步的供应商"), body: `<p>${tr("仅同步勾选的已保存供应商，最多 16 个。先关闭 Copilot App，再核对写入计划。")}</p><div class="app-sync-choices">${providers.map(c => `<label class="checkbox-row"><input type="checkbox" data-sync-provider value="${escape(c.id)}"><span>${escape(c.name)}</span></label>`).join("")}</div><p data-sync-error role="status"></p>`, footer: `<button class="button ghost" data-modal-close>${tr("取消")}</button><button class="button primary" data-sync-preview>${tr("核对范围与风险")}</button>`, onOpen(root) {
        root.querySelector("[data-sync-preview]").addEventListener("click", () => perform(async () => {
          const ids = [...root.querySelectorAll("[data-sync-provider]")].filter(e => e.checked).map(e => e.value);
          if (!ids.length || ids.length > 16) { root.querySelector("[data-sync-error]").textContent = tr("请选择 1 至 16 个供应商。"); return; }
          setBusy(true);
          let preview;
          try { preview = await invoke("preview_app_sync_enable", { connectionIds: ids }); }
          finally { setBusy(false); }
          if (root.isConnected) risk(preview);
        }));
      } });
    }
    async function revoke(id) {
      const plan = await invoke("preview_app_sync_revoke", { connectionId: id });
      openModal({ title: tr("移除 App 中的受管配置"), body: `<p>${tr("只移除本管理器拥有的 App 供应商和模型，并停止该供应商的自动同步。管理器中的供应商与密钥会保留。")}</p>${removalReview(plan)}<ul>${plan.operations.map(o => `<li>${escape(o.description)}</li>`).join("")}</ul>`, footer: `<button class="button ghost" data-modal-close>${tr("取消")}</button><button class="button danger" data-sync-revoke>${tr("确认移除")}</button>`, onOpen(root) {
        let planId = plan.id;
        const checkbox = root.querySelector("[data-app-models-resolved]"), button = root.querySelector("[data-sync-revoke]");
        if (checkbox) { button.disabled = true; checkbox.addEventListener("change", () => { button.disabled = !checkbox.checked; }); }
        button.addEventListener("click", () => perform(async () => {
          if (!planId || button.disabled) return;
          const id = planId; planId = null; setBusy(true);
          try {
            const result = await invoke("apply_deployment_plan", { planId: id, confirmed: true, appModelReferencesResolved: checkbox?.checked === true });
            setBusy(false); closeModal(); await refresh();
            if (result.records.some(r => r.status !== "applied")) throw new Error(tr("移除未完成，请核对发布记录与恢复状态。"));
          } catch (error) { setBusy(false); closeModal(); throw error; }
        }));
      } });
    }
    function handle(action, id) {
      if (!action.startsWith("app-sync-")) return false;
      if (busy) return true;
      if (action === "app-sync-enable") choose();
      else if (action === "app-sync-review") {
        const provider = snapshot().connections.find(c => c.id === id);
        if (provider) openDeployment(provider, ["github-copilot-app:local"]);
      } else void perform(async () => {
        if (action === "app-sync-revoke") return revoke(id);
        const command = ({ "app-sync-disable": "disable_app_sync", "app-sync-retry": "retry_app_sync", "app-sync-status": "get_app_sync_status" })[action];
        if (command) { setStatus(await invoke(command)); if (action !== "app-sync-status") await refresh(); }
      });
      return true;
    }
    return { handle };
  }
  return { label, panel, removalReview, riskBody, create };
});
