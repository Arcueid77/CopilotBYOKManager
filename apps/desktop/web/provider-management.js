(function (root, factory) {
  const api = factory(root.CopilotBYOKManagerI18n, root.CopilotBYOKManagerManager);
  root.CopilotBYOKManagerProviderManagement = api;
})(globalThis, function (i18n, manager) {
  "use strict";
  const tr = i18n.t, escape = manager.escape;

  function fieldLabel(field) {
    switch (field.kind) {
      case "name": return tr("供应商名称");
      case "endpoint": return tr("端点 URL");
      case "modelName": return tr("模型名称");
      case "modelEndpoint": return tr("模型端点 URL");
      default: return "";
    }
  }

  function errorText(error) {
    switch (error) {
      case "stale": return tr("应用配置已变化，请重新打开管理配置。");
      case "busy": return tr("有其他配置操作正在进行，请完成后重试。");
      case "invalid": return tr("请检查名称和端点 URL。");
      case "recovery": return tr("请先完成配置恢复。");
      case "appRunning": return tr("退出 Copilot App 后重新核对。");
      case "permissions": return tr("请检查 App 数据目录的读取权限。");
      case "referenced": return tr("Copilot App 仍在引用该供应商或模型。请在 App 的 Model providers 设置中处理。");
      default: return tr("此应用配置无法安全读取或写入，请在应用内检查。");
    }
  }

  function create({ invoke, openModal, closeModal, setBusy, refresh, done, editSaved, revokeApp }) {
    const closeButton = () => `<button class="button ghost" data-modal-close>${tr("关闭")}</button>`;
    const cancelButton = () => `<button class="button ghost" data-modal-close>${tr("取消")}</button>`;
    const message = '<p class="inline-error" data-existing-error role="alert" hidden></p>';
    const displayName = entry => entry.name || tr("未命名供应商");
    const sharedScope = inventory => inventory.sharedInstances > 1
      ? `<p class="manager-meta">${tr("这份配置由 {0} 个应用实例共用。", inventory.sharedInstances)}</p>` : "";

    function showError(root, error) {
      const notice = root.querySelector("[data-existing-error]");
      notice.hidden = false;
      notice.textContent = errorText(error);
    }

    function open(targetId, appName) {
      const title = tr("{0} 的供应商配置", appName);
      openModal({ title, body: `<p role="status">${tr("正在读取应用配置…")}</p>${message}`, footer: closeButton(), async onOpen(root) {
        try {
          const inventory = await invoke("list_existing_providers", { targetId });
          if (root.isConnected) list(title, { ...inventory, appName });
        } catch (error) {
          if (root.isConnected) {
            root.querySelector('[role="status"]').hidden = true;
            showError(root, error);
          }
        }
      } });
    }

    function rows(entries) {
      return entries.length ? `<div class="existing-providers">${entries.map((entry, index) => {
        const endpoint = entry.fields?.find(field => field.kind === "endpoint" || field.kind === "modelEndpoint");
        const models = entry.syncRecordOnly ? tr("仅有管理器的同步记录") : Number.isInteger(entry.modelCount) ? tr("{0} 个模型", entry.modelCount) : tr("模型数量未知");
        const sameName = entry.manualDeletionId && entries.some(other => other !== entry && displayName(other) === displayName(entry));
        const ref = sameName ? ` · ${tr("条目 {0}", escape(entry.manualDeletionId.slice(0, 8)))}` : "";
        return `<article class="existing-provider-row"><div><strong>${escape(displayName(entry))}</strong><small>${models}${endpoint ? ` · ${escape(endpoint.value)}` : ""}${ref}</small></div>
          <div class="inline-actions">${entry.editable ? `<button type="button" class="button ghost small" data-existing-edit="${index}">${tr("编辑")}</button>` : ""}${entry.deletable !== false ? `<button type="button" class="button ghost small danger-text" data-existing-delete="${index}">${entry.syncRecordOnly ? tr("撤销同步") : tr("删除")}</button>` : ""}</div></article>`;
      }).join("")}</div>` : `<p class="manager-meta">${tr("此应用暂无可管理的供应商。")}</p>`;
    }

    function list(title, inventory) {
      const entries = inventory.entries.map(entry => ({ ...entry, editable: entry.fields.length > 0 }));
      openModal({ title, body: `${sharedScope(inventory)}${rows(entries)}`, wide: true, footer: closeButton(), onOpen(root) {
        root.querySelectorAll("[data-existing-edit]").forEach(button => button.addEventListener("click", () => edit(inventory, Number(button.dataset.existingEdit))));
        root.querySelectorAll("[data-existing-delete]").forEach(button => button.addEventListener("click", () => remove(inventory, Number(button.dataset.existingDelete))));
      } });
    }

    function openApp(appName, entries) {
      const guide = entries.some(entry => entry.deletable === false) ? `<p class="manager-meta">${tr("手动添加的供应商可在 Copilot App 的 Model providers 设置中编辑和删除。")}</p>` : "";
      openModal({ title: tr("{0} 的供应商配置", appName), body: rows(entries) + guide, wide: true, footer: closeButton(), onOpen(root) {
        root.querySelectorAll("[data-existing-edit]").forEach(button => button.addEventListener("click", () => editSaved(entries[Number(button.dataset.existingEdit)].id)));
        root.querySelectorAll("[data-existing-delete]").forEach(button => button.addEventListener("click", () => {
          const index = Number(button.dataset.existingDelete);
          if (entries[index].manualDeletionId) remove({ appName, entries }, index);
          else revokeApp(entries[index].id);
        }));
      } });
    }

    async function write(root, button, plan, kind, command = "apply_existing_provider_change") {
      button.disabled = true;
      setBusy(true);
      try {
        await invoke(command, { planId: await plan(), confirmed: true });
        setBusy(false);
        closeModal();
        await refresh();
        done(kind);
      } catch (error) {
        if (root.isConnected) {
          setBusy(false);
          showError(root, error);
          button.disabled = kind === "delete" || error === "stale" || error === "recovery";
        }
      }
    }

    function review(inventory, index, change) {
      return invoke("preview_existing_provider_change", { inventoryId: inventory.inventoryId, providerIndex: index, change });
    }

    function edit(inventory, index) {
      const entry = inventory.entries[index];
      const endpoint = field => ["endpoint", "modelEndpoint"].includes(field.kind);
      const fields = entry.fields.map((field, i) => `<label class="form-field"><span>${escape(fieldLabel(field))}${field.model ? ` · ${escape(field.model)}` : ""}</span><input name="provider-field-${i}" data-existing-field="${i}" maxlength="${endpoint(field) ? 2048 : 512}" required value="${escape(field.value)}"></label>`).join("");
      openModal({ title: tr("编辑 {0}", displayName(entry)), wide: true,
        body: `<p class="manager-meta">${escape(inventory.appName)}</p>${sharedScope(inventory)}<form id="existing-provider-form">${fields}<p class="manager-meta" data-endpoint-change hidden>${tr("修改端点后，应用将使用此配置中已有的密钥访问新地址。")}</p>${message}</form>`,
        footer: `${cancelButton()}<button type="submit" form="existing-provider-form" class="button primary" data-existing-save disabled>${tr("保存修改")}</button>`,
        onOpen(root) {
          const form = root.querySelector("form"), button = root.querySelector("[data-existing-save]");
          const inputs = [...form.querySelectorAll("[data-existing-field]")];
          const getChanges = () => inputs.map((input, i) => ({ index: i, value: input.value.trim() })).filter(field => field.value !== entry.fields[field.index].value);
          form.addEventListener("input", () => {
            const changes = getChanges();
            button.disabled = !changes.length;
            root.querySelector("[data-endpoint-change]").hidden = !changes.some(field => endpoint(entry.fields[field.index]));
          });
          form.addEventListener("submit", event => {
            event.preventDefault();
            if (button.disabled) return;
            const changed = getChanges();
            if (changed.length) void write(root, button, () => review(inventory, index, { kind: "edit", fields: changed }), "edit");
          });
        }
      });
    }

    function remove(inventory, index) {
      const entry = inventory.entries[index];
      let pending;
      function discard() {
        if (pending) void invoke("discard_existing_provider_change", { planId: pending }).catch(() => {});
        pending = null;
      }
      openModal({ title: tr("删除 {0}", displayName(entry)), compact: true,
        body: `<p>${tr("将从 {0} 中删除该供应商及其 {1} 个模型。", escape(inventory.appName), entry.modelCount)}</p><p class="manager-meta" data-delete-origin hidden></p>${sharedScope(inventory)}${message}`,
        footer: `${cancelButton()}<button type="button" class="button danger" data-existing-confirm disabled>${tr("确认删除")}</button>`,
        onClose: discard,
        async onOpen(root) {
          const button = root.querySelector("[data-existing-confirm]");
          try {
            const manual = entry.manualDeletionId;
            const preview = manual
              ? await invoke("preview_app_provider_delete", { selection: manual })
              : await review(inventory, index, { kind: "delete" });
            pending = manual ? preview.planId : preview;
            if (!root.isConnected) { discard(); return; }
            if (manual && preview.origin) {
              const origin = root.querySelector("[data-delete-origin]");
              origin.textContent = preview.origin;
              origin.hidden = false;
            }
            button.disabled = false;
            button.addEventListener("click", () => {
              const plan = pending;
              pending = null;
              void write(root, button, () => plan, "delete", manual ? "apply_app_provider_delete" : "apply_existing_provider_change");
            }, { once: true });
          } catch (error) { if (root.isConnected) showError(root, error); }
        }
      });
    }

    return { open, openApp };
  }

  return { create };
});
