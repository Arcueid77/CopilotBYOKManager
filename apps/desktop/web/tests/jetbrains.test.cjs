const { test } = require("node:test");
const assert = require("node:assert/strict");
const { guide } = require("../jetbrains-ui.js");
const setup = require("../setup-ui.js");
const usage = require("../usage-ui.js");
const connection = { id: "c", name: "Example", baseUrl: "https://example.invalid/v1", protocol: "chat-completions", headers: { Authorization: "SENSITIVE-HEADER" }, secretRef: "SENSITIVE-REFERENCE", models: [{ modelId: "allowed-model", name: "Allowed", enabled: true }, { modelId: "disabled-model", name: "Disabled", enabled: false }] };
const target = { id: "jb-idea", kind: "jetbrains-copilot", name: "IntelliJ IDEA 2026.2 · Copilot", detail: "Public plugin metadata, not a verified account", path: "Fixture profile", detected: true, supportsWrite: false, status: "read-only" };

test("JetBrains guide includes real configuration steps but not credentials or completion controls", () => {
  const html = guide(connection, target, { description: "Manual only", changes: ["Enable model: allowed-model"] });
  for (const text of ["Manage Models", "Add Models", "Login to GitHub", "OpenAI-compatible", "example.invalid/v1", "allowed-model", "Password Safe"]) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /SENSITIVE|disabled-model|confirm-manual|apply-deployment|<input/);
  assert.match(guide(null, target), /Add a Connection/);
});
test("untrusted names, endpoints, models and native runbook fields are escaped", () => {
  const html = guide({ ...connection, name: "<script>name</script>", baseUrl: '<img src=x onerror="bad">', models: [{ modelId: "<script>model</script>", enabled: true }] }, { ...target, detail: "<script>plugin</script>", path: '<img src="x">' }, { description: "<script>native</script>", changes: ["<img src=x>"] });
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
});
test("writable JetBrains review exposes real automatic fields without showing secrets", () => {
  const html = guide(connection, { ...target, supportsWrite: true, status: "available" }, { supported: true, description: "Deploy dedicated BYOK namespace", changes: ["Enable model: allowed-model"] });
  assert.match(html, /Automatic BYOK deployment is available/);
  assert.match(html, /byok\.json/);
  assert.match(html, /written once/);
  assert.match(html, /reopen them/);
  assert.match(html, /you do not need to re-enter them in Manage Models/);
  assert.doesNotMatch(html, /Save, enable the desired models/);
  assert.doesNotMatch(html, /SENSITIVE|disabled-model|<input/);
  const data = { setup: { manualConfirmed: true, preferences: { connectionId: "c" }, targets: [{ targetId: "jb-idea", state: "notDeployed" }] } };
  const state = setup.derive({ clients: [{ ...target, supportsWrite: true }], connections: [connection] }, data);
  assert.equal(state.writable.length, 1);
  assert.equal(state.deployed, false);
});
test("app manual confirmation never covers JetBrains, which is optional for core deployment", () => {
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
  assert.match(html, /JetBrains usage: not covered/);
  assert.match(html, /unknown, not zero/);
  assert.doesNotMatch(html, /data-source-id="jetbrains/);
});
