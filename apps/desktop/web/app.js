(() => {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  i18n.localizeStatic();

  const invokeNative = window.__TAURI__?.core?.invoke ?? null;
  const isDesktop = typeof invokeNative === "function";
  const content = document.querySelector("#content");
  const modalRoot = document.querySelector("#modal-root");
  const toastRoot = document.querySelector("#toast-root");
  const pageTitle = document.querySelector("#page-title");
  const pageSubtitle = document.querySelector("#page-subtitle");
  const addConnectionButton = document.querySelector("#add-connection-button");
  const refreshButton = document.querySelector("#refresh-button");
  const runtimeLabel = document.querySelector("#runtime-label");
  const runtimeDetail = document.querySelector("#runtime-detail");
  const runtimeDot = document.querySelector(".runtime-dot");
  const languageSelect = document.querySelector("#interface-language");
  languageSelect.value = i18n.locale();
  const helpUrls = Object.freeze({
    manual: "https://github.com/AvaloNero/CopilotBYOKManager/blob/main/README.md",
    "manual-zh": "https://github.com/AvaloNero/CopilotBYOKManager/blob/main/README.zh-CN.md",
    issues: "https://github.com/AvaloNero/CopilotBYOKManager/issues",
  });

  const routes = {
    overview: {
      get title() { return tr("总览"); },
      get subtitle() { return tr("管理连接，预览后发布。"); },
      add: false,
    },
    connections: {
      get title() { return tr("供应商"); },
      get subtitle() { return tr("端点、密钥与模型。停用连接不会删除客户端配置。"); },
      add: true,
    },
    clients: {
      get title() { return tr("应用"); },
      get subtitle() { return tr("安装、官方登录与发布能力，按客户端逐个核对。"); },
      add: false,
    },
    about: { get title() { return tr("关于"); }, subtitle: "CopilotBYOKManager", add: false },
  };

  let route = "overview";
  let snapshot = null;
  let loading = false;
  let refreshQueued = false;
  let deploymentCleanup = null;
  // Presentation-only selections, keyed by native IDs; never keys or form data.
  const appProviderChoices = new Map();
  function closeDeployment() {
    if (deploymentCleanup?.busy || deploymentCleanup?.() === false) return false;
    deploymentCleanup = null; return true;
  }
  function setDeploymentBusy(value) {
    document.querySelector("#primary-nav").inert = value;
    document.querySelectorAll("#primary-nav .nav-item").forEach(button => { button.disabled = value; });
    refreshButton.disabled = value || loading;
    addConnectionButton.disabled = value || Boolean(snapshot?.stateRecovery || snapshot?.deploymentRecovery);
    languageSelect.disabled = value;
    content.querySelectorAll(":scope > :not(#inline-deployment)").forEach(element => { element.inert = value; });
  }
  const data = { errors: {} };
  let windowSettingsBusy = false;
  let desiredTrayLocale = i18n.locale(), appliedTrayLocale = null, syncingTrayLocale = false;
  async function syncTrayLocale() {
    if (!isDesktop) return;
    desiredTrayLocale = i18n.locale();
    if (syncingTrayLocale) return;
    syncingTrayLocale = true;
    try {
      // Coalesce rapid language changes; this command changes menu text only.
      while (appliedTrayLocale !== desiredTrayLocale) {
        const locale = desiredTrayLocale;
        await invokeNative("set_tray_locale", { locale });
        appliedTrayLocale = locale;
      }
    } catch {
      showToast(tr("托盘菜单语言未更新，窗口中的语言选择不受影响。"), "warning");
    } finally { syncingTrayLocale = false; }
  }
  function updateWindowSettingsUI() {
    const select = content.querySelector("[data-close-action]");
    if (!select) return;
    select.value = data.windowBehavior?.closeAction === "exit" ? "exit" : "tray";
    select.disabled = windowSettingsBusy || data.windowBehavior?.preferencesAvailable !== true || data.windowBehavior?.trayAvailable !== true;
    content.querySelector("[data-window-explanation]").textContent = window.CopilotBYOKManagerCore.windowBehaviorDescription(data, isDesktop);
  }
  const sectionVersions = {};
  async function loadSections(sections) {
    const versions = sections.map(([key]) => (sectionVersions[key] = (sectionVersions[key] ?? 0) + 1));
    const results = await Promise.allSettled(sections.map(([, command, args]) => invoke(command, args)));
    results.forEach((result, i) => {
      const key = sections[i][0];
      if (versions[i] !== sectionVersions[key]) return;
      if (result.status === "fulfilled") { data[key] = result.value; delete data.errors[key]; }
      else { data[key] = null; data.errors[key] = result.reason?.message ?? String(result.reason); }
    });
  }


  function nowIso() {
    return new Date().toISOString();
  }

  function model(id, name) {
    return {
      id: crypto.randomUUID(),
      modelId: id,
      name,
      enabled: true,
      capabilities: {
        toolCalling: true,
        vision: null,
        reasoning: null,
        contextWindow: null,
        maxOutputTokens: null,
      },
    };
  }

  function createDemoSnapshot() {
    const createdAt = nowIso();
    return {
      version: 1,
      statePath: tr("浏览器试用 — no filesystem access"),
      stateRecovery: null,
      usageDb: {
        state: "unavailable",
        detail: tr("浏览器试用 has no native usage database"),
        path: null,
        schemaVersion: null,
      },
      connections: [
        {
          id: "demo-openrouter",
          name: "OpenRouter",
          enabled: true,
          baseUrl: "https://openrouter.ai/api/v1",
          providerKind: "openai",
          protocol: "chat-completions",
          headers: { "HTTP-Referer": "https://github.com/AvaloNero/CopilotBYOKManager" },
          models: [
            model("anthropic/claude-sonnet-4", "Claude Sonnet 4"),
            model("openai/gpt-5", "GPT-5"),
          ],
          secretRef: "connection:demo-openrouter",
          hasSecret: true,
          createdAt,
          updatedAt: createdAt,
        },
      ],
      clients: [
        {
          id: "vscode:stable:default",
          kind: "vs-code-copilot",
          name: "Visual Studio Code · Default",
          detail: tr("默认配置的模型目录（模拟）"),
          path: "~/Library/Application Support/Code/User/chatLanguageModels.json",
          detected: true,
          supportsWrite: true,
          status: "available",
          diagnostic: null,
        },
        {
          id: "copilot-cli:user-environment",
          kind: "copilot-cli",
          name: "GitHub Copilot CLI",
          detail: "User-level provider environment",
          path: "/usr/local/bin/copilot",
          detected: true,
          supportsWrite: true,
          status: "available",
          diagnostic: null,
        },
        {
          id: "github-copilot-app:local",
          kind: "github-copilot-app",
          name: "GitHub Copilot app",
          detail: tr("模拟检测结果；App 供应商需手动配置"),
          path: "/Applications/GitHub Copilot.app",
          detected: true,
          supportsWrite: false,
          status: "read-only",
          diagnostic:
            tr("没有已审核的外部接口，不改写 App 私有状态或凭据存储"),
        },
      ],
      deployments: [],
      publishedSources: [],
    };
  }

  function loadDemoState() {
    const raw = sessionStorage.getItem("copilot-byok-manager-demo");
    if (!raw) return createDemoSnapshot();
    try {
      return JSON.parse(raw);
    } catch {
      return createDemoSnapshot();
    }
  }

  let demoState = loadDemoState();
  const demoPlans = new Map();

  function saveDemoState() {
    sessionStorage.setItem("copilot-byok-manager-demo", JSON.stringify(demoState));
  }

  async function invoke(command, args = {}) {
    if (isDesktop) return invokeNative(command, args);
    await new Promise((resolve) => setTimeout(resolve, 90));
    return invokeMock(command, args);
  }

  function invokeMock(command, args) {
    switch (command) {
      case "get_dashboard":
        return structuredClone(demoState);
      case "get_install_runs":
        return [];
      case "get_resources":
        return { resources: [], bindings: [], detail: tr("浏览器试用 has no native resource catalog") };
      case "upsert_connection": {
        const input = args.input;
        const existing = input.id
          ? demoState.connections.find((item) => item.id === input.id)
          : null;
        const id = existing?.id ?? crypto.randomUUID();
        const timestamp = nowIso();
        const connection = {
          id,
          name: input.name.trim(),
          enabled: existing?.enabled !== false,
          baseUrl: input.baseUrl.trim().replace(/\/$/, ""),
          providerKind: input.providerKind,
          protocol: input.protocol,
          headers: input.headers,
          models: input.models,
          secretRef: existing?.secretRef ?? `connection:${id}`,
          hasSecret: input.clearSecret
            ? false
            : Boolean(input.apiKey?.trim()) || Boolean(existing?.hasSecret),
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };
        const index = demoState.connections.findIndex((item) => item.id === id);
        if (index >= 0) demoState.connections[index] = connection;
        else demoState.connections.push(connection);
        demoState.connections.sort((a, b) => a.name.localeCompare(b.name));
        demoPlans.clear();
        saveDemoState();
        return structuredClone(connection);
      }
      case "set_connection_enabled": {
        const connection = demoState.connections.find(item => item.id === args.connectionId);
        if (!connection) throw new Error(tr("连接不存在"));
        if (connection.enabled !== args.enabled) {
          connection.enabled = args.enabled; connection.updatedAt = nowIso(); demoPlans.clear(); saveDemoState();
        }
        return structuredClone(connection);
      }
      case "delete_connection": {
        demoState.connections = demoState.connections.filter(
          (item) => item.id !== args.connectionId,
        );
        demoState.deployments = demoState.deployments.filter(
          (item) => item.connectionId !== args.connectionId,
        );
        demoState.publishedSources = (demoState.publishedSources ?? []).filter(item => item.connectionId !== args.connectionId);
        demoPlans.clear();
        saveDemoState();
        return true;
      }
      case "preview_deployment": {
        const connection = demoState.connections.find(
          (item) => item.id === args.connectionId,
        );
        if (!connection) throw new Error(tr("连接不存在"));
        if (connection.enabled === false) throw new Error(tr("请先启用连接再发布"));
        const targets = args.targetIds.map((id) =>
          demoState.clients.find((item) => item.id === id),
        );
        if (!targets.length || targets.some((target) => !target)) throw new Error(tr("发布目标不存在"));
        for (const [id, stored] of demoPlans) {
          if (Date.now() >= stored.expiresAt) demoPlans.delete(id);
        }
        if (demoPlans.size >= 32) throw new Error(tr("待处理预览过多，请关闭旧预览"));
        const plan = createMockPlan(connection, targets);
        demoPlans.set(plan.id, {
          plan: structuredClone(plan),
          connectionRevision: JSON.stringify(connection),
          targetRevision: JSON.stringify(targets),
          expiresAt: Date.now() + 15 * 60 * 1000,
        });
        return plan;
      }
      case "apply_deployment_plan": {
        const stored = demoPlans.get(args.planId);
        demoPlans.delete(args.planId);
        if (!stored || Date.now() >= stored.expiresAt || args.confirmed !== true) {
          throw new Error(tr("预览已过期或已使用，请重新预览"));
        }
        const { plan } = stored;
        const connection = demoState.connections.find(
          (item) => item.id === plan.connectionId,
        );
        if (!connection) throw new Error(tr("连接不存在"));
        const targets = plan.targetIds
          .map((id) => demoState.clients.find((item) => item.id === id))
          .filter(Boolean);
        if (stored.connectionRevision !== JSON.stringify(connection) || stored.targetRevision !== JSON.stringify(targets)) {
          throw new Error(tr("模拟计划已变化，请重新预览"));
        }
        const records = plan.operations.map((operation) => ({
          id: crypto.randomUUID(),
          planId: plan.id,
          connectionId: connection.id,
          targetId: operation.targetId,
          targetKind: operation.targetKind,
          status: operation.supported ? "applied" : "skipped",
          detail: operation.supported
            ? tr("浏览器试用仅模拟此次发布，未写入客户端配置")
            : operation.description,
          createdAt: nowIso(),
        }));
        demoState.deployments.unshift(...records);
        demoState.deployments = demoState.deployments.slice(0, 200);
        demoState.publishedSources ??= [];
        for (const record of records.filter(record => record.status === "applied")) {
          demoState.publishedSources = demoState.publishedSources.filter(source => !(source.targetId === record.targetId && (record.targetKind === "copilot-cli" || source.connectionId === connection.id)));
          const count = record.targetKind === "copilot-cli" ? 1 : connection.models.filter(model => model.enabled).length;
          if (count) demoState.publishedSources.push({ targetId: record.targetId, connectionId: connection.id, state: "published", modelCount: count, publishedAt: record.createdAt });
        }
        saveDemoState();
        return { planId: plan.id, records };
      }
      default:
        return window.CopilotBYOKManagerUsage.preview(command, demoState);
    }
  }

  function createMockPlan(connection, targets) {
    return {
      id: crypto.randomUUID(),
      connectionId: connection.id,
      connectionName: connection.name,
      targetIds: targets.map((target) => target.id),
      createdAt: nowIso(),
      operations: targets.map((target) => ({
        id: crypto.randomUUID(),
        targetId: target.id,
        targetKind: target.kind,
        title: tr("发布 {0} 到 {1}", connection.name, target.name),
        description: target.supportsWrite
          ? tr("模拟更新 {0}", target.path ?? target.name)
          : tr("请在客户端供应商设置中手动配置"),
        changes: [
          tr("发布 {0} 个启用模型", connection.models.filter((item) => item.enabled).length),
          tr("保留其他来源的配置"),
          target.supportsWrite
            ? tr("模拟创建支持回滚的受管配置")
            : tr("不改写未支持的客户端私有状态"),
        ],
        supported: target.detected && target.supportsWrite,
        requiresRestart: target.kind === "copilot-cli",
      })),
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(i18n.locale(), {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function initials(name) {
    return String(name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  function statusLabel(status) {
    return {
      available: tr("可用"),
      "not-installed": tr("未安装"),
      "read-only": tr("仅手动处理"),
      error: tr("需核对"),
      applied: tr("已完成"),
      skipped: tr("未自动处理"),
      failed: tr("失败"),
    }[status] ?? status;
  }

  function clientIcon(kind) {
    return {
      "vs-code-copilot": "⌘",
      "copilot-cli": ">_",
      "github-copilot-app": "◈",
      "jetbrains-copilot": "JB",
    }[kind] ?? "◇";
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastRoot.append(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  function setRuntimeState() {
    runtimeDot.classList.toggle("online", true);
    runtimeLabel.textContent = isDesktop ? tr("本地模式") : tr("浏览器试用");
    runtimeDetail.textContent = isDesktop
      ? tr("写入前须预览确认")
      : tr("不修改电脑");
  }

  async function refresh() {
    if (windowSettingsBusy) { refreshQueued = true; return; }
    if (!closeDeployment()) return;
    if (loading) { refreshQueued = true; return; }
    loading = true;
    const focus = window.CopilotBYOKManagerUI.capture(content);
    refreshButton.disabled = true;
    content.innerHTML = `<div class="loading"><div><div class="spinner"></div>${tr("读取本地状态…")}</div></div>`;
    try {
      await loadSections(window.CopilotBYOKManagerCore.sections);
      if (!data.dashboard) throw new Error(data.errors.dashboard);
      snapshot = data.dashboard;
      for (const id of appProviderChoices.keys()) if (!snapshot.clients.some(client => client.id === id)) appProviderChoices.delete(id);
      window.CopilotBYOKManagerInstaller.hydrate(data.components, data.installRuns);
      window.CopilotBYOKManagerAccount.hydrate(data.setup?.accounts);
      setRuntimeState();
      render();
      window.CopilotBYOKManagerUI.restore(content, focus);
    } catch (error) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">!</div>
          <h2>${tr("无法读取本地状态")}</h2>
          <p>${escapeHtml(error?.message ?? error)}</p>
          <button class="button" data-action="refresh">${tr("重试")}</button>
        </div>`;
      showToast(error?.message ?? String(error), "error");
    } finally {
      loading = false;
      refreshButton.disabled = false;
      if (refreshQueued) { refreshQueued = false; void refresh(); }
    }
  }

  function setRoute(nextRoute) {
    if (!window.CopilotBYOKManagerCore.routeIds.includes(nextRoute) || deploymentCleanup?.busy || dialogs.active) return false;
    const changed = route !== nextRoute;
    route = nextRoute;
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.route === route);
      if (button.dataset.route === route) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    render();
    if (changed) window.scrollTo({ top: 0, behavior: "instant" });
    return true;
  }

  function render() {
    if (!snapshot) return;
    if (!closeDeployment()) return;
    const focus = window.CopilotBYOKManagerUI.capture(content);
    const meta = routes[route];
    pageTitle.textContent = meta.title;
    pageSubtitle.textContent = meta.subtitle;
    addConnectionButton.hidden = !meta.add;
    addConnectionButton.disabled = Boolean(snapshot.stateRecovery || snapshot.deploymentRecovery);
    const renderers = {
      overview: renderOverview,
      connections: renderConnections,
      clients: renderClients,
      about: () => window.CopilotBYOKManagerCore.about(snapshot, data, isDesktop, helpUrls),
    };
    content.innerHTML = (!isDesktop && route !== "overview" ? `<div class="preview-banner">${tr("浏览器试用 · 示例数据 · 不修改电脑")}</div>` : "") + window.CopilotBYOKManagerCore.recovery(snapshot, isDesktop) + renderers[route]();
    content.dataset.route = route;
    window.CopilotBYOKManagerInstaller.mount();
    window.CopilotBYOKManagerAccount.mount();
    window.CopilotBYOKManagerAppearance.apply();
    updateWindowSettingsUI();
    window.CopilotBYOKManagerUI.restore(content, focus);
  }

  function renderOverview() {
    return window.CopilotBYOKManagerManager.renderHome(snapshot, data, isDesktop);
  }

  function renderConnections() {
    return `
      ${snapshot.connections.length ? `<div class="card-grid">${snapshot.connections.map(connectionCard).join("")}</div>` : emptyConnections()}
      <section class="manager-section manager-publication"><h2 id="publication-result-title">${tr("最近配置操作")}</h2>${window.CopilotBYOKManagerManager.lastResult(snapshot, isDesktop)}</section>
      ${window.CopilotBYOKManagerCore.history(snapshot)}
    `;
  }

  function renderClients() {
    return `<div class="client-grid">${snapshot.clients.map(clientCard).join("")}</div>
      <details class="manager-section" ${isDesktop && data.components?.some(component => ["missing", "broken", "unknown"].includes(component.status)) ? "open" : ""}><summary>${tr("安装与更新")}</summary><section id="installation-panel" class="install-panel"></section></details>
      <details class="manager-section"><summary>${tr("官方登录与账号核对")}</summary><section id="account-panel" class="account-panel"></section><button class="button ghost small" data-action="setup-accounts" ${!isDesktop ? "disabled" : ""}>${tr("逐个核对同一 GitHub 账号")}</button></details>
      <section class="manager-section"><h2 id="publication-result-title">${tr("最近一次发布")}</h2>${window.CopilotBYOKManagerManager.lastResult(snapshot, isDesktop)}</section>
      ${window.CopilotBYOKManagerCore.history(snapshot)}
    `;
  }

  function renderActivity() {
    const entries = [
      ...snapshot.deployments.map((r) => ({ time: r.createdAt, kind: tr("发布 / 回滚"), source: r.targetId, status: r.status, detail: r.detail, route: "connections" })),
      ...(data.installRuns ?? []).map((r) => ({ time: r.finishedAt ?? r.startedAt, kind: tr("安装"), source: r.componentIds.join(", "), status: r.status, detail: r.detail, route: "clients" })),
      ...(data.setup?.accounts?.loginRuns ?? []).map((r) => ({ time: r.finishedAt ?? r.startedAt, kind: tr("官方登录"), source: r.requestedSurfaces.join(", "), status: r.status, detail: r.summary, route: "clients" })),
      ...(data.runs ?? []).map((r) => ({ time: r.finishedAt ?? r.startedAt, kind: tr("导入 / 刷新"), source: r.sourceId, status: r.status, detail: r.detail, route: "usage" })),
    ].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    return `<section class="usage-panel"><div class="step-heading"><h2>${tr("最近活动")}</h2><span>${tr("本地脱敏记录")}</span></div>${[data.errors.runs, data.errors.installRuns].filter(Boolean).map((error) => `<p class="inline-error">${escapeHtml(error)}</p>`).join("")}
      ${entries.length ? `<div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>${tr("时间")}</th><th>${tr("操作")}</th><th>${tr("目标 / 来源")}</th><th>${tr("状态")}</th><th>${tr("详情")}</th><th>${tr("下一步")}</th></tr></thead><tbody>${entries.slice(0, 200).map((r) => `<tr><td>${escapeHtml(formatDate(r.time))}</td><td>${escapeHtml(r.kind)}</td><td>${escapeHtml(r.source)}</td><td>${escapeHtml(window.CopilotBYOKManagerUsage.label(r.status))}</td><td>${escapeHtml(r.detail)}</td><td><button class="button ghost small" data-action="route" data-route="${r.route}">${tr("核对")}</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="usage-empty">${tr("尚无活动记录。")}</p>`}</section>`;
  }

  function renderSettings() {
    return `<section id="github-authorization-panel"></section>
      <div class="settings-list">
        ${settingRow(tr("运行时"), isDesktop ? tr("本地原生后端") : tr("浏览器试用"), isDesktop ? tr("配置写入须先预览并确认。") : tr("发布仅模拟，数据保留在当前标签页。"))}
        ${settingRow(tr("状态文件"), snapshot.statePath, tr("只保存非敏感连接、发布记录和版本。"))}
        ${settingRow(tr("状态版本"), `v${snapshot.version}`, tr("状态版本高于当前程序时拒绝迁移。"))}
        ${settingRow(tr("状态恢复"), snapshot.stateRecovery ? tr("只读恢复") : tr("正常"), snapshot.stateRecovery ?? tr("状态文件已正常读取，可修改。"))}
        ${settingRow(tr("用量数据库"), usageDbLabel(), snapshot.usageDb?.detail ?? tr("未提供用量存储状态。"))}
        ${settingRow(tr("凭据存储"), isDesktop ? tr("系统凭据库") : tr("模拟密钥保存标记"), tr("状态查询不会返回密钥。"))}
        ${settingRow("GitHub Copilot app", tr("供应商仅手动配置"), tr("可检测客户端，不读写私有供应商存储。"))}
      </div>`;
  }

  function usageDbLabel() {
    const db = snapshot.usageDb;
    if (!db) return tr("未知");
    return db.state === "available"
      ? tr("可用（格式 v{0}）", db.schemaVersion)
      : tr("不可用");
  }

  function storageWarningBanner() {
    const warnings = [];
    if (snapshot.deploymentRecovery) warnings.push(snapshot.deploymentRecovery);
    if (snapshot.stateRecovery) {
      warnings.push(
        tr("连接存储处于只读恢复： {0}", snapshot.stateRecovery),
      );
    }
    if (snapshot.usageDb && snapshot.usageDb.state !== "available") {
      warnings.push(tr("用量数据库不可用： {0}", snapshot.usageDb.detail));
    }
    if (!warnings.length) return "";
    return `<div class="security-note">
      <div class="note-icon">⚠</div>
      <div>
        <strong>${tr("存储需要核对")}</strong>
        ${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}
        ${snapshot.deploymentRecovery ? `<button class="button" data-action="preview-recovery">${tr("核对安全恢复")}</button>` : ""}
      </div>
    </div>`;
  }

  function statCard(label, value) {
    return `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function settingRow(title, value, copy) {
    return `<div class="setting-row"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></div><div class="setting-value" title="${escapeHtml(value)}">${escapeHtml(value)}</div></div>`;
  }

  function clientCard(client) {
    const providers = snapshot.connections.filter(connection => connection.enabled !== false);
    const chosen = appProviderChoices.get(client.id);
    const providerId = appProviderChoices.has(client.id) ? (providers.some(provider => provider.id === chosen) ? chosen : "") : providers.length === 1 ? providers[0].id : "";
    return `
      <article class="client-card" data-client-id="${escapeHtml(client.id)}" tabindex="-1">
        <div class="client-header">
          <div class="client-icon">${escapeHtml(clientIcon(client.kind))}</div>
          <h3>${escapeHtml(client.name)}</h3>
          <span class="status-pill ${escapeHtml(client.status)}">${escapeHtml(statusLabel(client.status))}</span>
        </div>
        <p class="client-description">${escapeHtml(client.detail)}</p>
        <div class="app-configuration">${client.detected ? `<label class="app-provider-field"><span>${tr("使用供应商")}</span><select class="app-provider-select" aria-label="${tr("{0} 使用的供应商", escapeHtml(client.name))}" ${!providers.length || snapshot.stateRecovery || snapshot.deploymentRecovery ? "disabled" : ""}><option value="" ${!providerId ? "selected" : ""}>${providers.length ? tr("请选择供应商") : tr("请先添加供应商")}</option>${providers.map(connection => `<option value="${escapeHtml(connection.id)}" ${connection.id === providerId ? "selected" : ""}>${escapeHtml(connection.name)}</option>`).join("")}</select></label><button class="button primary small" data-action="deploy-client" data-client-id="${escapeHtml(client.id)}" ${!providerId || snapshot.stateRecovery || snapshot.deploymentRecovery || (!client.supportsWrite && client.kind !== "github-copilot-app") ? "disabled" : ""}>${client.supportsWrite ? tr("预览配置") : tr("手动配置")}</button>` : ""}</div>
        <div class="app-card-footer"><details class="app-details"><summary>${tr("应用信息")}</summary><div class="path-line" title="${escapeHtml(client.path ?? client.diagnostic ?? "")}">${escapeHtml(client.path ?? client.diagnostic ?? tr("未提供本地路径"))}</div></details>
        ${client.kind === "jetbrains-copilot" && !client.supportsWrite ? `<button class="button ghost small" data-action="jetbrains-guide" data-id="${escapeHtml(client.id)}">${tr("配置指引")}</button>` : ""}
        </div>
      </article>`;
  }

  function connectionCard(connection) {
    return window.CopilotBYOKManagerManager.connectionCard(connection, snapshot, isDesktop);
  }

  function emptyConnections() {
    return `
      <div class="empty-state">
        <div class="empty-icon">◇</div>
        <h2>${tr("尚无连接")}</h2>
        <p>${tr("添加供应商端点和模型，预览后发布到支持的客户端。")}</p>
        <button class="button primary" data-action="add-connection">${tr("添加连接")}</button>
      </div>`;
  }

  let modalCleanup = null;
  const dialogs = window.CopilotBYOKManagerUI.modal({ root: modalRoot, background: document.querySelector(".app-shell"), cleanup() {
    modalCleanup?.(); modalCleanup = null; modalRoot.replaceChildren();
  } });
  function openModal({ title, body, footer = "", wide = false, onOpen }) {
    if (deploymentCleanup?.busy) return;
    if (!dialogs.prepare()) return;
    closeDeployment();
    modalCleanup?.();
    modalCleanup = null;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
          <header class="modal-header"><h2>${escapeHtml(title)}</h2><button class="icon-button" data-modal-close aria-label="${tr("关闭")}">×</button></header>
          <div class="modal-body">${body}</div>
          ${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}
        </section>
      </div>`;
    dialogs.mount();
    // Async handlers belong to this dialog instance, not the permanent root.
    onOpen?.(modalRoot.querySelector('[role="dialog"]'));
  }

  function closeModal(event) {
    return event?.type ? dialogs.requestClose() : dialogs.close();
  }

  function openConnectionForm(connection = null) {
    if (snapshot.stateRecovery || snapshot.deploymentRecovery) {
      showToast(tr("只读恢复期间不能修改连接"), "error");
      return;
    }
    const modelsText = connection?.models
      ?.map((item) => `${item.modelId} | ${item.name}`)
      .join("\n") ?? "";
    const headersText = connection
      ? Object.entries(connection.headers)
          .map(([name, value]) => `${name}: ${value}`)
          .join("\n")
      : "";
    const advanced = connection && (connection.providerKind !== "openai" || connection.protocol !== "chat-completions" || headersText);
    openModal({
      title: connection ? tr("编辑 {0}", connection.name) : tr("添加连接"),
      wide: true,
      body: `
        <form id="connection-form" class="form-grid" novalidate>
          <input type="hidden" name="id" value="${escapeHtml(connection?.id ?? "")}" />
          <p id="connection-error" class="inline-error full" role="alert" tabindex="-1" hidden></p>
          <div class="form-field full">
            <label for="connection-name">${tr("名称")}</label>
            <input id="connection-name" name="name" required maxlength="160" value="${escapeHtml(connection?.name ?? "")}" placeholder="${tr("例如：我的供应商")}" />
          </div>
          <div class="form-field full">
            <label for="base-url">${tr("端点地址")}</label>
            <input id="base-url" name="baseUrl" type="url" required value="${escapeHtml(connection?.baseUrl ?? "")}" placeholder="https://api.example.com/v1" />
            <small>${tr("填写供应商提供的接口基址，例如 https://api.example.com/v1。不同供应商的协议可在高级选项中核对。")}</small>
          </div>
          <div class="form-field full">
            <label for="api-key">${tr("API 密钥")}</label>
            <input id="api-key" name="apiKey" type="password" autocomplete="new-password" placeholder="${connection?.hasSecret ? tr("留空保留已存密钥，不回读原值") : tr("允许匿名的端点可留空")}" />
            <small>${tr("保存在系统凭据库，不写入连接配置文件。")}</small>
          </div>
          ${connection ? `<div class="form-field full"><label><input name="clearSecret" type="checkbox" style="width:auto;height:auto;margin-right:7px" />${tr("移除已保存的密钥")}</label></div>` : ""}
          <div class="form-field full model-discovery" id="model-discovery">
            <div class="model-discovery-actions"><strong>${tr("获取模型目录")}</strong><button type="button" class="button ghost small" data-model-fetch>${tr("获取模型")}</button></div>
            <small data-model-status role="status" aria-live="polite"></small>
            <small>${tr("获取供应商的模型列表，勾选需要的模型即可加入草稿。")}</small>
            <div data-model-results hidden>
              <input type="search" data-model-search aria-label="${tr("筛选模型")}" placeholder="${tr("按模型名称或 ID 筛选")}" />
              <div class="discovered-models" data-model-list></div>
              <small data-model-selection role="status" aria-live="polite"></small>
            </div>
          </div>
          <div class="form-field full">
            <label for="models">${tr("模型")}</label>
            <textarea id="models" name="models" required placeholder="model-id | Display Name">${escapeHtml(modelsText)}</textarea>
            <small>${tr("每行一个模型：")}<code>${tr("上游模型 ID | 显示名称")}</code>${tr("，名称可省略。")}</small>
          </div>
          <div class="form-field full"><label for="preferred-model">${tr("首选模型")}</label><select id="preferred-model" name="preferredModel"></select><small>${tr("CLI 写入 COPILOT_MODEL；其他客户端仅作本软件推荐，仍需在客户端选择。")}</small></div>
          <details class="connection-advanced full" ${advanced ? "open" : ""}><summary>${tr("高级选项：供应商类型、接口协议与请求头")}</summary><div class="form-grid">
            <div class="form-field"><label for="provider-kind">${tr("供应商类型")}</label><select id="provider-kind" name="providerKind">${selectOptions(["openai", "azure", "anthropic", "local", "custom"], connection?.providerKind ?? "openai", { openai: tr("OpenAI 兼容"), azure: "Azure OpenAI", anthropic: "Anthropic", local: tr("本地端点"), custom: tr("自定义") })}</select></div>
            <div class="form-field"><label for="protocol">${tr("接口协议")}</label><select id="protocol" name="protocol">${selectOptions(["chat-completions", "responses", "messages"], connection?.protocol ?? "chat-completions", { "chat-completions": "Chat Completions", responses: "Responses", messages: "Messages" })}</select><small>${tr("按供应商文档选择；更改类型不会自动改写协议或端点。")}</small></div>
            <div class="form-field full"><label for="headers">${tr("请求头（可选）")}</label><textarea id="headers" name="headers" placeholder="X-Custom-Header: value&#10;Authorization: Bearer \${apiKey}">${escapeHtml(headersText)}</textarea><small>${tr("每行一个请求头；用")} <code>\${apiKey}</code> ${tr("引用密钥，不填写真实密钥值。")}</small></div>
          </div></details>
        </form>`,
      footer: `<button class="button ghost" data-modal-close>${tr("取消")}</button><button class="button primary" id="save-connection" type="submit" form="connection-form">${tr("保存连接")}</button>`,
      onOpen(root) {
        const preferred = root.querySelector("#preferred-model");
        const modelsField = root.querySelector("#models");
        function syncPreferred() {
          const chosen = preferred.value || connection?.models.find(model => model.enabled)?.modelId;
          const lines = modelsField.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
          const options = lines.map(line => line.split("|")[0].trim()).filter(id => id && connection?.models.find(model => model.modelId === id)?.enabled !== false);
          preferred.replaceChildren();
          for (const id of options) { const option = document.createElement("option"); option.value = id; option.textContent = id; preferred.append(option); }
          if (options.includes(chosen)) preferred.value = chosen;
        }
        modelsField.addEventListener("input", syncPreferred); syncPreferred();
        const discovery = window.ModelDiscovery.mount(root.querySelector("#connection-form"), { invoke, native: Boolean(window.__TAURI__?.core?.invoke), connection });
        modalCleanup = () => discovery.dispose();
        const form = root.querySelector("#connection-form"), errorPanel = root.querySelector("#connection-error");
        for (const field of form.querySelectorAll("input, select, textarea")) {
          const hint = field.parentElement.querySelector(":scope > small");
          if (hint && field.id) { hint.id = `${field.id}-hint`; field.setAttribute("aria-describedby", hint.id); }
        }
        function formError(message, field) {
          errorPanel.textContent = tr("连接未保存。{0}", message); errorPanel.hidden = false;
          if (field) {
            field.setAttribute("aria-invalid", "true");
            field.setAttribute("aria-describedby", `${field.getAttribute("aria-describedby") ?? ""} connection-error`.trim());
            const details = field.closest("details"); if (details) details.open = true;
            field.focus();
          } else errorPanel.focus();
        }
        form.addEventListener("input", event => { event.target.removeAttribute("aria-invalid"); });
        let saving = false;
        const saveButton = root.querySelector("#save-connection");
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (saving) return;
          if (!form.checkValidity()) { formError(tr("请填写必填项，并检查端点地址格式。"), form.querySelector(":invalid")); return; }
          const data = new FormData(form);
          saving = true;
          saveButton.disabled = true;
          saveButton.textContent = tr("保存中…");
          dialogs.setBusy(true);
          errorPanel.hidden = true;
          try {
            const input = parseConnectionForm(data, connection, discovery.discoveredIds);
            await invoke("upsert_connection", { input });
            if (form.isConnected) closeModal();
            showToast(tr("连接已保存，尚未发布到客户端。"));
            await refresh();
          } catch (error) {
            if (form.isConnected) dialogs.setBusy(false);
            const field = ["name", "baseUrl", "models", "headers", "preferredModel"].includes(error?.field) ? form.elements.namedItem(error.field) : null;
            if (form.isConnected) formError(error?.message ?? String(error), field);
          } finally {
            saving = false;
            if (saveButton.isConnected) { dialogs.setBusy(false); saveButton.disabled = false; saveButton.textContent = tr("保存连接"); }
          }
        });
      },
    });
  }

  function selectOptions(values, selected, labels = {}) {
    return values
      .map(
        (value) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(labels[value] ?? value)}</option>`,
      )
      .join("");
  }

  function parseConnectionForm(data, existing, discoveredIds = new Set()) {
    function invalid(message, field) { const error = new Error(message); error.field = field; throw error; }
    if (!String(data.get("name") ?? "").trim()) invalid(tr("请填写连接名称。"), "name");
    if (new TextEncoder().encode(String(data.get("name") ?? "")).length > 160) invalid(tr("名称过长，请缩短后重试。"), "name");
    const modelLines = String(data.get("models") ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!modelLines.length) invalid(tr("请至少添加一个模型。"), "models");
    const existingByModelId = Object.fromEntries(
      (existing?.models ?? []).map((item) => [item.modelId, item]),
    );
    let models = modelLines.map((line) => {
      const [rawId, ...nameParts] = line.split("|");
      const modelId = rawId.trim();
      if (!modelId) invalid(tr("模型行须包含模型 ID。"), "models");
      const name = nameParts.join("|").trim() || modelId;
      return {
        id: existingByModelId[modelId]?.id ?? crypto.randomUUID(),
        modelId,
        name,
        enabled: existingByModelId[modelId]?.enabled ?? true,
        capabilities: existingByModelId[modelId]?.capabilities ?? {
          toolCalling: discoveredIds.has(modelId) ? null : true,
          vision: null,
          reasoning: null,
          contextWindow: null,
          maxOutputTokens: null,
        },
      };
    });
    try { models = window.ModelDiscovery.preferModels(models, String(data.get("preferredModel") ?? "")); }
    catch (error) { invalid(error.message, "preferredModel"); }
    let headers;
    try { headers = window.ModelDiscovery.parseHeaders(String(data.get("headers") ?? "")); }
    catch (error) { invalid(error.message, "headers"); }
    const id = String(data.get("id") ?? "").trim();
    return {
      id: id || null,
      name: String(data.get("name") ?? ""),
      baseUrl: String(data.get("baseUrl") ?? ""),
      providerKind: String(data.get("providerKind") ?? "openai"),
      protocol: String(data.get("protocol") ?? "chat-completions"),
      headers,
      models,
      apiKey: String(data.get("apiKey") ?? "") || null,
      clearSecret: data.get("clearSecret") === "on",
    };
  }

  function openDeleteConfirmation(connection) {
    if (snapshot.stateRecovery || snapshot.deploymentRecovery) {
      showToast(tr("只读恢复期间不能修改连接"), "error");
      return;
    }
    openModal({
      title: tr("移除连接"),
      body: `<p class="muted" style="line-height:1.7">${tr("移除")} <strong style="color:var(--text)">${escapeHtml(connection.name)}</strong>${tr("？撤销并删除仅移除有本软件受管证明的配置；仅停止管理会保留客户端配置及其中的密钥。")}</p><div id="delete-preview" role="status"></div>`,
      footer: `<button class="button ghost" data-modal-close>${tr("取消")}</button><button class="button ghost" id="confirm-delete">${tr("仅停止管理…")}</button><button class="button danger" id="revoke-delete">${tr("预览撤销并删除")}</button>`,
      onOpen(root) {
        root.querySelectorAll("[data-modal-close]").forEach((button) =>
          button.addEventListener("click", closeModal),
        );
        let plan = null;
        let busy = false;
        const detach = root.querySelector("#confirm-delete");
        const revoke = root.querySelector("#revoke-delete");
        const preview = root.querySelector("#delete-preview");
        detach.addEventListener("click", async () => {
          if (busy) return;
          if (detach.textContent !== tr("确认停止管理")) {
            plan = null;
            preview.textContent = tr("客户端配置及其中已写入的密钥将保留。本软件删除受管证明、发布记录和专用凭据；确认后需自行管理。");
            detach.textContent = tr("确认停止管理");
            revoke.textContent = tr("预览撤销并删除");
            return;
          }
          busy = true; detach.disabled = true; revoke.disabled = true;
          dialogs.setBusy(true);
          try {
            const result = await invoke("delete_connection", { connectionId: connection.id });
            if (root.isConnected) closeModal();
            showToast(result?.credentialCleanupWarning ?? tr("已停止管理，客户端配置保留"), result?.credentialCleanupWarning ? "warning" : "success");
            await refresh();
          } catch (error) {
            showToast(error?.message ?? String(error), "error");
          } finally { busy = false; if (root.isConnected) { dialogs.setBusy(false); detach.disabled = false; revoke.disabled = false; } }
        });
        revoke.addEventListener("click", async () => {
          if (busy) return;
          busy = true; detach.disabled = true; revoke.disabled = true;
          dialogs.setBusy(true);
          detach.textContent = tr("仅停止管理…");
          try {
            if (!plan) {
              plan = await invoke("preview_revoke_and_delete", { connectionId: connection.id });
              preview.innerHTML = `<p>${plan.operations.length ? tr("已核验的受管目标：") : tr("没有受管目标记录，不删除客户端文件。")}</p><ul>${plan.operations.map((op) => `<li>${escapeHtml(op.title)} · ${escapeHtml(op.targetId)}</li>`).join("")}</ul><p>${tr("受管配置与连接一并删除。外部修改会使预览失效；凭据清理失败单独报告。")}</p>`;
              revoke.textContent = tr("确认撤销并删除");
            } else {
              const planId = plan.id;
              plan = null; // An uncertain or failed apply must never be replayed.
              const result = await invoke("apply_deployment_plan", { planId, confirmed: true });
              if (!result.connectionDeleted) throw new Error(tr("撤销未完成，连接已保留。请查看活动记录或恢复状态。"));
              if (root.isConnected) closeModal();
              showToast(result.credentialCleanupWarning ?? tr("受管配置已撤销，连接已删除"), result.credentialCleanupWarning ? "warning" : "success");
              await refresh();
            }
          } catch (error) {
            plan = null;
            revoke.textContent = tr("预览撤销并删除");
            preview.textContent = error?.message ?? String(error);
            showToast(error?.message ?? String(error), "error");
          } finally { busy = false; if (root.isConnected) { dialogs.setBusy(false); detach.disabled = false; revoke.disabled = false; } }
        });
      },
    });
  }

  function openDeployment(connection, selectedIds = null) {
    if (deploymentCleanup?.busy || dialogs.busy) return;
    if (snapshot.stateRecovery || snapshot.deploymentRecovery) {
      showToast(tr("只读恢复期间不能发布。"), "error");
      return;
    }
    if (connection.enabled === false) { showToast(tr("请先启用连接再发布。"), "error"); return; }
    closeModal(); closeDeployment();
    deploymentCleanup = window.CopilotBYOKManagerInlineDeployment.mount({
      container: content, connection, targets: snapshot.clients, selectedIds, invoke, native: isDesktop,
      onError: error => showToast(error?.message ?? String(error), "error"),
      onBusyChange: setDeploymentBusy,
      async onApplied(result) {
        const applied = result.records.filter(item => item.status === "applied");
        const skipped = result.records.filter(item => item.status === "skipped").length;
        const failed = result.records.filter(item => item.status === "failed").length;
        showToast(tr("{0}{1} 个目标配置已写入{2}{3}。请核对下方结果与下一步。", isDesktop ? "" : tr("模拟 · "), applied.length, skipped ? tr("，{0} 个未自动处理", skipped) : "", failed ? tr("，{0} 个失败", failed) : ""), failed ? "error" : "success");
        await refresh();
        const heading = content.querySelector("#publication-result-title");
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: "nearest" }); }
      },
    });
  }


  function openAccountConfirmation() {
    if (!isDesktop || !data.setup) return;
    const evidenceFingerprint = data.setup.evidenceFingerprint;
    openModal({ title: tr("核对同一 GitHub 账号"), body: `
      <p>${tr("核对每个客户端显示的账号后，保存你的确认。")}</p>
      <label class="setup-select">${tr("GitHub 用户名")}<input id="confirmed-login" maxlength="39" value="${escapeHtml(data.setup.target?.login ?? "")}" placeholder="${tr("github.com 用户名")}" /></label>
      <p class="muted">${tr("通过 GitHub 公开用户接口解析账号 ID，不需要账单授权。")}</p>
      <label class="account-confirmation"><input type="checkbox" id="confirm-all-accounts" /><span>${tr("我已逐个核对所有列出的客户端，包括每个检测到的 JetBrains IDE 配置，均显示同一个 github.com 账号。")}</span></label>`,
      footer: `<button class="button ghost" data-modal-close>${tr("取消")}</button><button class="button primary" id="save-account-confirmation" disabled>${tr("保存我的确认")}</button>`,
      onOpen(root) {
        const button = root.querySelector("#save-account-confirmation");
        root.querySelector("#confirm-all-accounts").addEventListener("change", (e) => { button.disabled = !e.target.checked; });
        button.addEventListener("click", async () => {
          button.disabled = true;
          dialogs.setBusy(true);
          try { await invoke("confirm_account_alignment", { login: root.querySelector("#confirmed-login").value.trim(), evidenceFingerprint, confirmed: true }); if (root.isConnected) closeModal(); await refresh(); }
          catch (error) { showToast(error?.message ?? String(error), "error"); button.disabled = false; }
          finally { if (root.isConnected) dialogs.setBusy(false); }
        });
      },
    });
  }
  function openManualSetup(connectionId = null) {
    const connection = connectionId ? snapshot.connections.find(item => item.id === connectionId) : window.CopilotBYOKManagerSetup.derive(snapshot, data, isDesktop).selected;
    if (connectionId && !connection) { showToast(tr("该连接已移除，请重新选择连接。"), "warning"); return; }
    if (!connection) { openConnectionForm(); return; }
    openModal({ title: tr("手动配置 Copilot App"), body: `
      <p class="manager-meta">${escapeHtml(window.CopilotBYOKManagerManager.policy("github-copilot-app"))}</p>
      <ol class="manual-steps"><li>${tr("在 Copilot App 中打开")} <strong>Model providers</strong> ${tr("设置。")}</li>
      <li>${tr("添加")} <strong>${escapeHtml(connection.name)}</strong>${tr("，端点")} <code>${escapeHtml(connection.baseUrl)}</code>${tr("，推荐模型")} <code>${escapeHtml(connection.models.find((m) => m.enabled)?.modelId ?? tr("未配置"))}</code>${tr("。如需密钥，请在 App 内输入。")}</li>
      <li>${tr("在 App 内选择供应商和模型，并验证请求。")}</li></ol><p>${tr("完成 App 内配置后，保存你的确认。")}</p>`,
      footer: `<button class="button ghost" data-modal-close>${tr("关闭")}</button><button class="button primary" id="confirm-manual" ${!isDesktop || snapshot.stateRecovery || snapshot.deploymentRecovery ? "disabled" : ""}>${tr("我已完成手动配置")}</button>`,
      onOpen(root) { root.querySelector("#confirm-manual").addEventListener("click", async (event) => {
        event.target.disabled = true;
        dialogs.setBusy(true);
        try { await invoke("confirm_manual_provider", { connectionId: connection.id, confirmed: true }); if (root.isConnected) closeModal(); await refresh(); }
        catch (error) { showToast(error?.message ?? String(error), "error"); event.target.disabled = false; }
        finally { if (root.isConnected) dialogs.setBusy(false); }
      }); },
    });
  }
  async function openJetBrainsGuide(targetId) {
    const target = snapshot.clients.find(c => c.id === targetId && c.kind === "jetbrains-copilot");
    if (!target) return;
    const connection = window.CopilotBYOKManagerSetup.derive(snapshot, data, isDesktop).selected;
    let operation = null;
    if (isDesktop && connection && !snapshot.stateRecovery && !snapshot.deploymentRecovery) {
      try {
        const guide = await invoke("get_jetbrains_setup_guide", { connectionId: connection.id, targetId: target.id });
        if (guide.targetId === target.id) operation = guide;
      } catch (error) { showToast(error?.message ?? String(error), "error"); }
    }
    openModal({ title: `JetBrains BYOK · ${target.name}`, wide: true,
      body: window.CopilotBYOKManagerJetBrains.guide(connection, target, operation),
      footer: `<button class="button ghost" data-modal-close>${tr("关闭")}</button>${operation?.supported ? `<button class="button primary" id="jetbrains-preview-deployment">${tr("预览自动 BYOK")}</button>` : ""}`,
      onOpen(root) { root.querySelector("#jetbrains-preview-deployment")?.addEventListener("click", () => openDeployment(connection, [target.id])); }
    });
  }
  async function openRecovery(action = "restore") {
    if (!isDesktop) return;
    try {
      const plan = await invoke("preview_deployment_recovery", { action });
      const keepCurrent = plan.action === "keepCurrent";
      const blocked = !keepCurrent && !plan.view.committed && (plan.view.conflictCount > 0 || plan.view.unknownResourceCount > 0 || plan.view.unreadableResourceCount > 0);
      openModal({
        title: keepCurrent ? tr("核对保留现有文件") : tr("核对中断后的恢复"),
        body: keepCurrent
          ? `<p>${tr("保留全部 {0} 个记录中的资源，移除待恢复日志并解除发布写入阻塞。", plan.view.resourceCount)}</p><p><strong>${tr("此操作后，本软件将无法回滚尚未完成的变更。")}</strong> ${tr("再次发布前请核对客户端配置。")}</p><label><input id="confirm-recovery" type="checkbox" style="width:auto" />${tr("我确认保留现有文件，并丢弃待恢复的回滚数据。")}</label>`
          : `<p>${tr("记录了 {0} 个物理资源：{1} 个被外部修改，{2} 个无法定位，{3} 个无法安全读取。", plan.view.resourceCount, plan.view.conflictCount, plan.view.unknownResourceCount ?? 0, plan.view.unreadableResourceCount ?? 0)}</p><p>${plan.view.committed ? tr("审计已提交，仅清理完成的日志。") : blocked ? tr("自动恢复已阻塞。处理受影响目标后重新预览，或另行核对保留现有文件。") : tr("仅恢复没有外部改动的受管写入；再次发生外部改动时保留日志并停止恢复。")}</p><label><input id="confirm-recovery" type="checkbox" style="width:auto" ${blocked ? "disabled" : ""} />${tr("我已核对并同意执行此恢复操作。")}</label>`,
        footer: `<button class="button ghost" data-modal-close>${tr("取消")}</button>${!keepCurrent && !plan.view.committed ? `<button class="button ghost" id="review-keep-current">${tr("核对保留现有文件…")}</button>` : ""}<button class="button primary" id="apply-recovery" disabled>${keepCurrent ? tr("保留文件并结束恢复") : tr("恢复")}</button>`,
        onOpen(root) {
          const button = root.querySelector("#apply-recovery");
          root.querySelector("#confirm-recovery").addEventListener("change", (event) => { button.disabled = blocked || !event.target.checked; });
          root.querySelector("#review-keep-current")?.addEventListener("click", async (event) => {
            event.target.disabled = true;
            await openRecovery("keepCurrent");
          });
          button.addEventListener("click", async () => {
            button.disabled = true;
            dialogs.setBusy(true);
            try {
              await invoke("apply_deployment_recovery", { planId: plan.id, confirmed: true });
              closeModal();
              showToast(keepCurrent ? tr("现有文件已保留，再次发布前请核对客户端") : tr("恢复已完成，请核对原审计记录"));
              await refresh();
            } catch (error) {
              closeModal();
              showToast(tr("{0} 重试前请重新预览。", error?.message ?? error), "error");
              await refresh();
            }
            finally { if (root.isConnected) dialogs.setBusy(false); }
          });
        },
      });
    } catch (error) { showToast(error?.message ?? String(error), "error"); }
  }


  async function toggleConnection(connection, button) {
    if (snapshot.stateRecovery || snapshot.deploymentRecovery || deploymentCleanup?.busy) return;
    closeDeployment(); button.disabled = true;
    try {
      await invoke("set_connection_enabled", { connectionId: connection.id, enabled: connection.enabled === false });
      showToast(connection.enabled === false ? tr("连接已启用，尚未重新发布。") : tr("连接已停用，客户端配置仍保留。"));
      await refresh();
    } catch (error) { showToast(error?.message ?? String(error), "error"); }
    finally { if (button.isConnected) button.disabled = false; }
  }

  async function testConnection(connection, button) {
    if (!isDesktop || snapshot.stateRecovery || snapshot.deploymentRecovery) return;
    const status = button.closest("[data-connection-id]").querySelector("[data-probe-id]");
    button.disabled = true; status.textContent = tr("测试模型目录接口…");
    try {
      const result = await window.ModelDiscovery.testConnection(invoke, connection);
      if (status.isConnected) { status.textContent = result.detail; status.dataset.status = result.status; }
    } finally { if (button.isConnected) button.disabled = false; }
  }

  document.querySelector("#primary-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-route]");
    if (button) setRoute(button.dataset.route);
  });

  content.addEventListener("click", (event) => {
    const help = event.target.closest("[data-help-link]");
    if (help && isDesktop) {
      event.preventDefault();
      const url = Object.hasOwn(helpUrls, help.dataset.helpLink) ? helpUrls[help.dataset.helpLink] : null;
      if (url) void invokeNative("plugin:opener|open_url", { url, with: null }).catch(error => showToast(error?.message ?? String(error), "error"));
      return;
    }
    const action = event.target.closest("[data-action]");
    if (!action || action.disabled || deploymentCleanup?.busy) return;
    const connection = snapshot?.connections.find((item) => item.id === action.dataset.id);
    switch (action.dataset.action) {
      case "view-planned-features":
        openModal({ title: tr("未推出功能记录"), body: window.CopilotBYOKManagerCore.planned(), footer: `<button class="button ghost" data-modal-close>${tr("关闭")}</button>` });
        break;
      case "setup-install":
        window.CopilotBYOKManagerInstaller.preview((data.components ?? []).filter((c) => ["missing", "broken"].includes(c.status)).map((c) => c.id)); break;
      case "setup-signin": window.CopilotBYOKManagerAccount.preview(action.dataset.surface ? [action.dataset.surface] : undefined); break;
      case "setup-accounts": openAccountConfirmation(); break;
      case "setup-deploy": {
        const selected = window.CopilotBYOKManagerSetup.derive(snapshot, data, isDesktop).selected;
        if (selected) openDeployment(selected); else openConnectionForm(); break;
      }
      case "setup-manual": openManualSetup(action.dataset.id); break;
      case "jump-connections": {
        if (!setRoute("connections")) break;
        const target = content.querySelector('[data-action="deploy-connection"]') ?? addConnectionButton;
        if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: "center" }); } break;
      }
      case "view-publication-history": {
        if (!setRoute("clients")) break;
        const history = content.querySelector("#publication-history");
        history.open = true;
        history.querySelector("summary").focus({ preventScroll: true });
        history.scrollIntoView({ block: "start" });
        break;
      }
      case "deploy-client": {
        const client = snapshot.clients.find(client => client.id === action.dataset.clientId);
        const selected = snapshot.connections.find(connection => connection.id === action.closest(".client-card").querySelector(".app-provider-select").value);
        if (!selected || !client) break;
        appProviderChoices.set(client.id, selected.id);
        if (client.kind === "github-copilot-app") openManualSetup(selected.id);
        else openDeployment(selected, [client.id]);
        break;
      }
      case "jetbrains-guide": openJetBrainsGuide(action.dataset.id).catch(error => showToast(error?.message ?? String(error), "error")); break;
      case "preview-recovery": openRecovery(); break;
      case "add-connection":
        openConnectionForm();
        break;
      case "edit-connection":
        if (connection) openConnectionForm(connection);
        break;
      case "deploy-connection":
        if (connection) openDeployment(connection);
        break;
      case "toggle-connection":
        if (connection) void toggleConnection(connection, action);
        break;
      case "test-connection":
        if (connection) void testConnection(connection, action);
        break;
      case "delete-connection":
        if (connection) openDeleteConfirmation(connection);
        break;
      case "route":
        if (setRoute(action.dataset.route) && action.dataset.clientId) {
          const target = [...content.querySelectorAll(".client-card[data-client-id]")].find(card => card.dataset.clientId === action.dataset.clientId);
          if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: "start" }); }
        }
        break;
      case "refresh":
        refresh();
        break;
    }
  });

  addConnectionButton.addEventListener("click", () => openConnectionForm());
  refreshButton.addEventListener("click", refresh);

  languageSelect.addEventListener("change", () => {
    // Never discard a form or a reviewed/in-flight deployment to change copy.
    // Modal backgrounds are inert; this guard also protects synthetic events.
    if (modalRoot.querySelector('[role="dialog"]') || content.querySelector("#inline-deployment")) {
      languageSelect.value = i18n.locale();
      showToast(tr("请先完成当前操作或关闭表单、发布预览，再切换语言。"), "warning");
      return;
    }
    const result = i18n.setLocale(languageSelect.value);
    languageSelect.value = i18n.locale();
    if (result.changed) toastRoot.replaceChildren();
    setRuntimeState();
    render();
    void syncTrayLocale();
    if (!result.persisted) showToast(tr("语言偏好无法保存，下次启动将按系统语言选择。"), "warning");
  });
  document.addEventListener("change", event => {
    if (!event.target.matches("[data-appearance-select]")) return;
    const result = window.CopilotBYOKManagerAppearance.set(event.target.value);
    if (!result.persisted) showToast(tr("外观偏好无法保存，本次选择仍然有效。"), "warning");
  });

  content.addEventListener("change", async (event) => {
    if (event.target.matches("[data-close-action]")) {
      if (!isDesktop || windowSettingsBusy || !["tray", "exit"].includes(event.target.value) || data.windowBehavior?.preferencesAvailable !== true || data.windowBehavior?.trayAvailable !== true) {
        updateWindowSettingsUI(); return;
      }
      windowSettingsBusy = true;
      event.target.disabled = true;
      try { data.windowBehavior = await invokeNative("set_close_action", { action: event.target.value }); }
      catch { showToast(tr("关闭选项未保存，仍使用原选择。请刷新或重启后核对。"), "error"); }
      finally {
        windowSettingsBusy = false; updateWindowSettingsUI();
        if (refreshQueued) { refreshQueued = false; void refresh(); }
      }
      return;
    }
    if (event.target.matches(".app-provider-select")) {
      const card = event.target.closest(".client-card");
      if (deploymentCleanup?.busy) {
        event.target.value = appProviderChoices.get(card.dataset.clientId) ?? "";
        return;
      }
      closeDeployment();
      const chosen = snapshot.connections.find(connection => connection.id === event.target.value && connection.enabled !== false);
      appProviderChoices.set(card.dataset.clientId, chosen?.id ?? "");
      card.querySelector('[data-action="deploy-client"]').disabled = !chosen || Boolean(snapshot.stateRecovery || snapshot.deploymentRecovery) || (!snapshot.clients.find(client => client.id === card.dataset.clientId)?.supportsWrite && snapshot.clients.find(client => client.id === card.dataset.clientId)?.kind !== "github-copilot-app");
      return;
    }
    if (event.target.id !== "setup-connection") return;
    const select = event.target;
    select.disabled = true;
    try { await invoke("select_setup_connection", { connectionId: select.value }); await refresh(); }
    catch (error) { select.value = window.CopilotBYOKManagerSetup.derive(snapshot, data, isDesktop).selected?.id ?? ""; showToast(error?.message ?? String(error), "error"); }
    finally { if (select.isConnected) select.disabled = false; }
  });
  document.addEventListener("copilot-byok-manager:refresh-setup", () => refresh());
  void syncTrayLocale();
  refresh();
})();
