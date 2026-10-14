const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../i18n.js").setLocale("zh-CN", { persist: false });
const { render, renderPlan } = require("../resources-ui.js");
test("resource data is escaped and publication is not represented as verified client consumption", () => {
  const html = render({ resources: [{ id: '" onclick="attack()', name: "<img src=x onerror=attack()>", kind: "instructions", updatedAt: "2026-10-02T00:00:00Z" }],
    bindings: [{ resourceId: '" onclick="attack()', targetId: "<script>attack()</script>", deployedAt: "2026-10-01T00:00:00Z" }], detail: "Last-published only" }, null, true);
  assert.ok(html.includes("&lt;img")); assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>")); assert.ok(!html.includes('id="" onclick='));
  assert.ok(html.includes("个最近发布绑定")); assert.ok(html.includes("本地修改待发布")); assert.ok(html.includes("保持手动"));
});
test("resources unavailable in browser or storage recovery are not fabricated empty native catalogs", () => {
  const browser = render(null, null, false); assert.ok(browser.includes("浏览器试用不可用")); assert.ok(!browser.includes("尚无资源"));
  const unavailable = render(null, "Read-only recovery", true); assert.ok(unavailable.includes("资源存储不可用"));
  const empty = render({ resources: [], bindings: [] }, null, true); assert.ok(empty.includes("保存不会自动发布"));
});
test("review renders native semantic changes and owned content as escaped text", () => {
  const html = renderPlan({ operations: [{ title: "CLI <script>attack()</script>", change: "create", destination: 'file:fixture/<img src=x>', detail: "Public target", contentPreview: '</pre><script>attack()</script>' }, { title: "Manual app", change: "manual", detail: "No stable path" }] });
  assert.ok(html.includes("新增受管配置"));
  assert.ok(html.includes("手动处理 / 不可用"));
  assert.ok(html.includes("受管内容预览"));
  assert.ok(html.includes("&lt;/pre&gt;&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
});
