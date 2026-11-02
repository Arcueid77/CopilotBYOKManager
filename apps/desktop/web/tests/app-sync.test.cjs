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
function harness(response, data = snapshot) {
  const calls = [], dialogs = [], errors = [], statuses = [];
  let current;
  const controller = ui.create({ snapshot: () => data, async invoke(command, args) { calls.push([command,args]); return response(command,args); }, setStatus: status => statuses.push(status),
    openModal(config) {
      const nodes = Object.fromEntries(['[data-sync-preview]','[data-sync-confirm]','[data-sync-error]','[data-sync-count]','[data-sync-revoke]','[data-app-models-resolved]'].map(key => [key,element()]));
      const inputs = data.connections.filter(c => c.enabled !== false).map(c => Object.assign(element(), {value:c.id}));
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
  chooser.inputs[0].handlers.change();
  await chooser.nodes['[data-sync-preview]'].click();
  assert.deepEqual(h.calls,[['preview_app_sync_enable',{connectionIds:['saved']}]]);
  const abandoned = h.dialogs.at(-1).root; abandoned.isConnected=false;
  await abandoned.nodes['[data-sync-confirm]'].click(); assert.equal(h.calls.length,1);
  h.controller.handle('app-sync-enable'); const second=h.dialogs.at(-1).root; second.inputs[0].checked=true; second.inputs[0].handlers.change();
  await second.nodes['[data-sync-preview]'].click(); const risk=h.dialogs.at(-1).root;
  await risk.nodes['[data-sync-confirm]'].click(); await risk.nodes['[data-sync-confirm]'].click();
  assert.deepEqual(h.calls.at(-1),['enable_app_sync',{planId:'native-enable-id',confirmed:true}]);
  assert.equal(h.calls.filter(([command]) => command==='enable_app_sync').length,1);
  assert.equal(h.errors.length,0);
});

test('provider choice is compact, empty by default, bounded to sixteen and does not query on selection', async () => {
  const data={connections:Array.from({length:17},(_,i)=>({...provider,id:`p${i}`,baseUrl:'https://fixture.invalid/v1',name:`Provider ${i}`}))};
  const h=harness(()=>preview,data);h.controller.handle('app-sync-enable');
  const dialog=h.dialogs.at(-1),root=dialog.root,button=root.nodes['[data-sync-preview]'];
  assert.equal(dialog.config.compact,true);assert.equal(button.disabled,true);assert.equal(h.calls.length,0);
  assert.match(dialog.config.body,/app-sync-choice-content/);assert.match(dialog.config.body,/fixture.invalid\/v1/);
  root.inputs.forEach(input=>{input.checked=true;input.handlers.change();});
  assert.equal(button.disabled,true);await button.click();assert.equal(h.calls.length,0);
  root.inputs[16].checked=false;root.inputs[16].handlers.change();assert.equal(button.disabled,false);
  assert.match(root.nodes['[data-sync-count]'].textContent,/16/);
});

test('failed preparation keeps selection and reports an escaped inline error without enabling sync', async () => {
  for(const locale of ['en','zh-CN']) {
    i18n.setLocale(locale,{persist:false});
    const h=harness(()=>{throw Error('Native <detail>');});h.controller.handle('app-sync-enable');
    const root=h.dialogs.at(-1).root;root.inputs[0].checked=true;root.inputs[0].handlers.change();
    await root.nodes['[data-sync-preview]'].click();
    assert.equal(root.inputs[0].checked,true);assert.equal(root.nodes['[data-sync-preview]'].disabled,false);
    assert.equal(root.nodes['[data-sync-error]'].hidden,false);assert.match(root.nodes['[data-sync-error]'].innerHTML,/Native &lt;detail&gt;/);
    assert.equal(h.calls.length,1);assert.equal(h.errors.length,0);assert.equal(h.dialogs.length,1);
  }
});

test('scope controls are disabled while the native preview is preparing', async () => {
  let resolve;const h=harness(()=>new Promise(done=>{resolve=done;}));h.controller.handle('app-sync-enable');
  const root=h.dialogs.at(-1).root;root.inputs[0].checked=true;root.inputs[0].handlers.change();
  const pending=root.nodes['[data-sync-preview]'].click();
  assert.equal(root.inputs[0].disabled,true);assert.equal(root.nodes['[data-sync-preview]'].disabled,true);
  resolve(preview);await pending;assert.equal(h.dialogs.length,2);
  assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'preview_app_sync_enable');
});

test('native failure codes distinguish running App, permissions and write contention in both languages',()=>{
  for(const locale of ['zh-CN','en']) {
    i18n.setLocale(locale,{persist:false});
    const running=ui.preparationError({code:'appRunning',message:'ignored payload'});
    const busy=ui.preparationError({code:'writeBusy',message:'ignored payload'});
    const permissions=ui.preparationError({code:'unsafePermissions'});
    assert.notEqual(running,busy);
    assert.match(running,locale==='en'?/tray menu/:/托盘菜单/);
    assert.match(permissions,locale==='en'?/permissions/:/权限/);
    assert.notEqual(ui.preparationError({code:'appExitUnverified'}),running);
    assert.notEqual(ui.preparationError({message:'Another managed write is in progress'}),busy);
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

test('confirmation failures use typed localized guidance and never replay a consumed plan', async () => {
  for(const locale of ['zh-CN','en']) {
    i18n.setLocale(locale,{persist:false});
    const failure={code:'appRunning',message:'Native diagnostic'};
    const h=harness(command=>{if(command==='preview_app_sync_enable')return preview;throw failure;});
    h.controller.handle('app-sync-enable');
    const choice=h.dialogs.at(-1).root;choice.inputs[0].checked=true;choice.inputs[0].handlers.change();
    await choice.nodes['[data-sync-preview]'].click();
    const confirm=h.dialogs.at(-1).root.nodes['[data-sync-confirm]'];
    await confirm.click();await confirm.click();
    assert.equal(h.calls.filter(([command])=>command==='enable_app_sync').length,1);
    assert.equal(h.statuses.length,0);assert.equal(h.errors.length,1);
    assert.equal(h.errors[0].message,ui.preparationError(failure));
    assert.equal(h.errors[0].cause,failure);
  }
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
