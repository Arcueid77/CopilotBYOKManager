const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const i18n = require("../i18n.js");
i18n.setLocale("zh-CN", { persist: false });
const usage = require("../usage-ui.js");

// Render the real secondary panels without a browser, IPC, timers or user data.
function panelModule(file, apiName, panelId) {
  const panel = { dataset: {}, innerHTML: "" };
  const content = { querySelector: (selector) => selector === panelId ? panel : null };
  const window = { __TAURI__: { core: { invoke() { throw new Error("Rendering must not invoke native writes"); } } } };
  const document = {
    querySelector: (selector) => selector === "#content" ? content : {},
    addEventListener() {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), { window, document, structuredClone, console, CopilotBYOKManagerI18n: i18n }, { filename: file });
  return { panel, api: window[apiName] };
}

test("Chinese status labels preserve unknown, unavailable, partial, stale and exact zero distinctions", () => {
  assert.equal(usage.label("unknown"), "未知");
  assert.equal(usage.label("unavailable"), "不可用");
  assert.equal(usage.label("partial"), "部分完成");
  assert.equal(usage.label("stale"), "已过期，显示旧快照");
  assert.equal(usage.label("successfulEmpty"), "读取成功，无记录");
  assert.equal(usage.label("complete"), "已结束");
  assert.equal(usage.label("processSucceededVerificationFailed"), "安装程序结束，但核验失败");
  assert.equal(usage.label("future-status"), "future-status");
  assert.equal(usage.label("toString"), "toString");
  assert.equal(usage.value("9007199254740993"), "9007199254740993");
  assert.equal(usage.money("0.0000000000000000000000001234"), "$0.0000000000000000000000001234");
  assert.equal(usage.money("0"), "$0");
  assert.match(usage.money(null), /不可用/);
});

test("account copy distinguishes inferred identity and manual action without changing official-login controls", () => {
  const { panel, api } = panelModule("account-ui.js", "CopilotBYOKManagerAccount", "#account-panel");
  const state = api.previewStatus();
  state.anchor.detail = "<script>remote</script>";
  api.hydrate(state); api.mount();
  assert.match(panel.innerHTML, /通过官方流程登录/);
  assert.match(panel.innerHTML, /不读取或复制客户端登录凭据/);
  assert.match(panel.innerHTML, /推断，待确认/);
  assert.match(panel.innerHTML, /data-account-action="preview"/);
  assert.match(panel.innerHTML, /name="account-surface" value="vsCodeCopilot"/);
  assert.match(panel.innerHTML, /&lt;script&gt;remote&lt;\/script&gt;/);
  assert.doesNotMatch(panel.innerHTML, /<script>|simulated|Preview data/);
});

test("installation copy keeps unknown detection non-installable and result verification explicit", () => {
  const { panel, api } = panelModule("installer-ui.js", "CopilotBYOKManagerInstaller", "#installation-panel");
  api.hydrate([{ id: "vscode", name: "<img src=x>", status: "unknown", detail: "<script>remote</script>", version: null }], []);
  api.mount();
  assert.match(panel.innerHTML, /先核对安装计划，再确认执行/);
  assert.match(panel.innerHTML, /检测不可用/);
  assert.match(panel.innerHTML, /版本不可用/);
  assert.doesNotMatch(panel.innerHTML, /data-install-action="install-one"|<script>|<img/);
  assert.match(panel.innerHTML, /&lt;img src=x&gt;/);
});

test("separate GitHub authorization and source-clear copy retain their credential and deletion boundaries", () => {
  const { panel, api } = panelModule("github-auth-ui.js", "CopilotBYOKManagerGithubAuth", "#github-authorization-panel");
  const state = api.previewStatus();
  state.detail = "<script>remote</script>";
  api.hydrate(state); api.mount();
  assert.match(panel.innerHTML, /GitHub 个人账单授权/);
  assert.match(panel.innerHTML, /Plan · read/);
  assert.match(panel.innerHTML, /data-github-auth-action="authorize"/);
  assert.match(panel.innerHTML, /&lt;script&gt;remote&lt;\/script&gt;/);
  assert.doesNotMatch(panel.innerHTML, /<script>|requesting personal|has no separate/);
  const source = usage.setupInstructions({ id: "vscode-otel", pathHint: "Fixture", setupPath: "C:\\Fixture\\metadata.jsonl" });
  assert.match(source, /不改 VS Code 设置/);
  assert.match(source, /captureContent&quot;: false/);
  assert.match(source, /不上传日志/);
  assert.match(source, /清除移除本软件中的该来源记录与游标/);
});
