const test = require('node:test');
const assert = require('node:assert/strict');
require('../i18n.js').setLocale('zh-CN', { persist: false });
const ui = require('../ui-lifecycle.js');
const usage = require('../usage-ui.js');
const manager = require('../manager-ui.js');
const snapshot = { connections: [{ id: 'c', name: '供应商', models: [{ modelId: 'gpt-5', enabled: true }] }], clients: [], deployments: [] };

test('focus identity never captures input values or interprets untrusted selector text', () => {
  const field = { tagName: 'INPUT', id: 'api-key', value: 'SYNTHETIC_PRIVATE_KEY', getAttribute: key => key === 'name' ? 'apiKey' : null };
  const root = { ownerDocument: { activeElement: field }, contains: element => element === field };
  const identity = ui.capture(root);
  assert.equal(identity.attributes.name, 'apiKey'); assert.doesNotMatch(JSON.stringify(identity), /SYNTHETIC_PRIVATE_KEY|value/);
  const input = { tagName: 'BUTTON', id: '', disabled: false, getAttribute: key => key === 'data-usage-action' ? 'x"]' : null, getClientRects: () => [1], focus() { this.focused = true; } };
  assert.equal(ui.restore({ querySelectorAll: () => [input] }, { tag: 'BUTTON', id: '', attributes: { 'data-usage-action': 'x"]' } }), true);
  assert.equal(input.focused, true);
});

test('official view starts with task navigation and does not apply local filters to Billing', () => {
  const html = usage.render(snapshot, {}, true);
  assert.ok(html.indexOf('用量视图') < html.indexOf('官方运行时额度'));
  assert.doesNotMatch(html, /id="usage-filters"|本地 Token 观察/);
  assert.match(html, /尚未取得额度|尚无官方金额/);
});

test('all local filters remain available through progressive disclosure and bounded model suggestions', () => {
  const data = { localUsage: { models: [{ rawModel: '<hostile>', route: 'unknown', surfaces: [] }] }, sources: [] };
  const html = usage.filterForm(snapshot, data);
  for (const key of ['start', 'end', 'surface', 'route', 'connectionId', 'model', 'confidence', 'sourceId', 'sourceStatus']) assert.match(html, new RegExp(`name="${key}"`));
  assert.match(html, /usage-advanced-filters/); assert.match(html, /重置筛选/); assert.match(html, /&lt;hostile&gt;/); assert.doesNotMatch(html, /value="<hostile>"/);
  usage.resetFilters();
  const defaults = usage.query(); assert.equal(defaults.model, null); assert.equal(defaults.route, null); assert.equal(defaults.page, 0); assert.equal(defaults.pageSize, 50);
});

test('publication guidance provides next steps for the applied client', () => {
  const connection = snapshot.connections[0];
  assert.doesNotMatch(manager.publicationSteps({ status: 'applied', targetKind: 'vs-code-copilot' }, connection).join(''), /JetBrains|终端/);
  assert.match(manager.publicationSteps({ status: 'applied', targetKind: 'copilot-cli' }, connection).join(''), /新开终端和 CLI 会话/);
  assert.match(manager.publicationSteps({ status: 'applied', targetKind: 'jetbrains-copilot' }, connection).join(''), /重启此 IDE/);
  assert.deepEqual(manager.publicationSteps({ status: 'rolledBack', targetKind: 'copilot-cli' }, connection), []);
  assert.deepEqual(manager.publicationSteps({ status: 'applied', targetKind: 'vs-code-copilot' }, undefined), []);
});

test('latest operation keeps failure and manual states, escapes targets, and scopes legacy batches', () => {
  const records = [{ targetId: '<bad>', connectionId: 'c', targetKind: 'copilot-cli', status: 'failed', detail: '<diagnostic>', createdAt: '2026-10-13T00:00:00Z' }, { connectionId: 'c', targetKind: 'jetbrains-copilot', status: 'applied', createdAt: '2026-10-12T00:00:00Z' }];
  const html = manager.lastResult({ ...snapshot, deployments: records }, true);
  assert.match(html, /失败，请核对/); assert.match(html, /&lt;bad&gt;|&lt;diagnostic&gt;/); assert.doesNotMatch(html, /重启此 IDE|新开终端|<bad>|<diagnostic>/);
});
