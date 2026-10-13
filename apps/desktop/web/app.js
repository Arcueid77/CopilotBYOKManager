(() => {
  "use strict";

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

  const routes = {
    overview: {
      title: "总览",
      subtitle: "管理连接，预览后发布。",
      add: false,
    },
    connections: {
      title: "连接",
      subtitle: "端点、密钥与模型。停用连接不会删除客户端配置。",
      add: true,
    },
    clients: {
      title: "客户端",
      subtitle: "安装、官方登录与发布能力，按客户端逐个核对。",
      add: false,
    },
    usage: { title: "用量", subtitle: "官方配额、个人账单与本地记录，分别显示覆盖范围。", add: false },
    resources: { title: "资源", subtitle: "通过已审核的公开配置发布 MCP、Skills 与 Instructions。", add: false },
    about: { title: "关于", subtitle: "CopilotBYOKManager · PilotWeave", add: false },
    activity: {
      title: "活动记录",
      subtitle: "本地操作记录，不含密钥或对话内容。",
      add: false,
    },
    settings: {
      title: "设置",
      subtitle: "本地存储、授权与恢复状态。",
      add: false,
    },
  };

  let route = "overview";
  let snapshot = null;
  let loading = false;
  let refreshQueued = false;
  let deploymentCleanup = null;
  function closeDeployment() { deploymentCleanup?.(); deploymentCleanup = null; }
  const data = { errors: {} };
  const usageSections = () => [
    ["localUsage", "get_usage_overview", { query: window.PilotWeaveUsage.query() }],
    ["sources", "get_usage_sources"], ["quota", "get_official_runtime_usage"],
    ["billing", "get_github_billing", window.PilotWeaveUsage.billingQuery()], ["catalog", "get_price_catalog"], ["runs", "get_usage_runs"],
  ];
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
  async function refreshUsage() { await loadSections(usageSections()); render(); }


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
      statePath: "浏览器试用 — no filesystem access",
      stateRecovery: null,
      usageDb: {
        state: "unavailable",
        detail: "浏览器试用 has no native usage database",
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
          headers: { "HTTP-Referer": "https://pilotweave.dev" },
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
          detail: "默认配置的模型目录（模拟）",
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
          detail: "模拟检测结果；App 供应商需手动配置",
          path: "/Applications/GitHub Copilot.app",
          detected: true,
          supportsWrite: false,
          status: "read-only",
          diagnostic:
            "没有已审核的外部接口，不改写 App 私有状态或凭据存储",
        },
      ],
      deployments: [],
      publishedSources: [],
    };
  }

  function loadDemoState() {
    const raw = sessionStorage.getItem("pilotweave-demo");
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
    sessionStorage.setItem("pilotweave-demo", JSON.stringify(demoState));
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
        return { resources: [], bindings: [], detail: "浏览器试用 has no native resource catalog" };
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
        if (!connection) throw new Error("连接不存在");
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
        if (!connection) throw new Error("连接不存在");
        if (connection.enabled === false) throw new Error("请先启用连接再发布");
        const targets = args.targetIds.map((id) =>
          demoState.clients.find((item) => item.id === id),
        );
        if (!targets.length || targets.some((target) => !target)) throw new Error("发布目标不存在");
        for (const [id, stored] of demoPlans) {
          if (Date.now() >= stored.expiresAt) demoPlans.delete(id);
        }
        if (demoPlans.size >= 32) throw new Error("待处理预览过多，请关闭旧预览");
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
          throw new Error("预览已过期或已使用，请重新预览");
        }
        const { plan } = stored;
        const connection = demoState.connections.find(
          (item) => item.id === plan.connectionId,
        );
        if (!connection) throw new Error("连接不存在");
        const targets = plan.targetIds
          .map((id) => demoState.clients.find((item) => item.id === id))
          .filter(Boolean);
        if (stored.connectionRevision !== JSON.stringify(connection) || stored.targetRevision !== JSON.stringify(targets)) {
          throw new Error("模拟计划已变化，请重新预览");
        }
        const records = plan.operations.map((operation) => ({
          id: crypto.randomUUID(),
          planId: plan.id,
          connectionId: connection.id,
          targetId: operation.targetId,
          targetKind: operation.targetKind,
          status: operation.supported ? "applied" : "skipped",
          detail: operation.supported
            ? "浏览器试用仅模拟此次发布，未写入客户端配置"
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
        return window.PilotWeaveUsage.preview(command, demoState);
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
        title: `发布 ${connection.name} 到 ${target.name}`,
        description: target.supportsWrite
          ? `模拟更新 ${target.path ?? target.name}`
          : "请在客户端供应商设置中手动配置",
        changes: [
          `发布 ${connection.models.filter((item) => item.enabled).length} 个启用模型`,
          "保留其他来源的配置",
          target.supportsWrite
            ? "模拟创建支持回滚的受管配置"
            : "不改写未支持的客户端私有状态",
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
    return new Intl.DateTimeFormat(undefined, {
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
      available: "可用",
      "not-installed": "未安装",
      "read-only": "仅手动处理",
      error: "需核对",
      applied: "已完成",
      skipped: "未自动处理",
      failed: "失败",
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
    runtimeLabel.textContent = isDesktop ? "本地模式" : "浏览器试用";
    runtimeDetail.textContent = isDesktop
      ? "写入前须预览确认"
      : "不修改电脑";
  }

  async function refresh() {
    closeDeployment();
    if (loading) { refreshQueued = true; return; }
    loading = true;
    const focus = window.PilotWeaveUI.capture(content);
    refreshButton.disabled = true;
    content.innerHTML = '<div class="loading"><div><div class="spinner"></div>读取本地状态…</div></div>';
    try {
      await loadSections([["dashboard", "get_dashboard"], ["components", "get_installation_status"], ["installRuns", "get_install_runs"], ["resources", "get_resources"], ["setup", "get_setup_status"], ["authorization", "get_github_authorization_status"], ...usageSections()]);
      if (!data.dashboard) throw new Error(data.errors.dashboard);
      snapshot = data.dashboard;
      window.PilotWeaveInstaller.hydrate(data.components, data.installRuns);
      window.PilotWeaveAccount.hydrate(data.setup?.accounts);
      window.PilotWeaveGithubAuth.hydrate(data.authorization);
      setRuntimeState();
      render();
      window.PilotWeaveUI.restore(content, focus);
    } catch (error) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">!</div>
          <h2>无法读取本地状态</h2>
          <p>${escapeHtml(error?.message ?? error)}</p>
          <button class="button" data-action="refresh">重试</button>
        </div>`;
      showToast(error?.message ?? String(error), "error");
    } finally {
      loading = false;
      refreshButton.disabled = false;
      if (refreshQueued) { refreshQueued = false; void refresh(); }
    }
  }

  function setRoute(nextRoute) {
    if (!routes[nextRoute]) return;
    const fromMore = document.querySelector(".more-nav").contains(document.activeElement);
    route = nextRoute;
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.route === route);
      if (button.dataset.route === route) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    document.querySelector(".more-nav").open = false;
    document.querySelector(".more-nav > summary").classList.toggle("active", ["resources", "activity", "settings", "about"].includes(route));
    render();
    if (fromMore) { pageTitle.tabIndex = -1; pageTitle.focus({ preventScroll: true }); }
  }

  function render() {
    if (!snapshot) return;
    closeDeployment();
    const focus = window.PilotWeaveUI.capture(content);
    const meta = routes[route];
    pageTitle.textContent = meta.title;
    pageSubtitle.textContent = meta.subtitle;
    addConnectionButton.hidden = !meta.add;
    addConnectionButton.disabled = Boolean(snapshot.stateRecovery || snapshot.deploymentRecovery);
    const renderers = {
      overview: renderOverview,
      connections: renderConnections,
      clients: renderClients,
      usage: () => window.PilotWeaveUsage.render(snapshot, data, isDesktop),
      resources: () => window.PilotWeaveResources.render(data.resources, data.errors.resources, isDesktop, Boolean(snapshot.stateRecovery || snapshot.deploymentRecovery)),
      about: () => '<section class="setting-row"><div><h2>CopilotBYOKManager</h2><p>独立的 Copilot 配置管理工具，处于预发布阶段，与 GitHub 无隶属关系。</p><p>配置保存在本地，登录凭据留在各官方客户端。</p></div></section>',
      activity: renderActivity,
      settings: renderSettings,
    };
    content.innerHTML = (!isDesktop && !["overview", "usage"].includes(route) ? '<div class="preview-banner">浏览器试用 · 示例数据 · 不修改电脑</div>' : "") + renderers[route]();
    content.dataset.route = route;
    window.PilotWeaveInstaller.mount();
    window.PilotWeaveAccount.mount();
    window.PilotWeaveGithubAuth.mount();
    window.PilotWeaveUI.restore(content, focus);
  }

  function renderOverview() {
    return window.PilotWeaveManager.renderHome(snapshot, data, isDesktop);
  }

  function renderConnections() {
    return `
      <p class="manager-boundary" style="margin-bottom:18px">密钥保存在系统凭据库，不回读到界面。测试连接仅查询模型目录，不验证推理能力。</p>
      ${snapshot.connections.length ? `<div class="card-grid">${snapshot.connections.map(connectionCard).join("")}</div>` : emptyConnections()}
      <section class="manager-section manager-publication"><h2>最近配置操作</h2>${window.PilotWeaveManager.lastResult(snapshot, isDesktop)}</section>
    `;
  }

  function renderClients() {
    return `<details class="manager-section" ${isDesktop && data.components?.some(component => ["missing", "broken", "unknown"].includes(component.status)) ? "open" : ""}><summary>安装与更新</summary><section id="installation-panel" class="install-panel"></section></details>
      <details class="manager-section" ${isDesktop && !["verifiedSameAccount", "userConfirmedSameAccount"].includes(data.setup?.alignment) ? "open" : ""}><summary>官方登录与账号核对</summary><section id="account-panel" class="account-panel"></section><button class="button ghost small" data-action="setup-accounts" ${!isDesktop ? "disabled" : ""}>逐个核对同一 GitHub 账号</button></details>
      <div class="client-grid">${snapshot.clients.map(clientCard).join("")}</div>
      ${snapshot.clients.some(client => client.kind === "github-copilot-app" && client.detected) ? `<section class="manager-section"><h2>Copilot App 供应商</h2><p class="manager-meta">${escapeHtml(window.PilotWeaveManager.policy("github-copilot-app"))}</p><button class="button ghost small" data-action="setup-manual">查看手动配置步骤</button></section>` : ""}
    `;
  }

  function renderActivity() {
    const entries = [
      ...snapshot.deployments.map((r) => ({ time: r.createdAt, kind: "发布 / 回滚", source: r.targetId, status: r.status, detail: r.detail, route: "connections" })),
      ...(data.installRuns ?? []).map((r) => ({ time: r.finishedAt ?? r.startedAt, kind: "安装", source: r.componentIds.join(", "), status: r.status, detail: r.detail, route: "clients" })),
      ...(data.setup?.accounts?.loginRuns ?? []).map((r) => ({ time: r.finishedAt ?? r.startedAt, kind: "官方登录", source: r.requestedSurfaces.join(", "), status: r.status, detail: r.summary, route: "clients" })),
      ...(data.runs ?? []).map((r) => ({ time: r.finishedAt ?? r.startedAt, kind: "导入 / 刷新", source: r.sourceId, status: r.status, detail: r.detail, route: "usage" })),
    ].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    return `<section class="usage-panel"><div class="step-heading"><h2>最近活动</h2><span>本地脱敏记录</span></div>${[data.errors.runs, data.errors.installRuns].filter(Boolean).map((error) => `<p class="inline-error">${escapeHtml(error)}</p>`).join("")}
      ${entries.length ? `<div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>时间</th><th>操作</th><th>目标 / 来源</th><th>状态</th><th>详情</th><th>下一步</th></tr></thead><tbody>${entries.slice(0, 200).map((r) => `<tr><td>${escapeHtml(formatDate(r.time))}</td><td>${escapeHtml(r.kind)}</td><td>${escapeHtml(r.source)}</td><td>${escapeHtml(window.PilotWeaveUsage.label(r.status))}</td><td>${escapeHtml(r.detail)}</td><td><button class="button ghost small" data-action="route" data-route="${r.route}">核对</button></td></tr>`).join("")}</tbody></table></div>` : '<p class="usage-empty">尚无活动记录。</p>'}</section>`;
  }

  function renderSettings() {
    return `<section id="github-authorization-panel"></section>
      <div class="settings-list">
        ${settingRow("运行时", isDesktop ? "本地原生后端" : "浏览器试用", isDesktop ? "配置写入须先预览并确认。" : "发布仅模拟，数据保留在当前标签页。")}
        ${settingRow("状态文件", snapshot.statePath, "只保存非敏感连接、发布记录和版本。")}
        ${settingRow("状态版本", `v${snapshot.version}`, "状态版本高于当前程序时拒绝迁移。")}
        ${settingRow("状态恢复", snapshot.stateRecovery ? "只读恢复" : "正常", snapshot.stateRecovery ?? "状态文件已正常读取，可修改。")}
        ${settingRow("用量数据库", usageDbLabel(), snapshot.usageDb?.detail ?? "未提供用量存储状态。")}
        ${settingRow("凭据存储", isDesktop ? "系统凭据库" : "模拟密钥保存标记", "状态查询不会返回密钥。")}
        ${settingRow("GitHub Copilot app", "供应商仅手动配置", "可检测客户端，不读写私有供应商存储。")}
      </div>`;
  }

  function usageDbLabel() {
    const db = snapshot.usageDb;
    if (!db) return "未知";
    return db.state === "available"
      ? `可用（格式 v${db.schemaVersion}）`
      : "不可用";
  }

  function storageWarningBanner() {
    const warnings = [];
    if (snapshot.deploymentRecovery) warnings.push(snapshot.deploymentRecovery);
    if (snapshot.stateRecovery) {
      warnings.push(
        `连接存储处于只读恢复： ${snapshot.stateRecovery}`,
      );
    }
    if (snapshot.usageDb && snapshot.usageDb.state !== "available") {
      warnings.push(`用量数据库不可用： ${snapshot.usageDb.detail}`);
    }
    if (!warnings.length) return "";
    return `<div class="security-note">
      <div class="note-icon">⚠</div>
      <div>
        <strong>存储需要核对</strong>
        ${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}
        ${snapshot.deploymentRecovery ? '<button class="button" data-action="preview-recovery">核对安全恢复</button>' : ""}
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
    return `
      <article class="client-card">
        <div class="client-header">
          <div class="client-icon">${escapeHtml(clientIcon(client.kind))}</div>
          <span class="status-pill ${escapeHtml(client.status)}">${escapeHtml(statusLabel(client.status))}</span>
        </div>
        <h3>${escapeHtml(client.name)}</h3>
        <p>${escapeHtml(client.detail)}</p>
        <div class="path-line" title="${escapeHtml(client.path ?? client.diagnostic ?? "")}">${escapeHtml(client.path ?? client.diagnostic ?? "未提供本地路径")}</div>
        ${client.kind === "jetbrains-copilot" ? `<button class="button ghost small" data-action="jetbrains-guide" data-id="${escapeHtml(client.id)}">${client.supportsWrite ? "自动发布 BYOK" : "配置指引"}</button>` : ""}
      </article>`;
  }

  function connectionCard(connection) {
    return window.PilotWeaveManager.connectionCard(connection, snapshot, isDesktop);
  }

  function emptyConnections() {
    return `
      <div class="empty-state">
        <div class="empty-icon">◇</div>
        <h2>尚无连接</h2>
        <p>添加供应商端点和模型，预览后发布到支持的客户端。</p>
        <button class="button primary" data-action="add-connection">添加连接</button>
      </div>`;
  }

  let modalCleanup = null;
  const dialogs = window.PilotWeaveUI.modal({ root: modalRoot, background: document.querySelector(".app-shell"), cleanup() {
    modalCleanup?.(); modalCleanup = null; modalRoot.replaceChildren();
  } });
  function openModal({ title, body, footer = "", wide = false, onOpen }) {
    if (!dialogs.prepare()) return;
    closeDeployment();
    modalCleanup?.();
    modalCleanup = null;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
          <header class="modal-header"><h2>${escapeHtml(title)}</h2><button class="icon-button" data-modal-close aria-label="关闭">×</button></header>
          <div class="modal-body">${body}</div>
          ${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}
        </section>
      </div>`;
    dialogs.mount();
    onOpen?.(modalRoot);
  }

  function closeModal(event) {
    return event?.type ? dialogs.requestClose() : dialogs.close();
  }

  function openConnectionForm(connection = null) {
    if (snapshot.stateRecovery || snapshot.deploymentRecovery) {
      showToast("只读恢复期间不能修改连接", "error");
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
      title: connection ? `编辑 ${connection.name}` : "添加连接",
      wide: true,
      body: `
        <form id="connection-form" class="form-grid" novalidate>
          <input type="hidden" name="id" value="${escapeHtml(connection?.id ?? "")}" />
          <p id="connection-error" class="inline-error full" role="alert" tabindex="-1" hidden></p>
          <div class="form-field full">
            <label for="connection-name">名称</label>
            <input id="connection-name" name="name" required maxlength="160" value="${escapeHtml(connection?.name ?? "")}" placeholder="例如：我的供应商" />
          </div>
          <div class="form-field full">
            <label for="base-url">端点地址</label>
            <input id="base-url" name="baseUrl" type="url" required value="${escapeHtml(connection?.baseUrl ?? "")}" placeholder="https://api.example.com/v1" />
            <small>填写供应商提供的接口基址，例如 https://api.example.com/v1。不同供应商的协议可在高级选项中核对。</small>
          </div>
          <div class="form-field full">
            <label for="api-key">API 密钥</label>
            <input id="api-key" name="apiKey" type="password" autocomplete="new-password" placeholder="${connection?.hasSecret ? "留空保留已存密钥，不回读原值" : "允许匿名的端点可留空"}" />
            <small>保存在系统凭据库，不写入连接配置文件。</small>
          </div>
          ${connection ? `<div class="form-field full"><label><input name="clearSecret" type="checkbox" style="width:auto;height:auto;margin-right:7px" />移除已保存的密钥</label></div>` : ""}
          <div class="form-field full model-discovery" id="model-discovery">
            <div class="model-discovery-actions"><strong>获取模型目录</strong><button type="button" class="button ghost small" data-model-fetch>获取模型</button></div>
            <small data-model-status role="status" aria-live="polite"></small>
            <small>只读取当前端点的模型目录，不发送对话请求。勾选后添加，不会自动全选。</small>
            <div data-model-results hidden>
              <input type="search" data-model-search aria-label="筛选模型" placeholder="按模型名称或 ID 筛选" />
              <div class="discovered-models" data-model-list></div>
              <button type="button" class="button ghost small" data-model-add disabled>添加已选 (0)</button>
            </div>
          </div>
          <div class="form-field full">
            <label for="models">模型</label>
            <textarea id="models" name="models" required placeholder="model-id | Display Name">${escapeHtml(modelsText)}</textarea>
            <small>每行一个模型：<code>上游模型 ID | 显示名称</code>，名称可省略。</small>
          </div>
          <div class="form-field full"><label for="preferred-model">首选模型</label><select id="preferred-model" name="preferredModel"></select><small>CLI 写入 COPILOT_MODEL；其他客户端仅作本软件推荐，仍需在客户端选择。</small></div>
          <details class="connection-advanced full" ${advanced ? "open" : ""}><summary>高级选项：供应商类型、接口协议与请求头</summary><div class="form-grid">
            <div class="form-field"><label for="provider-kind">供应商类型</label><select id="provider-kind" name="providerKind">${selectOptions(["openai", "azure", "anthropic", "local", "custom"], connection?.providerKind ?? "openai", { openai: "OpenAI 兼容", azure: "Azure OpenAI", anthropic: "Anthropic", local: "本地端点", custom: "自定义" })}</select></div>
            <div class="form-field"><label for="protocol">接口协议</label><select id="protocol" name="protocol">${selectOptions(["chat-completions", "responses", "messages"], connection?.protocol ?? "chat-completions", { "chat-completions": "Chat Completions", responses: "Responses", messages: "Messages" })}</select><small>按供应商文档选择；更改类型不会自动改写协议或端点。</small></div>
            <div class="form-field full"><label for="headers">请求头（可选）</label><textarea id="headers" name="headers" placeholder="X-Custom-Header: value&#10;Authorization: Bearer \${apiKey}">${escapeHtml(headersText)}</textarea><small>每行一个请求头；用 <code>\${apiKey}</code> 引用密钥，不填写真实密钥值。</small></div>
          </div></details>
        </form>`,
      footer: `<button class="button ghost" data-modal-close>取消</button><button class="button primary" id="save-connection" type="submit" form="connection-form">保存连接</button>`,
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
          errorPanel.textContent = `连接未保存。${message}`; errorPanel.hidden = false;
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
          if (!form.checkValidity()) { formError("请填写必填项，并检查端点地址格式。", form.querySelector(":invalid")); return; }
          const data = new FormData(form);
          saving = true;
          saveButton.disabled = true;
          saveButton.textContent = "保存中…";
          dialogs.setBusy(true);
          errorPanel.hidden = true;
          try {
            const input = parseConnectionForm(data, connection, discovery.discoveredIds);
            await invoke("upsert_connection", { input });
            if (form.isConnected) closeModal();
            showToast("连接已保存，尚未发布到客户端。");
            await refresh();
          } catch (error) {
            if (form.isConnected) dialogs.setBusy(false);
            const field = ["name", "baseUrl", "models", "headers", "preferredModel"].includes(error?.field) ? form.elements.namedItem(error.field) : null;
            if (form.isConnected) formError(error?.message ?? String(error), field);
          } finally {
            saving = false;
            if (saveButton.isConnected) { dialogs.setBusy(false); saveButton.disabled = false; saveButton.textContent = "保存连接"; }
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
    if (!String(data.get("name") ?? "").trim()) invalid("请填写连接名称。", "name");
    if (new TextEncoder().encode(String(data.get("name") ?? "")).length > 160) invalid("名称过长，请缩短后重试。", "name");
    const modelLines = String(data.get("models") ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!modelLines.length) invalid("请至少添加一个模型。", "models");
    const existingByModelId = Object.fromEntries(
      (existing?.models ?? []).map((item) => [item.modelId, item]),
    );
    let models = modelLines.map((line) => {
      const [rawId, ...nameParts] = line.split("|");
      const modelId = rawId.trim();
      if (!modelId) invalid("模型行须包含模型 ID。", "models");
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
      showToast("只读恢复期间不能修改连接", "error");
      return;
    }
    openModal({
      title: "移除连接",
      body: `<p class="muted" style="line-height:1.7">移除 <strong style="color:var(--text)">${escapeHtml(connection.name)}</strong>？撤销并删除仅移除有本软件受管证明的配置；仅停止管理会保留客户端配置及其中的密钥。</p><div id="delete-preview" role="status"></div>`,
      footer: `<button class="button ghost" data-modal-close>取消</button><button class="button ghost" id="confirm-delete">仅停止管理…</button><button class="button danger" id="revoke-delete">预览撤销并删除</button>`,
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
          if (detach.textContent !== "确认停止管理") {
            plan = null;
            preview.textContent = "客户端配置及其中已写入的密钥将保留。本软件删除受管证明、发布记录和专用凭据；确认后需自行管理。";
            detach.textContent = "确认停止管理";
            revoke.textContent = "预览撤销并删除";
            return;
          }
          busy = true; detach.disabled = true; revoke.disabled = true;
          try {
            const result = await invoke("delete_connection", { connectionId: connection.id });
            closeModal();
            showToast(result?.credentialCleanupWarning ?? "已停止管理，客户端配置保留", result?.credentialCleanupWarning ? "warning" : "success");
            await refresh();
          } catch (error) {
            showToast(error?.message ?? String(error), "error");
          } finally { busy = false; detach.disabled = false; revoke.disabled = false; }
        });
        revoke.addEventListener("click", async () => {
          if (busy) return;
          busy = true; detach.disabled = true; revoke.disabled = true;
          detach.textContent = "仅停止管理…";
          try {
            if (!plan) {
              plan = await invoke("preview_revoke_and_delete", { connectionId: connection.id });
              preview.innerHTML = `<p>${plan.operations.length ? "已核验的受管目标：" : "没有受管目标记录，不删除客户端文件。"}</p><ul>${plan.operations.map((op) => `<li>${escapeHtml(op.title)} · ${escapeHtml(op.targetId)}</li>`).join("")}</ul><p>受管配置与连接一并删除。外部修改会使预览失效；凭据清理失败单独报告。</p>`;
              revoke.textContent = "确认撤销并删除";
            } else {
              const planId = plan.id;
              plan = null; // An uncertain or failed apply must never be replayed.
              const result = await invoke("apply_deployment_plan", { planId, confirmed: true });
              if (!result.connectionDeleted) throw new Error("撤销未完成，连接已保留。请查看活动记录或恢复状态。");
              closeModal();
              showToast(result.credentialCleanupWarning ?? "受管配置已撤销，连接已删除", result.credentialCleanupWarning ? "warning" : "success");
              await refresh();
            }
          } catch (error) {
            plan = null;
            revoke.textContent = "预览撤销并删除";
            preview.textContent = error?.message ?? String(error);
            showToast(error?.message ?? String(error), "error");
          } finally { busy = false; detach.disabled = false; revoke.disabled = false; }
        });
      },
    });
  }

  function openDeployment(connection, selectedIds = null) {
    if (snapshot.stateRecovery || snapshot.deploymentRecovery) {
      showToast("只读恢复期间不能发布。", "error");
      return;
    }
    if (connection.enabled === false) { showToast("请先启用连接再发布。", "error"); return; }
    closeModal(); closeDeployment();
    deploymentCleanup = window.PilotWeaveInlineDeployment.mount({
      container: content, connection, targets: snapshot.clients, selectedIds, invoke, native: isDesktop,
      onError: error => showToast(error?.message ?? String(error), "error"),
      async onApplied(result) {
        const applied = result.records.filter(item => item.status === "applied");
        const skipped = result.records.filter(item => item.status === "skipped").length;
        const failed = result.records.filter(item => item.status === "failed").length;
        showToast(`${isDesktop ? "" : "模拟 · "}${applied.length} 个目标配置已写入${skipped ? `，${skipped} 个未自动处理` : ""}${failed ? `，${failed} 个失败` : ""}。请核对下方结果与下一步。`, failed ? "error" : "success");
        await refresh();
      },
    });
  }


  function openAccountConfirmation() {
    if (!isDesktop || !data.setup) return;
    const evidenceFingerprint = data.setup.evidenceFingerprint;
    openModal({ title: "核对同一 GitHub 账号", body: `
      <p>逐个检查客户端显示的账号。这只记录你的确认，不代替自动验证。</p>
      <label class="setup-select">GitHub 用户名<input id="confirmed-login" maxlength="39" value="${escapeHtml(data.setup.target?.login ?? "")}" placeholder="github.com 用户名" /></label>
      <p class="muted">通过 GitHub 公开用户接口解析账号 ID，不需要账单授权。</p>
      <label class="account-confirmation"><input type="checkbox" id="confirm-all-accounts" /><span>我已逐个核对所有列出的客户端，包括每个检测到的 JetBrains IDE 配置，均显示同一个 github.com 账号。</span></label>`,
      footer: '<button class="button ghost" data-modal-close>取消</button><button class="button primary" id="save-account-confirmation" disabled>保存我的确认</button>',
      onOpen(root) {
        const button = root.querySelector("#save-account-confirmation");
        root.querySelector("#confirm-all-accounts").addEventListener("change", (e) => { button.disabled = !e.target.checked; });
        button.addEventListener("click", async () => {
          button.disabled = true;
          try { await invoke("confirm_account_alignment", { login: root.querySelector("#confirmed-login").value.trim(), evidenceFingerprint, confirmed: true }); closeModal(); await refresh(); }
          catch (error) { showToast(error?.message ?? String(error), "error"); button.disabled = false; }
        });
      },
    });
  }
  function openManualSetup() {
    const connection = window.PilotWeaveSetup.derive(snapshot, data, isDesktop).selected;
    if (!connection) { openConnectionForm(); return; }
    openModal({ title: "手动配置 Copilot App", body: `
      <p class="manager-meta">${escapeHtml(window.PilotWeaveManager.policy("github-copilot-app"))}</p>
      <ol class="manual-steps"><li>在 Copilot App 中打开 <strong>Model providers</strong> 设置。</li>
      <li>添加 <strong>${escapeHtml(connection.name)}</strong>，端点 <code>${escapeHtml(connection.baseUrl)}</code>，推荐模型 <code>${escapeHtml(connection.models.find((m) => m.enabled)?.modelId ?? "未配置")}</code>。如需密钥，请在 App 内输入。</li>
      <li>在 App 内选择供应商和模型，并验证请求。</li></ol><p>这里记录你的手动确认，不读取或验证 App 的私有供应商配置。</p>`,
      footer: `<button class="button ghost" data-modal-close>关闭</button><button class="button primary" id="confirm-manual" ${!isDesktop || snapshot.stateRecovery || snapshot.deploymentRecovery ? "disabled" : ""}>我已完成手动配置</button>`,
      onOpen(root) { root.querySelector("#confirm-manual").addEventListener("click", async (event) => {
        event.target.disabled = true;
        try { await invoke("confirm_manual_provider", { connectionId: connection.id, confirmed: true }); closeModal(); await refresh(); }
        catch (error) { showToast(error?.message ?? String(error), "error"); event.target.disabled = false; }
      }); },
    });
  }
  async function openJetBrainsGuide(targetId) {
    const target = snapshot.clients.find(c => c.id === targetId && c.kind === "jetbrains-copilot");
    if (!target) return;
    const connection = window.PilotWeaveSetup.derive(snapshot, data, isDesktop).selected;
    let operation = null;
    if (isDesktop && connection && !snapshot.stateRecovery && !snapshot.deploymentRecovery) {
      try {
        const guide = await invoke("get_jetbrains_setup_guide", { connectionId: connection.id, targetId: target.id });
        if (guide.targetId === target.id) operation = guide;
      } catch (error) { showToast(error?.message ?? String(error), "error"); }
    }
    openModal({ title: `JetBrains BYOK · ${target.name}`, wide: true,
      body: window.PilotWeaveJetBrains.guide(connection, target, operation),
      footer: `<button class="button ghost" data-modal-close>关闭</button>${operation?.supported ? '<button class="button primary" id="jetbrains-preview-deployment">预览自动 BYOK</button>' : ""}`,
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
        title: keepCurrent ? "核对保留现有文件" : "核对中断后的恢复",
        body: keepCurrent
          ? `<p>保留全部 ${plan.view.resourceCount} 个记录中的资源，移除待恢复日志并解除发布写入阻塞。</p><p><strong>此操作后，本软件将无法回滚尚未完成的变更。</strong> 这不代表配置正确或发布成功。再次发布前请核对客户端。</p><label><input id="confirm-recovery" type="checkbox" style="width:auto" />我确认保留现有文件，并丢弃待恢复的回滚数据。</label>`
          : `<p>记录了 ${plan.view.resourceCount} 个物理资源：${plan.view.conflictCount} 个被外部修改，${plan.view.unknownResourceCount ?? 0} 个无法定位，${plan.view.unreadableResourceCount ?? 0} 个无法安全读取。</p><p>${plan.view.committed ? "审计已提交，仅清理完成的日志。" : blocked ? "自动恢复已阻塞。处理受影响目标后重新预览，或另行核对保留现有文件。" : "仅恢复没有外部改动的受管写入；再次发生外部改动时保留日志并停止恢复。"}</p><label><input id="confirm-recovery" type="checkbox" style="width:auto" ${blocked ? "disabled" : ""} />我已核对并同意执行此恢复操作。</label>`,
        footer: `<button class="button ghost" data-modal-close>取消</button>${!keepCurrent && !plan.view.committed ? '<button class="button ghost" id="review-keep-current">核对保留现有文件…</button>' : ""}<button class="button primary" id="apply-recovery" disabled>${keepCurrent ? "保留文件并结束恢复" : "恢复"}</button>`,
        onOpen(root) {
          const button = root.querySelector("#apply-recovery");
          root.querySelector("#confirm-recovery").addEventListener("change", (event) => { button.disabled = blocked || !event.target.checked; });
          root.querySelector("#review-keep-current")?.addEventListener("click", async (event) => {
            event.target.disabled = true;
            await openRecovery("keepCurrent");
          });
          button.addEventListener("click", async () => {
            button.disabled = true;
            try {
              await invoke("apply_deployment_recovery", { planId: plan.id, confirmed: true });
              closeModal();
              showToast(keepCurrent ? "现有文件已保留，再次发布前请核对客户端" : "恢复已完成，请核对原审计记录");
              await refresh();
            } catch (error) {
              closeModal();
              showToast(`${error?.message ?? error} 重试前请重新预览。`, "error");
              await refresh();
            }
          });
        },
      });
    } catch (error) { showToast(error?.message ?? String(error), "error"); }
  }


  async function toggleConnection(connection, button) {
    if (snapshot.stateRecovery || snapshot.deploymentRecovery) return;
    closeDeployment(); button.disabled = true;
    try {
      await invoke("set_connection_enabled", { connectionId: connection.id, enabled: connection.enabled === false });
      showToast(connection.enabled === false ? "连接已启用，尚未重新发布。" : "连接已停用，客户端配置仍保留。");
      await refresh();
    } catch (error) { showToast(error?.message ?? String(error), "error"); }
    finally { if (button.isConnected) button.disabled = false; }
  }

  async function testConnection(connection, button) {
    if (!isDesktop || snapshot.stateRecovery || snapshot.deploymentRecovery) return;
    const status = button.closest("[data-connection-id]").querySelector("[data-probe-id]");
    button.disabled = true; status.textContent = "测试模型目录接口…";
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
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const connection = snapshot?.connections.find((item) => item.id === action.dataset.id);
    switch (action.dataset.action) {
      case "setup-install":
        window.PilotWeaveInstaller.preview((data.components ?? []).filter((c) => ["missing", "broken"].includes(c.status)).map((c) => c.id)); break;
      case "setup-signin": window.PilotWeaveAccount.preview(action.dataset.surface ? [action.dataset.surface] : undefined); break;
      case "setup-accounts": openAccountConfirmation(); break;
      case "setup-deploy": {
        const selected = window.PilotWeaveSetup.derive(snapshot, data, isDesktop).selected;
        if (selected) openDeployment(selected); else openConnectionForm(); break;
      }
      case "setup-manual": openManualSetup(); break;
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
        setRoute(action.dataset.route);
        break;
      case "refresh":
        refresh();
        break;
    }
  });

  addConnectionButton.addEventListener("click", () => openConnectionForm());
  refreshButton.addEventListener("click", refresh);

  content.addEventListener("change", async (event) => {
    if (event.target.id !== "setup-connection") return;
    const select = event.target;
    select.disabled = true;
    try { await invoke("select_setup_connection", { connectionId: select.value }); await refresh(); }
    catch (error) { select.value = window.PilotWeaveSetup.derive(snapshot, data, isDesktop).selected?.id ?? ""; showToast(error?.message ?? String(error), "error"); }
    finally { if (select.isConnected) select.disabled = false; }
  });
  document.addEventListener("pilotweave:refresh-setup", () => refresh());
  window.PilotWeaveUsage.configure({ invoke, refresh: refreshUsage, render, showToast, openModal, closeModal, getData: () => data, native: isDesktop });
  window.PilotWeaveResources.configure({ invoke, refresh, showToast, openModal, closeModal, setBusy: value => dialogs.setBusy(value), getData: () => data, native: isDesktop });
  refresh();
})();
