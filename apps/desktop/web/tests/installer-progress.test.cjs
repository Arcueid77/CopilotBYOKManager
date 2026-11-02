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

test('typed DNS failures and timeouts are visible in both languages without guessing from diagnostics', () => {
  const result={componentId:'app',status:'failed',failureKind:'nameResolution',detail:'Unrelated original diagnostic'};
  const run={status:'failed',startedAt:'2026-11-02T00:00:00Z',finishedAt:'2026-11-02T00:01:16Z',componentIds:['app'],results:[result]};
  for(const locale of ['zh-CN','en']) {
    i18n.setLocale(locale,{persist:false});
    const html=ui.render(run,labels);
    assert.match(html,/role="alert"/);assert.doesNotMatch(html,/<progress/);
    assert.match(html,locale==='en'?/server name.*resolved/:/无法解析下载服务器/);
    assert.ok(ui.failureHint({...result,failureKind:'networkTimeout'}));
    assert.equal(ui.failureHint({...result,status:'completedAndVerified'}),'');
    assert.equal(ui.failureHint({...result,failureKind:undefined,detail:'0x80072EE7'}),'');
  }
  i18n.setLocale('zh-CN',{persist:false});
});

test('the result dialog displays the typed cause and retry opens a fresh reviewed component plan', () => {
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{parse}=require('acorn');
  const source=fs.readFileSync(path.join(__dirname,'../installer-ui.js'),'utf8');
  const nodes=parse(source,{ecmaVersion:'latest'}).body[0].expression.callee.body.body;
  const fn=nodes.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='showResultModal');
  for(const locale of ['en','zh-CN']) {
    i18n.setLocale(locale,{persist:false});
    const calls=[],retry={dataset:{installRetry:'github-copilot-app'},addEventListener(name,fn){this[name]=fn;}};
    const root={innerHTML:'',querySelectorAll(selector){return selector==='[data-install-retry]'?[retry]:[];}};
    const context=vm.createContext({tr:i18n.t,modalRoot:root,isDesktop:true,activeInstall:false,componentOrder:['github-copilot-app'],
      dialog:()=>({prepare:()=>true,mount(){}}),escapeHtml:v=>String(v).replaceAll('<','&lt;').replaceAll('>','&gt;'),
      componentName:()=> 'Copilot App',statusLabel:v=>v,statusClass:()=> 'error',
      window:{CopilotBYOKManagerInstallProgress:ui},closeModal:()=>calls.push('close'),preview:ids=>calls.push(ids)});
    vm.runInContext(source.slice(fn.start,fn.end),context);
    context.showResultModal({results:[{componentId:'github-copilot-app',status:'failed',failureKind:'nameResolution',detail:'<native diagnostic>'}]});
    assert.match(root.innerHTML,locale==='en'?/server name.*resolved/:/无法解析下载服务器/);
    assert.doesNotMatch(root.innerHTML,/<native diagnostic>/);
    retry.click();assert.equal(calls[0],'close');assert.deepEqual(Array.from(calls[1]),['github-copilot-app']);
    retry.dataset.installRetry='unreviewed';retry.click();assert.equal(calls.length,2);
  }
  i18n.setLocale('zh-CN',{persist:false});
});
