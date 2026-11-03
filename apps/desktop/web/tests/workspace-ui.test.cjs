const test=require('node:test');
const assert=require('node:assert/strict');
const ui=require('../workspace-ui.js');
const editor=require('../provider-editor.js');
const i18n=require('../i18n.js');
const source={id:'provider',name:'Provider <one>',enabled:true,baseUrl:'https://example.invalid/v1',protocol:'responses',models:[{modelId:'model-one',name:'Model One',enabled:true,capabilities:{contextWindow:32000}}],hasSecret:true};
function fixture(){
  const client=(id,kind)=>({id,kind,name:id,detected:true,supportsWrite:true,status:'available'});
  const clients=[client('vscode:stable:default','vs-code-copilot'),client('vscode:insiders:default','vs-code-copilot'),client('cli','copilot-cli'),{...client('app','github-copilot-app'),supportsWrite:false},client('idea','jetbrains-copilot'),client('pycharm','jetbrains-copilot')];
  return {connections:[structuredClone(source)],clients,deployments:[],clientConfigurations:clients.map(c=>({targetId:c.id,state:'available',sources:[]}))};
}
test('application families preserve every native installation/profile identity',()=>{
  const snapshot=fixture(),groups=ui.groups(snapshot);
  assert.equal(groups.length,4);
  assert.deepEqual(new Set(groups.find(g=>g.id==='vscode').members.map(c=>c.id)),new Set(['vscode:insiders:default','vscode:stable:default']));
  assert.equal(groups.find(g=>g.id==='jetbrains').members.length,2);
  const html=ui.appRows(snapshot,{},true,new Set(['vscode']),c=>`<section data-fixture="${c.id}"></section>`);
  for(const c of snapshot.clients)assert.ok(html.includes(`data-fixture="${c.id}"`));
  assert.match(html,/id="instances-vscode" >|id="instances-vscode"\s*>/);
  assert.match(html,/id="instances-jetbrains" hidden/);
});
test('group summaries retain multiple providers and unavailable data is never a zero success',()=>{
  i18n.setLocale('zh-CN',{persist:false});
  const snapshot=fixture();snapshot.clients=snapshot.clients.filter(c=>c.id==='cli');
  snapshot.clientConfigurations.find(c=>c.targetId==='cli').sources=[{connectionId:'provider',name:'First',modelCount:2},{name:'<Second>',modelCount:null}];
  const html=ui.overviewRows(snapshot,{});
  assert.match(html,/First/);assert.match(html,/&lt;Second&gt;/);assert.match(html,/模型数量未知/);
  snapshot.clientConfigurations.find(c=>c.targetId==='cli').state='unavailable';
  assert.match(ui.overview(snapshot,{},true),/应用配置状态待核对/);
  assert.doesNotMatch(ui.overview(snapshot,{},true),/0 个应用实例已配置|0 个模型/);
});
test('App primary action reflects native review availability and retains the consent gate',()=>{
  for(const locale of ['zh-CN','en']){
    i18n.setLocale(locale,{persist:false});const snapshot=fixture(),group=ui.groups(snapshot).find(g=>g.id==='copilot-app');
    const before=ui.groupHeader(group,snapshot,{appSync:{enabled:false,reviewSupported:true}},true,false);
    assert.match(before,/data-action="app-sync-enable"/);assert.doesNotMatch(before,/manage-app-sync/);
    const unsupported=ui.groupHeader(group,snapshot,{appSync:{enabled:false,reviewSupported:false}},true,false);
    assert.doesNotMatch(unsupported,/app-sync-enable/);assert.match(unsupported,/setup-manual/);
    const enabled=ui.groupHeader(group,snapshot,{appSync:{enabled:true,phase:'pendingAppExit'}},true,false);
    assert.match(enabled,/manage-app-sync/);assert.doesNotMatch(enabled,/app-sync-enable/);
    snapshot.stateRecovery='fixture recovery';
    assert.match(ui.groupHeader(group,snapshot,{appSync:{reviewSupported:true}},true,false),/data-action="app-sync-enable" disabled/);
  }
});
test('provider workspace uses native bindings, escapes untrusted names and preserves selections when filtering',()=>{
  i18n.setLocale('zh-CN',{persist:false});const snapshot=fixture();snapshot.connections.push({...source,id:'other',name:'Other'});
  snapshot.clientConfigurations[0].sources=[{connectionId:'provider',name:source.name,modelCount:1}];
  const state={query:'',selectedId:'provider'},html=ui.providers(snapshot,{},true,state);
  assert.match(html,/Provider &lt;one&gt;/);assert.doesNotMatch(html,/<one>/);
  assert.match(html,/data-action="edit-connection"/);assert.match(html,/data-action="test-connection"/);
  assert.match(html,/data-action="delete-connection"/);assert.match(html,/GitHub Copilot · VS Code/);
  state.query='other';ui.providers(snapshot,{},true,state);assert.equal(state.selectedId,'other');
  state.query='missing';assert.match(ui.providers(snapshot,{},true,state),/没有匹配/);assert.equal(snapshot.connections.length,2);
});
test('model draft enablement preserves native identity and capabilities before preferred ordering',()=>{
  const models=[{id:'native-a',modelId:'a',enabled:true,capabilities:{vision:null,contextWindow:32000}},{id:'native-b',modelId:'b',enabled:false,capabilities:{toolCalling:true}}];
  const flags=new Map([['a',false],['b',true]]),result=editor.applyEnabled(models,flags);
  assert.equal(result[0].enabled,false);assert.equal(result[1].enabled,true);
  assert.equal(result[0].id,'native-a');assert.deepEqual(result[0].capabilities,models[0].capabilities);
  assert.equal(models[0].enabled,true);assert.deepEqual(editor.rows('a | Model A\nb | Model B'),[{modelId:'a',name:'Model A'},{modelId:'b',name:'Model B'}]);
});
test('unknown detection and missing optional IDEs offer detection without inventing an installer',()=>{
  const snapshot=fixture();
  for(const c of snapshot.clients){c.detected=false;c.supportsWrite=false;c.status=c.kind==='jetbrains-copilot'?'not-installed':'error';}
  for(const group of ui.groups(snapshot)){
    const html=ui.groupHeader(group,snapshot,{},true,false);
    assert.match(html,/data-action="refresh"/);assert.doesNotMatch(html,/data-action="show-installation"/);
  }
});
test('clickable overview rows never contain a nested expandable control for many providers',()=>{
  const snapshot=fixture();snapshot.clients=snapshot.clients.filter(c=>c.id==='cli');
  snapshot.clientConfigurations.find(c=>c.targetId==='cli').sources=Array.from({length:5},(_,i)=>({name:'Provider '+i,modelCount:1}));
  const compact=ui.overviewRows(snapshot,{});
  assert.doesNotMatch(compact,/<details|<summary/);
  assert.match(compact,/manager-extra-summary/);
  assert.match(require('../manager-ui.js').currentSources(snapshot.clients[0],snapshot),/<details/);
});
test('every surface uses the same configuration state while synchronization progress stays separate',()=>{
  for(const locale of ['zh-CN','en']){
    i18n.setLocale(locale,{persist:false});const snapshot=fixture();
    for(const client of snapshot.clients){client.supportsWrite=true;const record=snapshot.clientConfigurations.find(c=>c.targetId===client.id);record.sources=[{connectionId:'provider',name:'Provider',modelCount:2}];}
    const data={appSync:{enabled:true,phase:'syncedConfiguration',selectedConnectionIds:['provider']}};
    const groups=ui.groups(snapshot),states=groups.map(g=>ui.groupState(g,snapshot,data));
    assert.ok(states.every(state=>state.state==='configured'));
    assert.equal(new Set(states.map(state=>state.label)).size,1);
    const app=groups.find(g=>g.id==='copilot-app');
    assert.doesNotMatch(ui.groupHeader(app,snapshot,data,true,false),/配置已同步|Configuration synchronized/);
    data.appSync.phase='failed';
    const html=ui.groupHeader(app,snapshot,data,true,false);
    assert.equal(ui.groupState(app,snapshot,data).state,'configured');assert.match(html,/data-sync-phase="failed"/);
    snapshot.clientConfigurations.find(c=>c.targetId==='app').state='unavailable';
    assert.equal(ui.groupState(app,snapshot,data).state,'unavailable');
  }
});
