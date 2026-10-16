(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerInlineDeployment = api;
})(globalThis, function () {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  function mount({ container, connection, targets, selectedIds, invoke, onApplied, onError, onBusyChange, native, autoPublish = false }) {
    const opener = container.ownerDocument.activeElement;
    const manager = globalThis.CopilotBYOKManagerManager;
    const escape = manager.escape;
    const review = globalThis.CopilotBYOKManagerDeploymentReview.createSession(invoke);
    const root = document.createElement("section");
    root.className = "manager-inline-preview";
    root.id = "inline-deployment";
    root.setAttribute("aria-label", tr("发布配置"));
    root.innerHTML = `<header class="manager-section-head"><h2>${tr("发布 {0}", escape(connection.name))}</h2><button class="button ghost small" data-deployment-close>${tr("收起")}</button></header>
      ${native ? "" : `<p class="preview-banner">${tr("模拟发布，不修改客户端")}</p>`}
      <p class="manager-meta">${tr("选择应用后发布，完成后显示结果。覆盖 CLI 环境配置或移除模型时会先请你确认。")}</p>
      <div class="manager-targets">${targets.map((target, index) => `<label class="manager-target"><input type="checkbox" name="deployment-target" id="target-${escape(target.id)}" value="${escape(target.id)}" data-target-index="${index}" ${target.detected && target.supportsWrite && (selectedIds ? selectedIds.includes(target.id) : target.kind !== "copilot-cli") ? "checked" : ""} ${!target.detected ? "disabled" : ""} /><span><strong>${escape(globalThis.CopilotBYOKManagerClients.name(target))}</strong><small>${!target.detected ? tr("未检测到") : target.supportsWrite ? tr("可自动发布") : tr("仅手动处理")}</small>${target.kind === "copilot-cli" && target.supportsWrite ? `<small class="manager-route-warning">${tr("使用所选供应商替换 CLI 当前环境配置。请主动勾选。")}</small>` : ""}</span></label>`).join("")}</div>
      <div id="deployment-preview" role="status"><p class="manager-meta">${tr("选择应用后即可发布。")}</p></div>
      <footer class="manager-preview-actions"><button class="button ghost" id="preview-deployment">${tr("查看变更")}</button><button class="button primary" id="apply-deployment">${tr("发布配置")}</button></footer>`;
    container.append(root);
    const preview = root.querySelector("#preview-deployment");
    const apply = root.querySelector("#apply-deployment");
    const body = root.querySelector("#deployment-preview");
    const close = root.querySelector("[data-deployment-close]");
    const inputs = Array.from(root.querySelectorAll('[name="deployment-target"]'));
    let disposed = false, applying = false;
    function setApplying(value) { applying = value; root.setAttribute("aria-busy", String(value)); onBusyChange?.(value); }
    function buttons() {
      if (disposed) return;
      preview.disabled = review.busy || applying;
      apply.disabled = review.busy || applying || (review.plan
        ? !review.plan.operations.some(operation => operation.supported)
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
    close.addEventListener("click", () => dispose(true));
    inputs.forEach(input => input.addEventListener("change", () => {
      review.invalidate(); body.textContent = tr("目标已改变，发布时会重新检查。"); buttons();
    }));
    async function generatePreview() {
      const targetIds = inputs.filter(input => input.checked).map(input => input.value);
      if (!targetIds.length) { body.textContent = tr("请至少选择一个目标。"); return null; }
      body.textContent = tr("正在核对目标和写入计划…");
      const request = review.preview(connection.id, targetIds);
      buttons();
      const plan = await request;
      if (disposed || !plan) return null;
      body.innerHTML = `<div class="manager-operations">${plan.operations.map(operation => {
        const target = targets.find(target => target.id === operation.targetId);
        const count = connection.models.filter(model => model.enabled).length;
        return `<article class="manager-operation"><h3>${escape(target ? globalThis.CopilotBYOKManagerClients.name(target) : operation.title)} <span class="manager-meta">${operation.supported ? tr("自动写入") : tr("需手动处理")}</span></h3><p>${escape(manager.policy(target?.kind ?? operation.targetKind))}</p>${operation.supported && !count ? `<p class="inline-error">${tr("空模型目录：将移除本连接的供应商分组。")}</p>` : ""}<details><summary>${tr("写入明细")}</summary><p>${escape(operation.description)}</p><ul>${operation.changes.map(change => `<li>${escape(change)}</li>`).join("")}</ul></details></article>`;
      }).join("")}</div>`;
      return plan;
    }
    function showFailure(message, error) {
      if (disposed) return;
      body.innerHTML = `<p>${escape(message)}</p><details><summary>${tr("详细原因")}</summary><p>${escape(error?.message ?? String(error))}</p></details>`;
      body.tabIndex = -1; body.focus({ preventScroll: true });
    }
    preview.addEventListener("click", async () => {
      if (review.busy || applying || disposed) return;
      try {
        await generatePreview();
      } catch (error) {
        review.invalidate();
        if (!disposed) { showFailure(tr("无法生成预览，请核对后重试。"), error); onError(error); }
      } finally { buttons(); }
    });
    apply.addEventListener("click", async () => {
      if (review.busy || applying || disposed) return;
      setApplying(true);
      inputs.forEach(input => { input.disabled = true; });
      try {
        const alreadyReviewed = Boolean(review.plan);
        const plan = review.plan ?? await generatePreview();
        if (disposed || !plan || !plan.operations.some(operation => operation.supported)) return;
        // Normal publication is one click. Keep a reviewed confirmation for
        // replacing the CLI's exclusive route or removing a provider group.
        if (!alreadyReviewed && (!connection.models.some(model => model.enabled)
          || plan.operations.some(operation => operation.supported && operation.targetKind === "copilot-cli"))) return;
        const request = review.apply();
        body.textContent = tr("正在发布配置…");
        buttons();
        const result = await request;
        setApplying(false);
        await onApplied(result);
        dispose();
      } catch (error) {
        review.invalidate();
        showFailure(tr("发布失败或结果不确定。请核对结果与恢复状态后重试。"), error);
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
    if (autoPublish) apply.click();
    else apply.focus({ preventScroll: true });
    return dispose;
  }
  return { mount };
});
