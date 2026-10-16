const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../i18n.js');
const core = require('../core-ui.js');
i18n.setLocale('zh-CN', { persist: false });
const snapshot = { connections: [], clients: [], deployments: [], version: 2, statePath: '<state>' };
test('only the four core routes are available, and refresh never requests hidden features', () => {
  assert.deepEqual(core.routeIds, ['overview', 'connections', 'clients', 'about']);
  assert.equal(Object.isFrozen(core.routeIds), true);
  assert.deepEqual(core.sections.map(s => s[1]), ['get_dashboard', 'get_installation_status', 'get_install_runs', 'get_setup_status', 'get_window_behavior']);
  assert.doesNotMatch(JSON.stringify(core.sections), /usage|billing|quota|price|resources|authorization/);
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.deepEqual([...html.matchAll(/data-route="([^"]+)"/g)].map(m => m[1]), core.routeIds);
  assert.doesNotMatch(html, /more-nav|src="(?:usage-ui|resources-ui|github-auth-ui)\.js"/);
  assert.ok(html.indexOf('src="appearance.js"') < html.indexOf('rel="stylesheet"'));
});
test('the WebView cannot arbitrarily remove or mutate native tray recovery and quit actions', () => {
  const capability = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src-tauri/capabilities/default.json'), 'utf8'));
  assert.doesNotMatch(JSON.stringify(capability.permissions), /core:default|core:tray|core:menu/);
  assert.ok(capability.permissions.includes('core:event:default'));
});
test('read-only state and deployment recovery remain visible without a hidden Settings route', () => {
  assert.equal(core.recovery(snapshot, true), '');
  const html = core.recovery({ ...snapshot, stateRecovery: '<broken>', deploymentRecovery: '<interrupted>' }, true);
  assert.match(html, /role="alert"|data-action="preview-recovery"/);
  assert.match(html, /&lt;broken&gt;|&lt;interrupted&gt;/);
  assert.doesNotMatch(html, /<broken>|<interrupted>|data-route="settings"/);
  assert.match(core.recovery({ ...snapshot, deploymentRecovery: 'pending' }, false), /data-action="preview-recovery" disabled/);
});
test('publication history is bounded, preserves failure states and escapes all diagnostics', () => {
  const records = Array.from({ length: 105 }, (_, i) => ({ targetId: '<target>', status: 'failed', createdAt: '2026-10-14T00:00:00Z', detail: '<diagnostic>' + i }));
  const html = core.history({ ...snapshot, deployments: records });
  assert.equal((html.match(/<li>/g) ?? []).length, 100);
  assert.match(html, /失败，请核对|&lt;target&gt;|&lt;diagnostic&gt;/);
  assert.doesNotMatch(html, /data-route="activity"|<target>|<diagnostic>/);
});
test('About distinguishes native tray, unavailable tray and browser preview without exposing hidden controls', () => {
  const urls = { manual: 'https://example.invalid/manual', 'manual-zh': 'https://example.invalid/manual-zh', issues: 'https://example.invalid/issues', planned: 'https://example.invalid/plan' };
  assert.match(core.about(snapshot, { windowBehavior: { closeToTray: true } }, true, urls), /关闭窗口收起到系统托盘/);
  assert.match(core.about(snapshot, { windowBehavior: { closeToTray: false } }, true, urls), /关闭窗口将正常退出/);
  assert.match(core.about(snapshot, {}, true, urls), /无法读取窗口设置，请刷新后重试。/);
  const html = core.about(snapshot, {}, false, urls);
  assert.match(html, /浏览器试用不提供系统托盘|data-action="view-planned-features"|&lt;state&gt;/);
  assert.match(core.planned(), /尚未实现|入口暂未开放/);
  assert.doesNotMatch(html, /data-usage-action|data-resource-action|data-github-auth-action/);
  assert.doesNotMatch(html, /data-close-action/);
});
test('close preferences are explicit, bounded and disabled when native state is unavailable', () => {
  const urls = { manual: 'https://example.invalid', 'manual-zh': 'https://example.invalid', issues: 'https://example.invalid' };
  const data = { windowBehavior: { closeToTray: false, trayAvailable: true, closeAction: 'exit', preferencesAvailable: true } };
  assert.match(core.about(snapshot, data, true, urls), /data-close-action[^>]*><option value="tray".*<option value="exit" selected/);
  assert.match(core.windowBehaviorDescription(data, true), /关闭窗口将退出程序/);
  assert.match(core.about(snapshot, { windowBehavior: { ...data.windowBehavior, preferencesAvailable: false } }, true, urls), /data-close-action[^>]*disabled/);
  assert.match(core.windowBehaviorDescription({ windowBehavior: { preferencesAvailable: false } }, true), /原文件保留/);
  assert.match(core.about(snapshot, { windowBehavior: { ...data.windowBehavior, trayAvailable: false } }, true, urls), /data-close-action[^>]*disabled/);
});
test('the single-instance plugin runs before stores open and ignores secondary launch payloads', () => {
  const native = fs.readFileSync(path.join(__dirname, '../../src-tauri/src/lib.rs'), 'utf8');
  assert.ok(native.indexOf('tauri_plugin_single_instance::init') < native.indexOf('let store = StateStore::open()'));
  assert.match(native, /init\(\|app, _args, _cwd\|\s*\{\s*window_shell::restore\(app\);\s*\}\)/);
  const shell = fs.readFileSync(path.join(__dirname, '../../src-tauri/src/window_shell.rs'), 'utf8');
  assert.doesNotMatch(shell, /显示窗口 \/ Show window|退出 \/ Quit/);
  assert.match(shell, /show_menu_on_left_click\(false\)/);
});
test('public labels are Providers and Apps in English and the approved names in Chinese', () => {
  for (const [locale, provider, app] of [['en', 'Providers', 'Apps'], ['zh-CN', '供应商', '应用']]) {
    i18n.setLocale(locale, { persist: false });
    assert.equal(i18n.t('供应商'), provider); assert.equal(i18n.t('应用'), app);
    assert.equal(i18n.t('连接'), provider); assert.equal(i18n.t('客户端'), app);
  }
});
