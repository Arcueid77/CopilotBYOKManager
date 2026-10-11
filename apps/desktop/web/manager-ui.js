(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PilotWeaveManager = api;
})(globalThis, function () {
  "use strict";
  const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const frozen = snapshot => Boolean(snapshot.stateRecovery || snapshot.deploymentRecovery);
  const date = value => Number.isNaN(Date.parse(value)) ? "时间未知" : new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  function policy(kind) {
    if (kind === "copilot-cli") return "本软件使用旧式环境变量方式：替换 CLI 的单一路由，首选模型写入 COPILOT_MODEL。请新开终端和 CLI 会话，此覆盖生效时不要期待使用 GitHub 官方路由。";
    if (kind === "github-copilot-app") return "没有已审核的文档化自动写入接口，请在 App 内手动添加供应商；不读写私有数据库或登录凭据。";
    if (kind === "jetbrains-copilot") return "仅更新本连接的供应商分组，保留其他来源；共享 BYOK 配置去重写入。重启相关 IDE 后，在模型选择器中选用。";
    return "仅更新本连接的供应商分组，保留其他来源；发布后在客户端的模型选择器中选用。";
  }

  function connectionCard(connection, snapshot, native, home = false) {
    const models = connection.models.filter(model => model.enabled);
    const enabled = connection.enabled !== false;
    const blocked = frozen(snapshot);
    const credential = snapshot.credentialStatuses?.[connection.id]?.state;
    const keyStatus = credential === "unavailable" ? "密钥存储不可用" : connection.hasSecret ? "•••••• · 已保存" : "未保存密钥";
    return `<article class="manager-connection ${enabled ? "" : "is-disabled"}" data-connection-id="${escape(connection.id)}">
      <header><div><h3>${escape(connection.name)}</h3><span class="manager-meta">${escape(connection.protocol)} · ${models.length} 个模型</span></div>
        ${home ? "" : `<button type="button" class="manager-switch" role="switch" aria-checked="${enabled}" aria-label="启用 ${escape(connection.name)}" data-action="toggle-connection" data-id="${escape(connection.id)}" ${blocked ? "disabled" : ""}><span></span></button>`}</header>
      <p class="manager-endpoint" title="${escape(connection.baseUrl)}">${escape(connection.baseUrl)}</p>
      <p class="manager-meta">${escape(keyStatus)}${enabled ? "" : " · 已停用，客户端配置保留"}</p>
      <div class="manager-model-chips">${models.slice(0, 3).map((model, index) => `<span>${escape(model.name)}${index === 0 ? '<small>首选</small>' : ""}</span>`).join("")}${models.length > 3 ? `<span>+${models.length - 3}</span>` : ""}${models.length ? "" : '<span>空目录：发布将移除本连接分组</span>'}</div>
      <div class="manager-card-actions"><button class="button primary small" data-action="deploy-connection" data-id="${escape(connection.id)}" ${blocked || !enabled ? "disabled" : ""}>发布到客户端</button><button class="button ghost small" data-action="edit-connection" data-id="${escape(connection.id)}" ${blocked ? "disabled" : ""}>编辑</button>
        ${home ? "" : `<button class="button ghost small" data-action="test-connection" data-id="${escape(connection.id)}" ${blocked || !native ? "disabled" : ""} title="只测试模型目录接口，不验证推理能力">测试连接</button><button class="button ghost small manager-remove" data-action="delete-connection" data-id="${escape(connection.id)}" ${blocked ? "disabled" : ""}>移除</button>`}</div>
      <p class="manager-probe" data-probe-id="${escape(connection.id)}" role="status"></p>
    </article>`;
  }

  function sourceRows(snapshot) {
    return snapshot.clients.map(client => {
      const sources = (snapshot.publishedSources ?? []).filter(source => source.targetId === client.id);
      let detail = "暂无本软件可核验的 BYOK 来源";
      if (!client.detected) detail = "未检测到客户端";
      else if (client.kind === "github-copilot-app") detail = "手动添加供应商 · 无已审核的自动写入接口";
      else if (!client.supportsWrite) detail = "当前版本或配置不支持自动发布，请到客户端页核对";
      else if (!Array.isArray(snapshot.publishedSources)) detail = "来源状态未提供，不能确认已发布";
      const chips = sources.map(source => {
        const connection = snapshot.connections.find(connection => connection.id === source.connectionId);
        const state = source.state === "published" && Number.isInteger(source.modelCount) && source.modelCount >= 0 ? "published" : source.state === "changed" ? "changed" : "unavailable";
        const text = state === "published" ? `${source.modelCount} 个模型` : state === "changed" ? "外部改动，待核对" : "无法核验";
        return `<span class="manager-source" data-source-state="${state}">${escape(connection?.name ?? "已移除的连接")} · ${text}${connection?.enabled === false ? " · 已停用，配置保留" : ""}</span>`;
      }).join("");
      return `<div class="manager-client-row" data-client-id="${escape(client.id)}"><div><strong>${escape(client.name)}</strong>${client.kind === "copilot-cli" ? '<small>单一环境路由</small>' : ""}</div><div class="manager-sources">${chips || `<span class="manager-meta">${detail}</span>`}</div><button class="button ghost small" data-action="route" data-route="clients">核对</button></div>`;
    }).join("");
  }

  function pending(snapshot, data, native) {
    const rows = [];
    const add = (text, action, label, route, disabled = false) => rows.push({ text, action, label, route, disabled });
    if (snapshot.stateRecovery) add("连接存储进入只读恢复，暂不能修改或发布。", "route", "查看恢复状态", "settings");
    else if (snapshot.deploymentRecovery) add("上次发布中断，请先核对恢复，再进行新的写入。", "preview-recovery", "核对恢复", null, !native);
    if (native && (!data.setup || data.errors?.setup || !data.components || data.errors?.components)) add("环境状态无法完整读取，需要核对客户端。", "route", "核对客户端", "clients");
    else if (native) {
      const missing = data.components.filter(component => ["missing", "broken"].includes(component.status));
      if (missing.length) add(`有 ${missing.length} 个组件需要安装或修复。`, "route", "查看安装计划", "clients");
      else if (data.components.some(component => component.status === "unknown")) add("部分组件状态未知，不能确认安装完整。", "route", "核对客户端", "clients");
      if (!frozen(snapshot) && !["verifiedSameAccount", "userConfirmedSameAccount"].includes(data.setup?.alignment)) add("客户端账号尚未对齐，请完成官方登录并逐个核对。", "setup-accounts", "核对账号", null);
    }
    if (!snapshot.connections.some(connection => connection.enabled !== false)) add("没有启用的连接，请添加连接或到连接页重新启用。", "route", "管理连接", "connections");
    if ((snapshot.publishedSources ?? []).some(source => source.state !== "published")) add("有已发布来源发生变化或无法核验，请先核对客户端。", "route", "核对来源", "clients");
    return rows;
  }

  function lastResult(snapshot, native) {
    const records = snapshot.deployments.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (!records.length) return '<p class="manager-meta">尚无发布记录</p>';
    const last = records[0], batch = records.filter(record => record.planId === last.planId);
    const applied = batch.filter(record => record.status === "applied").length;
    const failed = batch.filter(record => record.status === "failed").length;
    const manual = batch.filter(record => record.status === "skipped").length;
    const picked = batch.filter(record => record.status === "applied" && snapshot.connections.some(connection => connection.id === record.connectionId && connection.models.some(model => model.enabled)));
    const picker = picked.some(record => ["vs-code-copilot", "vscode-copilot", "jetbrains-copilot"].includes(record.targetKind));
    const cli = picked.some(record => record.targetKind === "copilot-cli");
    return `<div class="manager-result"><span>${native ? "" : "模拟 · "}${date(last.createdAt)} · ${applied} 个目标已完成${manual ? ` · ${manual} 个需手动处理` : ""}${failed ? ` · ${failed} 个失败` : ""}</span><button class="button ghost small" data-action="route" data-route="activity">查看记录</button></div>${picker ? '<p class="manager-meta">请到客户端的模型选择器中选用刚发布的模型；JetBrains 请先重启相关 IDE。</p>' : ""}${cli ? '<p class="manager-meta">CLI 首选模型已写入环境路由，请新开终端和 CLI 会话。</p>' : ""}`;
  }

  function renderHome(snapshot, data, native) {
    const actions = pending(snapshot, data, native);
    const connections = snapshot.connections.filter(connection => connection.enabled !== false);
    return `${!native ? '<div class="preview-banner">浏览器试用 · 示例数据 · 发布仅为模拟，不修改电脑</div>' : ""}
      <div class="manager-health"><span class="manager-dot ${actions.length ? "attention" : ""}"></span><span>${actions.length ? "有事项需要核对" : "连接可管理，发布配置与客户端实际选用分开显示"}</span></div>
      ${actions.length ? `<section class="manager-section manager-pending"><h2>待处理</h2>${actions.map(row => `<div class="manager-action-row"><span>${escape(row.text)}</span><button class="button ghost small" data-action="${row.action}" ${row.route ? `data-route="${row.route}"` : ""} ${row.disabled ? "disabled" : ""}>${row.label}</button></div>`).join("")}</section>` : ""}
      <section class="manager-section"><div class="manager-section-head"><h2>客户端模型来源</h2><button class="button ghost small" data-action="route" data-route="clients">客户端管理</button></div>${sourceRows(snapshot)}<p class="manager-boundary">仅核验本软件发布的配置，不读取当前所选模型。VS Code / JetBrains 保留其他供应商；CLI 环境路由一次一个；App 手动配置。</p></section>
      <section class="manager-section"><div class="manager-section-head"><h2>连接</h2><button class="button ghost small" data-action="add-connection" ${frozen(snapshot) ? "disabled" : ""}>＋ 添加连接</button></div><div class="manager-connection-grid">${connections.map(connection => connectionCard(connection, snapshot, native, true)).join("")}</div>${connections.length ? "" : '<p class="manager-meta">添加端点和模型，预览后再发布。</p>'}</section>
      <section class="manager-section"><h2>最近一次发布</h2>${lastResult(snapshot, native)}</section>`;
  }

  return { escape, policy, connectionCard, sourceRows, pending, lastResult, renderHome };
});
