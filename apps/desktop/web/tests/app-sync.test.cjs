const test = require('node:test');
const assert = require('node:assert/strict');
const ui = require('../app-sync-ui.js');
const i18n = require('../i18n.js');
const clients = require('../client-presentation.js');
const manager = require('../manager-ui.js');
const provider = { id:'saved', name:'Saved <provider>', enabled:true, models:[{ enabled:true }] };
const snapshot = { connections:[provider, { ...provider, id:'paused', enabled:false }], clients:[] };
const preview = { id:'native-enable-id', appVersion:'1.1.25', databasePath:'C:\\fixture\\data.db', providers:[{ id:'saved', name:'Saved <provider>', endpoint:'https://example.invalid/v1', protocol:'responses', modelCount:2 }] };
function element() { return { checked:false, disabled:false, isConnected:true, textContent:'', handlers:{}, addEventListener(name, fn) { this.handlers[name] = fn; }, async click() { if (!this.disabled) await this.handlers.click?.(); } }; }
function harness(response) {
  const calls = [], dialogs = [], errors = [], statuses = [];
  let current;
  const controller = ui.create({ snapshot: () => snapshot, async invoke(command, args) { calls.push([command,args]); return response(command,args); }, setStatus: status => statuses.push(status),
    openModal(config) {
      const nodes = Object.fromEntries(['[data-sync-preview]','[data-sync-confirm]','[data-sync-error]','[data-sync-revoke]','[data-app-models-resolved]'].map(key => [key,element()]));
      const inputs = [Object.assign(element(), {value:'saved'})];
      current = { ...element(), nodes, inputs, querySelector: key => key === '[data-app-models-resolved]' && !config.body.includes('data-app-models-resolved') ? null : nodes[key], querySelectorAll: () => inputs };
      dialogs.push({ config,root:current }); config.onOpen?.(current);
    }, closeModal() { current.isConnected = false; }, setBusy() {}, async refresh() {}, onError: error => errors.push(error), openDeployment() {} });
  return { controller,calls,dialogs,errors,statuses };
}

test('App sync starts off and clearly discloses the reviewed plaintext storage in both languages', () => {
  for (const locale of ['zh-CN','en']) {
    i18n.setLocale(locale,{persist:false});
    const html = ui.panel({enabled:false,phase:'disabled',selectedConnectionIds:[],ownedConnectionIds:[],results:[]},null,snapshot,true);
    assert.match(html,/data-action="app-sync-enable"/); assert.doesNotMatch(html,/data-action="app-sync-disable"/);
    const risk = ui.riskBody(preview);
    assert.match(risk,/Authorization header/); assert.match(risk,/WAL/); assert.match(risk,/1\.1\.25/); assert.match(risk,/data\.db/);
    assert.match(risk,/Saved &lt;provider&gt;/); assert.doesNotMatch(risk,/<provider>/);
    assert.match(risk, locale === 'en' ? /plaintext.*backups|plaintext[\s\S]*backups/ : /明文[\s\S]*备份/);
    assert.match(risk, locale === 'en' ? /does not erase keys/ : /不会清除/);
  }
});

test('closing enablement after preview has no mutation and affirmative confirmation is one-shot', async () => {
  const h = harness(command => command === 'preview_app_sync_enable' ? preview : {enabled:true,phase:'pendingSync'});
  h.controller.handle('app-sync-enable');
  assert.equal(h.calls.length,0);
  const chooser = h.dialogs.at(-1).root;
  await chooser.nodes['[data-sync-preview]'].click(); assert.equal(h.calls.length,0);
  chooser.inputs[0].checked=true;
  await chooser.nodes['[data-sync-preview]'].click();
  assert.deepEqual(h.calls,[['preview_app_sync_enable',{connectionIds:['saved']}]]);
  const abandoned = h.dialogs.at(-1).root; abandoned.isConnected=false;
  await abandoned.nodes['[data-sync-confirm]'].click(); assert.equal(h.calls.length,1);
  h.controller.handle('app-sync-enable'); const second=h.dialogs.at(-1).root; second.inputs[0].checked=true;
  await second.nodes['[data-sync-preview]'].click(); const risk=h.dialogs.at(-1).root;
  await risk.nodes['[data-sync-confirm]'].click(); await risk.nodes['[data-sync-confirm]'].click();
  assert.deepEqual(h.calls.at(-1),['enable_app_sync',{planId:'native-enable-id',confirmed:true}]);
  assert.equal(h.calls.filter(([command]) => command==='enable_app_sync').length,1);
  assert.equal(h.errors.length,0);
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
