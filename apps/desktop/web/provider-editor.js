(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./i18n.js") : root.CopilotBYOKManagerI18n,
    typeof module === "object" && module.exports ? require("./model-discovery.js") : root.ModelDiscovery);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerProviderEditor = api;
})(globalThis, function (i18n, discovery) {
  "use strict";
  const tr = i18n.t;
  const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  function rows(text) { return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => { const [id, ...name] = line.split("|"); return { modelId: id.trim(), name: name.join("|").trim() || id.trim() }; }); }
  function applyEnabled(models, enabled) { return models.map(model => ({ ...model, enabled: enabled.has(model.modelId) ? enabled.get(model.modelId) : model.enabled })); }
  function mount(form, connection, onChanged) {
    const field = form.querySelector("#models"), preferred = form.querySelector("#preferred-model"), list = form.querySelector("[data-draft-model-list]");
    const enabled = new Map((connection?.models ?? []).map(model => [model.modelId, model.enabled]));
    let disposed = false;
    function isEnabled(id) { return enabled.get(id) !== false; }
    function render() {
      if (disposed) return;
      const current = rows(field.value);
      list.innerHTML = current.map((model, index) => `<div class="editor-model-row"><input type="checkbox" name="draftModelEnabled" data-draft-model="${index}" aria-label="${tr("启用模型 {0}", escape(model.name))}" ${isEnabled(model.modelId) ? "checked" : ""}><div><strong>${escape(model.name)}</strong><span class="mono">${escape(model.modelId)}</span></div><button type="button" class="icon-button ${preferred.value === model.modelId ? "preferred" : ""}" data-prefer-draft="${index}" aria-label="${tr("推荐模型：{0}", escape(model.name))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/></svg></button></div>`).join("") || `<p class="editor-empty">${tr("获取模型目录，或手动添加模型。")}</p>`;
    }
    function commitManual() {
      const id = form.querySelector("[data-manual-model-id]"), name = form.querySelector("[data-manual-model-name]");
      if (!id.value.trim()) return;
      field.value = discovery.mergeModels(field.value, [{ modelId: id.value.trim(), name: name.value.trim() || id.value.trim() }]);
      id.value = ""; name.value = "";
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
    list.addEventListener("change", event => {
      if (!event.target.matches("[data-draft-model]")) return;
      const model = rows(field.value)[Number(event.target.dataset.draftModel)];
      if (model) enabled.set(model.modelId, event.target.checked);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    list.addEventListener("click", event => {
      const button = event.target.closest("[data-prefer-draft]");
      if (!button) return;
      const model = rows(field.value)[Number(button.dataset.preferDraft)];
      if (!model) return;
      enabled.set(model.modelId, true); onChanged(); preferred.value = model.modelId;
      preferred.dispatchEvent(new Event("change", { bubbles: true })); render();
      list.querySelector(`[data-prefer-draft="${button.dataset.preferDraft}"]`)?.focus();
    });
    form.querySelector("[data-add-manual-model]").addEventListener("click", () => {
      try { commitManual(); form.querySelector("[data-manual-model-error]").textContent = ""; }
      catch (error) { form.querySelector("[data-manual-model-error]").textContent = error.message; }
    });
    field.addEventListener("input", render);
    preferred.addEventListener("change", render);
    render();
    return { isEnabled, render, commitManual, apply: models => applyEnabled(models, enabled), dispose() { disposed = true; } };
  }
  return { rows, applyEnabled, mount };
});
