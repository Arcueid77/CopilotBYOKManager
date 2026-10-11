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
      statePath: "Browser preview — no filesystem access",
      stateRecovery: null,
      usageDb: {
        state: "unavailable",
        detail: "Browser preview has no native usage database",
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
          detail: "Default profile language-model catalog",
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
          detail: "Installation detected; provider management is manual in this MVP",
          path: "/Applications/GitHub Copilot.app",
          detected: true,
          supportsWrite: false,
          status: "read-only",
          diagnostic:
            "PilotWeave will not write private app state or credential storage without a stable external interface",
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
        return { resources: [], bindings: [], detail: "Browser preview has no native resource catalog" };
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
        if (!connection) throw new Error("Unknown connection");
        if (connection.enabled === false) throw new Error("请先启用连接再发布");
        const targets = args.targetIds.map((id) =>
          demoState.clients.find((item) => item.id === id),
        );
        if (!targets.length || targets.some((target) => !target)) throw new Error("Unknown deployment target");
        for (const [id, stored] of demoPlans) {
          if (Date.now() >= stored.expiresAt) demoPlans.delete(id);
        }
        if (demoPlans.size >= 32) throw new Error("Too many pending previews");
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
          throw new Error("Preview expired or was consumed; preview again");
        }
        const { plan } = stored;
        const connection = demoState.connections.find(
          (item) => item.id === plan.connectionId,
        );
        if (!connection) throw new Error("Unknown connection");
        const targets = plan.targetIds
          .map((id) => demoState.clients.find((item) => item.id === id))
          .filter(Boolean);
        if (stored.connectionRevision !== JSON.stringify(connection) || stored.targetRevision !== JSON.stringify(targets)) {
          throw new Error("PlanChanged: preview again");
        }
        const records = plan.operations.map((operation) => ({
          id: crypto.randomUUID(),
          planId: plan.id,
          connectionId: connection.id,
          targetId: operation.targetId,
          targetKind: operation.targetKind,
          status: operation.supported ? "applied" : "skipped",
          detail: operation.supported
            ? "Browser preview simulated this deployment; no client configuration was written"
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
        title: `Deploy ${connection.name} to ${target.name}`,
        description: target.supportsWrite
          ? `Update ${target.path ?? target.name}`
          : "Manual action required in the client's provider settings",
        changes: [
          `Publish ${connection.models.filter((item) => item.enabled).length} enabled model(s)`,
          "Preserve non-PilotWeave configuration",
          target.supportsWrite
            ? "Create a rollback-safe managed projection"
            : "Do not mutate unsupported private client state",
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
    } catch (error) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">!</div>
          <h2>Could not load PilotWeave</h2>
          <p>${escapeHtml(error?.message ?? error)}</p>
          <button class="button" data-action="refresh">Try again</button>
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
    route = nextRoute;
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.route === route);
    });
    document.querySelector(".more-nav").open = false;
    document.querySelector(".more-nav > summary").classList.toggle("active", ["resources", "activity", "settings", "about"].includes(route));
    render();
  }

  function render() {
    if (!snapshot) return;
    closeDeployment();
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
      about: () => '<section class="setting-row"><div><h2>PilotWeave</h2><p>An independent Copilot setup tool. Pre-release; not affiliated with GitHub.</p><p>Configuration is local. Client authentication stays in each official client.</p></div></section>',
      activity: renderActivity,
      settings: renderSettings,
    };
    content.innerHTML = (!isDesktop && !["overview", "usage"].includes(route) ? '<div class="preview-banner">浏览器试用 · 示例数据 · 不修改电脑</div>' : "") + renderers[route]();
    content.dataset.route = route;
    window.PilotWeaveInstaller.mount();
    window.PilotWeaveAccount.mount();
    window.PilotWeaveGithubAuth.mount();
  }

  function renderOverview() {
    return window.PilotWeaveManager.renderHome(snapshot, data, isDesktop);
  }

  function renderConnections() {
    return `
      <p class="manager-boundary" style="margin-bottom:18px">密钥保存在系统凭据库，不回读到界面。测试连接仅查询模型目录，不验证推理能力。</p>
      ${snapshot.connections.length ? `<div class="card-grid">${snapshot.connections.map(connectionCard).join("")}</div>` : emptyConnections()}
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
      ...snapshot.deployments.map((r) => ({ time: r.createdAt, kind: "Deployment / rollback", source: r.targetId, status: r.status, detail: r.detail, route: "connections" })),
      ...(data.installRuns ?? []).map((r) => ({ time: r.finishedAt ?? r.startedAt, kind: "Installation", source: r.componentIds.join(", "), status: r.status, detail: r.detail, route: "clients" })),
      ...(data.setup?.accounts?.loginRuns ?? []).map((r) => ({ time: r.finishedAt ?? r.startedAt, kind: "Official sign-in", source: r.requestedSurfaces.join(", "), status: r.status, detail: r.summary, route: "clients" })),
      ...(data.runs ?? []).map((r) => ({ time: r.finishedAt ?? r.startedAt, kind: "Import / refresh", source: r.sourceId, status: r.status, detail: r.detail, route: "usage" })),
    ].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    return `<section class="usage-panel"><div class="step-heading"><h2>Recent activity</h2><span>Local, redacted history</span></div>${[data.errors.runs, data.errors.installRuns].filter(Boolean).map((error) => `<p class="inline-error">${escapeHtml(error)}</p>`).join("")}
      ${entries.length ? `<div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>Time</th><th>Operation</th><th>Target / source</th><th>Status</th><th>Detail</th><th>Next step</th></tr></thead><tbody>${entries.slice(0, 200).map((r) => `<tr><td>${escapeHtml(formatDate(r.time))}</td><td>${escapeHtml(r.kind)}</td><td>${escapeHtml(r.source)}</td><td>${escapeHtml(window.PilotWeaveUsage.label(r.status))}</td><td>${escapeHtml(r.detail)}</td><td><button class="button ghost small" data-action="route" data-route="${r.route}">Review</button></td></tr>`).join("")}</tbody></table></div>` : '<p class="usage-empty">No recorded activity yet.</p>'}</section>`;
  }

  function renderSettings() {
    return `<section id="github-authorization-panel"></section>
      <div class="settings-list">
        ${settingRow("Runtime", isDesktop ? "Tauri native backend" : "Browser preview", isDesktop ? "Client configuration writes can be applied after preview." : "All deployment applies are simulated and remain inside this tab.")}
        ${settingRow("State file", snapshot.statePath, "Non-secret connections, deployments, and schema version.")}
        ${settingRow("State schema", `v${snapshot.version}`, "Migrations are rejected when state is newer than the running build.")}
        ${settingRow("State recovery", snapshot.stateRecovery ? "Read-only recovery" : "Healthy", snapshot.stateRecovery ?? "The primary state file loaded successfully; writes are enabled.")}
        ${settingRow("Usage database", usageDbLabel(), snapshot.usageDb?.detail ?? "Usage storage status was not reported.")}
        ${settingRow("Credential storage", isDesktop ? "Operating-system credential store" : "Simulated has-secret flag", "Secrets are never returned by get_dashboard.")}
        ${settingRow("GitHub Copilot app", "Read-only provider adapter", "Detection is implemented; private provider-store mutation is intentionally disabled.")}
      </div>`;
  }

  function usageDbLabel() {
    const db = snapshot.usageDb;
    if (!db) return "Unknown";
    return db.state === "available"
      ? `Ready (schema v${db.schemaVersion})`
      : "Unavailable";
  }

  function storageWarningBanner() {
    const warnings = [];
    if (snapshot.deploymentRecovery) warnings.push(snapshot.deploymentRecovery);
    if (snapshot.stateRecovery) {
      warnings.push(
        `Connection storage is in read-only recovery: ${snapshot.stateRecovery}`,
      );
    }
    if (snapshot.usageDb && snapshot.usageDb.state !== "available") {
      warnings.push(`Usage database is unavailable: ${snapshot.usageDb.detail}`);
    }
    if (!warnings.length) return "";
    return `<div class="security-note">
      <div class="note-icon">⚠</div>
      <div>
        <strong>Storage needs attention</strong>
        ${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}
        ${snapshot.deploymentRecovery ? '<button class="button" data-action="preview-recovery">Review safe recovery</button>' : ""}
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
        <div class="path-line" title="${escapeHtml(client.path ?? client.diagnostic ?? "")}">${escapeHtml(client.path ?? client.diagnostic ?? "No local path")}</div>
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
  function openModal({ title, body, footer = "", wide = false, onOpen }) {
    closeDeployment();
    modalCleanup?.();
    modalCleanup = null;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
          <header class="modal-header"><h2>${escapeHtml(title)}</h2><button class="icon-button" data-modal-close aria-label="Close">×</button></header>
          <div class="modal-body">${body}</div>
          ${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}
        </section>
      </div>`;
    const backdrop = modalRoot.querySelector(".modal-backdrop");
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal();
    });
    modalRoot.querySelectorAll("[data-modal-close]").forEach((button) => button.addEventListener("click", closeModal));
    onOpen?.(modalRoot);
  }

  function closeModal() {
    modalCleanup?.();
    modalCleanup = null;
    modalRoot.innerHTML = "";
  }

  function openConnectionForm(connection = null) {
    if (snapshot.stateRecovery || snapshot.deploymentRecovery) {
      showToast("Connection changes are disabled during read-only recovery", "error");
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
    openModal({
      title: connection ? `编辑 ${connection.name}` : "添加连接",
      wide: true,
      body: `
        <form id="connection-form" class="form-grid">
          <input type="hidden" name="id" value="${escapeHtml(connection?.id ?? "")}" />
          <div class="form-field">
            <label for="connection-name">名称</label>
            <input id="connection-name" name="name" required value="${escapeHtml(connection?.name ?? "")}" placeholder="OpenRouter" />
          </div>
          <div class="form-field">
            <label for="provider-kind">供应商类型</label>
            <select id="provider-kind" name="providerKind">
              ${selectOptions(["openai", "azure", "anthropic", "local", "custom"], connection?.providerKind ?? "openai")}
            </select>
          </div>
          <div class="form-field full">
            <label for="base-url">端点地址</label>
            <input id="base-url" name="baseUrl" type="url" required value="${escapeHtml(connection?.baseUrl ?? "")}" placeholder="https://api.example.com/v1" />
            <small>填写供应商基址或客户端所需的推理端点。</small>
          </div>
          <div class="form-field">
            <label for="protocol">接口协议</label>
            <select id="protocol" name="protocol">
              ${selectOptions(["chat-completions", "responses", "messages"], connection?.protocol ?? "chat-completions")}
            </select>
          </div>
          <div class="form-field">
            <label for="api-key">API 密钥</label>
            <input id="api-key" name="apiKey" type="password" autocomplete="new-password" placeholder="${connection?.hasSecret ? "留空保留已存密钥，不回读原值" : "本地端点可留空"}" />
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
          <div class="form-field full">
            <label for="headers">请求头</label>
            <textarea id="headers" name="headers" placeholder="X-Custom-Header: value&#10;Authorization: Bearer \${apiKey}">${escapeHtml(headersText)}</textarea>
            <small>每行一个请求头；用 <code>\${apiKey}</code> 作为发布时的密钥占位符。</small>
          </div>
        </form>`,
      footer: `<button class="button ghost" data-modal-close>取消</button><button class="button primary" id="save-connection">保存连接</button>`,
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
        root.querySelectorAll("[data-modal-close]").forEach((button) =>
          button.addEventListener("click", closeModal),
        );
        let saving = false;
        root.querySelector("#save-connection").addEventListener("click", async (event) => {
          if (saving) return;
          const form = root.querySelector("#connection-form");
          if (!form.reportValidity()) return;
          const data = new FormData(form);
          const saveButton = event.currentTarget;
          saving = true;
          saveButton.disabled = true;
          try {
            const input = parseConnectionForm(data, connection, discovery.discoveredIds);
            await invoke("upsert_connection", { input });
            if (form.isConnected) closeModal();
            showToast("连接已保存，尚未发布到客户端。");
            await refresh();
          } catch (error) {
            showToast(error?.message ?? String(error), "error");
          } finally {
            saving = false;
            if (saveButton.isConnected) saveButton.disabled = false;
          }
        });
      },
    });
  }

  function selectOptions(values, selected) {
    return values
      .map(
        (value) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`,
      )
      .join("");
  }

  function parseConnectionForm(data, existing, discoveredIds = new Set()) {
    const modelLines = String(data.get("models") ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!modelLines.length) throw new Error("Add at least one model");
    const existingByModelId = Object.fromEntries(
      (existing?.models ?? []).map((item) => [item.modelId, item]),
    );
    let models = modelLines.map((line) => {
      const [rawId, ...nameParts] = line.split("|");
      const modelId = rawId.trim();
      if (!modelId) throw new Error(`Invalid model line: ${line}`);
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
    models = window.ModelDiscovery.preferModels(models, String(data.get("preferredModel") ?? ""));
    const headers = window.ModelDiscovery.parseHeaders(String(data.get("headers") ?? ""));
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
      showToast("Connection changes are disabled during read-only recovery", "error");
      return;
    }
    openModal({
      title: "Remove connection",
      body: `<p class="muted" style="line-height:1.7">Remove <strong style="color:var(--text)">${escapeHtml(connection.name)}</strong>? Revoke and delete reviews removal of configuration proven to belong to this installation. Detach only leaves all client configuration, including materialized credentials, untouched.</p><div id="delete-preview" role="status"></div>`,
      footer: `<button class="button ghost" data-modal-close>Cancel</button><button class="button ghost" id="confirm-delete">Detach only…</button><button class="button danger" id="revoke-delete">Preview revoke and delete</button>`,
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
          if (detach.textContent !== "Confirm detach only") {
            plan = null;
            preview.textContent = "Client configuration and any keys already written there will remain. PilotWeave will discard ownership, local deployment history and its stored credential. Confirm only if you intend to manage that configuration manually.";
            detach.textContent = "Confirm detach only";
            revoke.textContent = "Preview revoke and delete";
            return;
          }
          busy = true; detach.disabled = true; revoke.disabled = true;
          try {
            const result = await invoke("delete_connection", { connectionId: connection.id });
            closeModal();
            showToast(result?.credentialCleanupWarning ?? "Connection detached; client configuration remains", result?.credentialCleanupWarning ? "warning" : "success");
            await refresh();
          } catch (error) {
            showToast(error?.message ?? String(error), "error");
          } finally { busy = false; detach.disabled = false; revoke.disabled = false; }
        });
        revoke.addEventListener("click", async () => {
          if (busy) return;
          busy = true; detach.disabled = true; revoke.disabled = true;
          detach.textContent = "Detach only…";
          try {
            if (!plan) {
              plan = await invoke("preview_revoke_and_delete", { connectionId: connection.id });
              preview.innerHTML = `<p>${plan.operations.length ? "Reviewed owned targets:" : "No owned targets are recorded; no client files will be removed."}</p><ul>${plan.operations.map((op) => `<li>${escapeHtml(op.title)} · ${escapeHtml(op.targetId)}</li>`).join("")}</ul><p>Client removal, ownership and connection deletion commit together. External changes invalidate this one-shot preview. Credential-store cleanup failures are reported separately.</p>`;
              revoke.textContent = "Confirm revoke and delete";
            } else {
              const planId = plan.id;
              plan = null; // An uncertain or failed apply must never be replayed.
              const result = await invoke("apply_deployment_plan", { planId, confirmed: true });
              if (!result.connectionDeleted) throw new Error("Revocation did not complete; the connection was preserved. Review Activity or recovery.");
              closeModal();
              showToast(result.credentialCleanupWarning ?? "Owned configuration revoked and connection deleted", result.credentialCleanupWarning ? "warning" : "success");
              await refresh();
            }
          } catch (error) {
            plan = null;
            revoke.textContent = "Preview revoke and delete";
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
        const picker = applied.some(item => ["vs-code-copilot", "vscode-copilot", "jetbrains-copilot"].includes(item.targetKind));
        showToast(`${isDesktop ? "" : "模拟 · "}${applied.length} 个目标已完成${skipped ? `，${skipped} 个需手动处理` : ""}${failed ? `，${failed} 个失败` : ""}${picker && connection.models.some(model => model.enabled) ? "。请到客户端的模型选择器中选用刚发布的模型；JetBrains 请先重启 IDE。" : ""}`, failed ? "error" : "success");
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
      footer: `<button class="button ghost" data-modal-close>Close</button>${operation?.supported ? '<button class="button primary" id="jetbrains-preview-deployment">Preview automatic BYOK</button>' : ""}`,
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
        title: keepCurrent ? "Review keeping current files" : "Review interrupted deployment recovery",
        body: keepCurrent
          ? `<p>Keep all ${plan.view.resourceCount} recorded resources exactly as they are. This removes the pending rollback journal and ends the deployment write block.</p><p><strong>The pending changes cannot be rolled back by PilotWeave after this operation.</strong> This does not verify client configuration or mark the deployment successful. Review the current client setup before deploying again.</p><label><input id="confirm-recovery" type="checkbox" style="width:auto" />I reviewed this choice and accept keeping the current files and discarding pending rollback data.</label>`
          : `<p>${plan.view.resourceCount} physical resources were recorded; ${plan.view.conflictCount} have external changes, ${plan.view.unknownResourceCount ?? 0} are no longer detected or cannot be located, and ${plan.view.unreadableResourceCount ?? 0} cannot be read safely.</p><p>${plan.view.committed ? "The audit was committed. This only removes the completed journal." : blocked ? "Automatic restoration is blocked. Resolve the affected targets and preview again, or separately review keeping all current files to end recovery." : "Unchanged PilotWeave writes will be restored. A new external edit will stop safe restoration and retain the journal for another review."}</p><label><input id="confirm-recovery" type="checkbox" style="width:auto" ${blocked ? "disabled" : ""} />I reviewed and approve this recovery operation.</label>`,
        footer: `<button class="button ghost" data-modal-close>Cancel</button>${!keepCurrent && !plan.view.committed ? '<button class="button ghost" id="review-keep-current">Review keeping current files…</button>' : ""}<button class="button primary" id="apply-recovery" disabled>${keepCurrent ? "Keep files and end recovery" : "Recover"}</button>`,
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
              showToast(keepCurrent ? "Current files retained; review client setup before deploying again" : "Recovery completed; original audit may require review");
              await refresh();
            } catch (error) {
              closeModal();
              showToast(`${error?.message ?? error} Preview again before retrying.`, "error");
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
  window.PilotWeaveResources.configure({ invoke, refresh, showToast, openModal, closeModal, getData: () => data, native: isDesktop });
  refresh();
})();
