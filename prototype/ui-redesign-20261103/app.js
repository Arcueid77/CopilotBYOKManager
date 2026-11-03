(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const icon = (name, className = "") => `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const button = (label, action, { kind = "", iconName = "", id = "", extra = "" } = {}) => `<button class="button ${kind}" data-action="${action}" ${id ? `data-id="${escapeHtml(id)}"` : ""} ${extra}>${iconName ? icon(iconName) : ""}<span>${escapeHtml(label)}</span></button>`;

  const state = {
    route: "overview",
    selectedProviderId: "openrouter",
    providerQuery: "",
    expandedApps: new Set(),
    theme: "light",
    resultBanner: null,
    providers: [
      {
        id: "openrouter",
        name: "OpenRouter",
        short: "OR",
        baseUrl: "https://openrouter.ai/api/v1",
        protocol: "Chat Completions",
        enabled: true,
        hasSecret: true,
        models: [
          { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", enabled: true, preferred: true },
          { id: "openai/gpt-5", name: "GPT-5", enabled: true, preferred: false },
          { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", enabled: true, preferred: false },
        ],
      },
      {
        id: "siliconflow",
        name: "SiliconFlow",
        short: "SF",
        baseUrl: "https://api.siliconflow.cn/v1",
        protocol: "Chat Completions",
        enabled: true,
        hasSecret: true,
        models: [
          { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3", enabled: true, preferred: true },
          { id: "Qwen/Qwen3-32B", name: "Qwen3 32B", enabled: true, preferred: false },
        ],
      },
      {
        id: "local",
        name: "本地模型",
        short: "LM",
        baseUrl: "http://127.0.0.1:11434/v1",
        protocol: "Chat Completions",
        enabled: false,
        hasSecret: false,
        models: [{ id: "qwen3:14b", name: "Qwen3 14B", enabled: true, preferred: true }],
      },
    ],
    apps: [
      { id: "vscode", name: "Copilot Chat · VS Code", detail: "Stable · 默认配置档案", icon: "code", iconClass: "vscode", status: "configured", providerId: "openrouter", providerName: "OpenRouter", modelCount: 3, version: "已安装 · 支持自动发布", account: "未核对 · 不影响供应商发布", config: "默认模型目录" },
      { id: "cli", name: "GitHub Copilot CLI", detail: "用户级供应商配置", icon: "terminal", iconClass: "cli", status: "configured", providerId: "openrouter", providerName: "OpenRouter", modelCount: 3, version: "已安装 · providers.json", account: "未核对 · 不影响供应商发布", config: "保留其他供应商" },
      { id: "copilot-app", name: "GitHub Copilot App", detail: "Windows x64 · 1.1.25", icon: "copilot", iconClass: "copilot", status: "manual", providerId: null, providerName: null, modelCount: null, version: "已安装 · 手动配置或实验性同步", account: "使用官方账号流程", config: "自动同步默认关闭" },
      { id: "jetbrains", name: "IntelliJ IDEA · Copilot", detail: "GitHub Copilot 1.19", icon: "jetbrains", iconClass: "jetbrains", status: "empty", providerId: null, providerName: null, modelCount: null, version: "已检测 · 支持自动发布", account: "每个 IDE 独立核对", config: "共享 BYOK 配置" },
    ],
    lastResult: { providerName: "OpenRouter", targetNames: ["Copilot Chat · VS Code", "GitHub Copilot CLI"], time: "今天 14:32", count: 2 },
    history: [
      { title: "OpenRouter → VS Code、Copilot CLI", time: "今天 14:32", status: "已发布" },
      { title: "OpenRouter → Copilot Chat · VS Code", time: "昨天 19:18", status: "已发布" },
    ],
  };

  const routes = {
    overview: { title: "总览", subtitle: "掌握配置状态，继续下一步。" },
    providers: { title: "供应商", subtitle: "集中管理端点、密钥和模型。" },
    apps: { title: "应用", subtitle: "查看当前配置，或选择应用发布。" },
    about: { title: "关于", subtitle: "偏好、帮助与本地存储。" },
  };

  const content = $("#content");
  const modalRoot = $("#modal-root");
  let lastFocus = null;
  let modalBusy = false;
  let editorModels = [];
  let publishState = null;

  function enabledModels(provider) {
    return provider?.models.filter(model => model.enabled) ?? [];
  }

  function providerById(id) {
    return state.providers.find(provider => provider.id === id);
  }

  function appById(id) {
    return state.apps.find(app => app.id === id);
  }

  function statusPill(app) {
    const labels = { configured: "已配置", empty: "未配置", manual: "手动配置" };
    return `<span class="status-pill ${app.status}">${labels[app.status] ?? "状态未知"}</span>`;
  }

  function appIdentity(app) {
    return `<div class="app-identity"><span class="app-icon ${app.iconClass}">${icon(app.icon)}</span><div><strong>${escapeHtml(app.name)}</strong><span>${escapeHtml(app.detail)}</span></div></div>`;
  }

  function currentSource(app) {
    if (app.status === "configured") return `<div class="current-source"><strong>${escapeHtml(app.providerName)}</strong><span>${app.modelCount == null ? "模型数量未知" : `${app.modelCount} 个可用模型`}</span></div>`;
    if (app.status === "manual") return `<div class="current-source"><strong>在 App 内添加供应商</strong><span>手动配置，或开启实验性同步</span></div>`;
    return `<div class="current-source"><strong class="muted">尚未配置供应商</strong><span>可选择一个供应商发布</span></div>`;
  }

  function resultBanner() {
    if (!state.resultBanner) return "";
    const result = state.resultBanner;
    return `<section class="result-banner" role="status">${icon("check")}<div><strong>${escapeHtml(result.providerName)} 已发布到 ${result.targetNames.length} 个应用</strong><span>结果已保存；接下来在各客户端选择模型。</span></div><button class="button small" data-action="view-result">查看结果</button></section>`;
  }

  function renderOverview() {
    const configured = state.apps.filter(app => app.status === "configured").length;
    return `
      <section class="surface readiness">
        <span class="readiness-icon">${icon("check")}</span>
        <div class="readiness-copy"><h2>${configured} 个应用已写入供应商配置</h2><p>OpenRouter · 3 个模型可用，其他供应商配置保持不变。</p></div>
        <div class="readiness-meta"><strong>最近发布</strong><span>${escapeHtml(state.lastResult.time)}</span></div>
      </section>

      <section class="section">
        <div class="section-heading"><h2>应用配置</h2><button class="text-button" data-route="apps">管理应用</button></div>
        <div class="surface app-status-list">${state.apps.map(app => `
          <button class="status-row" data-action="open-app" data-id="${app.id}">
            ${appIdentity(app)}${currentSource(app)}${statusPill(app)}<span class="row-chevron">${icon("arrow")}</span>
          </button>`).join("")}
        </div>
      </section>

      <div class="overview-bottom">
        <section class="section">
          <div class="section-heading"><h2>供应商</h2><button class="text-button" data-route="providers">管理供应商</button></div>
          <div class="surface provider-summary-list">${state.providers.slice(0, 3).map(provider => {
            const used = state.apps.filter(app => app.providerId === provider.id).length;
            return `<button class="provider-summary-row" data-action="open-provider" data-id="${provider.id}" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;text-align:left"><span class="provider-monogram">${escapeHtml(provider.short)}</span><div><strong>${escapeHtml(provider.name)}</strong><span>${enabledModels(provider).length} 个模型${provider.enabled ? "" : " · 已暂停"}</span></div><span class="meta">${used ? `${used} 个应用` : "未使用"}</span><span class="row-chevron">${icon("arrow")}</span></button>`;
          }).join("")}</div>
        </section>

        <section class="section" id="latest-result">
          <div class="section-heading"><h2>最近发布</h2><button class="text-button" data-route="apps">全部记录</button></div>
          <div class="surface latest-result">
            <div class="result-heading"><span class="result-check">${icon("check")}</span><div><strong>${escapeHtml(state.lastResult.providerName)} → ${state.lastResult.count} 个应用</strong><p>${escapeHtml(state.lastResult.targetNames.join("、"))}</p></div><time>${escapeHtml(state.lastResult.time)}</time></div>
            <details class="next-steps"><summary>查看客户端后续步骤</summary><ul><li>VS Code / JetBrains：在客户端的模型选择器中选择模型。</li><li>CLI：启动新会话，使用 /model 选择供应商与模型。</li></ul></details>
          </div>
        </section>
      </div>`;
  }

  function providerList() {
    const query = state.providerQuery.trim().toLocaleLowerCase();
    const providers = state.providers.filter(provider => `${provider.name} ${provider.baseUrl}`.toLocaleLowerCase().includes(query));
    if (!providers.length) return `<div class="empty-search">没有匹配的供应商</div>`;
    return providers.map(provider => `<button class="provider-list-item ${provider.id === state.selectedProviderId ? "active" : ""}" data-action="select-provider" data-id="${provider.id}"><span class="provider-monogram">${escapeHtml(provider.short)}</span><div><strong>${escapeHtml(provider.name)}</strong><span>${enabledModels(provider).length} 个模型 · ${provider.protocol}</span></div><span class="provider-state-dot ${provider.enabled ? "" : "paused"}"></span></button>`).join("");
  }

  function providerDetail(provider) {
    if (!provider) return `<section class="provider-detail"><div class="empty-search">选择或添加一个供应商。</div></section>`;
    const models = enabledModels(provider);
    const usedApps = state.apps.filter(app => app.providerId === provider.id);
    return `<section class="provider-detail">
      <div class="provider-detail-header"><span class="provider-monogram">${escapeHtml(provider.short)}</span><div class="provider-title"><h2>${escapeHtml(provider.name)}</h2><p>${escapeHtml(provider.protocol)} · ${provider.hasSecret ? "密钥已保存" : "无需密钥"}</p></div>
        <div class="provider-detail-actions">${button("发布", "publish-provider", { kind: "primary small", iconName: "upload", id: provider.id, extra: provider.enabled ? "" : "disabled" })}${button("编辑", "edit-provider", { kind: "small", iconName: "edit", id: provider.id })}<div class="menu-wrap"><button class="icon-button bordered" data-action="provider-menu" aria-label="更多供应商操作">${icon("more")}</button><div class="action-menu" hidden><button data-action="test-provider" data-id="${provider.id}">${icon("refresh")}测试模型目录</button><button class="danger-text" data-action="remove-provider" data-id="${provider.id}">${icon("trash")}移除供应商</button></div></div></div>
      </div>
      <section class="detail-section"><div class="detail-section-header"><h3>连接</h3></div><div class="endpoint-value"><span class="mono" title="${escapeHtml(provider.baseUrl)}">${escapeHtml(provider.baseUrl)}</span><button class="icon-button" data-action="copy-endpoint" data-id="${provider.id}" aria-label="复制端点地址">${icon("copy")}</button></div><div class="key-status">${icon("key")}${provider.hasSecret ? "API 密钥由系统凭据库保存，不会显示原值。" : "此连接不需要 API 密钥。"}</div></section>
      <section class="detail-section"><div class="detail-section-header"><h3>模型 <span class="muted">${models.length}</span></h3><button class="text-button" data-action="edit-provider" data-id="${provider.id}">编辑模型</button></div><div class="model-list">${models.map(model => `<div class="model-row">${icon("star", model.preferred ? "preferred" : "")}<div><strong>${escapeHtml(model.name)}</strong><span class="mono">${escapeHtml(model.id)}</span></div>${model.preferred ? `<span class="model-tag">首选模型</span>` : ""}</div>`).join("") || `<div class="editor-empty">没有启用的模型</div>`}</div></section>
      <section class="detail-section"><div class="detail-section-header"><h3>使用情况</h3></div><div class="used-apps">${usedApps.length ? usedApps.map(app => `<span class="used-app">${icon(app.icon)}${escapeHtml(app.name)}</span>`).join("") : `<span class="meta">尚未发布到应用</span>`}</div></section>
      <div class="eligibility"><div><strong>允许发布</strong><p>暂停后保留客户端现有配置，不再允许新发布。</p></div><button class="switch" role="switch" aria-checked="${provider.enabled}" aria-label="允许发布 ${escapeHtml(provider.name)}" data-action="toggle-provider" data-id="${provider.id}"></button></div>
    </section>`;
  }

  function renderProviders() {
    return `<div class="surface provider-workspace"><aside class="provider-list-pane"><div class="search-field">${icon("search")}<input id="provider-search" value="${escapeHtml(state.providerQuery)}" placeholder="搜索供应商" aria-label="搜索供应商" /></div><div class="provider-list">${providerList()}</div></aside>${providerDetail(providerById(state.selectedProviderId))}</div>${renderHistory()}`;
  }

  function renderApps() {
    return `<div class="surface apps-list">${state.apps.map(app => {
      const expanded = state.expandedApps.has(app.id);
      const mainAction = app.status === "manual"
        ? button("配置指引", "manual-guide", { kind: "small", id: app.id })
        : button(app.status === "configured" ? "重新发布" : "发布", "publish-target", { kind: app.status === "configured" ? "small" : "primary small", id: app.id });
      return `<article class="app-config-row ${expanded ? "expanded" : ""}" id="app-${app.id}"><div class="app-config-main">${appIdentity(app)}${currentSource(app)}${statusPill(app)}${mainAction}<button class="icon-button app-expand" data-action="toggle-app" data-id="${app.id}" aria-label="${expanded ? "收起" : "展开"} ${escapeHtml(app.name)} 详情" aria-expanded="${expanded}">${icon("arrow")}</button></div>${expanded ? `<div class="app-inline-details"><div class="app-detail-block"><strong>安装与能力</strong><span>${escapeHtml(app.version)}</span></div><div class="app-detail-block"><strong>账号（可选）</strong><span>${escapeHtml(app.account)}</span><button class="text-button" data-action="account-help">官方登录说明</button></div><div class="app-detail-block"><strong>配置方式</strong><span>${escapeHtml(app.config)}</span>${app.id === "copilot-app" ? `<button class="text-button" data-action="app-sync-settings">管理实验性同步</button>` : ""}</div></div>` : ""}</article>`;
    }).join("")}</div>${renderHistory()}`;
  }

  function renderHistory() {
    return `<details class="surface history"><summary>操作记录 <span class="subtle">· 最近 ${state.history.length} 条</span></summary><div class="history-content">${state.history.map(item => `<div class="history-row"><span class="status-pill success">${escapeHtml(item.status)}</span><strong>${escapeHtml(item.title)}</strong><span class="meta">${escapeHtml(item.time)}</span></div>`).join("")}</div></details>`;
  }

  function renderAbout() {
    return `<div class="about-grid">
      <section class="surface about-card product"><img src="../../apps/desktop/web/assets/app-icon.png" alt="" width="54" height="54" /><div><h2>CopilotBYOKManager</h2><p>一次配置供应商，在你的 Copilot 应用中使用。</p></div><span class="version">v0.2.2 · 预发布</span></section>
      <section class="surface about-card"><h2>偏好</h2>
        <div class="preference-row"><span>外观<small>只影响界面显示</small></span><div class="segmented" aria-label="外观"><button data-action="set-theme" data-value="system" class="${state.theme === "system" ? "active" : ""}">${icon("monitor")}系统</button><button data-action="set-theme" data-value="light" class="${state.theme === "light" ? "active" : ""}">${icon("sun")}浅色</button><button data-action="set-theme" data-value="dark" class="${state.theme === "dark" ? "active" : ""}">${icon("moon")}深色</button></div></div>
        <div class="preference-row"><label for="interface-language">界面语言<small>沿用现有中英文文案</small></label><select id="interface-language" class="select-control"><option value="zh-CN">简体中文</option><option value="en">English</option></select></div>
        <div class="preference-row"><label for="close-behavior">关闭窗口时<small>普通最小化仍进入任务栏</small></label><select id="close-behavior" class="select-control"><option>收起到系统托盘</option><option>退出程序</option></select></div>
      </section>
      <section class="surface about-card"><h2>帮助与反馈</h2><div class="help-links"><a class="help-link" href="https://github.com/Arcueid77/CopilotBYOKManager/blob/main/docs/user-guide.zh-CN.md" target="_blank" rel="noopener noreferrer">${icon("book")}中文使用手册${icon("external", "external")}</a><a class="help-link" href="https://github.com/Arcueid77/CopilotBYOKManager/blob/main/docs/user-guide.md" target="_blank" rel="noopener noreferrer">${icon("book")}English guide${icon("external", "external")}</a><a class="help-link" href="https://github.com/Arcueid77/CopilotBYOKManager/issues" target="_blank" rel="noopener noreferrer">${icon("external")}反馈问题${icon("external", "external")}</a></div></section>
      <details class="surface storage-details"><summary>本地存储与安全</summary><div class="storage-content"><div><strong>配置</strong><span>保存在当前用户的 CopilotBYOKManager 配置目录。</span></div><div><strong>凭据</strong><span>供应商密钥由操作系统凭据库单独保存。</span></div><div><strong>恢复</strong><span>仅在检测到中断或异常时显示恢复入口。</span></div></div></details>
    </div>`;
  }

  function pageActions() {
    if (state.route === "overview") return `<button class="icon-button bordered" data-action="refresh" aria-label="刷新状态">${icon("refresh")}</button>${button("发布配置", "publish", { kind: "primary", iconName: "upload" })}`;
    if (state.route === "providers") return button("添加供应商", "add-provider", { kind: "primary", iconName: "plus" });
    if (state.route === "apps") return button("重新检测", "refresh", { kind: "", iconName: "refresh" });
    return "";
  }

  function render() {
    const route = routes[state.route];
    $("#page-title").textContent = route.title;
    $("#page-subtitle").textContent = route.subtitle;
    $("#page-actions").innerHTML = pageActions();
    $$(".nav-item").forEach(item => {
      const active = item.dataset.route === state.route;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    const renderer = { overview: renderOverview, providers: renderProviders, apps: renderApps, about: renderAbout }[state.route];
    content.innerHTML = resultBanner() + renderer();
    document.title = `${route.title} · CopilotBYOKManager 视觉方案`;
  }

  function navigate(route, id = null) {
    state.route = route;
    if (id && route === "apps") state.expandedApps.add(id);
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
    if (id && route === "apps") requestAnimationFrame(() => $(`#app-${CSS.escape(id)}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }

  function toast(message, action = null) {
    const element = document.createElement("div");
    element.className = "toast";
    element.innerHTML = `${icon("check")}<span>${escapeHtml(message)}</span>${action ? `<button class="text-button" data-action="${escapeHtml(action.name)}">${escapeHtml(action.label)}</button>` : ""}<button class="icon-button" data-action="dismiss-toast" aria-label="关闭通知">${icon("close")}</button>`;
    $("#toast-root").append(element);
    setTimeout(() => element.remove(), 5200);
  }

  function openModal({ title, subtitle = "", body, footer = "", drawer = false, onOpen = null }) {
    lastFocus = document.activeElement;
    modalBusy = false;
    modalRoot.innerHTML = `<div class="modal-backdrop ${drawer ? "drawer-backdrop" : ""}"><section class="modal ${drawer ? "drawer" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><header class="modal-header"><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon("close")}</button></header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}</section></div>`;
    $(".app-shell").inert = true;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      const target = $("input:not([type=hidden]), select, button", $(".modal-body")) || $("[data-action=close-modal]", modalRoot);
      target?.focus({ preventScroll: true });
      onOpen?.($(".modal", modalRoot));
    });
  }

  function closeModal(force = false) {
    if (modalBusy && !force) return false;
    modalRoot.replaceChildren();
    $(".app-shell").inert = false;
    document.body.style.overflow = "";
    modalBusy = false;
    publishState = null;
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
    return true;
  }

  function editorModelList() {
    if (!editorModels.length) return `<div class="editor-empty">获取模型目录，或在下方手动添加。</div>`;
    return editorModels.map((model, index) => `<div class="editor-model-row"><input type="checkbox" data-model-index="${index}" aria-label="启用 ${escapeHtml(model.name)}" ${model.enabled ? "checked" : ""}/><div><strong>${escapeHtml(model.name)}</strong><span class="mono">${escapeHtml(model.id)}</span></div><button type="button" class="icon-button ${model.preferred ? "preferred" : ""}" data-action="preferred-model" data-index="${index}" aria-label="将 ${escapeHtml(model.name)} 设为首选模型">${icon("star")}</button></div>`).join("");
  }

  function refreshEditorModels() {
    const list = $("#editor-model-list", modalRoot);
    if (list) list.innerHTML = editorModelList();
    const preferred = $("#editor-preferred", modalRoot);
    if (preferred) {
      const current = editorModels.find(model => model.preferred)?.id;
      preferred.innerHTML = editorModels.filter(model => model.enabled).map(model => `<option value="${escapeHtml(model.id)}" ${model.id === current ? "selected" : ""}>${escapeHtml(model.name)}</option>`).join("");
    }
  }

  function openProviderEditor(provider = null) {
    editorModels = structuredClone(provider?.models ?? []);
    openModal({
      title: provider ? `编辑 ${provider.name}` : "添加供应商",
      subtitle: "保存后可直接选择应用发布。",
      drawer: true,
      body: `<form id="provider-form" data-provider-id="${provider?.id ?? ""}" novalidate>
        <section class="form-section"><div class="form-section-heading"><div><h3>基本信息</h3><p>端点和密钥只需填写一次。</p></div></div>
          <div class="form-field"><label for="editor-name">名称</label><input class="input-control" id="editor-name" name="name" required maxlength="160" value="${escapeHtml(provider?.name ?? "")}" placeholder="例如：我的供应商" /></div>
          <div class="form-field"><label for="editor-endpoint">端点地址</label><input class="input-control mono" id="editor-endpoint" name="baseUrl" type="url" required value="${escapeHtml(provider?.baseUrl ?? "")}" placeholder="https://api.example.com/v1" /></div>
          <div class="form-field"><label for="editor-key">API 密钥</label><div class="password-field"><input class="input-control" id="editor-key" name="apiKey" type="password" autocomplete="new-password" placeholder="${provider?.hasSecret ? "留空保留已存密钥" : "匿名端点可留空"}" /><button type="button" class="icon-button" data-action="toggle-key" aria-label="显示或隐藏密钥">${icon("eye")}</button></div><small>由系统凭据库保存，不写入普通配置文件。</small></div>
        </section>
        <section class="form-section"><div class="form-section-heading"><div><h3>模型</h3><p>获取后勾选即可，无需二次添加。</p></div><button type="button" class="button small" data-action="fetch-models">${icon("refresh")}获取模型</button></div>
          <div class="editor-models" id="editor-model-list">${editorModelList()}</div><div class="fetch-status" id="fetch-status" role="status"></div>
          <div class="manual-model"><input class="input-control mono" id="manual-model-id" placeholder="模型 ID" aria-label="手动添加模型 ID" /><input class="input-control" id="manual-model-name" placeholder="显示名称（可选）" aria-label="模型显示名称" /><button type="button" class="icon-button bordered" data-action="add-manual-model" aria-label="添加模型">${icon("plus")}</button></div>
          <div class="form-field"><label for="editor-preferred">首选模型</label><select class="select-control" id="editor-preferred"></select><small>仅作为推荐，发布后仍在客户端选择。</small></div>
        </section>
        <section class="form-section"><details class="advanced-options" ${provider && provider.protocol !== "Chat Completions" ? "open" : ""}><summary>高级选项：供应商类型、接口协议与请求头</summary><div class="advanced-grid"><div class="form-field"><label for="editor-kind">供应商类型</label><select class="select-control" id="editor-kind"><option>OpenAI 兼容</option><option>Azure OpenAI</option><option>Anthropic</option><option>本地端点</option><option>自定义</option></select></div><div class="form-field"><label for="editor-protocol">接口协议</label><select class="select-control" id="editor-protocol"><option ${provider?.protocol === "Chat Completions" || !provider ? "selected" : ""}>Chat Completions</option><option ${provider?.protocol === "Responses" ? "selected" : ""}>Responses</option><option ${provider?.protocol === "Messages" ? "selected" : ""}>Messages</option></select></div><div class="form-field full"><label for="editor-headers">请求头（可选）</label><textarea class="input-control mono" id="editor-headers" placeholder="X-Custom-Header: value"></textarea></div></div></details></section>
      </form>`,
      footer: `<span class="footer-meta">模型选择与基本信息一起保存</span><button class="button ghost" data-action="close-modal">取消</button><button class="button primary" type="submit" form="provider-form">保存供应商</button>`,
    });
    refreshEditorModels();
  }

  function openPublish(targetId = null, providerId = null) {
    const provider = providerById(providerId ?? state.selectedProviderId) ?? state.providers.find(item => item.enabled);
    if (!provider) { toast("请先添加一个供应商"); navigate("providers"); return; }
    publishState = { providerId: provider.id, review: false };
    const available = state.providers.filter(item => item.enabled);
    openModal({
      title: "发布配置",
      subtitle: "选择供应商和目标应用。",
      body: `<div class="form-field"><label for="publish-provider">供应商</label><select class="select-control" id="publish-provider">${available.map(item => `<option value="${item.id}" ${item.id === provider.id ? "selected" : ""}>${escapeHtml(item.name)} · ${enabledModels(item).length} 个模型</option>`).join("")}</select></div>
        <div class="target-grid">${state.apps.map(app => {
          const supported = app.status !== "manual";
          const checked = supported && (targetId ? app.id === targetId : ["vscode", "jetbrains"].includes(app.id));
          return `<label class="target-option ${checked ? "selected" : ""} ${supported ? "" : "manual"}"><input type="checkbox" name="publish-target" value="${app.id}" ${checked ? "checked" : ""} ${supported ? "" : "disabled"}/><div><strong>${escapeHtml(app.name)}</strong><span>${supported ? (app.id === "cli" ? "写入 providers.json · 发布前核对" : "自动发布 · 保留其他供应商") : "请在 App 内手动配置"}</span></div></label>`;
        }).join("")}</div><div id="publish-review"></div>`,
      footer: `<span class="footer-meta" id="publish-summary"></span><button class="button ghost" data-action="view-changes">查看变更</button><button class="button primary" data-action="apply-publish" id="apply-publish"></button>`,
    });
    updatePublishFooter();
  }

  function selectedTargets() {
    return $$("input[name=publish-target]:checked", modalRoot).map(input => appById(input.value)).filter(Boolean);
  }

  function updatePublishFooter() {
    if (!publishState || !$("#apply-publish")) return;
    const targets = selectedTargets();
    const provider = providerById(publishState.providerId);
    $("#publish-summary").textContent = targets.length ? `${enabledModels(provider).length} 个模型 · ${targets.length} 个应用` : "请至少选择一个应用";
    const apply = $("#apply-publish");
    apply.disabled = !targets.length;
    apply.textContent = publishState.review ? "确认发布" : `发布到 ${targets.length || 0} 个应用`;
  }

  function renderPublishReview() {
    const targets = selectedTargets();
    const provider = providerById(publishState.providerId);
    const review = $("#publish-review");
    review.innerHTML = `<div class="change-review"><h3>本次变更</h3><ul>${targets.map(app => `<li>${escapeHtml(app.name)}：写入 ${escapeHtml(provider.name)} 和 ${enabledModels(provider).length} 个启用模型，保留其他供应商。</li>`).join("")}</ul></div>${targets.some(app => app.id === "cli") ? `<div class="review-warning">${icon("about")}<span>Copilot CLI 的 providers.json 将被更新。确认此次目标和模型后继续。</span></div>` : ""}`;
    $("[data-action=view-changes]").textContent = "收起变更";
  }

  function finishPublish() {
    const provider = providerById(publishState.providerId);
    const targets = selectedTargets();
    for (const app of targets) {
      app.status = "configured";
      app.providerId = provider.id;
      app.providerName = provider.name;
      app.modelCount = enabledModels(provider).length;
    }
    state.lastResult = { providerName: provider.name, targetNames: targets.map(app => app.name), time: "刚刚", count: targets.length };
    state.history.unshift({ title: `${provider.name} → ${targets.map(app => app.name.replace("Copilot Chat · ", "")).join("、")}`, time: "刚刚", status: "已发布" });
    state.resultBanner = { providerName: provider.name, targetNames: targets.map(app => app.name) };
    closeModal(true);
    render();
    toast(`已发布到 ${targets.length} 个应用`, { name: "view-result", label: "查看结果" });
  }

  function openManualGuide(appId) {
    const provider = providerById(state.selectedProviderId) ?? state.providers[0];
    openModal({
      title: "在 Copilot App 中添加供应商",
      subtitle: "按以下步骤操作，完成后回到这里保存记录。",
      body: `<div class="guide-steps"><div class="guide-step"><span class="guide-number">1</span><div><strong>打开模型供应商设置</strong><p>在 GitHub Copilot App 中进入模型或供应商设置。</p></div></div><div class="guide-step"><span class="guide-number">2</span><div><strong>添加 OpenAI 兼容供应商</strong><p>填写下方端点，并使用 ${escapeHtml(provider.name)} 的 API 密钥。</p></div></div><div class="guide-step"><span class="guide-number">3</span><div><strong>添加模型并选择</strong><p>将已启用的模型加入 App，然后在模型选择器中使用。</p></div></div></div><div class="guide-values"><div><span>供应商</span><strong>${escapeHtml(provider.name)}</strong></div><div><span>端点</span><strong class="mono">${escapeHtml(provider.baseUrl)}</strong></div><div><span>模型</span><strong>${enabledModels(provider).map(model => escapeHtml(model.name)).join("、")}</strong></div></div>`,
      footer: `<button class="button ghost" data-action="close-modal">关闭</button><button class="button primary" data-action="save-manual-record" data-id="${appId}">保存配置记录</button>`,
    });
  }

  function openRemoveProvider(provider) {
    const used = state.apps.filter(app => app.providerId === provider.id);
    openModal({
      title: `移除 ${provider.name}`,
      body: `<p class="confirm-copy">此供应商已用于 <strong>${used.length} 个应用</strong>。选择保留客户端配置，或同时撤销本软件管理的配置。</p><div class="confirm-actions"><div class="confirm-choice"><strong>仅停止管理</strong><p>删除这里的供应商记录，客户端中的现有配置保持不变。</p><button class="button small" data-action="confirm-remove" data-mode="detach" data-id="${provider.id}">仅停止管理</button></div><div class="confirm-choice"><strong>撤销并删除</strong><p>从已受管应用中撤销此供应商，再删除本地记录。</p><button class="button danger small" data-action="confirm-remove" data-mode="revoke" data-id="${provider.id}">撤销并删除</button></div></div>`,
      footer: `<button class="button ghost" data-action="close-modal">取消</button>`,
    });
  }

  function openSyncSettings() {
    openModal({
      title: "Copilot App 实验性同步",
      subtitle: "默认关闭；开启时再选择供应商并核对风险。",
      body: `<div class="eligibility" style="margin-top:0;padding-top:0;border-top:0"><div><strong>自动同步供应商与模型</strong><p>仅用于已审核的 Windows x64 App 1.1.25。</p></div><button class="switch" role="switch" aria-checked="false" aria-label="自动同步" data-action="demo-sync-toggle"></button></div><div class="change-review" id="sync-note"><h3>当前保持手动配置</h3><ul><li>不自动写入 App 配置。</li><li>现有手动指引和配置记录仍然可用。</li></ul></div>`,
      footer: `<button class="button primary" data-action="close-modal">完成</button>`,
    });
  }

  function applyTheme(preference) {
    state.theme = preference;
    const resolved = preference === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : preference;
    document.documentElement.dataset.theme = resolved;
  }

  document.addEventListener("click", async event => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) { navigate(routeButton.dataset.route); return; }
    const trigger = event.target.closest("[data-action]");
    if (!trigger) {
      $$(".action-menu:not([hidden])").forEach(menu => { menu.hidden = true; });
      return;
    }
    const action = trigger.dataset.action;
    const id = trigger.dataset.id;

    if (action === "open-app") { navigate("apps", id); return; }
    if (action === "open-provider") { state.selectedProviderId = id; navigate("providers"); return; }
    if (action === "select-provider") { state.selectedProviderId = id; render(); return; }
    if (action === "add-provider") { openProviderEditor(); return; }
    if (action === "edit-provider") { openProviderEditor(providerById(id)); return; }
    if (action === "publish" || action === "publish-provider") { openPublish(null, id); return; }
    if (action === "publish-target") { openPublish(id, appById(id)?.providerId); return; }
    if (action === "close-modal") { closeModal(); return; }
    if (action === "dismiss-toast") { trigger.closest(".toast")?.remove(); return; }
    if (action === "refresh") {
      trigger.disabled = true;
      const original = trigger.innerHTML;
      trigger.innerHTML = `<span class="spinner"></span><span>检测中</span>`;
      setTimeout(() => { if (trigger.isConnected) { trigger.disabled = false; trigger.innerHTML = original; } toast("状态已更新（演示）"); }, 650);
      return;
    }
    if (action === "view-result") {
      navigate("overview");
      requestAnimationFrame(() => $("#latest-result")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    if (action === "provider-menu") {
      const menu = trigger.parentElement.querySelector(".action-menu");
      $$(".action-menu").forEach(other => { if (other !== menu) other.hidden = true; });
      menu.hidden = !menu.hidden;
      return;
    }
    if (action === "test-provider") { trigger.closest(".action-menu").hidden = true; toast("模型目录可访问（演示）"); return; }
    if (action === "remove-provider") { openRemoveProvider(providerById(id)); return; }
    if (action === "confirm-remove") {
      const provider = providerById(id);
      if (trigger.dataset.mode === "revoke") {
        state.apps.forEach(app => { if (app.providerId === id) { Object.assign(app, { status: app.id === "copilot-app" ? "manual" : "empty", providerId: null, providerName: null, modelCount: null }); } });
      }
      state.providers = state.providers.filter(item => item.id !== id);
      state.selectedProviderId = state.providers[0]?.id ?? null;
      closeModal(true);
      render();
      toast(trigger.dataset.mode === "revoke" ? `已撤销并移除 ${provider.name}（演示）` : `已停止管理 ${provider.name}，客户端配置保留（演示）`);
      return;
    }
    if (action === "toggle-provider") {
      const provider = providerById(id);
      provider.enabled = !provider.enabled;
      render();
      toast(provider.enabled ? "已允许发布" : "已暂停发布，客户端配置保留");
      return;
    }
    if (action === "copy-endpoint") {
      const provider = providerById(id);
      try { await navigator.clipboard.writeText(provider.baseUrl); toast("端点地址已复制"); }
      catch { toast("请手动复制端点地址"); }
      return;
    }
    if (action === "toggle-app") {
      if (state.expandedApps.has(id)) state.expandedApps.delete(id); else state.expandedApps.add(id);
      render();
      requestAnimationFrame(() => $(`#app-${CSS.escape(id)}`)?.scrollIntoView({ block: "nearest" }));
      return;
    }
    if (action === "manual-guide") { openManualGuide(id); return; }
    if (action === "save-manual-record") { closeModal(); toast("配置记录已保存（演示）"); return; }
    if (action === "account-help") {
      openModal({ title: "官方账号流程", subtitle: "账号核对是可选项，不影响供应商发布。", body: `<div class="guide-steps"><div class="guide-step"><span class="guide-number">1</span><div><strong>启动对应客户端的官方登录</strong><p>由官方客户端完成账号认证。</p></div></div><div class="guide-step"><span class="guide-number">2</span><div><strong>回来核对账号状态</strong><p>只记录核对结果，不复制客户端凭据。</p></div></div></div>`, footer: `<button class="button primary" data-action="close-modal">知道了</button>` });
      return;
    }
    if (action === "app-sync-settings") { openSyncSettings(); return; }
    if (action === "demo-sync-toggle") {
      const enabled = trigger.getAttribute("aria-checked") !== "true";
      trigger.setAttribute("aria-checked", String(enabled));
      $("#sync-note").innerHTML = enabled ? `<h3>开启前需要一次风险核对</h3><ul><li>仅限选定的供应商和受支持的 App 版本。</li><li>正式流程会在此时说明密钥存储方式，不会默认开启。</li></ul>` : `<h3>当前保持手动配置</h3><ul><li>不自动写入 App 配置。</li></ul>`;
      return;
    }
    if (action === "set-theme") { applyTheme(trigger.dataset.value); render(); return; }
    if (action === "toggle-key") {
      const input = $("#editor-key");
      input.type = input.type === "password" ? "text" : "password";
      return;
    }
    if (action === "fetch-models") {
      trigger.disabled = true;
      trigger.innerHTML = `<span class="spinner"></span>获取中`;
      $("#fetch-status").textContent = "";
      setTimeout(() => {
        const samples = [
          { id: "openai/gpt-5-mini", name: "GPT-5 mini", enabled: false, preferred: false },
          { id: "anthropic/claude-haiku-4", name: "Claude Haiku 4", enabled: false, preferred: false },
          { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", enabled: false, preferred: false },
        ];
        for (const model of samples) if (!editorModels.some(existing => existing.id === model.id)) editorModels.push(model);
        refreshEditorModels();
        if (trigger.isConnected) { trigger.disabled = false; trigger.innerHTML = `${icon("refresh")}获取模型`; }
        $("#fetch-status").textContent = "已获取模型目录（演示）。勾选需要的模型后一起保存。";
      }, 600);
      return;
    }
    if (action === "add-manual-model") {
      const idInput = $("#manual-model-id");
      const nameInput = $("#manual-model-name");
      const modelId = idInput.value.trim();
      if (!modelId) { idInput.focus(); return; }
      if (!editorModels.some(model => model.id === modelId)) editorModels.push({ id: modelId, name: nameInput.value.trim() || modelId, enabled: true, preferred: false });
      idInput.value = "";
      nameInput.value = "";
      refreshEditorModels();
      idInput.focus();
      return;
    }
    if (action === "preferred-model") {
      const selected = editorModels[Number(trigger.dataset.index)];
      if (!selected) return;
      editorModels.forEach(model => { model.preferred = model === selected; });
      selected.enabled = true;
      refreshEditorModels();
      return;
    }
    if (action === "view-changes") {
      if (!publishState) return;
      publishState.review = !publishState.review;
      if (publishState.review) renderPublishReview();
      else { $("#publish-review").innerHTML = ""; trigger.textContent = "查看变更"; }
      updatePublishFooter();
      return;
    }
    if (action === "apply-publish") {
      if (!publishState || modalBusy) return;
      const targets = selectedTargets();
      if (!targets.length) return;
      if (!publishState.review && targets.some(app => app.id === "cli")) {
        publishState.review = true;
        renderPublishReview();
        updatePublishFooter();
        $("#publish-review").scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      modalBusy = true;
      $$("button, input, select", modalRoot).forEach(control => { control.disabled = true; });
      trigger.disabled = false;
      trigger.innerHTML = `<span class="spinner"></span>正在发布`;
      setTimeout(finishPublish, 750);
    }
  });

  document.addEventListener("input", event => {
    if (event.target.id === "provider-search") {
      state.providerQuery = event.target.value;
      const list = $(".provider-list");
      if (list) list.innerHTML = providerList();
    }
  });

  document.addEventListener("change", event => {
    if (event.target.matches("input[name=publish-target]")) {
      event.target.closest(".target-option").classList.toggle("selected", event.target.checked);
      if (publishState?.review) {
        publishState.review = false;
        $("#publish-review").innerHTML = "";
        $("[data-action=view-changes]").textContent = "查看变更";
      }
      updatePublishFooter();
    }
    if (event.target.id === "publish-provider" && publishState) {
      publishState.providerId = event.target.value;
      publishState.review = false;
      $("#publish-review").innerHTML = "";
      $("[data-action=view-changes]").textContent = "查看变更";
      updatePublishFooter();
    }
    if (event.target.matches("[data-model-index]")) {
      const model = editorModels[Number(event.target.dataset.modelIndex)];
      if (model) {
        model.enabled = event.target.checked;
        if (!model.enabled && model.preferred) {
          model.preferred = false;
          const next = editorModels.find(item => item.enabled);
          if (next) next.preferred = true;
        }
        refreshEditorModels();
      }
    }
    if (event.target.id === "editor-preferred") {
      editorModels.forEach(model => { model.preferred = model.id === event.target.value; });
      refreshEditorModels();
    }
    if (event.target.id === "interface-language" && event.target.value === "en") {
      event.target.value = "zh-CN";
      toast("此视觉原型以中文展示，正式实现保留中英文切换");
    }
    if (event.target.id === "close-behavior") toast("窗口偏好已更新（演示）");
  });

  document.addEventListener("submit", event => {
    if (event.target.id !== "provider-form") return;
    event.preventDefault();
    const form = event.target;
    const name = $("#editor-name").value.trim();
    const baseUrl = $("#editor-endpoint").value.trim();
    if (!name || !baseUrl || !$("#editor-endpoint").checkValidity()) {
      toast("请填写名称和有效的端点地址");
      (!name ? $("#editor-name") : $("#editor-endpoint")).focus();
      return;
    }
    if (!editorModels.some(model => model.enabled)) {
      toast("请至少启用一个模型");
      $("#manual-model-id").focus();
      return;
    }
    const id = form.dataset.providerId || `provider-${Date.now()}`;
    const existing = providerById(id);
    const provider = existing ?? { id, short: name.slice(0, 2).toUpperCase(), enabled: true, hasSecret: false };
    Object.assign(provider, {
      name,
      short: name.slice(0, 2).toUpperCase(),
      baseUrl,
      protocol: $("#editor-protocol").value,
      hasSecret: Boolean($("#editor-key").value) || Boolean(existing?.hasSecret),
      models: structuredClone(editorModels),
    });
    if (!existing) state.providers.push(provider);
    state.selectedProviderId = id;
    closeModal(true);
    navigate("providers");
    toast("供应商已保存", { name: "publish", label: "立即发布" });
  });

  document.addEventListener("keydown", event => {
    const modal = $(".modal", modalRoot);
    if (!modal) return;
    if (event.key === "Escape" && !modalBusy) { event.preventDefault(); closeModal(); return; }
    if (event.key !== "Tab") return;
    const focusable = $$("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href]", modal).filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (state.theme === "system") applyTheme("system"); });
  applyTheme(state.theme);
  render();
})();
