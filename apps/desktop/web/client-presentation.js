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
  const platforms = Object.freeze({ "vs-code-copilot": "VS Code", "vscode-copilot": "VS Code", "copilot-cli": "CLI", "github-copilot-app": "App", "jetbrains-copilot": "JetBrains" });

  function surfaceName(kind) {
    const platform = Object.hasOwn(platforms, kind) ? platforms[kind] : null;
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
    if (!vscode(client)) return client.name;
    if (!/^vscode:(stable|insiders):/.test(client.id)) return surfaceName(client.kind);
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

  function publicationTarget(client, snapshot, data = {}) {
    const sync = data.appSync;
    if (!client?.detected) return client;
    let supportsWrite = client.supportsWrite;
    if (client.kind === "github-copilot-app" && typeof sync?.enabled === "boolean") {
      supportsWrite = sync.enabled && (sync.reviewSupported ?? supportsWrite);
    }
    if (client.supportsWrite && configuration(client, snapshot)?.state === "unsupported") supportsWrite = false;
    return supportsWrite === client.supportsWrite ? client : { ...client, supportsWrite };
  }

  function sources(client, snapshot) {
    const current = configuration(client, snapshot);
    return current?.state === "available" && Array.isArray(current.sources) ? current.sources : [];
  }

  function sourceName(source, snapshot) {
    return source.name || snapshot.connections.find(connection => connection.id === source.connectionId)?.name || tr("供应商");
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

  function stateLabel(state) {
    return ({
      configured: tr("已配置"), empty: tr("未配置"), partial: tr("部分已配置"),
      unavailable: tr("需核对状态"), missing: tr("未安装"), disabled: tr("已停用"),
      manual: tr("手动配置"), unsupported: tr("不支持自动发布"),
    })[state] ?? tr("需核对状态");
  }

  function configurationState(client, snapshot, data = {}) {
    const result = (state, detail, values = []) => ({ state, label: stateLabel(state), detail, sources: values });
    if (["error", "unknown"].includes(client.status)) return result("unavailable", tr("检测不可用"));
    if (!client.detected && client.status === "read-only") return result("disabled", tr("应用或插件已停用"));
    if (!client.detected) return result("missing", tr("未安装"));
    const current = configuration(client, snapshot);
    if (current?.state === "available") {
      const values = sources(client, snapshot);
      return values.length ? result("configured", tr("已配置 {0} 个供应商", values.length), values) : result("empty", tr("未配置供应商"));
    }
    if (current?.state === "unavailable") {
      return result("unavailable", current.issue === "clientRunning" ? tr("退出 Copilot App 后刷新配置。") : tr("配置读取失败"));
    }
    const target = publicationTarget(client, snapshot, data);
    if (client.kind === "github-copilot-app" && !(data.appSync?.enabled ?? client.supportsWrite)) {
      if (data.errors?.manualProviders) return result("unavailable", tr("手动配置记录读取失败"));
      const records = (data.manualProviders ?? []).filter(record => record.state !== "notConfirmed");
      const values = records.flatMap(record => {
        const connection = snapshot.connections.find(value => value.id === record.connectionId);
        return connection ? [{ ...record, name: connection.name, manual: true }] : [];
      });
      return result("manual", values.length ? tr("手动配置记录") : tr("在 Copilot App 中手动添加供应商"), values);
    }
    if (!target.supportsWrite || current?.state === "unsupported") return result("unsupported", tr("此配置格式暂不支持"));
    return result("unavailable", tr("配置读取失败"));
  }

  function blockerText(blocker) {
    switch (blocker) {
      case "missingProviderKey": return tr("缺少 API 密钥，请在供应商页保存后再发布。");
      case "incompatibleEndpoint": return tr("供应商端点与 JetBrains 不兼容，请查看明细。");
      case "modelToolCallingRequired": return tr("有启用的模型不支持工具调用，停用后可发布。");
      case "clientRunning": return tr("退出 Copilot App 后重新核对。");
      case "unsafeClientPermissions": return tr("App 数据目录允许其他账号读取。请先收紧权限，再核对同步。");
      case "unsupportedClientFormat": return tr("此配置格式暂不支持");
      default: return "";
    }
  }

  function canFixProvider(blocker) {
    return ["missingProviderKey", "incompatibleEndpoint", "modelToolCallingRequired"].includes(blocker);
  }

  function publicationStatus(status) {
    return ({ applied: tr("配置变更已应用"), skipped: tr("未自动处理"), failed: tr("失败，请核对"), rolledBack: tr("已回滚"), "rolled-back": tr("已回滚"), interrupted: tr("已中断，待恢复"), partial: tr("部分完成"), prepared: tr("已准备"), applying: tr("处理中") })[status] ?? tr("状态需核对");
  }

  function publicationName(record, snapshot) {
    const target = snapshot.clients.find(client => client.id === record.targetId);
    if (target) return name(target);
    const kind = record.targetKind ?? ({ vscode: "vs-code-copilot", "copilot-cli": "copilot-cli", "github-copilot-app": "github-copilot-app", jetbrains: "jetbrains-copilot" })[record.targetId?.split(":", 1)[0]];
    return Object.hasOwn(platforms, kind) ? surfaceName(kind) : tr("目标未知");
  }

  return { name, surfaceName, visible, ordered, configuration, sources, sourceName, configurationState, stateLabel, publicationTarget, blockerText, canFixProvider, publicationStatus, publicationName };
});
