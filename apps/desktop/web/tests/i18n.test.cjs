const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const messages = require("../i18n-messages.js");
const i18n = require("../i18n.js");
const usage = require("../usage-ui.js");
const manager = require("../manager-ui.js");
function isolated({ languages = ["en-US"], saved, deny = false } = {}) {
  const writes = [], document = { documentElement: {}, querySelectorAll: () => [] };
  const localStorage = { getItem() { if (deny) throw Error("Denied"); return saved; }, setItem(key, value) { if (deny) throw Error("Denied"); saved = value; writes.push([key, value]); } };
  const context = { navigator: { languages }, localStorage, document, CopilotBYOKManagerMessages: messages };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../i18n.js"), "utf8"), context);
  return { api: context.CopilotBYOKManagerI18n, writes, document };
}
test("system language, persisted choice and invalid/blocked storage have bounded fallbacks", () => {
  assert.equal(isolated({ languages: ["zh-HK", "en-US"] }).api.locale(), "zh-CN");
  assert.equal(isolated({ languages: ["en-GB", "zh-CN"] }).api.locale(), "en");
  assert.equal(isolated({ languages: ["fr-FR"] }).api.locale(), "en");
  assert.equal(isolated({ languages: ["zh-CN"], saved: "en" }).api.locale(), "en");
  assert.equal(isolated({ languages: ["en"], saved: "__proto__" }).api.locale(), "en");
  const blocked = isolated({ deny: true });
  assert.equal(blocked.api.setLocale("zh-CN").persisted, false);
  assert.equal(blocked.api.locale(), "zh-CN");
  const normal = isolated();
  assert.equal(normal.api.setLocale("zh-CN").persisted, true);
  assert.equal(normal.document.documentElement.lang, "zh-CN");
  assert.deepEqual(normal.writes, [["copilot-byok-manager.locale", "zh-CN"]]);
  normal.api.setLocale("<script>");
  assert.equal(normal.writes.length, 1);
});
test("translations do not recursively translate or interpolate user values", () => {
  const { api } = isolated();
  assert.equal(api.t("编辑 {0}", "未知 {1} ${apiKey}"), "Edit 未知 {1} ${apiKey}");
  assert.equal(api.t("toString"), "toString");
  assert.equal(api.t("__proto__"), "__proto__");
  assert.equal(api.t("missing-message"), "missing-message");
  let changes = 0;
  const unsubscribe = api.subscribe(() => changes++);
  api.setLocale("en"); api.setLocale("zh-CN"); unsubscribe(); api.setLocale("en");
  assert.equal(changes, 1);
});
test("cached UI labels resolve the live language and preserve unknown versus zero", () => {
  for (const [locale, unknown, unavailable] of [["en", "Unknown", "Unavailable"], ["zh-CN", "未知", "不可用"], ["en", "Unknown", "Unavailable"]]) {
    i18n.setLocale(locale, { persist: false });
    assert.equal(usage.label("unknown"), unknown);
    assert.match(usage.money(null), new RegExp(unavailable));
    assert.equal(usage.money("0.000000000000000000000123"), "$0.000000000000000000000123");
    assert.equal(usage.money("0"), "$0");
    assert.notEqual(usage.label("partial"), usage.label("complete"));
  }
});
test("both languages escape provider data and preserve names and configuration semantics", () => {
  const connection = { id: "c", name: '未知 <img src=x onerror="bad">', protocol: "chat-completions", baseUrl: "https://example.invalid/连接", enabled: true, hasSecret: true, models: [{ name: "连接", modelId: "model-未知", enabled: true }] };
  const snapshot = { connections: [connection], clients: [], deployments: [] };
  const before = structuredClone(snapshot);
  for (const locale of ["zh-CN", "en"]) {
    i18n.setLocale(locale, { persist: false });
    const html = manager.connectionCard(connection, snapshot, true);
    assert.match(html, /未知 &lt;img/);
    assert.match(html, /https:\/\/example.invalid\/连接/);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /data-action="deploy-connection" data-id="c"/);
    assert.match(html, locale === "en" ? /Publish to apps/ : /发布到应用/);
  }
  assert.deepEqual(snapshot, before);
});
test("language redraw preserves only allowlisted usage drafts, never credentials or other forms", () => {
  const selectors = [], restored = new Map();
  const restore = usage.preserveDraft({ querySelector(selector) {
    selectors.push(selector);
    if (selector === '#usage-filters [name="model"]') return { value: '未知 model {0}' };
    if (selector === "#usage-advanced-filters") return { open: true };
    if (selector === "#usage-local-summary") return { open: true };
    return null;
  } });
  restore({ querySelector(selector) { const field = {}; restored.set(selector, field); return field; } });
  assert.equal(restored.get('#usage-filters [name="model"]').value, '未知 model {0}');
  assert.equal(restored.get("#usage-advanced-filters").open, true);
  assert.equal(restored.get("#usage-local-summary").open, true);
  assert.ok(selectors.every(selector => /^#usage-filters \[name=|^#price-filter \[name=|^#usage-advanced-filters$|^#usage-local-summary$/.test(selector)));
  assert.doesNotMatch(selectors.join(" "), /apiKey|password|headers|connection-form|resource-form/);
});
