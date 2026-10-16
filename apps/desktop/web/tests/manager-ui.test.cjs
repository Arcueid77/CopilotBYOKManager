const test = require("node:test");
const assert = require("node:assert/strict");
require("../i18n.js").setLocale("zh-CN", { persist: false });
const manager = require("../manager-ui.js");
const setup = require("../setup-ui.js");
const discovery = require("../model-discovery.js");
function fixture() {
  return { connections: [{ id: "a", name: "供应商 A", enabled: true, baseUrl: "https://example.invalid/v1", models: [{ modelId: "one", name: "One", enabled: true }], hasSecret: true }, { id: "b", name: "供应商 B", enabled: false, models: [{ modelId: "two", name: "Two", enabled: true }] }], clients: [{ id: "vs", name: "VS Code", kind: "vs-code-copilot", detected: true, supportsWrite: true }], clientConfigurations: [{ targetId: "vs", state: "available", sources: [{ connectionId: "a", name: "供应商 A", modelCount: 3 }, { connectionId: "b", name: "供应商 B", modelCount: 2 }] }], deployments: [] };
}
const data = { setup: { alignment: "verifiedSameAccount" }, components: [{ status: "ready" }], errors: {} };
test("Home uses approved section order, hides disabled cards but retains published sources", () => {
  const snapshot = fixture();
  const html = manager.renderHome(snapshot, data, true);
  assert.ok(html.indexOf("应用配置状态") < html.indexOf('<h2>供应商概况</h2>'));
  assert.ok(html.indexOf('<h2>供应商概况</h2>') < html.indexOf("最近一次发布"));
  assert.match(html, /供应商 A · 3 个模型/); // Observed count, not newly edited 1-model catalog.
  assert.match(html, /供应商 B · 2 个模型 · 已停用，配置保留/);
  assert.doesNotMatch(html, /data-connection-id="b"/);
  assert.match(html, /应用配置状态/);
  assert.match(html, />查看应用<\/button>/);
  for (const status of ["missing", "broken", "unsupported", "unknown", "ready"]) {
    const observed = { ...data, components: [{ status }] };
    assert.doesNotMatch(manager.renderHome(snapshot, observed, true), /manager-pending|有事项需要核对|核对客户端/);
  }
  assert.doesNotMatch(manager.renderHome(snapshot, { errors: { setup: "unavailable", components: "unavailable" } }, true), /manager-pending|核对客户端/);
  assert.doesNotMatch(html, /当前使用|已自动选用|setup-hero|setup-steps|<table/);
  assert.match(manager.renderHome(snapshot, data, false), /发布仅为模拟，不修改电脑/);
});
test("state recovery disables editing, enablement, probes and publication with a concrete next action", () => {
  const snapshot = { ...fixture(), deploymentRecovery: "pending" };
  const html = manager.connectionCard(snapshot.connections[0], snapshot, true);
  for (const action of ["deploy-connection", "edit-connection", "toggle-connection", "test-connection", "delete-connection"]) assert.match(html, new RegExp(`data-action="${action}"[^>]*disabled`));
  assert.match(manager.renderHome(snapshot, data, true), /data-action="preview-recovery"/);
  assert.doesNotMatch(manager.renderHome(snapshot, data, true), /管理供应商并发布到应用/);
  const preview = manager.connectionCard(snapshot.connections[0], fixture(), false);
  assert.match(preview, /data-action="test-connection"[^>]*disabled/);
});
test("current configuration follows manual edits and deletion; read failures remain distinct", () => {
  const snapshot = fixture();
  snapshot.clientConfigurations[0].sources[0].name = "用户改过的名称";
  snapshot.clientConfigurations[0].sources[0].modelCount = 5;
  assert.match(manager.sourceRows(snapshot), /用户改过的名称 · 5 个模型/);
  assert.doesNotMatch(manager.renderHome(snapshot, data, true), /外部改动|核对来源/);
  snapshot.clientConfigurations[0].sources = [];
  assert.match(manager.sourceRows(snapshot), /未配置供应商/);
  snapshot.clientConfigurations[0].state = "unavailable";
  assert.match(manager.sourceRows(snapshot), /配置读取失败/);
  assert.doesNotMatch(manager.sourceRows(snapshot), /未配置供应商|0 个模型/);
  delete snapshot.clientConfigurations;
  assert.match(manager.sourceRows(snapshot), /配置读取失败/);
});

test("copy scopes the exclusive CLI environment projection, manual app boundary and model pickers", () => {
  assert.match(manager.policy("copilot-cli"), /确认后替换 CLI 当前.*环境配置.*首选模型/);
  assert.match(manager.policy("copilot-cli"), /新开终端/);
  assert.equal(manager.policy("github-copilot-app"), "请在 Copilot App 中手动添加供应商。");
  assert.match(manager.policy("jetbrains-copilot"), /保留其他来源.*共享.*重启/);
  const snapshot = fixture(); snapshot.deployments.push({ planId: "p", connectionId: "a", targetKind: "vs-code-copilot", status: "applied", createdAt: "2026-10-12T00:00:00Z" });
  assert.match(manager.lastResult(snapshot, true), /请到客户端的模型选择器中选用刚发布的模型/);
  snapshot.connections = [];
  assert.doesNotMatch(manager.lastResult(snapshot, true), /刚发布的模型/); // Revocation is not publication.
});
test("untrusted strings are escaped and no credential value is requested or rendered", () => {
  const snapshot = fixture(); snapshot.connections[0].name = '<img src=x onerror="bad">';
  snapshot.clientConfigurations[0].sources[0].name = snapshot.connections[0].name;
  snapshot.connections[0].baseUrl = '<script>bad</script>';
  const html = manager.renderHome(snapshot, data, true);
  assert.doesNotMatch(html, /<script>|<img/); assert.match(html, /&lt;img/);
  assert.match(manager.connectionCard(snapshot.connections[0], snapshot, true), /••••••/);
});
test("legacy setup selection ignores disabled connections", () => {
  const snapshot = fixture();
  assert.equal(setup.derive(snapshot, { setup: { preferences: { connectionId: "b" } } }).selected.id, "a");
  snapshot.connections[0].enabled = false;
  assert.equal(setup.derive(snapshot, { setup: { preferences: { connectionId: "b" } } }).selected, undefined);
});
test("preferred order changes only recommendation order, preserving model identity and flags", () => {
  const models = [{ modelId: "a", enabled: true, capabilities: { vision: null } }, { modelId: "off", enabled: false }, { modelId: "b", enabled: true }];
  assert.deepEqual(discovery.preferModels(models, "b").map(model => model.modelId), ["b", "a", "off"]);
  assert.equal(discovery.preferModels(models, "b")[1], models[0]);
  assert.equal(models[0].modelId, "a");
  assert.throws(() => discovery.preferModels(models, "off")); assert.throws(() => discovery.preferModels(models, "missing"));
});
test("connection probe uses bound model-list input and returns a concise catalog status", async () => {
  const snapshot = fixture(), calls = [];
  const result = await discovery.testConnection(async (cmd, args) => { calls.push([cmd, args]); return { status: "available", detail: "UNTRUSTED DETAIL", models: [{ modelId: "PRIVATE_MODEL" }] }; }, snapshot.connections[0]);
  assert.equal(calls[0][0], "discover_connection_models");
  assert.deepEqual(calls[0][1].input, { connectionId: "a", baseUrl: "https://example.invalid/v1", providerKind: undefined, protocol: undefined, headers: {}, apiKey: null, clearSecret: false });
  assert.equal(result.detail, "模型目录可访问。");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_MODEL|UNTRUSTED DETAIL/);
  assert.equal((await discovery.testConnection(async () => { throw Error("PRIVATE_SECRET"); }, snapshot.connections[0])).status, "networkError");
});

test("first connection and publication actions are discoverable without removing recovery precedence", () => {
  const empty = { ...fixture(), connections: [] };
  const html = manager.renderHome(empty, { ...data, setup: { alignment: "partiallyVerified" } }, true);
  assert.match(html, /添加第一个供应商/);
  assert.doesNotMatch(html, /账号尚未对齐|data-action="setup-accounts"/);
  assert.doesNotMatch(manager.renderHome({ ...empty, stateRecovery: 'Read only' }, data, true), /manager-start|添加第一个供应商/);
  assert.ok(manager.renderHome(fixture(), data, true).indexOf('data-action="jump-connections"') < manager.renderHome(fixture(), data, true).indexOf('应用配置状态'));
});

test("client review and manual publication follow-ups carry the exact client and connection", () => {
  const snapshot = fixture();
  assert.match(manager.sourceRows(snapshot), /data-action="route" data-route="clients" data-client-id="vs"/);
  snapshot.deployments.push({ planId: 'p', targetId: 'app', targetKind: 'github-copilot-app', connectionId: 'b', status: 'skipped', createdAt: '2026-10-13T00:00:00Z' });
  assert.match(manager.lastResult(snapshot, true), /data-action="setup-manual" data-id="b"/);
  snapshot.connections = [];
  assert.doesNotMatch(manager.lastResult(snapshot, true), /data-action="setup-manual"/);
});
