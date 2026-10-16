// Optional end-to-end UI check. Runs against an ephemeral HTTP server and a
// fresh headless browser profile. The native API is replaced with in-memory
// fixtures; no installed client's data or configuration is accessed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const { chromium } = require(process.env.COPILOT_BYOK_MANAGER_PLAYWRIGHT ?? "playwright");
const webRoot = path.resolve(__dirname, "..");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "copilot-byok-manager-ui-"));
const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
const server = http.createServer((req, res) => {
  const name = new URL(req.url, "http://localhost").pathname;
  const target = path.resolve(webRoot, `.${name === "/" ? "/index.html" : name}`);
  if (!target.startsWith(webRoot + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
  res.setHeader("Content-Type", mime[path.extname(target)] ?? "text/plain");
  res.end(fs.readFileSync(target));
});
async function assertReadable(page, selectors) {
  for (const selector of selectors) {
    const ratios = await page.locator(selector).evaluateAll((elements) => {
      const rgba = (color) => {
        const values = color.match(/[\d.]+/g).map(Number);
        return [values[0], values[1], values[2], values[3] ?? 1];
      };
      const paint = (top, bottom) => top.slice(0, 3).map((channel, i) => channel * top[3] + bottom[i] * (1 - top[3]));
      const luminance = (rgb) => rgb.map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
      return elements.map((element) => {
        const layers = [];
        for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) layers.push(rgba(getComputedStyle(ancestor).backgroundColor));
        const background = layers.reverse().reduce((color, layer) => paint(layer, color), [255, 255, 255]);
        const foreground = paint(rgba(getComputedStyle(element).color), background);
        const [low, high] = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
        return { ratio: (high + .05) / (low + .05), theme: document.documentElement.dataset.theme, text: element.textContent.trim().slice(0, 40), color: getComputedStyle(element).color, background };
      });
    });
    assert.ok(ratios.length, `Missing contrast target: ${selector}`);
    for (const value of ratios) assert.ok(value.ratio >= 4.5, `Low text contrast for ${selector}: ${JSON.stringify(value)}`);
  }
}
async function nativeFixture() {
  const now = new Date().toISOString(), day = now.slice(0, 10);
  const connection = { id: "connection", name: "Example provider", baseUrl: "https://example.invalid/v1", providerKind: "openai", protocol: "chat-completions", headers: {}, models: [{ id: "model", modelId: "gpt-5", name: "GPT-5", enabled: true, capabilities: {} }], secretRef: "fixture", hasSecret: true, createdAt: now, updatedAt: now };
  connection.enabled = true;
  const connections = [connection], publications = [], deployments = [];
  const resources = [], delayed = new Map();
  let catalogStatus = "available";
  window.__setCatalogStatus = status => { catalogStatus = status; };
  let resourcePlan = null;
  window.__delayCommand = cmd => delayed.set(cmd, {});
  window.__releaseCommand = (cmd, fail = false) => { const pending = delayed.get(cmd); delayed.delete(cmd); if (fail) pending.reject?.(Error("Synthetic isolated operation failure")); else pending.resolve?.(); };
  window.__emptyConnections = () => { connections.splice(0); publications.splice(0); };
  window.__addSecondConnection = () => connections.push({ ...structuredClone(connection), id: "connection-b", name: "Second provider", baseUrl: "https://second.invalid/v1", models: [{ id: "b-model", modelId: "b-model", name: "B model", enabled: true, capabilities: {} }] });
  window.__addDisabledModel = () => connection.models.push({ id: "disabled-id", modelId: "disabled-model", name: "Disabled model", enabled: false, capabilities: { vision: true } });
  window.__addResource = () => resources.push({ id: "fixture-resource", name: "Fixture instructions", kind: "instructions", body: "Synthetic test instructions only.", updatedAt: now });
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
  let stateRecovery = null;
  const windowBehavior = { closeToTray: true, trayAvailable: true, closeAction: "tray", preferencesAvailable: true };
  window.__setWindowBehavior = value => Object.assign(windowBehavior, value);
  window.__setStateRecovery = () => { stateRecovery = "Synthetic invalid state"; };
  window.__calls = [];
  window.__TAURI__ = { core: { invoke: async (cmd, args = {}) => {
    window.__calls.push({ cmd, args });
    const pending = delayed.get(cmd);
    if (pending) await new Promise((resolve, reject) => { pending.resolve = resolve; pending.reject = reject; });
    if (cmd === "get_dashboard") return structuredClone({ version: 2, connections, clients, deployments, publishedSources: publications, stateRecovery, deploymentRecovery, statePath: "Fixture only", usageDb: { state: "available", schemaVersion: 2 } });
    if (cmd === "get_install_runs") return [];
    if (cmd === "get_window_behavior") return structuredClone(windowBehavior);
    if (cmd === "set_close_action") {
      assertNative(["tray", "exit"].includes(args.action) && Object.keys(args).length === 1);
      windowBehavior.closeAction = args.action;
      windowBehavior.closeToTray = windowBehavior.trayAvailable && args.action === "tray";
      return structuredClone(windowBehavior);
    }
    if (cmd === "set_tray_locale") {
      assertNative(["en", "zh-CN"].includes(args.locale) && Object.keys(args).length === 1);
      window.__trayLocale = args.locale; return;
    }
    if (cmd === "get_resources") return structuredClone({ resources, bindings: [], detail: "Fixture" });
    if (cmd === "preview_resource_sync") { resourcePlan = "fixture-resource-plan"; return { id: resourcePlan, expiresAt: new Date(Date.now() + 15 * 60000).toISOString(), operations: [{ title: "VS Code fixture", change: "create", destination: "Fixture", detail: "Synthetic owned content only" }] }; }
    if (cmd === "apply_resource_plan") { assertNative(args.planId === resourcePlan && args.confirmed === true && Object.keys(args).length === 2); resourcePlan = null; return; }
    if (cmd === "plugin:opener|open_url") { assertNative(args.url.startsWith("https://github.com/Arcueid77/CopilotBYOKManager") && args.with === null); return; }
    if (cmd === "set_connection_enabled") { const saved = connections.find(c => c.id === args.connectionId); assertNative(saved && typeof args.enabled === "boolean"); saved.enabled = args.enabled; revision++; return structuredClone(saved); }
    if (cmd === "upsert_connection") {
      const input = args.input, saved = connections.find(c => c.id === input.id);
      const value = { id: input.id || crypto.randomUUID(), name: input.name, baseUrl: input.baseUrl, providerKind: input.providerKind, protocol: input.protocol, headers: input.headers, models: input.models, enabled: saved?.enabled !== false, hasSecret: input.clearSecret ? false : Boolean(input.apiKey) || Boolean(saved?.hasSecret), secretRef: "fixture-only", createdAt: saved?.createdAt ?? now, updatedAt: new Date().toISOString() };
      if (saved) Object.assign(saved, value); else connections.push(value);
      revision++; return structuredClone(value);
    }
    if (cmd === "discover_connection_models") return { status: catalogStatus, detail: "Untrusted fixture catalog detail", models: [{ modelId: "gpt-5", name: "GPT-5" }, { modelId: "fixture-new", name: "New model" }, { modelId: "fixture-unselected", name: "Do not auto-add" }], parserVersion: 1 };
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
      const records = reviewedTargets.map(id => ({ planId, connectionId: selected.id, targetId: id, targetKind: clients.find(c => c.id === id).kind, status: clients.find(c => c.id === id).supportsWrite ? "applied" : "skipped", createdAt: new Date().toISOString(), detail: "Fixture publication" }));
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

const routes = ["overview", "connections", "clients", "about"];
const hiddenCommands = /usage|billing|quota|price|resource|github_authorization|authorize_github/;
async function fixturePage(browser, url, errors, locale = "en-US", width = 1180) {
  const page = await browser.newPage({ locale, viewport: { width, height: width === 960 ? 640 : 760 }, colorScheme: "light" });
  page.on("pageerror", error => errors.push(String(error)));
  await page.addInitScript(nativeFixture);
  await page.goto(url); await page.locator(".manager-health").waitFor();
  return page;
}
async function route(page, name) {
  await page.locator('#primary-nav [data-route="' + name + '"]').click();
  await page.locator('#content[data-route="' + name + '"]').waitFor();
}
async function checkShell(browser, url, errors) {
  for (const [locale, expected] of [["en-US", ["Overview", "Providers", "Apps", "About"]], ["zh-CN", ["总览", "供应商", "应用", "关于"]]]) {
    const page = await fixturePage(browser, url, errors, locale, 960);
    assert.deepEqual((await page.locator("#primary-nav .nav-item").allTextContents()).map(text => text.trim()), expected);
    assert.equal(await page.locator(".more-nav").count(), 0);
    for (const theme of ["light", "dark"]) {
      await page.locator("#interface-theme").selectOption(theme);
      for (const name of routes) {
        await route(page, name);
        assert.equal(await page.locator("#page-title").textContent(), expected[routes.indexOf(name)]);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
        assert.equal(await page.locator('[data-appearance-select]').first().inputValue(), theme);
        await assertReadable(page, ["#primary-nav .nav-item", "#page-subtitle", ".manager-meta"]);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal page overflow");
        await page.screenshot({ path: path.join(output, name + "-" + theme + "-" + locale + "-960.png"), fullPage: true });
      }
    }
    assert.equal(await page.evaluate(() => window.__calls.some(call => /usage|billing|quota|price|resource|github_authorization|authorize_github/.test(call.cmd))), false);
    const calls = await page.evaluate(() => window.__calls.length);
    await page.evaluate(() => {
      const button = document.createElement("button"); button.dataset.route = "usage";
      document.querySelector("#primary-nav").append(button); button.click(); button.remove();
    });
    assert.equal(await page.locator("#content").getAttribute("data-route"), "about");
    assert.equal(await page.evaluate(() => window.__calls.length), calls);
    await page.locator("#interface-theme").selectOption("light");
    await page.locator('#content [data-appearance-select]').selectOption("dark");
    assert.equal(await page.locator("#interface-theme").inputValue(), "dark");
    assert.equal(await page.evaluate(() => window.__calls.length), calls, "Appearance is CSS-only");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.locator("#interface-theme").selectOption("system");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");
    await page.locator("#interface-theme").selectOption("dark");
    await page.locator("#interface-language").selectOption(locale === "en-US" ? "zh-CN" : "en");
    assert.equal(await page.locator("#interface-theme").inputValue(), "dark");
    await page.waitForFunction(() => window.__trayLocale === document.querySelector('#interface-language').value);
    assert.equal(await page.evaluate(start => window.__calls.slice(start).every(call => call.cmd === "set_tray_locale"), calls), true, "Language only updates native menu labels, never persisted settings or client operations");
    await page.reload(); await page.locator(".manager-health").waitFor();
    assert.equal(await page.locator("#interface-theme").inputValue(), "dark");
    assert.equal(await page.locator("#interface-language").inputValue(), locale === "en-US" ? "zh-CN" : "en");
    await route(page, "about");
    const beforePlan = await page.evaluate(() => window.__calls.length);
    await page.locator('[data-action="view-planned-features"]').click();
    assert.ok(await page.locator('.modal-body .manager-result-targets li').count() >= 6);
    assert.equal(await page.evaluate(() => window.__calls.length), beforePlan, "Planning record is available offline");
    await page.locator('.modal-footer [data-modal-close]').click();
    await page.close();
  }
}
async function checkEditor(browser, url, errors) {
  const page = await fixturePage(browser, url, errors);
  await route(page, "connections"); await page.locator('[data-action="edit-connection"]').click();
  assert.equal(await page.evaluate(() => document.activeElement.id), "connection-name");
  assert.equal(await page.locator("#api-key").inputValue(), "", "Saved keys never reappear");
  await page.locator("#save-connection").press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-modal-close")), true);
  await page.locator("#connection-name").fill("Unsaved supplier");
  await page.locator("#api-key").fill("SYNTHETIC_UNSAVED_KEY");
  const calls = await page.evaluate(() => window.__calls.length);
  await page.evaluate(() => {
    const select = document.querySelector("#interface-theme"); select.value = "dark";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert.equal(await page.locator("#connection-name").inputValue(), "Unsaved supplier");
  assert.equal(await page.locator("#api-key").inputValue(), "SYNTHETIC_UNSAVED_KEY");
  assert.equal(await page.evaluate(() => window.__calls.length), calls);
  await page.screenshot({ path: path.join(output, "provider-editor-dark.png") });
  await page.keyboard.press("Escape"); await page.locator("[data-keep-editing]").click();
  assert.equal(await page.locator("#connection-name").inputValue(), "Unsaved supplier");
  await page.evaluate(() => window.__delayCommand("upsert_connection"));
  await page.locator("#save-connection").click();
  await page.waitForFunction(() => document.querySelector("#connection-form").inert);
  await page.evaluate(() => window.__releaseCommand("upsert_connection", true));
  await page.locator("#connection-error").waitFor();
  assert.equal(await page.locator("#connection-name").inputValue(), "Unsaved supplier");
  assert.equal(await page.locator("#save-connection").isDisabled(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), "connection-error");
  await assertReadable(page, ["#connection-error", ".form-field small", ".form-field label"]);
  await page.evaluate(() => { window.__failSave = false; window.__delayCommand("upsert_connection"); });
  await page.locator("#save-connection").click();
  await page.waitForFunction(() => document.querySelector("#connection-form").inert);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#connection-form").count(), 1);
  assert.equal(await page.locator(".modal-header [data-modal-close]").isDisabled(), true);
  await page.evaluate(() => window.__releaseCommand("upsert_connection"));
  await page.waitForFunction(() => !document.querySelector("#connection-form"));
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes("SYNTHETIC_UNSAVED_KEY") || JSON.stringify(sessionStorage).includes("SYNTHETIC_UNSAVED_KEY")), false);
  await page.evaluate(() => window.__addDisabledModel()); await page.locator("#refresh-button").click();
  await page.locator('[data-action="edit-connection"]').click(); await page.locator("[data-model-fetch]").click();
  const checked = page.locator('[data-model-list] input[data-model-id="fixture-new"]');
  await checked.waitFor(); assert.equal(await page.locator('[data-model-list] input:checked:not(:disabled)').count(), 0);
  await checked.check(); assert.match(await page.locator("#models").inputValue(), /fixture-new/);
  await checked.uncheck(); assert.doesNotMatch(await page.locator("#models").inputValue(), /fixture-new/);
  await page.locator("#models").fill((await page.locator("#models").inputValue()) + "\nmanual-model | My name");
  await checked.check(); await page.locator("#base-url").fill("https://changed.invalid/v1");
  assert.match(await page.locator("#models").inputValue(), /manual-model/);
  assert.doesNotMatch(await page.locator("#models").inputValue(), /fixture-new/);
  await page.locator("[data-model-fetch]").click(); await checked.check();
  assert.equal(await page.locator("[data-model-add]").count(), 0);
  await page.locator("#save-connection").click(); await page.waitForFunction(() => !document.querySelector("#connection-form"));
  const saved = await page.evaluate(() => window.__calls.filter(call => call.cmd === "upsert_connection").at(-1).args.input);
  assert.deepEqual(saved.models.map(model => model.modelId), ["gpt-5", "disabled-model", "manual-model", "fixture-new"]);
  assert.equal(saved.models[1].enabled, false); assert.equal(saved.models[1].capabilities.vision, true);
  await page.close();
}
async function checkCliReplacementConfirmation(browser, url, errors) {
  for (const locale of ["en", "zh-CN"]) {
    const page = await fixturePage(browser, url, errors);
    await page.locator("#interface-language").selectOption(locale);
    await route(page, "clients");
    const open = () => page.locator('.client-card[data-client-id="cli"] [data-action="deploy-client"]').click();
    const applications = () => page.evaluate(() => window.__calls.filter(call => call.cmd === "apply_deployment_plan"));
    await open();
    assert.equal(await page.locator("#target-cli").isChecked(), true);
    assert.equal(await page.locator("#apply-deployment").isDisabled(), true);
    await page.locator("#preview-deployment").click();
    await page.locator(".manager-operation").waitFor();
    assert.match(await page.locator(".manager-operation").innerText(), locale === "en" ? /Confirm to replace the current CLI provider environment/ : /确认后替换 CLI 当前的供应商环境配置/);
    assert.equal((await applications()).length, 0, "Preview must not apply");
    await page.locator("[data-deployment-close]").click();
    assert.equal((await applications()).length, 0, "Closing review must not apply");
    await open();
    await page.locator("#preview-deployment").click();
    await page.locator("#apply-deployment").click();
    await page.waitForFunction(() => !document.querySelector("#inline-deployment"));
    assert.deepEqual((await applications()).map(call => call.args), [{ planId: "reviewed-plan", confirmed: true }]);
    await page.close();
  }
}
async function checkPublication(browser, url, errors) {
  const page = await fixturePage(browser, url, errors);
  await route(page, "clients"); await page.locator('.client-card[data-client-id="vscode"] [data-action="deploy-client"]').click();
  assert.equal(await page.locator("#target-vscode").isChecked(), true);
  assert.equal(await page.locator("#target-cli").isChecked(), false);
  assert.equal(await page.locator("#target-app").isChecked(), false);
  await page.locator("#preview-deployment").click(); await page.locator("#apply-deployment").waitFor({ state: "visible" });
  await page.locator("#interface-theme").selectOption("dark");
  assert.equal(await page.locator("#apply-deployment").isDisabled(), false, "Theme change preserves reviewed plan");
  await page.evaluate(() => window.__delayCommand("apply_deployment_plan")); await page.locator("#apply-deployment").click();
  await page.waitForFunction(() => document.querySelector("#inline-deployment")?.getAttribute("aria-busy") === "true");
  assert.equal(await page.locator("#refresh-button").isDisabled(), true);
  assert.equal(await page.locator("#interface-language").isDisabled(), true);
  await page.evaluate(() => {
    for (const selector of ['#primary-nav [data-route="connections"]', "#refresh-button", "[data-deployment-close]"]) document.querySelector(selector).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.equal(await page.locator("#content").getAttribute("data-route"), "clients");
  assert.equal(await page.locator("#inline-deployment").count(), 1);
  await page.evaluate(() => window.__releaseCommand("apply_deployment_plan", true));
  await page.waitForFunction(() => document.querySelector("#inline-deployment")?.getAttribute("aria-busy") === "false");
  assert.equal(await page.locator("#apply-deployment").isDisabled(), true);
  assert.match(await page.locator("#deployment-preview").innerText(), /failed or the result is uncertain/);
  assert.equal(await page.evaluate(() => document.activeElement.id), "deployment-preview");
  await page.locator("#preview-deployment").click(); await page.locator("#apply-deployment").click();
  await page.waitForFunction(() => document.activeElement.id === "publication-result-title");
  const applied = await page.evaluate(() => window.__calls.filter(c => c.cmd === "apply_deployment_plan").at(-1).args);
  assert.deepEqual(applied, { planId: "reviewed-plan", confirmed: true });
  await page.locator('[data-action="view-publication-history"]').click();
  assert.equal(await page.locator("#publication-history").getAttribute("open"), "");
  assert.match(await page.locator("#publication-history").innerText(), /VS Code/);
  await page.evaluate(() => window.__addSecondConnection()); await page.locator("#refresh-button").click();
  const app = page.locator('.client-card[data-client-id="app"]');
  await app.locator(".app-provider-select").selectOption("connection-b");
  await page.locator("#interface-language").selectOption("zh-CN");
  assert.equal(await app.locator(".app-provider-select").inputValue(), "connection-b");
  await page.locator("#interface-language").selectOption("en");
  await app.locator('[data-action="deploy-client"]').click();
  assert.match(await page.locator(".manual-steps").innerText(), /Second provider/);
  await page.locator(".modal-footer [data-modal-close]").click();
  await page.evaluate(() => { window.__addJetBrains(); window.__enableAutomaticJetBrains(); });
  await page.locator("#refresh-button").click();
  await page.locator('.client-card[data-client-id="jb-idea"] .app-provider-select').selectOption("connection");
  await page.locator('.client-card[data-client-id="jb-idea"] [data-action="deploy-client"]').click();
  await page.locator("#preview-deployment").click(); await page.locator("#apply-deployment").click();
  await page.waitForFunction(() => !document.querySelector("#inline-deployment"));
  assert.match(await page.locator(".manager-result-targets").first().innerText(), /restart this IDE/i);
  await route(page, "overview");
  await page.locator('.manager-client-row[data-client-id="app"] [data-action="route"]').click();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.clientId), "app");
  await page.close();
}
async function checkCatalogCopy(browser, url, errors) {
  for (const [locale, success, failure] of [
    ["zh-CN", "模型目录可访问。", "目录访问被拒绝，请检查密钥权限。"],
    ["en", "Model catalog available.", "Catalog access denied. Check key permissions."],
  ]) {
    const page = await fixturePage(browser, url, errors, locale);
    await page.locator('[data-appearance-select]').first().selectOption("dark");
    await route(page, "connections");
    const button = page.locator('[data-action="test-connection"]');
    const status = page.locator('[data-probe-id="connection"]');
    for (const [value, expected] of [["available", success], ["unauthorized", failure]]) {
      await page.evaluate(value => window.__setCatalogStatus(value), value);
      const before = await page.evaluate(() => window.__calls.length);
      await button.click();
      await page.waitForFunction(text => document.querySelector('[data-probe-id="connection"]')?.textContent === text, expected);
      assert.equal(await status.innerText(), expected);
      const calls = await page.evaluate(start => window.__calls.slice(start), before);
      assert.deepEqual(calls.map(call => call.cmd), ["discover_connection_models"]);
      assert.equal(calls[0].args.input.connectionId, "connection");
      assert.doesNotMatch(await page.locator("#content").innerText(), /Untrusted fixture|不代表|不证明|not verified|does not prove/);
      if (value === "available") await page.screenshot({ path: path.join(output, `catalog-result-${locale}.png`), fullPage: true });
    }
    await page.close();
  }
}
async function checkRecovery(browser, url, errors) {
  const page = await fixturePage(browser, url, errors);
  await page.evaluate(() => window.__setRecovery({ conflictCount: 1 }));
  await page.locator("#refresh-button").click(); await page.locator('.core-recovery [data-action="preview-recovery"]').click();
  await page.locator("#review-keep-current").click();
  await page.locator("#confirm-recovery").check(); await page.locator("#apply-recovery").click();
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(await page.locator(".core-recovery").count(), 0);
  await page.evaluate(() => window.__setStateRecovery()); await page.locator("#refresh-button").click();
  for (const name of routes) {
    await route(page, name); await page.locator(".core-recovery").waitFor();
  }
  await route(page, "connections");
  assert.equal(await page.locator('[data-action="edit-connection"]').isDisabled(), true);
  assert.equal(await page.locator('[data-action="deploy-connection"]').isDisabled(), true);
  await page.close();
}
async function checkWindowPreferences(browser, url, errors) {
  const page = await fixturePage(browser, url, errors);
  await route(page, "about");
  const select = page.locator('[data-close-action]');
  assert.equal(await select.inputValue(), "tray");
  await select.selectOption("exit");
  await page.waitForFunction(() => document.querySelector('[data-close-action]').disabled === false);
  assert.equal(await select.inputValue(), "exit");
  assert.match(await page.locator('[data-window-explanation]').textContent(), /Closing the window exits the app/);
  await page.evaluate(() => window.__delayCommand('set_close_action'));
  await select.selectOption("tray");
  assert.equal(await select.isDisabled(), true);
  await page.locator('#refresh-button').click();
  assert.equal(await select.isDisabled(), true, "Refresh cannot race a pending setting save");
  await page.evaluate(() => window.__releaseCommand('set_close_action', true));
  await page.locator('.toast.error').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-close-action]')?.disabled === false);
  assert.equal(await select.inputValue(), "exit", "Failed save keeps the prior live choice");
  await page.evaluate(() => window.__setWindowBehavior({ preferencesAvailable: false, closeAction: 'exit', closeToTray: false }));
  await page.locator('#refresh-button').click();
  await page.waitForFunction(() => document.querySelector('[data-close-action]')?.disabled === true);
  assert.match(await page.locator('[data-window-explanation]').textContent(), /original file is retained/);
  await page.close();
}
async function checkTrayLocale(browser, url, errors) {
  const page = await fixturePage(browser, url, errors);
  await page.waitForFunction(() => window.__trayLocale === 'en');
  const before = await page.evaluate(() => window.__calls.length);
  await page.evaluate(() => window.__delayCommand('set_tray_locale'));
  await page.locator('#interface-language').selectOption('zh-CN');
  await page.locator('#interface-language').selectOption('en');
  await page.evaluate(() => window.__releaseCommand('set_tray_locale'));
  await page.waitForFunction(() => window.__calls.filter(call => call.cmd === 'set_tray_locale').length >= 3 && window.__trayLocale === 'en');
  assert.equal(await page.evaluate(start => window.__calls.slice(start).every(call => call.cmd === 'set_tray_locale'), before), true);
  await page.evaluate(() => window.__delayCommand('set_tray_locale'));
  await page.locator('#interface-language').selectOption('zh-CN');
  await page.evaluate(() => window.__releaseCommand('set_tray_locale', true));
  await page.locator('.toast.warning').waitFor();
  assert.equal(await page.locator('#interface-language').inputValue(), 'zh-CN');
  assert.equal(await page.evaluate(() => window.__trayLocale), 'en', 'Failed menu update never fabricates a new native language');
  await page.close();
}
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.COPILOT_BYOK_MANAGER_BROWSER });
  const errors = [];
  try {
    const url = "http://127.0.0.1:" + server.address().port + "/";
    await checkShell(browser, url, errors);
    await checkEditor(browser, url, errors);
    await checkPublication(browser, url, errors);
    await checkCliReplacementConfirmation(browser, url, errors);
    await checkCatalogCopy(browser, url, errors);
    await checkRecovery(browser, url, errors);
    await checkWindowPreferences(browser, url, errors);
    await checkTrayLocale(browser, url, errors);
    const preview = await browser.newPage({ locale: "zh-CN", viewport: { width: 1180, height: 760 } });
    preview.on("pageerror", error => errors.push(String(error)));
    await preview.goto(url); await preview.locator(".preview-banner").waitFor();
    for (const name of routes) { await route(preview, name); assert.ok(await preview.locator(".preview-banner").count()); }
    await preview.close();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: "passed", scenarios: ["four core routes", "Chinese and English", "light and dark contrast", "system appearance changes", "preference persistence", "no hidden feature queries", "unsupported route rejection", "draft/focus/save guards", "catalog check-save and invalidation", "concise bilingual catalog results and failure recovery", "app-specific provider publication", "CLI replacement explicit confirmation in both languages", "busy/error/fresh-preview lifecycle", "manual app exact provider", "reviewed JetBrains fixture", "persistent history", "read-only/recovery visibility", "close preference success/failure/recovery", "bounded tray locale only", "browser preview boundaries"], output }));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
