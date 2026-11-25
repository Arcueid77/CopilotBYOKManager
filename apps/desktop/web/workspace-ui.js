(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./i18n.js") : root.CopilotBYOKManagerI18n,
    typeof module === "object" && module.exports ? require("./client-presentation.js") : root.CopilotBYOKManagerClients,
    typeof module === "object" && module.exports ? require("./manager-ui.js") : root.CopilotBYOKManagerManager);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerWorkspace = api;
})(globalThis, function (i18n, clients, manager) {
  "use strict";
  const tr = i18n.t, escape = manager.escape;
  const blocked = snapshot => Boolean(snapshot.stateRecovery || snapshot.deploymentRecovery);
  const appIcons = Object.freeze({ vscode: "code", cli: "terminal", "copilot-app": "copilot", jetbrains: "jetbrains" });
  const paths = Object.freeze({
    overview: '<path d="M4 4h6v9H4zm10 0h6v4h-6zM4 17h6v3H4zm10-5h6v8h-6z"/>',
    provider: '<path d="M8 10V7a4 4 0 0 1 8 0v3M5 10h14v11H5zm4 5h6"/>',
    apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>', refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 8a7 7 0 0 1 12-1l2 5M4 12l2 5a7 7 0 0 0 12-1"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 14v6h16v-6"/>',
    code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/>',
    copilot: '<path d="M5 9a7 7 0 0 1 14 0v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zm3 2h3m2 0h3m-7 5h6"/>',
    jetbrains: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 7v10m4-10v6a4 4 0 0 0 8 0V7"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
    edit: '<path d="m4 16-.7 4.7L8 20 19 9l-4-4L4 16zm9-9 4 4"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-4 4 3 3m-6 0 3 3"/>',
  });
  function icon(name, className = "") { return `<svg class="${escape(className)}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? paths.apps}</svg>`; }
  function family(client) {
    if (["vs-code-copilot", "vscode-copilot"].includes(client.kind)) return "vscode";
    return ({ "copilot-cli": "cli", "github-copilot-app": "copilot-app", "jetbrains-copilot": "jetbrains" })[client.kind] ?? client.kind;
  }
  function familyName(id) { return clients.surfaceName(({ vscode: "vs-code-copilot", cli: "copilot-cli", "copilot-app": "github-copilot-app", jetbrains: "jetbrains-copilot" })[id] ?? id); }
  function groups(snapshot) {
    const result = new Map();
    for (const client of clients.ordered(snapshot)) {
      const id = family(client);
      if (!result.has(id)) result.set(id, { id, name: familyName(id), icon: appIcons[id] ?? "apps", members: [] });
      result.get(id).members.push(client);
    }
    const order = { vscode: 0, cli: 1, "copilot-app": 2, jetbrains: 3 };
    return [...result.values()].sort((left, right) => (order[left.id] ?? 99) - (order[right.id] ?? 99));
  }
  function groupState(group, snapshot, data) {
    const states = group.members.map(client => clients.configurationState(client, snapshot, data));
    const result = state => ({ state, label: clients.stateLabel(state) });
    if (states.length === 1) return result(states[0].state);
    const configured = states.filter(value => value.state === "configured").length;
    if (states.some(value => value.state === "unavailable")) return result("unavailable");
    if (configured === states.length) return result("configured");
    if (configured) return result("partial");
    if (states.every(value => value.state === "missing")) return result("missing");
    if (states.some(value => value.state === "manual")) return result("manual");
    if (states.some(value => value.state === "empty")) return result("empty");
    if (states.some(value => value.state === "disabled")) return result("disabled");
    return result("unsupported");
  }
  function identity(group, detail = tr("{0} 个实例", group.members.length)) {
    return `<div class="app-identity"><span class="app-icon ${escape(group.id)}">${icon(group.icon)}</span><div><strong>${escape(group.name)}</strong><span>${escape(detail)}</span></div></div>`;
  }
  function summary(group, snapshot, data) {
    if (group.members.length === 1) return `<div class="current-source">${manager.currentSources(group.members[0], snapshot, data, true)}</div>`;
    const count = group.members.filter(client => clients.configurationState(client, snapshot, data).state === "configured").length;
    return `<div class="current-source">${count ? `<strong>${tr("{0} 个实例已配置", count)}</strong>` : ""}</div>`;
  }
  function pill(group, snapshot, data) { const value = groupState(group, snapshot, data); return `<span class="status-pill ${escape(value.state)}">${escape(value.label)}</span>`; }
  function mainAction(group, snapshot, data, native) {
    const disabled = blocked(snapshot) ? "disabled" : "";
    if (group.members.some(client => client.detected && clients.publicationTarget(client, snapshot, data).supportsWrite)) {
      const hasEnabled = snapshot.connections.some(connection => connection.enabled !== false);
      if (!hasEnabled && snapshot.connections.length) return `<button class="button small" data-action="route" data-route="connections">${tr("管理供应商")}</button>`;
      const label = hasEnabled ? tr("发布配置") : tr("添加供应商");
      return `<button class="button small" data-action="publish-family" data-id="${escape(group.id)}" ${disabled}>${label}</button>`;
    }
    if (group.id === "copilot-app" && group.members.some(client => client.detected)) {
      if (native && data.appSync?.reviewSupported === true && !data.appSync.enabled) return `<button class="button small" data-action="app-sync-enable" ${disabled}>${tr("启用同步")}</button>`;
    }
    const guide = group.members.find(client => client.detected || client.status === "read-only");
    if (guide) return `<button class="button small" data-action="client-guide" data-id="${escape(guide.id)}">${tr("配置指引")}</button>`;
    if (["vscode", "cli", "copilot-app"].includes(group.id) && group.members.every(client => client.status === "not-installed")) return `<button class="button small" data-action="show-installation" ${!native ? "disabled" : ""}>${tr("安装与更新")}</button>`;
    return `<button class="button small" data-action="refresh">${tr("重新检测")}</button>`;
  }
  function groupHeader(group, snapshot, data, native, open) {
    return `${identity(group)}${summary(group, snapshot, data)}${pill(group, snapshot, data)}${mainAction(group, snapshot, data, native)}<button class="icon-button app-expand" data-action="toggle-app-group" data-id="${escape(group.id)}" aria-expanded="${open}" aria-controls="instances-${escape(group.id)}" aria-label="${tr("查看 {0} 的实例", escape(group.name))}">${icon("arrow")}</button>`;
  }
  function appRows(snapshot, data, native, expanded, renderInstance) {
    return `<div class="surface apps-list">${groups(snapshot).map(group => {
      const open = expanded.has(group.id);
      return `<article class="app-config-row ${open ? "expanded" : ""}" data-app-group="${escape(group.id)}"><div class="app-config-main">${groupHeader(group, snapshot, data, native, open)}</div><div class="app-group-instances" id="instances-${escape(group.id)}" ${open ? "" : "hidden"}>${group.members.map(renderInstance).join("")}</div></article>`;
    }).join("")}</div>`;
  }
  function displayedSources(group, snapshot, data) {
    const unique = new Map();
    for (const client of group.members) {
      for (const source of clients.configurationState(client, snapshot, data).sources) {
        const key = JSON.stringify([source.connectionId, source.name, source.modelCount, source.manual, source.state]);
        if (!unique.has(key)) unique.set(key, source);
      }
    }
    return [...unique.values()];
  }
  function canExtract(snapshot, data, native, members) {
    if (!native || !snapshot || blocked(snapshot)) return false;
    if (!members) return data.providerImport?.batch === true;
    return members.some(client => client.detected && data.providerImport?.targetIds?.includes(client.id));
  }
  function canManageExisting(client, snapshot, data, native) {
    if (!native || !client?.detected || blocked(snapshot)) return false;
    const sources = clients.configurationState(client, snapshot, data).sources;
    const app = client.kind === "github-copilot-app";
    if (app && data.appSync?.ownedConnectionIds?.length) return true;
    return (app || client.supportsWrite) && sources.some(source => !source.manual);
  }
  function instanceCard(client, snapshot, data, native, chosen) {
    const target = clients.publicationTarget(client, snapshot, data);
    const name = clients.name(client);
    const id = escape(client.id);
    const group = family(client);
    const state = clients.configurationState(client, snapshot, data);
    const app = client.kind === "github-copilot-app";
    const providers = snapshot.connections.filter(connection => connection.enabled !== false);
    const selected = chosen === undefined && providers.length === 1 ? providers[0].id : chosen;
    const selectedId = providers.some(provider => provider.id === selected) ? selected : "";
    const frozen = blocked(snapshot);
    const providerAction = target.detected && (target.supportsWrite || app) && providers.length > 0;
    const guide = !target.supportsWrite && (target.detected || target.status === "read-only");
    const install = target.status === "not-installed" && ["vscode", "cli", "copilot-app"].includes(group);
    return `<article class="client-card" data-client-id="${id}" tabindex="-1">
      <div class="client-header"><span class="app-icon ${escape(group)}">${icon(appIcons[group] ?? "apps")}</span><h3>${escape(name)}</h3><span class="status-pill ${state.state}">${escape(state.label)}</span></div>
      <div class="app-current-config" data-app-sources="${id}">${manager.currentSources(client, snapshot, data)}</div>
      ${providerAction ? `<div class="app-configuration"><label class="app-provider-field"><span>${target.supportsWrite ? tr("本次发布") : tr("供应商")}</span><select class="app-provider-select" aria-label="${tr("选择 {0} 的供应商", escape(name))}" ${frozen ? "disabled" : ""}><option value="" ${!selectedId ? "selected" : ""}>${tr("请选择供应商")}</option>${providers.map(provider => `<option value="${escape(provider.id)}" ${provider.id === selectedId ? "selected" : ""}>${escape(provider.name)}</option>`).join("")}</select></label><button class="button primary small" data-action="deploy-client" data-client-id="${id}" ${!selectedId || frozen ? "disabled" : ""}>${target.supportsWrite ? tr("发布配置") : tr("配置指引")}</button></div>` : ""}
      <div class="app-card-footer">
        ${target.detected && target.supportsWrite && !providers.length ? (snapshot.connections.length
          ? `<button class="button small" data-action="route" data-route="connections">${tr("管理供应商")}</button>`
          : `<button class="button primary small" data-action="add-connection" ${frozen ? "disabled" : ""}>${tr("添加供应商")}</button>`) : ""}
        ${canManageExisting(client, snapshot, data, native) ? `<button class="button small" data-action="manage-existing-providers" data-id="${id}">${tr("管理配置")}</button>` : ""}
        ${native && target.detected ? `<button class="button ghost small" data-action="import-instance" data-id="${id}" ${canExtract(snapshot, data, native, [client]) ? "" : "hidden disabled"}>${tr("提取供应商")}</button>` : ""}
        ${guide && !providerAction ? `<button class="button ghost small" data-action="client-guide" data-id="${id}">${tr("配置指引")}</button>` : ""}
        ${install && native ? `<button class="button small" data-action="show-installation">${tr("安装与更新")}</button>` : ""}
        <details class="app-details"><summary>${tr("应用信息")}</summary>
          ${client.detail ? `<p class="manager-meta">${escape(client.detail)}</p>` : ""}
          ${client.diagnostic && client.diagnostic !== client.detail ? `<p class="manager-meta">${escape(client.diagnostic)}</p>` : ""}
          ${client.path ? `<div class="path-line" title="${escape(client.path)}">${escape(client.path)}</div>` : ""}
          ${native && app && target.detected ? `<button class="button ghost small" data-action="manage-app-sync">${tr("实验性自动同步")}</button>` : ""}
        </details>
      </div></article>`;
  }
  function overviewRows(snapshot, data, native = true) {
    const heading = `<div class="roster-head" aria-hidden="true"><span>${tr("应用")}</span><span>${tr("应用内供应商")}</span><span>${tr("配置状态")}</span><span>${tr("操作")}</span></div>`;
    return heading + groups(snapshot).map(group => {
      const sources = displayedSources(group, snapshot, data);
      const providers = sources.slice(0,3).map(source => {
        const detail = source.manual ? tr("手动确认") : Number.isInteger(source.modelCount) ? tr("{0} 个模型", source.modelCount) : tr("模型数量未知");
        return `<div class="roster-provider"><strong>${escape(clients.sourceName(source, snapshot))}</strong><small>${detail}</small></div>`;
      }).join("");
      const extra = sources.length > 3 ? `<small class="manager-extra-summary">${tr("另有 {0} 个来源", sources.length - 3)}</small>` : "";
      const extract = native && group.members.some(client => client.detected) ? `<button class="button ghost small" data-action="import-family" data-id="${escape(group.id)}" ${canExtract(snapshot, data, native, group.members) ? "" : "hidden disabled"}>${tr("提取")}</button>` : "";
      return `<div class="status-row" data-roster-app="${escape(group.id)}" data-action="open-app-group" data-id="${escape(group.id)}">${identity(group)}
        <div class="current-source roster-providers">${providers || '<span class="roster-dash">—</span>'}${extra}</div>
        ${pill(group,snapshot,data)}<div class="roster-actions">${extract}
        <button class="row-chevron" data-action="open-app-group" data-id="${escape(group.id)}" aria-label="${tr("查看 {0} 的实例",escape(group.name))}">${icon("arrow")}</button></div></div>`;
    }).join("");
  }
  function monogram(name) { return escape([...String(name)].slice(0, 2).join("").toLocaleUpperCase(i18n.locale())); }
  function usedClients(provider, snapshot, data) { return clients.ordered(snapshot).filter(client => clients.configurationState(client, snapshot, data).sources.some(source => source.connectionId === provider.id)); }
  function overviewStart(snapshot, data, native) {
    const found = groups(snapshot).filter(group => canExtract(snapshot, data, native, group.members)).length;
    const extract = canExtract(snapshot, data, native);
    return `<section class="surface manager-start" data-import-start><div><h2>${found ? tr("在 {0} 类应用中发现了供应商",found) : tr("配置一个供应商，用于多个 Copilot 客户端")}</h2>
      <p>${found ? tr("选择要保存到管理器的供应商，重复项会自动合并。") : tr("先添加端点、密钥与模型，再选择你要使用的客户端并预览发布。")}</p></div>
      <div class="start-actions">${extract ? `<button class="button primary" data-action="import-providers">${tr("一键提取")}</button>` : ""}<button class="button ${extract ? "ghost" : "primary"}" data-action="add-connection">${tr("添加连接")}</button></div></section>`;
  }
  function overview(snapshot, data, native) {
    const configured = clients.ordered(snapshot).filter(client => clients.configurationState(client, snapshot, data).state === "configured").length;
    const unknown = clients.ordered(snapshot).some(client => clients.configurationState(client, snapshot, data).state === "unavailable");
    const pending = manager.pending(snapshot, native);
    return `${!native ? `<div class="preview-banner">${tr("浏览器试用 · 示例数据 · 不修改电脑")}</div>` : ""}
      ${!blocked(snapshot) && !snapshot.connections.length ? overviewStart(snapshot, data, native) : `<section class="surface readiness"><span class="readiness-icon">${icon(unknown ? "about" : configured ? "check" : "provider")}</span><div class="readiness-copy"><h2>${unknown ? tr("应用配置状态待核对") : tr("{0} 个应用实例已配置", configured)}</h2><p>${tr("一次配置供应商，在你的 Copilot 应用中使用。")}</p></div><button class="text-button" data-action="publish-config" ${blocked(snapshot) ? "disabled" : ""}>${tr("发布配置")}</button></section>`}
      ${pending.length ? `<section class="surface workspace-pending">${pending.map(row => `<p><span>${escape(row.text)}</span><button class="text-button" data-action="${row.action}" ${row.route ? `data-route="${row.route}"` : ""} ${row.disabled ? "disabled" : ""}>${escape(row.label)}</button></p>`).join("")}</section>` : ""}
      <section class="section"><div class="section-heading"><h2>${tr("应用配置状态")}</h2><button class="text-button" data-action="route" data-route="clients">${tr("管理应用")}</button></div><div class="surface app-status-list" data-home-sources>${overviewRows(snapshot, data, native)}</div></section>
      <div class="overview-bottom"><section class="section"><div class="section-heading"><h2>${tr("管理器中的供应商")}</h2><button class="text-button" data-action="route" data-route="connections">${tr("管理供应商")}</button></div><div class="surface provider-summary-list">${snapshot.connections.slice(0, 5).map(provider => `<button class="provider-summary-row" data-action="open-provider" data-id="${escape(provider.id)}"><span class="provider-monogram">${monogram(provider.name)}</span><div><strong>${escape(provider.name)}</strong><span>${tr("{0} 个模型", provider.models.filter(model => model.enabled).length)}${provider.enabled === false ? ` · ${tr("已暂停")}` : ""}</span></div><span class="meta">${tr("{0} 个应用", usedClients(provider, snapshot, data).length)}</span><span class="row-chevron">${icon("arrow")}</span></button>`).join("") || `<p class="editor-empty">${tr("管理器尚未保存供应商")}</p>`}</div></section><section class="section"><div class="section-heading"><h2 id="publication-result-title">${tr("最近配置操作")}</h2><button class="text-button" data-action="view-publication-history">${tr("查看记录")}</button></div><div class="surface latest-result">${manager.lastResult(snapshot, native, false)}</div></section></div>`;
  }
  function filtered(snapshot, query = "") { const needle = query.trim().toLocaleLowerCase(i18n.locale()); return snapshot.connections.filter(c => `${c.name} ${c.baseUrl}`.toLocaleLowerCase(i18n.locale()).includes(needle)); }
  function providerList(snapshot, query, selectedId) {
    return filtered(snapshot, query).map(provider => `<button class="provider-list-item ${provider.id === selectedId ? "active" : ""}" data-action="select-provider" data-id="${escape(provider.id)}" aria-current="${provider.id === selectedId}"><span class="provider-monogram">${monogram(provider.name)}</span><div><strong>${escape(provider.name)}</strong><span>${tr("{0} 个模型", provider.models.filter(model => model.enabled).length)} · ${escape(provider.protocol)}</span></div><span class="provider-state-dot ${provider.enabled === false ? "paused" : ""}"></span></button>`).join("") || `<p class="empty-search">${tr("没有匹配的供应商")}</p>`;
  }
  function providerDetail(provider, snapshot, data, native) {
    if (!provider) return `<div class="empty-search">${tr("选择或添加一个供应商。")}</div>`;
    const models = provider.models.filter(model => model.enabled), used = usedClients(provider, snapshot, data), id = escape(provider.id);
    const disabled = blocked(snapshot) ? "disabled" : "";
    const credential = snapshot.credentialStatuses?.[provider.id]?.state;
    const keyStatus = credential === "unavailable" ? tr("密钥存储不可用") : provider.hasSecret ? tr("密钥已保存") : tr("未保存密钥");
    return `<section class="provider-detail manager-connection" data-connection-id="${id}"><div class="provider-detail-header"><span class="provider-monogram">${monogram(provider.name)}</span><div class="provider-title"><h2>${escape(provider.name)}</h2><p>${escape(provider.protocol)} · ${keyStatus}</p></div><div class="provider-detail-actions"><button class="button primary small" data-action="deploy-connection" data-id="${id}" ${disabled || provider.enabled === false ? "disabled" : ""}>${icon("upload")}${tr("发布")}</button><button class="button small" data-action="edit-connection" data-id="${id}" ${disabled}>${icon("edit")}${tr("编辑")}</button><details class="provider-more"><summary class="icon-button bordered" aria-label="${tr("更多供应商操作")}">${icon("more")}</summary><div class="action-menu"><button data-action="test-connection" data-id="${id}" ${disabled || !native ? "disabled" : ""}>${tr("测试模型目录")}</button><button class="danger-text" data-action="delete-connection" data-id="${id}" ${disabled}>${tr("移除供应商")}</button></div></details></div></div>
      <section class="detail-section"><div class="detail-section-header"><h3>${tr("端点地址")}</h3></div><div class="endpoint-value mono">${escape(provider.baseUrl)}</div><p class="key-status">${icon("key")}${keyStatus} · ${tr("系统凭据库")}</p><p class="manager-probe" data-probe-id="${id}" role="status"></p></section>
      <section class="detail-section"><div class="detail-section-header"><h3>${tr("模型")} <span class="muted">${models.length}</span></h3><button class="text-button" data-action="edit-connection" data-id="${id}" ${disabled}>${tr("编辑模型")}</button></div><div class="model-list">${models.map((model, index) => `<div class="model-row">${icon("star", index ? "" : "preferred")}<div><strong>${escape(model.name)}</strong><span class="mono">${escape(model.modelId)}</span></div>${!index ? `<span class="model-tag">${tr("首选模型")}</span>` : ""}</div>`).join("") || `<p class="editor-empty">${tr("没有启用的模型")}</p>`}</div></section>
      <section class="detail-section"><div class="detail-section-header"><h3>${tr("已发布到")}</h3></div><div class="used-apps">${used.map(client => `<span class="used-app">${escape(clients.name(client))}</span>`).join("") || `<span class="meta">${tr("尚未发布到应用")}</span>`}</div></section>
      <div class="eligibility"><div><strong>${tr("允许发布")}</strong><p>${tr("暂停后保留客户端现有配置。")}</p></div><button class="switch manager-switch" role="switch" aria-checked="${provider.enabled !== false}" aria-label="${tr("允许发布 {0}", escape(provider.name))}" data-action="toggle-connection" data-id="${id}" ${disabled}><span></span></button></div></section>`;
  }
  function providers(snapshot, data, native, state) {
    const entries = filtered(snapshot, state.query), selected = entries.find(c => c.id === state.selectedId) ?? entries[0];
    state.selectedId = selected?.id ?? null;
    return `<div class="surface provider-workspace"><aside class="provider-list-pane"><div class="search-field">${icon("search")}<input id="provider-search" type="search" value="${escape(state.query)}" placeholder="${tr("搜索供应商")}" aria-label="${tr("搜索供应商")}"></div><div class="provider-list" data-provider-list>${providerList(snapshot, state.query, state.selectedId)}</div></aside><div class="provider-detail-host" data-provider-detail>${providerDetail(selected, snapshot, data, native)}</div></div>`;
  }
  return { icon, family, groups, groupState, groupHeader, appRows, instanceCard, canExtract, canManageExisting, overviewRows, overviewStart, overview, filtered, providerList, providerDetail, providers };
});
