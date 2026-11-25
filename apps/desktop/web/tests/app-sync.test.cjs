const test = require('node:test');
const assert = require('node:assert/strict');
const ui = require('../app-sync-ui.js');
const i18n = require('../i18n.js');
const clients = require('../client-presentation.js');
const manager = require('../manager-ui.js');
const provider = { id:'saved', name:'Saved <provider>', enabled:true, models:[{ enabled:true }] };
const snapshot = { connections:[provider], clients:[] };
const tick = () => new Promise(resolve=>setImmediate(resolve));
function element() { return { checked:false, disabled:false, isConnected:true, handlers:{}, addEventListener(name, fn) { this.handlers[name]=fn; }, async click() { if (!this.disabled) await this.handlers.click?.(); } }; }
function harness(response) {
  const calls=[], dialogs=[], errors=[], statuses=[];
  let current;
  const controller=ui.create({async invoke(command,args){calls.push([command,args]);return response(command,args);}, setStatus:status=>statuses.push(status),
    openModal(config){
      const nodes=Object.fromEntries(['[data-sync-revoke]','[data-app-models-resolved]'].map(key=>[key,element()]));
      current={...element(),nodes,querySelector:key=>nodes[key]};dialogs.push({config,root:current});config.onOpen?.(current);
    },closeModal(){current.isConnected=false;},setBusy(){},async refresh(){},onError:error=>errors.push(error)});
  return {controller,calls,dialogs,errors,statuses};
}

test('settings shows only the sync switch, while revocation uses the common configuration manager',()=>{
  for(const locale of ['zh-CN','en']){
    i18n.setLocale(locale,{persist:false});
    const available={enabled:false,reviewSupported:true};
    const off=ui.settings(available,snapshot,true);
    assert.match(off,/role="switch"/);assert.match(off,/aria-checked="false"/);assert.match(off,/data-action="app-sync-enable"/);
    const on=ui.settings({...available,enabled:true,ownedConnectionIds:['saved'],phase:'failed',results:[provider]},snapshot,true);
    assert.match(on,/aria-checked="true"/);assert.match(on,/data-action="app-sync-disable"/);
    assert.doesNotMatch(on,/app-sync-revoke|Saved &lt;provider&gt;/);
    assert.doesNotMatch(on,/data-app-sync-panel|app-sync-select|app-sync-review|app-sync-retry/);
  }
});

test('the enable switch records a preference without a provider picker or write preview',async()=>{
  const h=harness(command=>{assert.equal(command,'enable_app_sync_waiting');return {enabled:true};});
  h.controller.handle('app-sync-enable');h.controller.handle('app-sync-enable');await tick();
  assert.equal(h.calls.length,1);assert.deepEqual(h.statuses,[{enabled:true}]);assert.deepEqual(h.dialogs,[]);
});

test('a failed compatibility check leaves the switch alone and shows the localized reason',async()=>{
  for(const locale of ['zh-CN','en']){
    i18n.setLocale(locale,{persist:false});
    const h=harness(()=>{throw {compatibilityIssue:'schema'};});
    h.controller.handle('app-sync-enable');await tick();
    assert.deepEqual(h.statuses,[]);assert.deepEqual(h.dialogs,[]);assert.equal(h.errors.length,1);
    assert.match(h.errors[0].message,locale==='en'? /database format/ : /数据库格式/);
  }
});

test('App revocation requires reviewed model references and failed requests cannot replay the native plan', async () => {
  const plan={id:'native-revoke-id',appModelRemovals:['model <old>'],operations:[{description:'Owned rows only'}]};
  const h=harness(command => { if(command==='preview_app_sync_revoke') return plan; throw Error('synthetic failure'); });
  h.controller.handle('app-sync-revoke','saved');
  await new Promise(resolve=>setImmediate(resolve));
  const root=h.dialogs.at(-1).root,button=root.nodes['[data-sync-revoke]'],checkbox=root.nodes['[data-app-models-resolved]'];
  assert.equal(button.disabled,true); await button.click(); assert.equal(h.calls.length,1);
  checkbox.checked=true; checkbox.handlers.change(); await button.click(); await button.click();
  assert.equal(h.calls.length,2);
  assert.deepEqual(h.calls[1],['apply_deployment_plan',{planId:'native-revoke-id',confirmed:true,appModelReferencesResolved:true}]);
  assert.equal(h.errors.length,1);
  assert.match(h.dialogs[0].config.body,/model &lt;old&gt;/);
});

test('database observations and manual confirmations remain separate and revoke has no model-selection instruction', () => {
  const app={id:'app',kind:'github-copilot-app',detected:true,supportsWrite:true,status:'available'};
  const state={...snapshot,clientConfigurations:[{targetId:'app',state:'unavailable',sources:[]}]};
  assert.equal(clients.configurationState(app,state,{manualProviders:[{connectionId:'saved',state:'userConfirmed'}]}).state,'unavailable');
  state.clientConfigurations[0]={targetId:'app',state:'available',sources:[{connectionId:'saved',name:provider.name,modelCount:2}]};
  assert.equal(clients.configurationState(app,state).sources[0].modelCount,2);
  assert.equal(manager.publicationSteps({status:'applied',targetKind:'github-copilot-app',purpose:'revokeApp'},provider).length,0);
  assert.equal(manager.publicationSteps({status:'applied',targetKind:'github-copilot-app',purpose:'deploy'},provider).length,1);
});
