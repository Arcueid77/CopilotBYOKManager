/* 最小 DOM 桩 + vm 沙箱：执行原型脚本并遍历所有场景 × 页面 × 模态，捕获运行时错误 */
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(require("path").join(__dirname, "copilot-byok-manager.html"), "utf8");
const parts = html.split("<script>");
if (parts.length < 2) { console.error("no script tag"); process.exit(1); }
const js = parts[1].split("</scr" + "ipt>")[0];

function makeEl() {
  return {
    innerHTML: "", textContent: "", value: "", checked: false, className: "", style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, remove() {}, addEventListener() {}, setAttribute() {}, scrollIntoView() {},
    closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }
  };
}
const els = {};
const documentShim = {
  querySelector(sel) { if (!els[sel]) els[sel] = makeEl(); return els[sel]; },
  querySelectorAll() { return []; },
  createElement() { return makeEl(); },
  addEventListener() {},
  body: makeEl()
};
const sandbox = {
  document: documentShim, window: {}, console,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}
};
vm.createContext(sandbox);
vm.runInContext(js, sandbox, { filename: "proto.js" });

const test = `
;(function(){
  const report = [];
  for (const key of Object.keys(SCENARIOS)) {
    loadScenario(key);
    for (const p of PAGES.map(x => x.id)) { state.page = p; render(); }
    report.push("scenario " + key + " × pages OK");
  }
  /* 模态全量 */
  loadScenario("standard");
  state.draft = { connId: "conn-galaxy", modelIds: ["m-sonnet"], targetIds: ["vs-stable", "cli", "jb-idea", "copilot-app"] };
  state.preview = buildPreviewFromDraft(state);
  openModal("preview", { size: "lg" });
  ui.installing = { items: installPlansFor(state.clients.filter(c => !c.installed)), started: false };
  openModal("install");
  ui.installing.started = true; renderModal();
  ui.loginGuide = { clientId: "cli", phase: "steps" }; openModal("loginGuide");
  ui.loginGuide.phase = "done"; state.clients.find(c=>c.id==="cli").account = { login: "octocat", trust: "high" }; renderModal();
  openModal("help"); openModal("manualGuide"); openModal("clearUsage"); openModal("corrupt");
  openModal("modelEdit", { modelId: null }); openModal("modelEdit", { modelId: "m-sonnet" });
  openModal("deleteConn"); openModal("confirm", { title: "t", message: "m" }); openModal("resPreview", { size: "lg" });
  report.push("modals(standard) OK");
  loadScenario("partial-success"); openModal("lastrun", { size: "lg" }); openModal("recovery");
  report.push("modals(partial-success) OK");
  loadScenario("interrupted"); openModal("lastrun", { size: "lg" }); openModal("recovery");
  report.push("modals(interrupted) OK");
  loadScenario("empty"); render(); openModal("install");
  ui.installing = { items: installPlansFor(state.clients.filter(c => !c.installed)), started: true }; renderModal();
  report.push("empty install OK");
  /* 运行流（同步驱动，绕过计时器） */
  loadScenario("standard");
  state.draft = { connId: "conn-galaxy", modelIds: ["m-sonnet", "m-haiku"], targetIds: ["vs-stable", "cli", "jb-idea", "jb-pycharm", "copilot-app", "jb-webstorm"] };
  state.preview = buildPreviewFromDraft(state);
  startRun("none");
  let guard = 0;
  while (state.run && state.run.status === "running" && guard++ < 40) {
    /* 手动推进：直接执行 runTick 内的同步部分不可行（setTimeout 被桩掉），改为逐项目直写 */
    const sim = ui.runSim;
    const item = state.run.items[sim.i];
    const client = state.clients.find(c => c.id === item.clientId);
    if (!client || !item.supported) { item.status = "skipped"; }
    else if (item.capability === "manual") { item.status = "manual"; }
    else if (item.external && !item.allowBackupWrite) { item.status = "skipped"; }
    else { item.status = "applied"; client.config = "managed-current"; }
    sim.i++;
    if (sim.i >= state.run.items.length) finishRun();
  }
  if (!state.lastRun || state.lastRun.status !== "done") throw new Error("run flow did not finish");
  openModal("run", { size: "lg" });
  report.push("run flow OK: " + state.lastRun.items.map(i => i.clientId + "=" + i.status).join(","));
  /* 中断流 */
  loadScenario("standard");
  state.draft = { connId: "conn-galaxy", modelIds: ["m-sonnet"], targetIds: ["vs-stable", "cli"] };
  state.preview = buildPreviewFromDraft(state);
  startRun("none");
  interruptRun("测试中断");
  if (!state.lastRun || state.lastRun.status !== "interrupted") throw new Error("interrupt failed");
  openModal("recovery");
  report.push("interrupt flow OK");
  /* 预览失效 */
  loadScenario("standard");
  state.draft = { connId: "conn-galaxy", modelIds: ["m-sonnet"], targetIds: ["vs-stable"] };
  state.preview = buildPreviewFromDraft(state);
  if (previewStale(state)) throw new Error("fresh preview should not be stale");
  state.connections[0].updatedAt = Date.now() + 1000;
  if (!previewStale(state)) throw new Error("preview should be stale after edit");
  openModal("preview", { size: "lg" });
  report.push("stale preview OK");
  /* 用量估算 */
  loadScenario("standard");
  const recs = filteredUsage();
  const est = estimateCost(recs);
  if (!(est.sum > 0)) throw new Error("estimate should be > 0, got " + est.sum);
  report.push("usage OK: recs=" + recs.length + " est=$" + est.sum.toFixed(3) + " missingPrices=" + est.missing.join("|"));
  return report.join("\\n");
})()`;
const out = vm.runInContext(test, sandbox, { filename: "test.js" });
console.log(out);
console.log("ALL SMOKE TESTS PASSED");
