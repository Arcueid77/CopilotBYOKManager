// Optional end-to-end UI check. Runs against an ephemeral HTTP server and a
// fresh headless browser profile. The native API is replaced with in-memory
// fixtures; no installed client's data or configuration is accessed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const { chromium } = require(process.env.PILOTWEAVE_PLAYWRIGHT ?? "playwright");
const webRoot = path.resolve(__dirname, "..");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "pilotweave-ui-"));
const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
const server = http.createServer((req, res) => {
  const name = new URL(req.url, "http://localhost").pathname;
  const target = path.resolve(webRoot, `.${name === "/" ? "/index.html" : name}`);
  if (!target.startsWith(webRoot + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
  res.setHeader("Content-Type", mime[path.extname(target)] ?? "text/plain");
  res.end(fs.readFileSync(target));
});
async function nativeFixture() {
  const now = new Date().toISOString(), day = now.slice(0, 10);
  const connection = { id: "connection", name: "Example provider", baseUrl: "https://example.invalid/v1", providerKind: "openai", protocol: "chat-completions", headers: {}, models: [{ id: "model", modelId: "gpt-5", name: "GPT-5", enabled: true, capabilities: {} }], secretRef: "fixture", hasSecret: true, createdAt: now, updatedAt: now };
  connection.enabled = true;
  const connections = [connection], publications = [], deployments = [];
  let revision = 0, previewRevision = 0, activePlan = false, delayPreview = false, releasePreview;
  window.__delayNextPreview = () => { delayPreview = true; };
  window.__releasePreview = () => releasePreview?.();
  const clients = [
    { id: "vscode", name: "VS Code · Default", kind: "vs-code-copilot", detected: true, supportsWrite: true, status: "available", detail: "Fixture profile", path: "Fixture" },
    { id: "cli", name: "Copilot CLI", kind: "copilot-cli", detected: true, supportsWrite: true, status: "available", detail: "Fixture runtime", path: "Fixture" },
    { id: "app", name: "Copilot app", kind: "github-copilot-app", detected: true, supportsWrite: false, status: "read-only", detail: "Manual configuration", path: "Fixture" },
  ];
  const components = ["vscode", "vscode-copilot-extension", "copilot-cli", "github-copilot-app"].map((id) => ({ id, name: id, status: "ready", version: "fixture", detail: "Isolated UI fixture" }));
  const identity = { login: "fixture", host: "github.com", userId: 1 };
  const accounts = { anchor: { state: "verified", identity, evidence: "Fake anchor", detail: "Fake API identity", observedAt: now }, surfaces: ["vsCodeCopilot", "copilotCli", "githubCopilotApp"].map((surface) => ({ surface, state: "actionRequired", identity: null, evidence: "Manual confirmation needed", detail: "Fixture", observedAt: now })), observedAt: now, loginRuns: [] };
  const setup = { scannedAt: now, target: identity, alignment: "partiallyVerified", evidenceFingerprint: "fixture-evidence", accounts, preferences: { connectionId: connection.id }, targets: clients.map((c) => ({ targetId: c.id, state: c.supportsWrite ? "notDeployed" : "manual", detail: "Fixture" })), manualConfirmed: false };
  const totals = { records: 1, requests: 1, inputReported: 1000, normalizedInput: 1000, freshInput: 200, cacheRead: 800, cacheWrite: 0, output: 40, cacheHitRate: "0.8", cacheCoveredRecords: 1, estimateUsd: "0.00075", pricedRecords: 1, unpricedRecords: 0, unresolvedModels: 0, unknownSemantics: 0, pricedTokens: 1040, unpricedTokens: null, priceSnapshots: ["fixture-price"], pricedRequests: 1, unpricedRequests: null };
  const record = { id: "hashed-record", rawModel: "gpt-5", canonicalModel: "openai/gpt-5", counterKind: "requestDelta", sourceId: "vscode-otel", route: "unknown", confidence: "unknown", inputReported: 1000, output: 40, estimateUsd: "0.00075", priceSnapshotId: "fixture-price", startedAt: now, finishedAt: now, surfaces: ["vs-code-copilot"], quality: [] };
  const sources = ["copilot-session-events", "vscode-otel", "github-copilot-app"].map((id) => ({ id, name: id, enabled: false, status: id === "github-copilot-app" ? "unsupported" : "disabled", detail: "Isolated UI fixture", pathHint: "Fixed fixture inbox", setupPath: id === "vscode-otel" ? "C:\\Fixture\\vscode-otel.jsonl" : null, parser: "fixture-v1", recordCount: 0 }));
  const quota = { latest: { id: "quota", status: "available", detail: "Official RPC fixture", account: "fixture@github.com", fetchedAt: now, runtimeVersion: "0.0.fixture", modelStatus: "available", models: [{ id: "gpt-5", name: "GPT-5", policy: "enabled" }], quotas: [{ key: "premium_interactions", used: "0", entitlement: "300", unlimited: false, remainingPercentage: "100", resetAt: "2026-10-01" }] }, lastSuccessful: null, stale: false };
  const authorization = { state: "verified", identity, hasSecret: true, scopes: [], billingCapability: "unknown", billingDetail: "Fixture", detail: "Fixture", validatedAt: now };
  const billing = { authorization, account: identity, families: [{ endpointFamily: "premiumRequest", latest: { id: "billing", status: "available", periodStart: `${day.slice(0, 7)}-01T00:00:00Z`, periodEnd: "2026-10-01T00:00:00Z", fetchedAt: now, apiVersion: "2026-03-10", coverage: "personalAccountOnly", items: [{ model: "GPT-5", sku: "Copilot Premium Request", quantity: "3.25", unit: "requests", netAmountUsd: "0", grossAmountUsd: "0.125", discountAmountUsd: "0.125" }] } }, { endpointFamily: "aiCredit", latest: { status: "notCovered", error: "Personal endpoint does not cover this plan", fetchedAt: now } }] };
  const catalog = { catalog: { id: "fixture-price", sourceVersion: "fixture", fetchedAt: now, parserVersion: 1, detail: "Public rate comparison fixture", models: [{ model: "openai/gpt-5", supported: true, tiers: [{ minInput: 0, input: "1.25", output: "10", cacheRead: "0.125", cacheWrite: null }] }] }, latest: { status: "available", finishedAt: now, detail: "Fixture catalog" }, stale: false };
  let deploymentRecovery = null;
  let recoveryIssue = {}, recoveryPlan = null;
  let reviewedTargets = [];
  window.__addJetBrains = () => {
    for (const [id, name, detected] of [["jb-idea", "IntelliJ IDEA 2026.2 · Copilot", true], ["jb-pycharm", "PyCharm 2026.2 · Copilot", true], ["jb-disabled", "WebStorm 2026.2 · Copilot", false]]) {
      clients.push({ id, name, kind: "jetbrains-copilot", detected, supportsWrite: false, status: "read-only", detail: detected ? "Plugin metadata only; manual BYOK" : "Plugin disabled; enable it in this IDE", path: "Fixture profile" });
      setup.targets.push({ targetId: id, state: "manual", detail: "JetBrains not configured or verified" });
    }
    accounts.surfaces.push({ surface: "jetBrainsCopilot", state: "actionRequired", identity: null, evidence: "Public metadata only", detail: "Check IntelliJ IDEA and PyCharm separately", observedAt: now });
    setup.alignment = "partiallyVerified";
  };
  window.__enableAutomaticJetBrains = () => {
    clients.filter(c => c.kind === "jetbrains-copilot" && c.detected).forEach(c => {
      c.supportsWrite = true; c.status = "available"; c.detail = "Reviewed 1.19 schema · shared BYOK file · restart IDEs after deployment";
      setup.targets.find(t => t.targetId === c.id).state = "notDeployed";
    });
  };
  window.__setRecovery = (issue = {}) => { deploymentRecovery = "An interrupted deployment needs review"; recoveryIssue = issue; };
  window.__calls = [];
  window.__TAURI__ = { core: { invoke: async (cmd, args = {}) => {
    window.__calls.push({ cmd, args });
    if (cmd === "get_dashboard") return structuredClone({ version: 2, connections, clients, deployments, publishedSources: publications, stateRecovery: null, deploymentRecovery, statePath: "Fixture only", usageDb: { state: "available", schemaVersion: 2 } });
    if (cmd === "get_install_runs") return [];
    if (cmd === "get_resources") return { resources: [], bindings: [], detail: "Fixture" };
    if (cmd === "set_connection_enabled") { const saved = connections.find(c => c.id === args.connectionId); assertNative(saved && typeof args.enabled === "boolean"); saved.enabled = args.enabled; revision++; return structuredClone(saved); }
    if (cmd === "upsert_connection") {
      const input = args.input, saved = connections.find(c => c.id === input.id);
      const value = { id: input.id || crypto.randomUUID(), name: input.name, baseUrl: input.baseUrl, providerKind: input.providerKind, protocol: input.protocol, headers: input.headers, models: input.models, enabled: saved?.enabled !== false, hasSecret: input.clearSecret ? false : Boolean(input.apiKey) || Boolean(saved?.hasSecret), secretRef: "fixture-only", createdAt: saved?.createdAt ?? now, updatedAt: new Date().toISOString() };
      if (saved) Object.assign(saved, value); else connections.push(value);
      revision++; return structuredClone(value);
    }
    if (cmd === "discover_connection_models") return { status: "available", detail: "Fixture catalog, not inference", models: [{ modelId: "gpt-5", name: "GPT-5" }, { modelId: "fixture-new", name: "New model" }, { modelId: "fixture-unselected", name: "Do not auto-add" }], parserVersion: 1 };
    if (cmd === "get_installation_status") return components;
    if (cmd === "get_setup_status") return structuredClone(setup);
    if (cmd === "get_github_authorization_status") return authorization;
    if (cmd === "get_usage_sources") return structuredClone(sources);
    if (cmd === "get_usage_runs") return [];
    if (cmd === "get_official_runtime_usage") return quota;
    if (cmd === "get_github_billing") return billing;
    if (cmd === "get_price_catalog") return catalog;
    if (cmd === "get_usage_overview") return { start: args.query.start, end: args.query.end, status: "partial", totals, records: [record], totalRecords: 1, coverageStart: now, coverageEnd: now, lastImported: now, models: [{ ...record, totals }], days: [{ key: day, totals }], routes: [], surfaces: [], providers: [] };
    if (cmd === "confirm_account_alignment") { assertNative(args.confirmed && args.evidenceFingerprint === "fixture-evidence"); setup.alignment = "userConfirmedSameAccount"; setup.preferences.accountConfirmation = { confirmedAt: now }; return; }
    if (cmd === "confirm_manual_provider") { setup.manualConfirmed = true; return; }
    if (cmd === "set_usage_source_enabled") { const source = sources.find((s) => s.id === args.sourceId); source.enabled = args.enabled; source.status = args.enabled ? "missing" : "disabled"; return; }
    if (cmd === "clear_local_usage") { assertNative(args.confirmed); sources.find((s) => s.id === args.sourceId).enabled = false; return; }
    if (cmd === "sync_local_usage" || cmd === "cancel_usage_sync") return [];
    if (["refresh_official_runtime_usage", "refresh_price_catalog", "refresh_personal_github_usage"].includes(cmd)) return null;
    if (cmd === "preview_deployment_recovery") { assertNative(["restore", "keepCurrent"].includes(args.action)); recoveryPlan = { id: `reviewed-recovery-${args.action}`, action: args.action, view: { resourceCount: 2, conflictCount: 0, unknownResourceCount: 0, unreadableResourceCount: 0, committed: false, ...recoveryIssue } }; return structuredClone(recoveryPlan); }
    if (cmd === "apply_deployment_recovery") { assertNative(recoveryPlan && args.planId === recoveryPlan.id && args.confirmed && Object.keys(args).length === 2); recoveryPlan = null; deploymentRecovery = null; return true; }
    if (cmd === "get_jetbrains_setup_guide") { assertNative(args.connectionId === connection.id && args.targetId.startsWith("jb-") && Object.keys(args).length === 2); const supported = clients.find(c => c.id === args.targetId).supportsWrite; return { targetId: args.targetId, targetKind: "jetbrains-copilot", title: "JetBrains BYOK review", description: supported ? "Automatic shared byok.json projection" : "Manage Models > Add Models", supported, requiresRestart: supported, changes: ["Endpoint: https://example.invalid/v1", "Enable model: gpt-5"] }; }
    if (cmd === "preview_login") return { id: "jb-login-guide", requestedSurfaces: args.surfaces, targetIdentity: identity, expiresAt: now, operations: [{ surface: "jetBrainsCopilot", title: "JetBrains sign-in guide", supported: false, description: "Tools > GitHub Copilot > Login to GitHub. Check IntelliJ IDEA and PyCharm separately." }] };
    if (cmd === "preview_deployment") {
      const selected = connections.find(c => c.id === args.connectionId); assertNative(selected.enabled);
      reviewedTargets = [...args.targetIds]; previewRevision = revision; activePlan = true;
      window.__planConnection = selected.id;
      if (delayPreview) { delayPreview = false; await new Promise(resolve => { releasePreview = resolve; }); releasePreview = null; }
      return { id: "reviewed-plan", connectionId: selected.id, operations: args.targetIds.map(id => ({ targetId: id, targetKind: clients.find(c => c.id === id).kind, title: id, description: "Fixture operation", supported: clients.find(c => c.id === id).supportsWrite, requiresRestart: id.startsWith("jb-"), changes: ["Fixture change"] })) };
    }
    if (cmd === "apply_deployment_plan") {
      assertNative(activePlan && previewRevision === revision && args.planId === "reviewed-plan" && args.confirmed === true && Object.keys(args).length === 2); activePlan = false;
      const selected = connections.find(c => c.id === window.__planConnection), planId = `fixture-${deployments.length}`;
      const records = reviewedTargets.map(id => ({ planId, connectionId: selected.id, targetId: id, targetKind: clients.find(c => c.id === id).kind, status: clients.find(c => c.id === id).supportsWrite ? "applied" : "skipped", createdAt: new Date().toISOString(), detail: "Fixture publication, not live consumption" }));
      setup.targets.forEach(t => { if (reviewedTargets.includes(t.targetId) && clients.find(c => c.id === t.targetId).supportsWrite) t.state = "inSync"; });
      for (const record of records.filter(record => record.status === "applied")) {
        for (let i = publications.length - 1; i >= 0; i--) if (publications[i].targetId === record.targetId && (record.targetKind === "copilot-cli" || publications[i].connectionId === selected.id)) publications.splice(i, 1);
        publications.push({ targetId: record.targetId, connectionId: selected.id, state: "published", modelCount: record.targetKind === "copilot-cli" ? 1 : selected.models.filter(m => m.enabled).length, publishedAt: record.createdAt });
      }
      deployments.unshift(...records); reviewedTargets = []; return { records };
    }
    throw Error(`Unmocked command: ${cmd}`);
  } }, event: { listen: async () => () => {} } };
  function assertNative(condition) { if (!condition) throw Error("Incorrect native command arguments"); }
}
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PILOTWEAVE_BROWSER });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    page.on("pageerror", (err) => errors.push(String(err)));
    const url = `http://127.0.0.1:${server.address().port}/`;
    await page.goto(url); await page.locator(".manager-health").waitFor();
    assert.ok((await page.locator(".preview-banner").textContent()).includes("发布仅为模拟"));
    await page.screenshot({ path: path.join(output, "home-preview.png"), fullPage: true });
    for (const route of ["usage", "connections", "clients", "resources", "activity", "settings", "about"]) {
      if (["resources", "activity", "settings", "about"].includes(route)) await page.locator(".more-nav").evaluate((e) => { e.open = true; });
      await page.locator(`#primary-nav [data-route="${route}"]`).click();
      await page.locator(`#content[data-route="${route}"]`).waitFor();
      assert.ok(await page.locator(".preview-banner").count());
    }
    await page.close();
    const native = await browser.newPage({ viewport: { width: 1440, height: 1100 } }); native.on("pageerror", (err) => errors.push(String(err)));
    await native.addInitScript(nativeFixture); await native.goto(url);
    await native.getByRole("button", { name: "核对账号", exact: true }).waitFor();
    await native.getByRole("button", { name: "核对账号", exact: true }).click(); await native.locator("#confirm-all-accounts").check(); await native.locator("#save-account-confirmation").click();
    await native.locator('[data-action="deploy-connection"][data-id="connection"]').click();
    assert.equal(await native.locator("#modal-root #deployment-preview").count(), 0);
    assert.equal(await native.locator("#apply-deployment").isDisabled(), true);
    assert.equal(await native.locator('input[name="deployment-target"]:checked').count(), 2);
    await native.locator("#preview-deployment").click(); await native.locator("#apply-deployment").click();
    await native.locator('.manager-client-row[data-client-id="vscode"] .manager-source').waitFor();
    await native.locator('#primary-nav [data-route="clients"]').click(); await native.locator('[data-action="setup-manual"]').click(); await native.locator("#confirm-manual").click();
    await native.locator('#primary-nav [data-route="overview"]').click(); await native.locator(".manager-health").waitFor(); await native.screenshot({ path: path.join(output, "home-ready-fixture.png"), fullPage: true });
    await native.locator('#primary-nav [data-route="usage"]').click();
    await native.locator('[data-usage-action="runtime"]').click(); await native.locator('[data-usage-action="billing"]').click();
    await native.screenshot({ path: path.join(output, "usage-official-fixture.png"), fullPage: true });
    await native.locator('[data-usage-tab="models"]').click(); assert.ok(await native.getByText("gpt-5", { exact: true }).count());
    await native.screenshot({ path: path.join(output, "usage-models-fixture.png"), fullPage: true });
    await native.locator('[data-usage-tab="sessions"]').click(); await native.locator('[data-usage-action="record"]').click(); assert.ok((await native.locator(".usage-code").textContent()).includes("hashed-record")); await native.locator(".modal-footer [data-modal-close]").click();
    await native.locator('[data-usage-tab="sources"]').click();
    await native.locator('[data-usage-action="enable-source"][data-source-id="vscode-otel"]').click(); assert.ok((await native.locator(".usage-code").textContent()).includes("captureContent")); await native.locator("#usage-confirm").click();
    await native.locator('[data-usage-action="disable-source"][data-source-id="vscode-otel"]').waitFor(); await native.locator('[data-usage-action="sync"]').click(); await native.locator('[data-usage-action="prices"]').click();
    await native.screenshot({ path: path.join(output, "usage-sources-fixture.png"), fullPage: true });
    await native.locator('[data-usage-action="clear-source"][data-source-id="vscode-otel"]').click(); await native.locator("#usage-confirm").click();
    await native.locator('#usage-filters [name="model"]').fill("gpt-5"); await native.locator('#usage-filters button[type="submit"]').click();
    await native.waitForFunction(() => window.__calls.some((c) => c.cmd === "get_usage_overview" && c.args.query.model === "gpt-5"));
    await native.evaluate(() => window.__setRecovery());
    await native.locator('#primary-nav [data-route="overview"]').click(); await native.locator('#refresh-button').click();
    await native.locator('[data-action="preview-recovery"]').click();
    assert.equal(await native.locator('#apply-recovery').isDisabled(), true);
    await native.locator('#confirm-recovery').check(); await native.locator('#apply-recovery').click();
    await native.locator(".manager-health").waitFor();
    for (const issue of [{ conflictCount: 1 }, { unknownResourceCount: 1 }]) {
      await native.evaluate((value) => window.__setRecovery(value), issue);
      await native.locator('#refresh-button').click();
      await native.locator('[data-action="preview-recovery"]').click();
      assert.equal(await native.locator('#apply-recovery').isDisabled(), true);
      assert.equal(await native.locator('#confirm-recovery').isDisabled(), true);
      await native.locator('#review-keep-current').click();
      await native.getByText("Review keeping current files", { exact: true }).waitFor();
      assert.equal(await native.locator('#apply-recovery').isDisabled(), true);
      assert.equal(await native.locator('#confirm-recovery').isChecked(), false);
      await native.locator('#confirm-recovery').check(); await native.locator('#apply-recovery').click();
      await native.locator(".manager-health").waitFor();
      const calls = await native.evaluate(() => window.__calls.filter((c) => c.cmd === "preview_deployment_recovery").slice(-2));
      assert.deepEqual(calls.map((c) => c.args.action), ["restore", "keepCurrent"]);
    }
    await native.evaluate(() => window.__addJetBrains()); await native.locator('#refresh-button').click();
    await native.getByRole("button", { name: "核对账号", exact: true }).waitFor();
    await native.getByRole("button", { name: "核对账号", exact: true }).click();
    await native.getByText(/包括每个检测到的 JetBrains IDE 配置/).waitFor();
    await native.locator("#confirm-all-accounts").check(); await native.locator("#save-account-confirmation").click();
    await native.locator(".manager-health").waitFor();
    const writesBefore = await native.evaluate(() => window.__calls.filter(c => c.cmd === "apply_deployment_plan").length);
    await native.locator('#primary-nav [data-route="clients"]').click();
    await native.locator('[data-action="jetbrains-guide"][data-id="jb-idea"]').click();
    await native.getByText("JetBrains BYOK · IntelliJ IDEA 2026.2 · Copilot", { exact: true }).waitFor();
    assert.ok((await native.locator("#modal-root").textContent()).includes("https://example.invalid/v1"));
    assert.equal(await native.locator("#modal-root input").count(), 0);
    assert.equal(await native.locator("#modal-root #confirm-manual").count(), 0);
    await native.screenshot({ path: path.join(output, "jetbrains-guide-fixture.png"), fullPage: true });
    await native.locator(".modal-footer [data-modal-close]").click();
    assert.equal(await native.evaluate(() => window.__calls.filter(c => c.cmd === "apply_deployment_plan").length), writesBefore);
    await native.locator('#account-panel').evaluate(e => { e.parentElement.open = true; });
    await native.locator('[data-account-action="preview"]').click();
    await native.getByText("Manual instructions", { exact: true }).waitFor();
    assert.equal(await native.locator('[data-account-confirm]').isDisabled(), true);
    await native.locator('.modal-footer [data-account-modal-close]').click();
    await native.locator('#primary-nav [data-route="overview"]').click();
    await native.locator('[data-action="deploy-connection"][data-id="connection"]').click();
    for (const id of ["vscode", "cli"]) await native.locator(`#target-${id}`).uncheck();
    await native.locator('#target-jb-idea').check(); await native.locator('#preview-deployment').click();
    assert.equal(await native.locator('#apply-deployment').isDisabled(), true);
    await native.locator('#target-cli').check(); assert.equal(await native.locator('#apply-deployment').isDisabled(), true);
    await native.locator('[data-deployment-close]').click();
    assert.equal(await native.locator('.manager-client-row').count(), 6);
    await native.screenshot({ path: path.join(output, "home-jetbrains-fixture.png"), fullPage: true });
    await native.evaluate(() => window.__enableAutomaticJetBrains()); await native.locator('#refresh-button').click();
    await native.locator('#primary-nav [data-route="clients"]').click();
    await native.locator('[data-action="jetbrains-guide"][data-id="jb-idea"]').click();
    await native.getByText("Automatic BYOK deployment is available.", { exact: true }).waitFor();
    await native.screenshot({ path: path.join(output, "jetbrains-automatic-fixture.png"), fullPage: true });
    await native.locator('#jetbrains-preview-deployment').click();
    assert.equal(await native.locator('input[name="deployment-target"]:checked').count(), 1);
    assert.equal(await native.locator('#target-jb-idea').isChecked(), true);
    const automaticWritesBefore = await native.evaluate(() => window.__calls.filter(c => c.cmd === "apply_deployment_plan").length);
    await native.locator('#preview-deployment').click();
    assert.equal(await native.evaluate(() => window.__calls.filter(c => c.cmd === "apply_deployment_plan").length), automaticWritesBefore);
    assert.equal(await native.locator('#preview-deployment').isDisabled(), false);
    assert.deepEqual(await native.evaluate(() => window.__calls.filter(c => c.cmd === "preview_deployment").at(-1).args.targetIds), ["jb-idea"]);
    await native.locator('#apply-deployment').click();
    await native.waitForFunction((count) => window.__calls.filter(c => c.cmd === "apply_deployment_plan").length === count + 1, automaticWritesBefore);
    const automaticApply = await native.evaluate(() => window.__calls.filter(c => c.cmd === "apply_deployment_plan").at(-1).args);
    assert.deepEqual(automaticApply, { planId: "reviewed-plan", confirmed: true });
    await native.locator('#primary-nav [data-route="usage"]').click(); await native.getByText(/JetBrains usage: not covered/).waitFor();
    // New manager flows: toggle is local eligibility, source counts remain tied
    // to the last observed publication, and editing never silently publishes.
    await native.locator('#primary-nav [data-route="connections"]').click();
    await native.locator('[data-action="toggle-connection"][data-id="connection"]').click();
    await native.waitForFunction(() => document.querySelector('[data-action="toggle-connection"][data-id="connection"]')?.getAttribute('aria-checked') === 'false');
    await native.locator('#primary-nav [data-route="overview"]').click();
    assert.equal(await native.locator('[data-connection-id="connection"]').count(), 0);
    assert.ok((await native.locator('.manager-client-row[data-client-id="vscode"]').textContent()).includes('已停用，配置保留'));
    await native.locator('#primary-nav [data-route="connections"]').click();
    await native.locator('[data-action="test-connection"][data-id="connection"]').click();
    await native.getByText(/不代表已验证推理能力/).waitFor();
    const probe = await native.evaluate(() => window.__calls.filter(c => c.cmd === 'discover_connection_models').at(-1).args.input);
    assert.equal(probe.apiKey, null); assert.equal(probe.connectionId, 'connection');
    await native.locator('[data-action="edit-connection"][data-id="connection"]').click();
    assert.equal(await native.locator('#api-key').inputValue(), '');
    assert.equal(await native.locator('#api-key').getAttribute('type'), 'password');
    await native.locator('#api-key').fill('synthetic-editor-key');
    await native.locator('[data-model-fetch]').click();
    await native.locator('[data-model-list] input:not(:disabled)').first().waitFor();
    assert.equal(await native.locator('[data-model-list] input:checked:not(:disabled)').count(), 0);
    await native.locator('[data-model-list] label').filter({ hasText: 'New model' }).locator('input').check();
    await native.locator('[data-model-add]').click();
    assert.ok((await native.locator('#models').inputValue()).includes('fixture-new'));
    assert.equal((await native.locator('#models').inputValue()).includes('fixture-unselected'), false);
    await native.locator('#preferred-model').selectOption('fixture-new');
    await native.locator('#save-connection').click();
    await native.waitForFunction(() => !document.querySelector('#connection-form'));
    const saved = await native.evaluate(() => window.__calls.filter(c => c.cmd === 'upsert_connection').at(-1).args.input);
    assert.equal(saved.models[0].modelId, 'fixture-new'); assert.equal(saved.models.length, 2);
    assert.equal(await native.locator('[data-action="toggle-connection"][data-id="connection"]').getAttribute('aria-checked'), 'false');
    await native.locator('[data-action="edit-connection"][data-id="connection"]').click();
    assert.equal(await native.locator('#api-key').inputValue(), '');
    await native.locator('.modal-footer [data-modal-close]').click();
    await native.locator('[data-action="toggle-connection"][data-id="connection"]').click();
    await native.waitForFunction(() => document.querySelector('[data-action="toggle-connection"][data-id="connection"]')?.getAttribute('aria-checked') === 'true');
    await native.locator('#primary-nav [data-route="overview"]').click();
    assert.ok((await native.locator('.manager-client-row[data-client-id="vscode"]').textContent()).includes('1 个模型'));
    const applies = await native.evaluate(() => window.__calls.filter(c => c.cmd === 'apply_deployment_plan').length);
    await native.locator('[data-action="deploy-connection"][data-id="connection"]').click();
    await native.locator('#preview-deployment').click();
    await native.waitForFunction(() => document.querySelector('#apply-deployment')?.disabled === false);
    await native.locator('#target-cli').uncheck();
    assert.equal(await native.locator('#apply-deployment').isDisabled(), true);
    await native.locator('#preview-deployment').click();
    await native.waitForFunction(() => document.querySelector('#apply-deployment')?.disabled === false);
    await native.locator('#refresh-button').click();
    await native.locator('.manager-health').waitFor();
    assert.equal(await native.locator('#inline-deployment').count(), 0);
    await native.locator('[data-action="deploy-connection"][data-id="connection"]').click();
    await native.evaluate(() => window.__delayNextPreview());
    await native.locator('#preview-deployment').click();
    await native.waitForFunction(() => document.querySelector('#preview-deployment')?.disabled === true);
    await native.locator('#target-cli').uncheck(); await native.evaluate(() => window.__releasePreview());
    await native.waitForFunction(() => document.querySelector('#preview-deployment')?.disabled === false);
    assert.equal(await native.locator('#apply-deployment').isDisabled(), true);
    await native.evaluate(() => window.__delayNextPreview()); await native.locator('#preview-deployment').click();
    await native.waitForFunction(() => document.querySelector('#preview-deployment')?.disabled === true);
    await native.locator('#primary-nav [data-route="clients"]').click(); await native.evaluate(() => window.__releasePreview());
    assert.equal(await native.locator('#inline-deployment').count(), 0);
    assert.equal(await native.evaluate(() => window.__calls.filter(c => c.cmd === 'apply_deployment_plan').length), applies);
    // Full browser fallback flow: supplier coexistence on VS Code, one legacy
    // CLI route, and no persistence of the typed key.
    const trial = await browser.newPage({ viewport: { width: 1200, height: 850 } });
    trial.on('pageerror', err => errors.push(String(err)));
    await trial.goto(url); await trial.locator('.manager-health').waitFor();
    await trial.locator('[data-action="deploy-connection"]').click();
    await trial.locator('#preview-deployment').click(); await trial.locator('#apply-deployment').click();
    await trial.locator('.manager-source').first().waitFor();
    await trial.locator('[data-action="add-connection"]').click();
    await trial.locator('#connection-name').fill('Second supplier'); await trial.locator('#base-url').fill('https://example.invalid/v1');
    await trial.locator('#api-key').fill('synthetic-preview-key'); await trial.locator('#models').fill('second-model | Second model');
    await trial.locator('#save-connection').click();
    await trial.locator('[data-connection-id]').filter({ hasText: 'Second supplier' }).waitFor();
    await trial.locator('[data-connection-id]').filter({ hasText: 'Second supplier' }).locator('[data-action="deploy-connection"]').click();
    await trial.locator('#preview-deployment').click(); await trial.locator('#apply-deployment').click();
    await trial.waitForFunction(() => document.querySelectorAll('.manager-client-row[data-client-id="vscode:stable:default"] .manager-source').length === 2);
    assert.equal(await trial.locator('.manager-client-row[data-client-id="copilot-cli:user-environment"] .manager-source').count(), 1);
    const disposable = await trial.evaluate(() => sessionStorage.getItem('pilotweave-demo'));
    assert.equal(disposable.includes('synthetic-preview-key'), false);
    assert.equal(await trial.locator('#modal-root #deployment-preview').count(), 0);
    await trial.screenshot({ path: path.join(output, 'manager-coexistence-preview.png'), fullPage: true });
    for (const width of [1200, 920, 600]) {
      await trial.setViewportSize({ width, height: 850 });
      assert.equal(await trial.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Home overflow at ${width}`);
    }
    await trial.close();
    assert.equal(await native.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []); console.log(JSON.stringify({ status: "passed", scenarios: ["preview routes", "account confirmation", "reviewed deployment", "manual provider", "quota and Billing", "models and details", "source consent/import/clear", "price refresh", "filters", "reviewed recovery", "external conflict retention", "missing target retention", "JetBrains per-IDE account confirmation", "JetBrains native guide without writes", "JetBrains manual sign-in", "manual-only apply disabled", "independent app/JetBrains status", "JetBrains coverage unavailable", "automatic JetBrains BYOK native review", "single selected IDE preview before apply", "JetBrains apply submits only reviewed plan ID"], output }));
  } finally { await browser.close(); server.close(); }
})().catch((err) => { console.error(err); server.close(); process.exitCode = 1; });
