const { test } = require("node:test");
const assert = require("node:assert/strict");
const i18n = require("../i18n.js");
test.beforeEach(() => i18n.setLocale("zh-CN", { persist: false }));
const { guide } = require("../jetbrains-ui.js");
const setup = require("../setup-ui.js");
const usage = require("../usage-ui.js");
const connection = { id: "c", name: "Example", baseUrl: "https://example.invalid/v1", protocol: "chat-completions", headers: { Authorization: "SENSITIVE-HEADER" }, secretRef: "SENSITIVE-REFERENCE", models: [{ modelId: "allowed-model", name: "Allowed", enabled: true }, { modelId: "disabled-model", name: "Disabled", enabled: false }] };
const target = { id: "jb-idea", kind: "jetbrains-copilot", name: "IntelliJ IDEA 2026.2 · Copilot", detail: "Public plugin metadata, not a verified account", path: "Fixture profile", detected: true, supportsWrite: false, status: "read-only" };

test("JetBrains guide includes real configuration steps but not credentials or completion controls", () => {
  const html = guide(connection, target, { description: "Manual only", changes: ["Enable model: allowed-model"] });
  for (const text of ["Manage Models", "Add Models", "Login to GitHub", "OpenAI 兼容", "example.invalid/v1", "allowed-model"]) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /SENSITIVE|disabled-model|confirm-manual|apply-deployment|<input/);
  assert.match(html, /仅在 IDE 中配置其界面支持的字段/);
  assert.doesNotMatch(html, /确认发布后仅在原生 BYOK 配置中写入/);
  assert.match(guide(null, target), /请先添加连接/);
});
test("untrusted names, endpoints, models and native runbook fields are escaped", () => {
  const html = guide({ ...connection, name: "<script>name</script>", baseUrl: '<img src=x onerror="bad">', models: [{ modelId: "<script>model</script>", enabled: true }] }, { ...target, detail: "<script>plugin</script>", path: '<img src="x">' }, { description: "<script>native</script>", changes: ["<img src=x>"] });
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
});
test("writable JetBrains review exposes real automatic fields without showing secrets", () => {
  const html = guide(connection, { ...target, supportsWrite: true, status: "available" }, { supported: true, description: "Deploy dedicated BYOK namespace", changes: ["Enable model: allowed-model"] });
  assert.match(html, /可自动发布 BYOK/);
  assert.match(html, /byok\.json/);
  assert.match(html, /只写一次/);
  assert.match(html, /重新打开 IDE/);
  assert.match(html, /无需在 Manage Models 中重新输入/);
  assert.match(html, /独立 XML/);
  assert.match(html, /请在每个 IDE 中通过 Tools > GitHub Copilot > Login to GitHub 登录并核对账号。/);
  assert.doesNotMatch(html, /保存并启用模型/);
  assert.doesNotMatch(html, /SENSITIVE|disabled-model|<input/);
  const data = { setup: { manualConfirmed: true, preferences: { connectionId: "c" }, targets: [{ targetId: "jb-idea", state: "notDeployed" }] } };
  const state = setup.derive({ clients: [{ ...target, supportsWrite: true }], connections: [connection] }, data);
  assert.equal(state.writable.length, 1);
  assert.equal(state.deployed, false);
});
test("app manual confirmation never covers JetBrains, which is optional for core deployment", () => {
  i18n.setLocale("en", { persist: false });
  const clients = [{ id: "vs", kind: "vs-code-copilot", name: "VS", detected: true, supportsWrite: true }, { id: "app", kind: "github-copilot-app", name: "App", detected: true, supportsWrite: false }, target];
  const data = { components: [1, 2, 3, 4].map(id => ({ id, status: "ready" })), errors: {}, setup: { scannedAt: new Date().toISOString(), alignment: "userConfirmedSameAccount", manualConfirmed: true, preferences: { connectionId: "c" }, targets: [{ targetId: "vs", state: "inSync" }, { targetId: "jb-idea", state: "manual", detail: "JetBrains not verified" }] } };
  const state = setup.derive({ clients, connections: [connection] }, data);
  assert.equal(state.complete, 4);
  assert.equal(state.manual.length, 1);
  const html = setup.render({ clients, connections: [connection] }, data, true);
  assert.match(html, /data-action="jetbrains-guide" data-id="jb-idea"/);
  assert.match(html, /Copilot<\/span><span class="setup-badge ">Manual/);
  assert.equal((html.match(/Provider setup confirmed by you/g) ?? []).length, 1);
  const noApp = setup.derive({ clients: clients.filter(c => c.id !== "app"), connections: [connection] }, { ...data, setup: { ...data.setup, manualConfirmed: false } });
  assert.equal(noApp.deployed, true);
});
test("JetBrains coverage is unavailable rather than fabricated zero or CLI attribution", () => {
  const html = usage.render({ connections: [connection], clients: [target] }, { errors: {} }, true);
  assert.match(html, /JetBrains 用量：暂未支持。/);
  assert.doesNotMatch(html, /data-source-id="jetbrains/);
});
