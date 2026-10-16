(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerClients = api;
})(globalThis, function () {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  const vscode = client => ["vs-code-copilot", "vscode-copilot"].includes(client.kind);
  const agents = client => vscode(client) && /^vscode:(stable|insiders):profile:builtin\/agents$/.test(client.id);

  function name(client) {
    if (!client) return "";
    if (!vscode(client) || !/^vscode:(stable|insiders):/.test(client.id)) return client.name;
    const edition = client.id.startsWith("vscode:insiders:") ? "VS Code Insiders" : "VS Code";
    if (client.id.endsWith(":default")) return tr("Copilot Chat · {0}", edition);
    if (agents(client)) return tr("{0} Agents", edition);
    const prefix = edition === "VS Code" ? "Visual Studio Code · " : "Visual Studio Code Insiders · ";
    return client.name.startsWith(prefix) ? tr("Copilot Chat · {0} · {1}", edition, client.name.slice(prefix.length)) : client.name;
  }

  function visible(clients) {
    return clients.filter(client => !agents(client) || !clients.some(chat =>
      chat.id === client.id.replace(":profile:builtin/agents", ":default")
      && chat.kind === client.kind && chat.detected && chat.supportsWrite
      && client.detected && client.supportsWrite && chat.path && chat.path === client.path));
  }

  function configuration(client, snapshot) {
    return (snapshot.clientConfigurations ?? []).find(value => value.targetId === client.id);
  }

  function sources(client, snapshot) {
    const current = configuration(client, snapshot);
    return current?.state === "available" && Array.isArray(current.sources) ? current.sources : [];
  }

  function rank(client, snapshot) {
    if (client.detected && client.supportsWrite) return sources(client, snapshot).length ? 0 : 1;
    if (client.detected) return 2;
    if (client.status === "read-only") return 3;
    if (client.status === "not-installed") return 5;
    return 4;
  }

  function ordered(snapshot) {
    return visible(snapshot.clients).slice().sort((left, right) => rank(left, snapshot) - rank(right, snapshot)
      || name(left).localeCompare(name(right), i18n.locale(), { numeric: true }) || left.id.localeCompare(right.id));
  }

  function description(client) {
    if (vscode(client) && client.detected && client.supportsWrite && /^vscode:(stable|insiders):default$/.test(client.id)) return tr("使用 VS Code 默认配置档案的模型目录。");
    return client.detail;
  }

  function capability(client) {
    if (client.kind !== "jetbrains-copilot") return "";
    if (client.status === "error" || client.status === "unknown") return tr("Copilot 插件状态未知");
    if (!client.detected) return client.status === "read-only" ? tr("Copilot 插件已停用") : tr("未检测到 Copilot 插件");
    return client.supportsWrite ? tr("Copilot 已安装 · 支持自动配置") : tr("Copilot 已安装 · 当前版本不支持自动配置");
  }

  return { name, visible, ordered, configuration, sources, description, capability };
});
