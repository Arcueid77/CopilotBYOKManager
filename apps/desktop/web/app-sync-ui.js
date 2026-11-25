(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerAppSync = api;
})(globalThis, function () {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  function compatibilityLabel(issue) {
    switch (issue) {
      case "platform": return tr("自动同步需要 Windows x64。");
      case "notInstalled": return tr("请先安装 Copilot App。");
      case "version": return tr("无法识别已安装的 Copilot App 稳定版本。");
      case "identity": return tr("无法验证 GitHub 发布的 x64 Copilot App。请检查安装来源。");
      case "schema": return tr("此 App 数据库格式暂不支持自动同步，请使用配置指引。");
      default: return "";
    }
  }
  function removalReview(plan) {
    if (!plan.appModelRemovals?.length) return "";
    return `<div class="app-sync-removal"><p>${tr("将从 Copilot App 移除这些模型：{0}", escape(plan.appModelRemovals.join(", ")))}</p><label class="checkbox-row"><input type="checkbox" data-app-models-resolved><span>${tr("我已在 App 中将当前和默认模型切换到其他模型，并关闭 App。")}</span></label></div>`;
  }
  function settings(status, snapshot, native) {
    const frozen = Boolean(snapshot.stateRecovery || snapshot.deploymentRecovery);
    const enabled = status?.enabled === true;
    const reason = compatibilityLabel(status?.compatibilityIssue);
    return `<section data-app-sync-settings>
      ${reason ? `<p class="manager-meta">${reason}</p>` : ""}
      <button type="button" role="switch" class="switch manager-switch" aria-label="${tr("实验性自动同步")}" aria-checked="${enabled}"
        data-action="${enabled ? "app-sync-disable" : "app-sync-enable"}" ${!native || (!enabled && (frozen || !status?.reviewSupported)) ? "disabled" : ""}><span></span></button>
    </section>`;
  }
  function failureMessage(error) {
    const reason = compatibilityLabel(error?.compatibilityIssue);
    if (reason) return reason;
    if (error?.code === "appRunning") return tr("Copilot App 仍在后台运行。请从它的托盘菜单退出后再试。");
    if (error?.code === "appExitUnverified") return tr("无法确认 Copilot App 已退出。请检查后台进程后重试。");
    if (error?.code === "unsafePermissions") return tr("App 数据目录允许其他账号读取。请先收紧权限，再核对同步。");
    if (error?.code === "writeBusy") return tr("有其他配置操作正在进行，请完成后重试。");
    return error?.message || String(error);
  }
  function create({ invoke, setStatus, openModal, closeModal, setBusy, refresh, onError }) {
    let busy = false;
    async function perform(task) {
      if (busy) return;
      busy = true;
      try { await task(); }
      catch (error) { onError(new Error(failureMessage(error), { cause: error })); }
      finally { busy = false; }
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
      if (action === "app-sync-revoke") {
        void perform(() => revoke(id));
        return true;
      }
      const command = ({ "app-sync-enable": "enable_app_sync_waiting", "app-sync-disable": "disable_app_sync" })[action];
      if (!command) return false;
      void perform(async () => {
        setStatus(await invoke(command));
        await refresh();
      });
      return true;
    }
    return { handle };
  }
  return { settings, removalReview, create };
});
