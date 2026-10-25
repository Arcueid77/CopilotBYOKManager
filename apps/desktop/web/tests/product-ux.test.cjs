const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('acorn');
const i18n = require('../i18n.js');
const manager = require('../manager-ui.js');
const clients = require('../client-presentation.js');
const core = require('../core-ui.js');
const loader = require('../core-loader.js');
const progress = require('../installer-progress.js');
const appSource = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const appFunctions = parse(appSource, { ecmaVersion: 'latest' }).body[0].expression.callee.body.body;
const provider = id => ({ id, name: `Provider ${id}`, enabled: true, baseUrl: 'https://example.invalid/v1', protocol: 'chat-completions', models: [{ modelId: 'demo', name: 'Demo', enabled: true }], hasSecret: false });
const client = { id: 'cli', name: 'Copilot CLI', kind: 'copilot-cli', detected: true, supportsWrite: true, status: 'available' };
const fixture = () => ({ connections: [provider('A'), provider('B')], clients: [client], deployments: [], clientConfigurations: [{ targetId: 'cli', state: 'available', sources: [] }] });
function cardRenderer(snapshot, data = {}) {
  const context = vm.createContext({ tr: i18n.t, window: { CopilotBYOKManagerClients: clients, CopilotBYOKManagerManager: manager }, snapshot, data, appProviderChoices: new Map(), escapeHtml: manager.escape });
  for (const name of ['clientCard', 'clientIcon', 'statusLabel']) {
    const node = appFunctions.find(fn => fn.type === 'FunctionDeclaration' && fn.id.name === name);
    vm.runInContext(appSource.slice(node.start, node.end), context);
  }
  return context.clientCard;
}

test('app cards distinguish empty, unreadable, unsupported and undetected states in both languages', () => {
  for (const locale of ['zh-CN', 'en']) {
    i18n.setLocale(locale, { persist: false });
    const snapshot = fixture(), render = cardRenderer(snapshot);
    const empty = render(client);
    assert.match(empty, /data-configuration-state="empty"/);
    snapshot.clientConfigurations[0].state = 'unavailable';
    const unavailable = render(client);
    assert.match(unavailable, /data-configuration-state="unavailable"/);
    assert.notEqual(empty, unavailable);
    snapshot.clientConfigurations[0].state = 'unsupported';
    assert.match(render(client), /data-configuration-state="unsupported"/);
    const error = { ...client, status: 'error', detected: false, supportsWrite: false };
    assert.equal(clients.configurationState(error, snapshot).state, 'unavailable');
    assert.equal(clients.configurationState({ ...error, status: 'not-installed' }, snapshot).state, 'missing');
    assert.equal(clients.configurationState({ ...error, status: 'read-only' }, snapshot).state, 'unsupported');
  }
});

test('apps show the actual provider catalog independently of the provider chosen for publication', () => {
  i18n.setLocale('zh-CN', { persist: false });
  const snapshot = fixture();
  snapshot.clientConfigurations[0].sources = [{ name: 'Manual Alpha', modelCount: 2 }, { name: '<Manual Beta>', modelCount: 4 }];
  const html = cardRenderer(snapshot)(client);
  assert.match(html, /Manual Alpha · 2 个模型/);
  assert.match(html, /&lt;Manual Beta&gt; · 4 个模型/);
  assert.match(html, /本次发布/);
  assert.doesNotMatch(html, /使用供应商|多供应商 · 多模型|<Manual Beta>/);
  assert.match(html, /<option value="" selected>/); // No inferred active provider.
  assert.match(manager.sourceRows(snapshot), /Manual Alpha/);
});

test('manual confirmation appears per provider without claiming observed client configuration', () => {
  i18n.setLocale('zh-CN', { persist: false });
  const snapshot = fixture(), app = { ...client, kind: 'github-copilot-app', supportsWrite: false, status: 'read-only' };
  snapshot.clients = [app];
  const data = { manualProviders: [{ connectionId: 'A', state: 'userConfirmed' }, { connectionId: 'B', state: 'configurationChanged' }], errors: {} };
  const html = cardRenderer(snapshot, data)(app);
  assert.match(html, /Provider A · 你已确认/);
  assert.match(html, /Provider B · 修改后待确认/);
  assert.doesNotMatch(html, /已配置 2|data-configuration-state="configured"/);
  assert.match(manager.sourceRows(snapshot, data), /Provider A · 你已确认/);
  data.errors.manualProviders = 'fixture failure';
  assert.match(cardRenderer(snapshot, data)(app), /手动配置记录读取失败/);
  assert.doesNotMatch(cardRenderer(snapshot, data)(app), /Provider A · 你已确认/);
});

test('publication results and history identify the exact provider and app and escape both', () => {
  i18n.setLocale('zh-CN', { persist: false });
  const snapshot = fixture();
  snapshot.connections[0].name = '<Provider A>';
  const record = { planId: 'plan', connectionId: 'A', targetId: 'cli', status: 'applied', createdAt: '2026-10-24T00:00:00Z', targetKind: 'copilot-cli' };
  snapshot.deployments = [record];
  const first = manager.lastResult(snapshot, true);
  assert.match(first, /&lt;Provider A&gt; → Copilot CLI/);
  assert.match(core.history(snapshot), /&lt;Provider A&gt; → Copilot CLI/);
  record.connectionId = 'B';
  assert.notEqual(first, manager.lastResult(snapshot, true));
  assert.match(manager.lastResult(snapshot, true), /Provider B → Copilot CLI/);
});

test('publishing pause keeps the observed catalog and labels the switch by its actual effect', () => {
  i18n.setLocale('zh-CN', { persist: false });
  const snapshot = fixture(); snapshot.connections[0].enabled = false;
  snapshot.clientConfigurations[0].sources = [{ connectionId: 'A', name: 'Provider A', modelCount: 3 }];
  assert.match(manager.connectionCard(snapshot.connections[0], snapshot, true), /允许发布/);
  assert.match(manager.connectionCard(snapshot.connections[0], snapshot, true), /data-action="deploy-connection"[^>]*disabled/);
  assert.match(manager.sourceRows(snapshot), /Provider A · 3 个模型 · 发布已暂停/);
});

test('independent reads commit immediately and slow optional reads do not hold dashboard state', async () => {
  const pending = new Map(), data = { errors: {} }, settled = [];
  const reader = loader.create({ data, invoke: command => new Promise(resolve => pending.set(command, resolve)), onSettled: key => settled.push(key) });
  const task = reader.load([['dashboard', 'fast'], ['setup', 'slow']]);
  pending.get('fast')({ ready: true }); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(data.dashboard, { ready: true });
  assert.equal(data.setup, undefined); assert.deepEqual(settled, ['dashboard']);
  pending.get('slow')({ ready: true }); await task;
});

test('stale read results and failures cannot overwrite newer data or a native preference write', async () => {
  const pending = [], data = { errors: {} };
  const reader = loader.create({ data, invoke: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) });
  const old = reader.load([['manualProviders', 'read']]), fresh = reader.load([['manualProviders', 'read']]);
  pending[1].resolve(['new']); await fresh;
  pending[0].reject(new Error('old failure')); await old;
  assert.deepEqual(data.manualProviders, ['new']); assert.equal(data.errors.manualProviders, undefined);
  const windowRead = reader.load([['windowBehavior', 'read']]);
  reader.invalidate('windowBehavior'); data.windowBehavior = { closeAction: 'exit' };
  pending[2].resolve({ closeAction: 'tray' }); await windowRead;
  assert.equal(data.windowBehavior.closeAction, 'exit');
});

test('normal cancellation is distinct from failures and incomplete operations in both languages', () => {
  for (const locale of ['zh-CN', 'en']) {
    i18n.setLocale(locale, { persist: false });
    const results = [{ status: 'completedAndVerified' }, { status: 'cancelled' }];
    assert.deepEqual(progress.summarize(results), { completed: 1, cancelled: 1, attention: 0 });
    assert.doesNotMatch(progress.summaryText(results), /待核对|需处理|attention/);
    assert.equal(progress.summarize([...results, { status: 'timedOut' }]).attention, 1);
  }
});

test('the core refresh omits account probes and UI-owned terms and controls stay consistent', () => {
  i18n.setLocale('zh-CN', { persist: false });
  assert.doesNotMatch(JSON.stringify(core.sections), /get_setup_status|get_account_status|get_installation_status/);
  assert.doesNotMatch(core.about({ ...fixture(), statePath: 'fixture', version: 2 }, {}, false, {}), /data-appearance-select/);
  assert.equal(i18n.t('首选模型'), '推荐模型');
  assert.doesNotMatch(i18n.t('撤销未完成，连接已保留。请查看活动记录或恢复状态。'), /活动记录|连接/);
  assert.ok(appSource.indexOf('data-current-protocol') < appSource.indexOf('data-model-fetch'));
  assert.match(appSource, /expectedRevision, confirmed: true/);
});
