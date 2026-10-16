const test = require("node:test");
const assert = require("node:assert/strict");
const i18n = require("../i18n.js");
const clients = require("../client-presentation.js");
i18n.setLocale("zh-CN", { persist: false });
const target = (id, extra = {}) => ({ id, name: id, kind: "jetbrains-copilot", detected: true, supportsWrite: true, status: "available", ...extra });

test("supported configured apps precede unconfigured, unsupported, disabled, unknown and missing apps", () => {
  const snapshot = {
    clients: [target("missing", { detected: false, supportsWrite: false, status: "not-installed" }), target("configured"), target("unconfigured"), target("unsupported", { supportsWrite: false }), target("changed"), target("disabled", { detected: false, supportsWrite: false, status: "read-only" }), target("unknown", { detected: false, supportsWrite: false, status: "error" })],
    clientConfigurations: [{ targetId: "configured", state: "available", sources: [{ name: "Current", modelCount: 2 }] }, { targetId: "changed", state: "unavailable", sources: [] }],
  };
  const original = snapshot.clients.slice();
  assert.deepEqual(clients.ordered(snapshot).map(client => client.id), ["configured", "changed", "unconfigured", "unsupported", "disabled", "unknown", "missing"]);
  assert.deepEqual(snapshot.clients, original);
  assert.equal(clients.sources(snapshot.clients[4], snapshot).length, 0);
  snapshot.clientConfigurations[0].sources[0].modelCount = 0;
  assert.equal(clients.sources(snapshot.clients[1], snapshot).length, 1);
  delete snapshot.clientConfigurations;
  assert.equal(clients.sources(snapshot.clients[1], snapshot).length, 0);
});

test("Agents is hidden only when the same edition's Chat actually shares its writable catalog", () => {
  const chat = target("vscode:stable:default", { kind: "vs-code-copilot", name: "Visual Studio Code · Default", path: "same.json" });
  const agents = { ...chat, id: "vscode:stable:profile:builtin/agents", name: "Visual Studio Code · Agents" };
  assert.deepEqual(clients.visible([agents, chat]), [chat]);
  assert.equal(clients.name(chat), "Copilot Chat · VS Code");
  assert.equal(clients.name({ ...chat, id: "vscode:insiders:default" }), "Copilot Chat · VS Code Insiders");
  for (const separate of [{ ...agents, path: "independent.json" }, { ...agents, supportsWrite: false }, { ...agents, detected: false }, { ...agents, id: "vscode:insiders:profile:builtin/agents" }]) assert.equal(clients.visible([chat, separate]).length, 2);
  assert.deepEqual(clients.visible([agents]), [agents]);
  const named = { ...chat, id: "vscode:stable:profile:work", name: "Visual Studio Code · Work <team>" };
  assert.equal(clients.name(named), "Copilot Chat · VS Code · Work <team>");
});

test("JetBrains plugin availability and version support keep unknown states distinct", () => {
  assert.match(clients.capability(target("supported")), /已安装.*支持自动/);
  assert.match(clients.capability(target("unsupported", { supportsWrite: false })), /当前版本不支持/);
  assert.match(clients.capability(target("disabled", { detected: false, status: "read-only" })), /已停用/);
  assert.match(clients.capability(target("missing", { detected: false, status: "not-installed" })), /未检测到/);
  assert.match(clients.capability(target("unknown", { detected: false, status: "error" })), /未知/);
});
