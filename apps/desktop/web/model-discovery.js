(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ModelDiscovery = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LIMIT = 128;

  function parseHeaders(text) {
    const headers = Object.create(null);
    const seen = new Set();
    for (const line of text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
      const colon = line.indexOf(":");
      if (colon <= 0) throw new Error("请求头须采用“名称: 值”格式，请检查每一行。");
      const name = line.slice(0, colon).trim();
      if (seen.has(name.toLowerCase())) throw new Error("请求头名称不能重复（不区分大小写），请合并重复项。");
      seen.add(name.toLowerCase());
      headers[name] = line.slice(colon + 1).trim();
    }
    return headers;
  }

  function modelIds(text) {
    return new Set(text.split(/\r?\n/).map(line => line.split("|")[0].trim().toLowerCase()).filter(Boolean));
  }

  function mergeModels(text, selected) {
    const ids = modelIds(text);
    const added = [];
    for (const model of selected) {
      const id = model.modelId;
      const name = model.name;
      if (typeof id !== "string" || typeof name !== "string" || !id.trim() || /[\s|]/.test(id) || /[\r\n|]/.test(name)) {
        throw new Error("目录包含格式不受支持的模型，请手动填写模型 ID。");
      }
      if (ids.has(id.toLowerCase())) continue;
      if (ids.size >= LIMIT) throw new Error(`每个连接最多 ${LIMIT} 个模型，请减少勾选数量。`);
      ids.add(id.toLowerCase());
      added.push(`${id} | ${name}`);
    }
    return added.length ? [text.trimEnd(), ...added].filter(Boolean).join("\n") : text;
  }

  function preferModels(models, id) {
    if (!id) return models;
    const preferred = models.find(model => model.modelId === id && model.enabled);
    if (!preferred) throw new Error("首选模型不在启用列表中，请重新选择。");
    return [preferred, ...models.filter(model => model !== preferred)];
  }

  function statusText(status) {
    return {
      available: "模型目录可访问。勾选后添加，不代表已验证推理能力。",
      empty: "模型目录接口已响应，但列表为空。可手动填写模型 ID。",
      partial: "仅获取了部分模型目录，可添加已返回模型或稍后重试。",
      unsupported: "该端点不支持此模型目录接口；Azure 请手动填写部署名称。",
      unauthorized: "目录访问被拒绝，请检查密钥权限。",
      rateLimited: "供应商限流，请稍后重试。",
      networkError: "目录请求失败或超时，请检查地址和网络。",
      schemaError: "目录格式不受支持或超出安全限制，请手动填写模型。",
      invalidInput: "请检查端点、密钥和请求头；远程端点须使用 HTTPS。",
      credentialRequired: "连接设置已改变，请重新输入用于该端点的密钥。",
      credentialUnavailable: "已存密钥缺失或不可访问，请解锁凭据库或重新输入。",
      busy: "已有目录请求正在运行，请稍后重试。",
    }[status] ?? "未获得可验证的目录响应。";
  }

  async function testConnection(invoke, connection) {
    try {
      const result = await invoke("discover_connection_models", { input: {
        connectionId: connection.id, baseUrl: connection.baseUrl,
        providerKind: connection.providerKind, protocol: connection.protocol,
        headers: connection.headers ?? {}, apiKey: null, clearSecret: false,
      } });
      // Do not retain catalog entries / remote detail or imply successful inference.
      return { status: result.status, detail: statusText(result.status) };
    } catch { return { status: "networkError", detail: statusText("networkError") }; }
  }

  // Edits invalidate the response immediately, including while a native request runs.
  function session(invoke, publish) {
    let version = 0, disposed = false, running = false;
    return {
      invalidate() { version++; },
      dispose() { disposed = true; version++; },
      get running() { return running; },
      async fetch(input) {
        if (disposed || running) return false;
        const current = ++version;
        running = true;
        try {
          const result = await invoke("discover_connection_models", { input });
          if (!disposed && current === version) publish(result);
        } catch {
          if (!disposed && current === version) publish({ status: "networkError", models: [], detail: "Model discovery is unavailable. Retry or enter model IDs manually." });
        } finally { running = false; }
        return true;
      },
    };
  }

  function mount(form, { invoke, native, connection }) {
    const panel = form.querySelector("#model-discovery");
    const status = panel.querySelector("[data-model-status]");
    const fetchButton = panel.querySelector("[data-model-fetch]");
    const results = panel.querySelector("[data-model-results]");
    const list = panel.querySelector("[data-model-list]");
    const search = panel.querySelector("[data-model-search]");
    const addButton = panel.querySelector("[data-model-add]");
    const modelsField = form.elements.models;
    const discoveredIds = new Set();
    let catalog = [], selected = new Set(), timer, disposed = false, changed = false;
    const text = message => { status.textContent = message; };
    function render() {
      const existing = modelIds(modelsField.value);
      const filter = search.value.trim().toLowerCase();
      list.replaceChildren();
      for (const model of catalog) {
        if (!`${model.modelId} ${model.name}`.toLowerCase().includes(filter)) continue;
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.disabled = existing.has(model.modelId.toLowerCase());
        checkbox.checked = checkbox.disabled || selected.has(model.modelId);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) selected.add(model.modelId); else selected.delete(model.modelId);
          updateAdd();
        });
        const name = document.createElement("span");
        name.textContent = model.name === model.modelId ? model.modelId : `${model.name} — ${model.modelId}`;
        label.append(checkbox, name);
        list.append(label);
      }
      updateAdd();
    }
    function updateAdd() {
      const existing = modelIds(modelsField.value);
      for (const id of selected) if (existing.has(id.toLowerCase())) selected.delete(id);
      addButton.disabled = selected.size === 0;
      addButton.textContent = `添加已选 (${selected.size})`;
    }
    const job = session(invoke, result => {
      if (!form.isConnected) return;
      catalog = result.models ?? [];
      selected.clear();
      results.hidden = catalog.length === 0;
      panel.dataset.status = result.status;
      text(`${catalog.length ? `找到 ${catalog.length} 个模型。` : ""}${statusText(result.status)}`);
      render();
    });
    function ready() {
      const url = form.elements.baseUrl;
      return url.value.trim() && url.checkValidity();
    }
    async function fetch(manual = false) {
      if (disposed || !form.isConnected || !native || !ready()) return;
      if (job.running) { if (manual) text(statusText("busy")); return; }
      if (!manual && !form.elements.apiKey.value && !connection?.hasSecret && form.elements.providerKind.value !== "local") return;
      let headers;
      try { headers = parseHeaders(form.elements.headers.value); }
      catch (error) { text(error.message); return; }
      changed = false;
      fetchButton.disabled = true;
      panel.dataset.status = "loading";
      text("读取模型目录…");
      await job.fetch({
        connectionId: connection?.id ?? null,
        baseUrl: form.elements.baseUrl.value.trim(),
        providerKind: form.elements.providerKind.value,
        protocol: form.elements.protocol.value,
        headers,
        apiKey: form.elements.apiKey.value || null,
        clearSecret: form.elements.clearSecret?.checked ?? false,
      });
      if (!disposed && form.isConnected) {
        fetchButton.disabled = false;
        if (changed) schedule();
      }
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Wait until the user leaves credential/URL/header editing; never send partial keys.
        if (![form.elements.baseUrl, form.elements.apiKey, form.elements.headers].includes(document.activeElement)) void fetch();
      }, 600);
    }
    function invalidate() {
      job.invalidate(); changed = true;
      catalog = []; selected.clear(); results.hidden = true;
      panel.dataset.status = "idle";
      text(native ? "填好端点和密钥后可获取目录；已配置模型会保留。" : "浏览器试用不请求供应商接口，请手动填写模型 ID。");
    }
    const fields = ["baseUrl", "apiKey", "providerKind", "protocol", "headers", "clearSecret"].map(name => form.elements[name]).filter(Boolean);
    for (const field of fields) {
      field.addEventListener("input", () => { invalidate(); schedule(); });
      field.addEventListener("change", () => { invalidate(); schedule(); });
      field.addEventListener("blur", schedule);
    }
    fetchButton.addEventListener("click", () => { clearTimeout(timer); void fetch(true); });
    search.addEventListener("input", render);
    modelsField.addEventListener("input", render);
    addButton.addEventListener("click", () => {
      try {
        const additions = catalog.filter(model => selected.has(model.modelId));
        modelsField.value = mergeModels(modelsField.value, additions);
        modelsField.dispatchEvent(new Event("input", { bubbles: true }));
        for (const model of additions) discoveredIds.add(model.modelId);
        selected.clear(); render();
        text("已添加勾选模型，请核对后保存连接。");
      } catch (error) { text(error.message); }
    });
    invalidate(); changed = false;
    fetchButton.disabled = !native;
    return { discoveredIds, dispose() { disposed = true; clearTimeout(timer); job.dispose(); } };
  }
  return { parseHeaders, modelIds, mergeModels, preferModels, statusText, testConnection, session, mount };
});
