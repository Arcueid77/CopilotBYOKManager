(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerInlineDeployment = api;
})(globalThis, function () {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  function mount({ container, connection, targets, selectedIds, invoke, onApplied, onError, onBusyChange, native, autoPublish = false, onClose }) {
    const opener = container.ownerDocument.activeElement;
    const manager = globalThis.CopilotBYOKManagerManager;
    const clients = globalThis.CopilotBYOKManagerClients;
    const escape = manager.escape;
    const review = globalThis.CopilotBYOKManagerDeploymentReview.createSession(invoke);
    const root = document.createElement("section");
    root.className = "manager-inline-preview";
    root.id = "inline-deployment";
    root.setAttribute("aria-label", tr("发布配置"));
    root.innerHTML = `<header class="manager-section-head"><h2>${tr("发布 {0}", escape(connection.name))}</h2><button class="button ghost small" data-deployment-close>${tr("收起")}</button></header>
      ${native ? "" : `<p class="preview-banner">${tr("模拟发布，不修改客户端")}</p>`}
      <p class="manager-meta">${tr("选择要发布到的应用。")}</p>
      <div class="manager-targets">${targets.map((target, index) => `<label class="manager-target"><input type="checkbox" name="deployment-target" id="target-${escape(target.id)}" value="${escape(target.id)}" data-target-index="${index}" ${target.detected && target.supportsWrite && (!selectedIds || selectedIds.includes(target.id)) ? "checked" : ""} ${!target.detected ? "disabled" : ""} /><span><strong>${escape(globalThis.CopilotBYOKManagerClients.name(target))}</strong><small data-target-status></small></span></label>`).join("")}</div>
      <div id="deployment-preview" role="status"></div>
      <footer class="manager-preview-actions"><button class="button ghost" id="preview-deployment">${tr("查看变更")}</button><button class="button primary" id="apply-deployment">${tr("发布配置")}</button></footer>`;
    container.append(root);
    const preview = root.querySelector("#preview-deployment");
    const apply = root.querySelector("#apply-deployment");
    const body = root.querySelector("#deployment-preview");
    const close = root.querySelector("[data-deployment-close]");
    const inputs = Array.from(root.querySelectorAll('[name="deployment-target"]'));
    const statuses = Array.from(root.querySelectorAll("[data-target-status]"));
    let disposed = false, applying = false, refreshReview = false;
    function checkedTargets() {
      return inputs.filter(input => input.checked).map(input => targets[Number(input.dataset.targetIndex)]);
    }
    function reviewBeforePublish() {
      return checkedTargets().some(target => target.supportsWrite &&
        (target.kind === "copilot-cli" || target.kind === "github-copilot-app" || !connection.models.some(model => model.enabled)));
    }
    function setApplying(value) { applying = value; root.setAttribute("aria-busy", String(value)); onBusyChange?.(value); }
    function targetStatus(target, operation, selected) {
      if (!target.detected) return tr("未检测到");
      if (operation?.supported && operation.targetKind === "github-copilot-app" && review.plan?.appRecreatesProvider) {
        return tr("此供应商已在 App 内删除，确认发布后将重新创建。");
      }
      if (operation?.supported) return tr("可自动发布");
      if (operation) return clients.blockerText(operation.blocker) || tr("本次无法自动发布");
      if (!target.supportsWrite) return tr("仅手动处理");
      return selected && review.busy ? tr("正在核对…") : tr("待核对");
    }
    function buttons() {
      if (disposed) return;
      const operations = new Map(review.plan?.operations.map(operation => [operation.targetId, operation]));
      for (const [index, target] of targets.entries()) {
        const operation = operations.get(target.id);
        statuses[index].textContent = targetStatus(target, operation, inputs[index].checked);
        statuses[index].classList.toggle("target-blocked", operation?.supported === false);
      }
      preview.hidden = Boolean(review.plan && !review.plan.operations.some(operation => !operation.supported));
      preview.textContent = review.plan ? tr("重新核对") : tr("查看变更");
      preview.disabled = review.busy || applying;
      apply.disabled = review.busy || applying || (review.plan
        ? !review.plan.operations.some(operation => operation.supported) || (review.plan.appModelRemovals?.length > 0 && !root.querySelector("[data-app-models-resolved]")?.checked)
        : !inputs.some(input => input.checked && targets[Number(input.dataset.targetIndex)].supportsWrite));
      apply.textContent = review.plan ? tr("确认发布") : tr("发布配置");
      close.disabled = review.busy || applying;
    }
    function dispose(restoreFocus = false) {
      if (applying) return false;
      if (disposed) return true;
      disposed = true; review.invalidate(); root.remove();
      if (restoreFocus) {
        const fallback = [...container.querySelectorAll('[data-action="deploy-connection"]')].find(button => button.dataset.id === connection.id) ?? container.ownerDocument.querySelector("#page-title");
        const target = opener?.isConnected && !opener.disabled ? opener : fallback;
        if (target) { if (!target.matches("button")) target.tabIndex = -1; target.focus({ preventScroll: true }); target.scrollIntoView({ block: "nearest" }); }
      }
      return true;
    }
    Object.defineProperty(dispose, "busy", { get: () => applying });
    close.addEventListener("click", () => { if (dispose(true) !== false) onClose?.(); });
    inputs.forEach(input => input.addEventListener("change", () => {
      const hadPreview = Boolean(review.plan);
      review.invalidate(); body.textContent = hadPreview ? tr("目标已改变，发布时会重新检查。") : ""; buttons();
      void prepareReview();
    }));
    async function generatePreview() {
      const targetIds = checkedTargets().map(target => target.id);
      if (!targetIds.length) { body.textContent = tr("请至少选择一个目标。"); return null; }
      body.textContent = tr("正在核对目标和写入计划…");
      const request = review.preview(connection.id, targetIds);
      buttons();
      const plan = await request;
      if (disposed || !plan) return null;
      body.innerHTML = `${!connection.models.some(model => model.enabled) && plan.operations.some(operation => operation.supported && operation.targetKind !== "github-copilot-app") ? `<p class="inline-error">${tr("空模型目录：将移除本连接的供应商分组。")}</p>` : ""}<details class="deployment-write-details"><summary>${tr("写入明细")}</summary><div class="manager-operations">${plan.operations.map(operation => {
        const target = targets.find(target => target.id === operation.targetId);
        return `<article class="manager-operation"><h3>${escape(target ? globalThis.CopilotBYOKManagerClients.name(target) : operation.title)}</h3><p>${escape(operation.description)}</p>${operation.supported ? `<ul>${operation.changes.map(change => `<li>${escape(change)}</li>`).join("")}</ul><p>${escape(manager.policy(operation.targetKind, true))}</p>` : ""}</article>`;
      }).join("")}</div></details>${plan.appScopeConfirmation ? `<p class="manager-meta">${tr("发布后，保存此供应商的变更会自动同步到 Copilot App。")}</p>${connection.hasSecret ? `<p class="inline-error">${tr("Copilot App 会在本地数据库中以明文保存此供应商的密钥，数据库日志和备份也可能保留该密钥。")}</p>` : ""}` : ""}${globalThis.CopilotBYOKManagerAppSync.removalReview(plan)}`;
      root.querySelector("[data-app-models-resolved]")?.addEventListener("change", buttons);
      return plan;
    }
    function showFailure(message, error) {
      if (disposed) return;
      body.innerHTML = `<p>${escape(message)}</p><details><summary>${tr("详细原因")}</summary><p>${escape(error?.message ?? String(error))}</p></details>`;
      body.tabIndex = -1; body.focus({ preventScroll: true });
    }
    async function prepareReview(explicit = false) {
      if (!explicit && !reviewBeforePublish()) return;
      if (review.busy && !applying) { refreshReview = true; return; }
      if (review.busy || applying || disposed) return;
      try {
        await generatePreview();
      } catch (error) {
        review.invalidate();
        if (!disposed) { showFailure(tr("无法生成预览，请核对后重试。"), error); onError(error); }
      } finally {
        buttons();
        if (refreshReview) { refreshReview = false; void prepareReview(); }
      }
    }
    preview.addEventListener("click", () => prepareReview(true));
    apply.addEventListener("click", async () => {
      if (review.busy || applying || disposed) return;
      setApplying(true);
      inputs.forEach(input => { input.disabled = true; });
      let writeStarted = false;
      try {
        const alreadyReviewed = Boolean(review.plan);
        const plan = review.plan ?? await generatePreview();
        if (disposed || !plan || !plan.operations.some(operation => operation.supported)) return;
        // A new destination scope or credential-file write requires a visible review.
        if (!alreadyReviewed && (!connection.models.some(model => model.enabled)
          || plan.appModelRemovals?.length
          || plan.appScopeConfirmation
          || plan.appRecreatesProvider
          || plan.operations.some(operation => !operation.supported || operation.targetKind === "copilot-cli"))) return;
        const resolved = root.querySelector("[data-app-models-resolved]")?.checked === true;
        if (plan.appModelRemovals?.length && !resolved) return;
        writeStarted = true;
        const request = review.apply({
          appModelReferencesResolved: resolved,
          appScopeConfirmed: plan.appScopeConfirmation === true && alreadyReviewed,
          appRecreationConfirmed: plan.appRecreatesProvider === true && alreadyReviewed,
        });
        body.textContent = tr("正在发布配置…");
        buttons();
        const result = await request;
        setApplying(false);
        await onApplied(result);
        dispose();
      } catch (error) {
        review.invalidate();
        showFailure(writeStarted ? tr("发布失败或结果不确定。请核对结果与恢复状态后重试。") : tr("无法生成预览，请核对后重试。"), error);
        if (!disposed) { body.tabIndex = -1; body.focus({ preventScroll: true }); }
        onError(error);
      } finally {
        setApplying(false);
        inputs.forEach(input => { input.disabled = !targets[Number(input.dataset.targetIndex)].detected; });
        buttons();
      }
    });
    root.scrollIntoView({ block: "nearest", behavior: "smooth" });
    buttons();
    if (autoPublish && !reviewBeforePublish()) apply.click();
    else {
      apply.focus({ preventScroll: true });
      void prepareReview();
    }
    return dispose;
  }
  return { mount };
});
