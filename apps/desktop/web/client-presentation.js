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

  function surfaceName(kind) {
    const platform = ({ "vs-code-copilot": "VS Code", "vscode-copilot": "VS Code", "copilot-cli": "CLI", "github-copilot-app": "App", "jetbrains-copilot": "JetBrains" })[kind];
    return platform ? tr("GitHub Copilot · {0}", platform) : kind;
  }

  function name(client) {
    if (!client) return "";
    if (["copilot-cli", "github-copilot-app"].includes(client.kind)) return surfaceName(client.kind);
    if (client.kind === "jetbrains-copilot") {
      const base = surfaceName(client.kind);
      if (client.id === "jetbrains:local") return base;
      const suffix = " · Copilot";
      const instance = client.name.endsWith(suffix) ? client.name.slice(0, -suffix.length) : client.name;
      return tr("{0} · {1}", base, instance);
    }
    if (!vscode(client) || !/^vscode:(stable|insiders):/.test(client.id)) return client.name;
    const edition = client.id.startsWith("vscode:insiders:") ? "VS Code Insiders" : "VS Code";
    const base = tr("GitHub Copilot · {0}", edition);
    if (client.id.endsWith(":default")) return base;
    if (agents(client)) return tr("{0} · {1}", base, "Agents");
    const prefix = edition === "VS Code" ? "Visual Studio Code · " : "Visual Studio Code Insiders · ";
    return tr("{0} · {1}", base, client.name.startsWith(prefix) ? client.name.slice(prefix.length) : client.name);
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
    if (client.kind === "github-copilot-app" && client.detected) return client.supportsWrite ? tr("同步自有供应商和模型；完成后重新启动 App 并选择模型。") : tr("手动配置，或开启实验性自动同步。");
    if (client.kind === "copilot-cli" && client.detected && client.supportsWrite) return tr("发布后，在新的 CLI 会话中用 /model 选择模型。");
    if (vscode(client) && client.detected && client.supportsWrite && /^vscode:(stable|insiders):default$/.test(client.id)) return tr("使用 VS Code 默认配置档案的模型目录。");
    return client.detail;
  }

  function configurationState(client, snapshot, data = {}) {
    if (["error", "unknown"].includes(client.status)) return { state: "unavailable", label: tr("检测不可用"), sources: [] };
    if (!client.detected && client.status === "read-only") return { state: "unsupported", label: tr("应用或插件已停用"), sources: [] };
    if (!client.detected) return { state: "missing", label: tr("未安装"), sources: [] };
    if (client.kind === "github-copilot-app" && !client.supportsWrite) {
      if (data.errors?.manualProviders) return { state: "unavailable", label: tr("手动配置记录读取失败"), sources: [] };
      const records = (data.manualProviders ?? []).filter(record => record.state !== "notConfirmed");
      const sources = records.flatMap(record => {
        const connection = snapshot.connections.find(value => value.id === record.connectionId);
        return connection ? [{ ...record, name: connection.name, manual: true }] : [];
      });
      return { state: "manual", label: sources.length ? tr("手动配置记录") : tr("在 Copilot App 中手动添加供应商"), sources };
    }
    if (!client.supportsWrite) return { state: "unsupported", label: tr("不支持自动发布"), sources: [] };
    const current = configuration(client, snapshot);
    if (current?.state === "unsupported") return { state: "unsupported", label: tr("此配置格式暂不支持"), sources: [] };
    if (!current || current.state !== "available") return { state: "unavailable", label: tr("配置读取失败"), sources: [] };
    const values = sources(client, snapshot);
    return { state: values.length ? "configured" : "empty", label: values.length ? tr("已配置 {0} 个供应商", values.length) : tr("未配置供应商"), sources: values };
  }

  function capability(client) {
    if (client.kind !== "jetbrains-copilot") return "";
    if (client.status === "error" || client.status === "unknown") return tr("Copilot 插件状态未知");
    if (!client.detected) return client.status === "read-only" ? tr("Copilot 插件已停用") : tr("未检测到 Copilot 插件");
    return client.supportsWrite ? tr("Copilot 已安装 · 支持自动配置") : tr("Copilot 已安装 · 当前版本不支持自动配置");
  }

  return { name, surfaceName, visible, ordered, configuration, sources, description, capability, configurationState };
});
