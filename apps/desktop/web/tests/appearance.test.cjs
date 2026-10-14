const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../appearance.js');
function fixture({ saved = null, dark = false, denied = false } = {}) {
  const writes = [], reads = [], controls = [{ value: '' }];
  const media = { matches: dark, addEventListener(name, fn) { this.listener = fn; } };
  const document = { documentElement: { dataset: {}, style: {} }, querySelectorAll: () => controls };
  const api = create({ document, matchMedia: () => media, localStorage: {
    getItem(key) { reads.push(key); if (denied) throw Error('Denied'); return saved; },
    setItem(key, value) { if (denied) throw Error('Denied'); writes.push([key, value]); },
  } });
  return { api, document, media, controls, writes, reads };
}
test('appearance follows system initially, including before body rendering', () => {
  const f = fixture({ dark: true });
  assert.equal(f.api.preference(), 'system');
  assert.equal(f.document.documentElement.dataset.theme, 'dark');
  assert.equal(f.document.documentElement.style.colorScheme, 'dark');
  assert.equal(f.controls[0].value, 'system');
  assert.deepEqual(f.writes, []);
});
test('explicit persisted light and dark override system without native calls or redraw', () => {
  const f = fixture({ saved: 'light', dark: true });
  assert.equal(f.api.resolved(), 'light');
  assert.deepEqual(f.api.set('dark'), { changed: true, persisted: true });
  assert.equal(f.document.documentElement.dataset.theme, 'dark');
  assert.deepEqual(f.writes, [['copilot-byok-manager.appearance', 'dark']]);
  assert.deepEqual(f.reads, ['copilot-byok-manager.appearance']);
});
test('system changes affect only the system preference and synchronize new controls', () => {
  const f = fixture(); f.media.matches = true; f.media.listener();
  assert.equal(f.api.resolved(), 'dark');
  f.api.set('light'); f.media.listener(); assert.equal(f.api.resolved(), 'light');
  f.controls.push({ value: '' }); f.api.apply(); assert.equal(f.controls[1].value, 'light');
  f.api.set('system'); assert.equal(f.api.resolved(), 'dark');
});
test('unknown preferences and hostile values cannot enter CSS or persistent storage', () => {
  for (const value of ['__proto__', '<script>', 'dark;url(secret)', '']) {
    const f = fixture({ saved: value });
    assert.equal(f.api.preference(), 'system');
    assert.deepEqual(f.api.set(value), { changed: false, persisted: false });
    assert.deepEqual(f.writes, []);
    assert.equal(f.document.documentElement.dataset.theme, 'light');
  }
});
test('denied storage keeps the choice for this session and missing browser APIs are safe', () => {
  const f = fixture({ denied: true });
  assert.deepEqual(f.api.set('dark'), { changed: true, persisted: false });
  assert.equal(f.api.resolved(), 'dark');
  assert.equal(create({}).resolved(), 'light');
});
