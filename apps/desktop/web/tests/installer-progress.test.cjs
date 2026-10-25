const test = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../i18n.js');
const ui = require('../installer-progress.js');
const labels = { componentName: id => id === 'cli' ? 'CLI <fixture>' : 'Copilot App', statusLabel: status => status };
test('progress preserves completed components, shows numeric download only when known, and escapes names', () => {
  const run = { status: 'running', startedAt: '2026-10-23T00:00:00Z', componentIds: ['cli','app'], currentComponentId: 'app', results: [{componentId:'cli',status:'completedAndVerified'}], progress: {phase:'downloading',downloadedBytes:2*1024**2,totalBytes:10*1024**2} };
  for (const locale of ['en','zh-CN']) {
    i18n.setLocale(locale);
    let html = ui.render(run,labels,Date.parse(run.startedAt)+65000);
    assert.match(html,/value="20"/); assert.match(html,/2 MiB.*10 MiB/); assert.match(html,/CLI &lt;fixture&gt;/); assert.match(html,/completedAndVerified/); assert.match(html,/1:05/);
    for (const progress of [{phase:'preparing'},{phase:'downloading',downloadedBytes:null,totalBytes:null},{phase:'downloading',downloadedBytes:999,totalBytes:10},{phase:'cancelling'}]) {
      html = ui.render({...run,progress},labels); assert.doesNotMatch(html,/<progress[^>]*value=/); assert.doesNotMatch(html,/NaN|Infinity/);
    }
  }
  i18n.setLocale('zh-CN');
});
