(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerManager = api;
})(globalThis, function () {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  const clients = typeof module === "object" && module.exports ? require("./client-presentation.js") : globalThis.CopilotBYOKManagerClients;
  const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const frozen = snapshot => Boolean(snapshot.stateRecovery || snapshot.deploymentRecovery);
  const date = value => Number.isNaN(Date.parse(value)) ? tr("时间未知") : new Date(value).toLocaleString(i18n.locale(), { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  function policy(kind, automatic = false) {
    if (kind === "copilot-cli") return tr("确认后将此供应商及全部启用模型写入 providers.json，保留其他供应商。启动新的 CLI 会话后，用 /model 选择模型。");
    if (kind === "github-copilot-app") return automatic ? tr("同步自有供应商和模型；完成后重新启动 App 并选择模型。") : tr("请在 Copilot App 中手动添加供应商。");
    if (kind === "jetbrains-copilot") return tr("仅更新本连接的供应商分组，保留其他来源；共享 BYOK 配置去重写入。重启相关 IDE 后，在模型选择器中选用。");
    return tr("仅更新本连接的供应商分组，保留其他来源；发布后在客户端的模型选择器中选用。");
  }

  function connectionCard(connection, snapshot, native, home = false) {
    const models = connection.models.filter(model => model.enabled);
    const enabled = connection.enabled !== false;
    const blocked = frozen(snapshot);
    const credential = snapshot.credentialStatuses?.[connection.id]?.state;
    const keyStatus = credential === "unavailable" ? tr("密钥存储不可用") : connection.hasSecret ? tr("•••••• · 已保存") : tr("未保存密钥");
    return `<article class="manager-connection ${enabled ? "" : "is-disabled"}" data-connection-id="${escape(connection.id)}">
      <header><div><h3>${escape(connection.name)}</h3><span class="manager-meta">${tr("{0} · {1} 个模型", escape(connection.protocol), models.length)}</span></div>
        ${home ? "" : `<div class="manager-publish-toggle"><span>${tr("允许发布")}</span><button type="button" class="manager-switch" role="switch" aria-checked="${enabled}" aria-label="${tr("允许发布 {0}", escape(connection.name))}" data-action="toggle-connection" data-id="${escape(connection.id)}" ${blocked ? "disabled" : ""}><span></span></button></div>`}</header>
      <p class="manager-endpoint" title="${escape(connection.baseUrl)}">${escape(connection.baseUrl)}</p>
      <p class="manager-meta">${escape(keyStatus)}${enabled ? "" : tr(" · 已停用，客户端配置保留")}</p>
      <div class="manager-model-chips">${models.slice(0, 3).map((model, index) => `<span>${escape(model.name)}${index === 0 ? `<small>${tr("首选")}</small>` : ""}</span>`).join("")}${models.length > 3 ? `<span>+${models.length - 3}</span>` : ""}${models.length ? "" : `<span>${tr("空目录：发布将移除本连接分组")}</span>`}</div>
      <div class="manager-card-actions"><button class="button primary small" data-action="deploy-connection" data-id="${escape(connection.id)}" ${blocked || !enabled ? "disabled" : ""}>${tr("发布到客户端")}</button><button class="button ghost small" data-action="edit-connection" data-id="${escape(connection.id)}" ${blocked ? "disabled" : ""}>${tr("编辑")}</button>
        ${home ? "" : `<button class="button ghost small" data-action="test-connection" data-id="${escape(connection.id)}" ${blocked || !native ? "disabled" : ""} title="${tr("检查模型目录接口")}">${tr("测试连接")}</button><button class="button ghost small manager-remove" data-action="delete-connection" data-id="${escape(connection.id)}" ${blocked ? "disabled" : ""}>${tr("移除")}</button>`}</div>
      <p class="manager-probe" data-probe-id="${escape(connection.id)}" role="status"></p>
    </article>`;
  }

  function currentSources(client, snapshot, data = {}, compact = false) {
      const current = clients.configurationState(client, snapshot, data);
      const chips = current.sources.map(source => {
        const connection = snapshot.connections.find(connection => connection.id === source.connectionId);
        if (source.manual) return `<span class="manager-source" data-source-state="${escape(source.state)}">${escape(source.name)} · ${source.state === "userConfirmed" ? tr("你已确认") : tr("修改后待确认")}</span>`;
        const text = Number.isInteger(source.modelCount) && source.modelCount >= 0 ? tr("{0} 个模型", source.modelCount) : tr("模型数量未知");
        return `<span class="manager-source" data-source-state="configured">${escape(source.name || connection?.name || tr("供应商"))} · ${text}${connection?.enabled === false ? tr(" · 已停用，配置保留") : ""}</span>`;
      });
      const visible = chips.slice(0, 3).join("") + (chips.length > 3 ? compact ? `<span class="manager-extra-summary">${tr("另有 {0} 个来源", chips.length - 3)}</span>` : `<details class="manager-extra-sources"><summary>${tr("另有 {0} 个来源", chips.length - 3)}</summary><div class="manager-sources">${chips.slice(3).join("")}</div></details>` : "");
      return `<div class="app-current-state" data-configuration-state="${escape(current.state)}">${!compact || !visible ? `<p class="manager-meta">${escape(current.label)}</p>` : ""}${visible ? `<div class="manager-sources">${visible}</div>` : ""}</div>`;
  }

  function sourceRows(snapshot, data = {}) {
    return clients.ordered(snapshot).map(client => {
      return `<div class="manager-client-row" data-client-id="${escape(client.id)}"><strong>${escape(clients.name(client))}</strong>${currentSources(client, snapshot, data, true)}<button class="button ghost small" data-action="route" data-route="clients" data-client-id="${escape(client.id)}">${tr("查看应用")}</button></div>`;
    }).join("");
  }

  function pending(snapshot, native) {
    const rows = [];
    const add = (text, action, label, route, disabled = false) => rows.push({ text, action, label, route, disabled });
    if (snapshot.stateRecovery) add(tr("连接存储进入只读恢复，暂不能修改或发布。"), "route", tr("查看恢复状态"), "about");
    else if (snapshot.deploymentRecovery) add(tr("上次发布中断，请先处理恢复。"), "preview-recovery", tr("查看恢复选项"), null, !native);
    if (snapshot.connections.length && !snapshot.connections.some(connection => connection.enabled !== false)) add(tr("没有启用的连接，请添加连接或到连接页重新启用。"), "route", tr("管理连接"), "connections");
    return rows;
  }

  function lastResult(snapshot, native) {
    const records = snapshot.deployments.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (!records.length) return `<p class="manager-meta">${tr("尚无发布记录")}</p>`;
    const last = records[0], batch = last.planId ? records.filter(record => record.planId === last.planId) : [last];
    const applied = batch.filter(record => record.status === "applied").length;
    const failed = batch.filter(record => record.status === "failed").length;
    const manual = batch.filter(record => record.status === "skipped").length;
    const statuses = { applied: tr("配置变更已应用"), skipped: tr("未自动处理"), failed: tr("失败，请核对"), rolledBack: tr("已回滚"), "rolled-back": tr("已回滚"), interrupted: tr("已中断，待恢复"), partial: tr("部分完成"), prepared: tr("已准备"), applying: tr("处理中") };
    return `<div class="manager-result"><span>${tr("{0}{1} · {2} 个目标配置已处理{3}{4}", native ? "" : tr("模拟 · "), date(last.createdAt), applied, manual ? tr(" · {0} 个未自动处理", manual) : "", failed ? tr(" · {0} 个失败", failed) : "")}</span><button class="button ghost small" data-action="view-publication-history">${tr("查看记录")}</button></div>
      <ul class="manager-result-targets">${batch.map(record => {
        const client = snapshot.clients.find(client => client.id === record.targetId);
        const connection = snapshot.connections.find(connection => connection.id === record.connectionId);
        const steps = publicationSteps(record, connection);
        const manual = record.status === "skipped" && record.targetKind === "github-copilot-app" && connection;
        return `<li><strong>${escape(connection?.name ?? record.connectionId ?? tr("供应商已移除"))} → ${escape(client ? clients.name(client) : record.targetId ?? record.targetKind ?? tr("目标未知"))}</strong><span>${escape(statuses[record.status] ?? tr("状态需核对"))}</span>${steps.map(text => `<p>${escape(text)}</p>`).join("")}${manual ? `<button class="button ghost small manager-result-action" data-action="setup-manual" data-id="${escape(connection.id)}">${tr("查看 {0} 的手动配置步骤", escape(connection.name))}</button>` : ""}${record.status !== "applied" && record.detail ? `<details><summary>${tr("操作明细")}</summary><p>${escape(record.detail)}</p></details>` : ""}</li>`;
      }).join("")}</ul>`;
  }

  function publicationSteps(record, connection) {
    if (["revokeApp", "revokeAndDelete"].includes(record.purpose)) return [];
    if (record.status !== "applied") return record.status === "skipped" && record.targetKind === "github-copilot-app" ? [tr("此客户端保持手动配置，请在 App 内添加本次连接。")] : [];
    if (!connection?.models.some(model => model.enabled)) return [];
    if (record.targetKind === "copilot-cli") return [tr("请启动新的 CLI 会话，用 /model 选择供应商与模型。")];
    if (record.targetKind === "jetbrains-copilot") return [tr("请先重启此 IDE，再到客户端的模型选择器中选用刚发布的模型。")];
    if (record.targetKind === "github-copilot-app") return [tr("重新启动 App，在模型选择器中选择已同步的模型。")];
    if (["vs-code-copilot", "vscode-copilot"].includes(record.targetKind)) return [tr("请到客户端的模型选择器中选用刚发布的模型。")];
    return [];
  }

  function renderHome(snapshot, data, native) {
    const actions = pending(snapshot, native);
    const connections = snapshot.connections.filter(connection => connection.enabled !== false);
    return `${!native ? `<div class="preview-banner">${tr("浏览器试用 · 示例数据 · 发布仅为模拟，不修改电脑")}</div>` : ""}
      ${!frozen(snapshot) && !snapshot.connections.length ? `<section class="manager-start"><div><h2>${tr("配置一个供应商，用于多个 Copilot 客户端")}</h2><p>${tr("先添加端点、密钥与模型，再选择你要使用的客户端并预览发布。")}</p></div><button class="button primary" data-action="add-connection">${tr("添加第一个连接")}</button></section>` : ""}
      ${actions.length ? `<section class="manager-section manager-pending"><h2>${tr("待处理")}</h2>${actions.map(row => `<div class="manager-action-row"><span>${escape(row.text)}</span><button class="button ghost small" data-action="${row.action}" ${row.route ? `data-route="${row.route}"` : ""} ${row.disabled ? "disabled" : ""}>${row.label}</button></div>`).join("")}</section>` : ""}
      <section class="manager-section manager-surface"><div class="manager-section-head"><h2>${tr("客户端模型来源")}</h2><button class="button ghost small" data-action="route" data-route="clients">${tr("客户端管理")}</button></div><div data-home-sources>${sourceRows(snapshot, data)}</div></section>
      <div class="manager-home-summary"><section class="manager-section manager-surface" id="home-connections"><div class="manager-section-head"><h2>${tr("供应商概况")}</h2><button class="button ghost small" data-action="route" data-route="connections">${tr("管理供应商")}</button></div><p class="manager-meta">${tr("{0} 个可发布，{1} 个已暂停。", connections.length, snapshot.connections.length - connections.length)}</p></section>
      <section class="manager-section manager-surface"><h2 id="publication-result-title">${tr("最近一次发布")}</h2>${lastResult(snapshot, native)}</section></div>`;
  }

  return { escape, policy, connectionCard, currentSources, sourceRows, pending, lastResult, publicationSteps, renderHome };
});
