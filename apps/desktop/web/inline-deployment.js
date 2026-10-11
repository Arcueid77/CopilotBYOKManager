(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PilotWeaveInlineDeployment = api;
})(globalThis, function () {
  "use strict";
  function mount({ container, connection, targets, selectedIds, invoke, onApplied, onError, native }) {
    const manager = globalThis.PilotWeaveManager;
    const escape = manager.escape;
    const review = globalThis.PilotWeaveDeploymentReview.createSession(invoke);
    const root = document.createElement("section");
    root.className = "manager-inline-preview";
    root.id = "inline-deployment";
    root.setAttribute("aria-label", "发布预览");
    root.innerHTML = `<header class="manager-section-head"><h2>发布 ${escape(connection.name)}</h2><button class="button ghost small" data-deployment-close>收起</button></header>
      ${native ? "" : '<p class="preview-banner">模拟发布，不修改客户端</p>'}
      <p class="manager-meta">选择目标，生成预览，再确认写入。预览 15 分钟内有效，只能使用一次。</p>
      <div class="manager-targets">${targets.map((target, index) => `<label class="manager-target"><input type="checkbox" name="deployment-target" id="target-${escape(target.id)}" value="${escape(target.id)}" data-target-index="${index}" ${target.detected && target.supportsWrite && (!selectedIds || selectedIds.includes(target.id)) ? "checked" : ""} ${!target.detected ? "disabled" : ""} /><span><strong>${escape(target.name)}</strong><small>${!target.detected ? "未检测到" : target.supportsWrite ? "可自动发布" : "仅手动处理"}</small></span></label>`).join("")}</div>
      <div id="deployment-preview" role="status"><p class="manager-meta">尚未生成预览。</p></div>
      <footer class="manager-preview-actions"><button class="button ghost" id="preview-deployment">生成预览</button><button class="button primary" id="apply-deployment" disabled>确认发布</button></footer>`;
    container.append(root);
    const preview = root.querySelector("#preview-deployment");
    const apply = root.querySelector("#apply-deployment");
    const body = root.querySelector("#deployment-preview");
    const close = root.querySelector("[data-deployment-close]");
    const inputs = Array.from(root.querySelectorAll('[name="deployment-target"]'));
    let disposed = false;
    function buttons() {
      if (disposed) return;
      preview.disabled = review.busy;
      apply.disabled = review.busy || !review.plan?.operations.some(operation => operation.supported);
      close.disabled = review.busy;
    }
    function dispose() { disposed = true; review.invalidate(); root.remove(); }
    close.addEventListener("click", dispose);
    inputs.forEach(input => input.addEventListener("change", () => {
      review.invalidate(); body.textContent = "目标已改变，请重新生成预览。"; buttons();
    }));
    preview.addEventListener("click", async () => {
      if (review.busy || disposed) return;
      const targetIds = inputs.filter(input => input.checked).map(input => input.value);
      if (!targetIds.length) { body.textContent = "请至少选择一个目标。"; return; }
      body.textContent = "正在核对目标和写入计划…";
      try {
        const request = review.preview(connection.id, targetIds);
        buttons();
        const plan = await request;
        if (disposed || !plan) return;
        body.innerHTML = `<div class="manager-operations">${plan.operations.map(operation => {
          const target = targets.find(target => target.id === operation.targetId);
          const count = connection.models.filter(model => model.enabled).length;
          return `<article class="manager-operation"><h3>${escape(target?.name ?? operation.title)} <span class="manager-meta">${operation.supported ? "自动写入" : "需手动处理"}</span></h3><p>${escape(manager.policy(target?.kind ?? operation.targetKind))}</p>${operation.supported && !count ? '<p class="inline-error">空模型目录：将移除本连接的供应商分组。</p>' : ""}<details><summary>写入明细</summary><p>${escape(operation.description)}</p><ul>${operation.changes.map(change => `<li>${escape(change)}</li>`).join("")}</ul></details></article>`;
        }).join("")}</div>`;
      } catch (error) {
        review.invalidate();
        if (!disposed) { body.textContent = "无法生成预览，请核对后重试。"; onError(error); }
      } finally { buttons(); }
    });
    apply.addEventListener("click", async () => {
      if (review.busy || disposed || !review.plan) return;
      inputs.forEach(input => { input.disabled = true; });
      try {
        const request = review.apply();
        buttons();
        const result = await request;
        await onApplied(result);
        dispose();
      } catch (error) {
        review.invalidate();
        if (!disposed) { body.textContent = "上次预览不可重用，请重新预览后再确认。"; onError(error); }
      } finally {
        inputs.forEach(input => { input.disabled = !targets[Number(input.dataset.targetIndex)].detected; });
        buttons();
      }
    });
    root.scrollIntoView({ block: "nearest", behavior: "smooth" });
    preview.focus({ preventScroll: true });
    return dispose;
  }
  return { mount };
});
