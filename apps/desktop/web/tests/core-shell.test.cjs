// Execute the real shell against a synthetic DOM/API boundary; no browser or desktop automation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const i18n = require('../i18n.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
function element() {
  return { dataset: {}, value: '', textContent: '', innerHTML: '', disabled: false, hidden: false, isConnected: true,
    listeners: {}, classList: { toggle() {} }, addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); },
    setAttribute() {}, removeAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    append() {}, replaceChildren() {}, focus() {}, scrollIntoView() {}, remove() {} };
}
function shell({ delayManual = false } = {}) {
  const elements = Object.fromEntries(['content', 'modal-root', 'toast-root', 'page-title', 'page-subtitle', 'add-connection-button', 'overview-publish-button', 'refresh-button', 'runtime-label', 'runtime-detail', 'interface-language', 'primary-nav'].map(id => [id, element()]));
  const nav = ['overview', 'connections', 'clients', 'about'].map(route => Object.assign(element(), { dataset: { route } }));
  const calls = [], documentEvents = {};
  const snapshot = { version: 2, statePath: 'fixture', connections: [{ id: 'p', name: 'Provider A', enabled: true, baseUrl: 'https://example.invalid/v1', protocol: 'chat-completions', models: [{ modelId: 'm', name: 'Model', enabled: true }] }],
    clients: [{ id: 'cli', name: 'Copilot CLI', kind: 'copilot-cli', detected: true, supportsWrite: true, status: 'available' }],
    clientConfigurations: [{ targetId: 'cli', state: 'available', sources: [] }], deployments: [] };
  const document = { activeElement: null, documentElement: { lang: 'zh-CN' },
    querySelector(selector) { return elements[selector.slice(1)] ?? element(); },
    querySelectorAll(selector) { return selector.includes('.nav-item') ? nav : []; },
    addEventListener(name, fn) { (documentEvents[name] ??= []).push(fn); }, createElement: element };
  const invoke = async command => {
    calls.push(command);
    if (command === 'get_dashboard') return structuredClone(snapshot);
    if (command === 'get_manual_provider_status') return delayManual ? new Promise(() => {}) : [];
    if (command === 'get_app_sync_status') return { enabled:false, phase:'disabled', selectedConnectionIds:[], ownedConnectionIds:[], results:[] };
    if (command === 'get_window_behavior') return { trayAvailable: true, preferencesAvailable: true, closeAction: 'tray' };
    if (command === 'get_installation_status' || command === 'get_install_runs') return [];
    if (command === 'get_setup_status') return { preferences: {}, accounts: { surfaces: [] } };
    if (command === 'set_tray_locale') return;
    throw Error(`Unexpected command: ${command}`);
  };
  const installer = { busy: false, checking: false, hydrate() {}, mount() {}, setLoading(value) { this.checking = value; } };
  const context = { document, console, crypto: webcrypto, TextEncoder, queueMicrotask, setTimeout: () => 0, setInterval: () => 0, clearInterval() {},
    sessionStorage: { getItem() { return null; }, setItem() {} }, scrollTo() {}, __TAURI__: { core: { invoke } },
    CopilotBYOKManagerI18n: i18n, CopilotBYOKManagerCore: require('../core-ui.js'), CopilotBYOKManagerLoader: require('../core-loader.js'),
    CopilotBYOKManagerManager: require('../manager-ui.js'), CopilotBYOKManagerClients: require('../client-presentation.js'),
    CopilotBYOKManagerAppSync: require('../app-sync-ui.js'),
    CopilotBYOKManagerSetup: require('../setup-ui.js'), CopilotBYOKManagerInstaller: installer,
    CopilotBYOKManagerAccount: { hydrate() {}, mount() {} }, CopilotBYOKManagerAppearance: { apply() {} },
    CopilotBYOKManagerUI: { capture() { return null; }, restore() {}, modal() { return { active: false, busy: false, close: () => true }; } } };
  context.window = context;
  i18n.setLocale('zh-CN', { persist: false });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), context, { filename: 'app.js' });
  const route = name => elements['primary-nav'].listeners.click[0]({ target: { closest: () => nav.find(button => button.dataset.route === name) } });
  return { elements, calls, route, installer };
}

test('the real core shell renders all four routes while optional metadata is still pending', async () => {
  const { elements, calls, route } = shell({ delayManual: true });
  await tick(); await tick();
  assert.equal(elements.content.dataset.route, 'overview');
  assert.match(elements.content.innerHTML, /应用配置状态/);
  assert.equal(elements['refresh-button'].disabled, false);
  for (const page of ['connections', 'clients', 'about', 'overview']) {
    route(page); assert.equal(elements.content.dataset.route, page); assert.ok(elements.content.innerHTML.length > 0);
  }
  assert.doesNotMatch(calls.join(','), /get_installation_status|get_setup_status/);
  assert.equal(elements['overview-publish-button'].hidden, false);
});

test('explicit detail expansion starts its probe; language redraw does not repeat that probe', async () => {
  const { elements, calls, route } = shell(); await tick(); await tick(); route('clients');
  const section = { id: 'account-details', open: true, isConnected: true };
  const target = { closest: selector => selector.includes('> summary') ? { parentElement: section } : null };
  elements.content.listeners.click[0]({ target });
  elements.content.listeners.toggle[0]({ target: section });
  await tick(); await tick();
  assert.equal(calls.filter(command => command === 'get_setup_status').length, 1);
  const before = calls.length;
  elements['interface-language'].value = 'en';
  elements['interface-language'].listeners.change[0](); await tick();
  assert.ok(calls.slice(before).every(command => command === 'set_tray_locale'));
  assert.equal(elements.content.dataset.route, 'clients');
});
