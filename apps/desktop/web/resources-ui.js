((scope) => {
  "use strict";
  const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const kindLabel = (kind) => ({ mcp: "MCP (HTTPS)", skill: "技能", instructions: "指令" })[kind] ?? "不支持";
  const date = (value) => Number.isNaN(Date.parse(value)) ? "未知" : new Date(value).toLocaleString("zh-CN");
  let context;

  function render(overview, error, native, blocked = false) {
    const writable = native && !blocked;
    const records = overview?.resources ?? [];
    return `<section class="usage-panel"><div class="step-heading"><h2>共享资源</h2><button class="button primary small" data-resource-action="add" ${!writable ? "disabled" : ""}>添加资源</button></div>
      <p class="install-copy">资源先保存到本地，再预览发布。App、命名配置与自定义路径保持手动；不导入密钥或客户端认证。</p>
      ${!native ? '<p class="preview-banner">浏览器试用不可用，不读取本地目录或客户端文件。</p>' : ""}
      ${error ? `<p class="inline-error">${escape(error)}</p>` : ""}
      ${blocked ? '<p class="inline-error">恢复期间暂停写入，请先核对恢复。</p>' : ""}
      ${overview?.detail ? `<p class="muted">${escape(overview.detail)}</p>` : ""}
      ${native && !overview ? '<p class="usage-empty">资源存储不可用，请核对恢复状态。</p>' : ""}
      ${native && overview && records.length === 0 ? '<p class="usage-empty">尚无资源；保存不会自动发布。</p>' : ""}
      <div class="client-grid">${records.map((record) => {
        const bindings = (overview.bindings ?? []).filter((binding) => binding.resourceId === record.id);
        const unpublished = bindings.some((binding) => Date.parse(binding.deployedAt) < Date.parse(record.updatedAt));
        return `<article class="client-card resource-card"><h3>${escape(record.name)}</h3><p>${escape(kindLabel(record.kind))} · ${bindings.length ? `${bindings.length} 个最近发布绑定` : "尚未发布"}${unpublished ? " · 本地修改待发布" : ""}</p>
          <p class="muted">${bindings.map((binding) => `${escape(binding.targetId)} · ${escape(date(binding.deployedAt))}`).join("<br>") || "尚未写入客户端配置。"}</p>
          <div class="install-panel-actions"><button class="button ghost small" data-resource-action="edit" data-resource-id="${escape(record.id)}" ${!writable ? "disabled" : ""}>编辑</button><button class="button small" data-resource-action="publish" data-resource-id="${escape(record.id)}" ${!writable ? "disabled" : ""}>预览发布</button><button class="button ghost small" data-resource-action="remove" data-resource-id="${escape(record.id)}" ${!writable ? "disabled" : ""}>撤销并删除…</button></div></article>`;
      }).join("")}</div></section>`;
  }

  function renderPlan(plan) {
    const labels = { create: "新增受管配置", update: "更新受管配置", remove: "移除受管配置", unchanged: "无需修改", manual: "手动处理 / 不可用" };
    return `<ul class="resource-plan-operations">${plan.operations.map((op) => `<li><strong>${escape(op.title)}</strong> · ${escape(labels[op.change] ?? "不支持的变更")}
      ${op.destination ? `<p class="muted"><code>${escape(op.destination)}</code></p>` : ""}<p>${escape(op.detail)}</p>
      ${op.contentPreview != null ? `<details><summary>受管内容预览</summary><pre class="usage-code">${escape(op.contentPreview)}</pre></details>` : ""}</li>`).join("")}</ul>${plan.operations.length ? "" : "没有发布记录，仅删除本地条目。"}`;
  }

  function editor(record) {
    const native = context.native;
    if (!native) return;
    context.openModal({ title: record ? "编辑资源" : "添加资源", wide: true,
      body: `<form id="resource-form"><label class="field-label">名称<input class="text-input" name="name" maxlength="128" required value="${escape(record?.name)}"></label><label class="field-label">类型<select class="text-input" name="kind" ${record ? "disabled" : ""}>${["instructions", "skill", "mcp"].map((kind) => `<option value="${kind}" ${record?.kind === kind ? "selected" : ""}>${kindLabel(kind)}</option>`).join("")}</select></label><label class="field-label">内容或不含凭据的 HTTPS MCP 地址<textarea class="text-input" name="body" rows="12" maxlength="65536" required>${escape(record?.body)}</textarea></label><p class="muted">指令面向全部文件；技能填写 Markdown 正文，脚本与资源手动管理。MCP 不接受请求头、密钥或查询参数。保存不会发布。</p></form>`,
      footer: '<button class="button ghost" data-resource-close>取消</button><button class="button primary" id="save-resource">保存到本地</button>',
      onOpen(root) {
        root.querySelector("[data-resource-close]").addEventListener("click", context.closeModal);
        const save = root.querySelector("#save-resource");
        save.addEventListener("click", async () => {
          if (save.disabled) return;
          const form = root.querySelector("#resource-form"); if (!form.reportValidity()) return;
          save.disabled = true;
          try {
            await context.invoke("upsert_resource", { input: { id: record?.id ?? null, name: form.elements.name.value, kind: form.elements.kind.value, body: form.elements.body.value } });
            if (root.isConnected) context.closeModal();
            context.showToast("资源已保存，发布需另行预览"); await context.refresh();
          } catch (error) { context.showToast(error?.message ?? String(error), "error"); }
          finally { save.disabled = false; }
        });
      },
    });
  }

  function review(record, revokeAndDelete) {
    if (!context.native) return;
    context.openModal({ title: revokeAndDelete ? "核对资源撤销" : "核对资源发布", wide: true,
      body: `<p>${escape(record.name)}：写前会重检受管证明和目标指纹。预览 15 分钟有效，仅可使用一次。 ${revokeAndDelete ? "仅移除已核验的受管配置，保留用户条目。" : "仅写入支持的目标，手动客户端不计为同步成功。"}</p><div id="resource-plan" role="status">请生成预览，逐个核对目标。</div>`,
      footer: '<button class="button ghost" data-resource-close>取消</button><button class="button primary" id="review-resource">生成预览</button>',
      onOpen(root) {
        root.querySelector("[data-resource-close]").addEventListener("click", context.closeModal);
        const session = new scope.PilotWeavePlanSession(); const action = root.querySelector("#review-resource");
        action.addEventListener("click", async () => {
          if (action.disabled) return; action.disabled = true;
          try {
            if (!session.plan) {
              const generation = session.begin();
              const plan = await context.invoke("preview_resource_sync", { resourceId: record.id, revokeAndDelete });
              if (!root.isConnected || !session.accept(generation, plan)) return;
              root.querySelector("#resource-plan").innerHTML = renderPlan(plan);
              action.textContent = revokeAndDelete ? "确认撤销并删除" : "确认发布";
            } else {
              const args = session.consume(true);
              await context.invoke("apply_resource_plan", args);
              if (root.isConnected) context.closeModal();
              context.showToast(revokeAndDelete ? "受管资源配置已移除" : "已发布到支持的目标，其他客户端仍需手动配置");
              await context.refresh();
            }
          } catch (error) { session.invalidate(); action.textContent = "生成预览"; if (root.isConnected) root.querySelector("#resource-plan").textContent = error?.message ?? String(error); context.showToast(error?.message ?? String(error), "error"); }
          finally { action.disabled = false; }
        });
      },
    });
  }

  function configure(value) {
    context = value;
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-resource-action]"); if (!button || !context.native) return;
      const action = button.dataset.resourceAction;
      if (action === "add") { editor(null); return; }
      const record = context.getData()?.resources?.resources?.find((record) => record.id === button.dataset.resourceId);
      if (!record) return;
      if (action === "edit") editor(record);
      else review(record, action === "remove");
    });
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { render, renderPlan, kindLabel };
  else scope.PilotWeaveResources = { render, configure };
})(globalThis);
