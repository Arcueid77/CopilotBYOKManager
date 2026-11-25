// Fresh headless browser and synthetic native API only. No client/account/key access.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.COPILOT_BYOK_MANAGER_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../apps/desktop/web');
const outputPrefix=path.resolve(process.env.COPILOT_BYOK_MANAGER_CAPTURE_DIR||'target/workspace-review');
fs.mkdirSync(path.dirname(outputPrefix),{recursive:true});
const output=fs.mkdtempSync(outputPrefix+'-');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
function fixture(){
  const model=(id,name)=>({id:'native-'+id,modelId:id,name,enabled:true,capabilities:{contextWindow:32000,toolCalling:true,vision:null,reasoning:null,maxOutputTokens:null}});
  const provider=(id,name)=>({id,name,enabled:true,baseUrl:'https://'+id+'.example.invalid/v1',providerKind:'openai',protocol:'chat-completions',headers:{'X-Example':'retained'},models:[model(id+'-code','Code Model'),model(id+'-chat','Chat Model')],hasSecret:true,createdAt:'2026-11-03T00:00:00Z',updatedAt:'2026-11-03T00:00:00Z'});
  const client=(id,kind,name)=>({id,kind,name,detail:'Synthetic installation',path:'C:\\fixture\\'+id,detected:true,supportsWrite:true,status:'available'});
  const state={version:2,statePath:'C:\\fixture\\state.json',connections:[provider('north','Northstar'),provider('team','团队网关 · Development & Research'),{...provider('local','Local Lab'),enabled:false}],
    clients:[client('vscode:stable:default','vs-code-copilot','VS Code Stable'),client('vscode:insiders:default','vs-code-copilot','VS Code Insiders'),client('cli','copilot-cli','GitHub Copilot CLI'),{...client('app','github-copilot-app','GitHub Copilot App'),supportsWrite:false,status:'read-only'},client('idea','jetbrains-copilot','IntelliJ IDEA'),client('pycharm','jetbrains-copilot','PyCharm')],
    clientConfigurations:[{targetId:'vscode:stable:default',state:'available',sources:[{connectionId:'north',name:'Northstar',modelCount:2}]},{targetId:'vscode:insiders:default',state:'available',sources:[]},{targetId:'cli',state:'available',sources:[{connectionId:'north',name:'Northstar',modelCount:2},{connectionId:'team',name:'团队网关 · Development & Research',modelCount:2}]},{targetId:'idea',state:'available',sources:[]},{targetId:'pycharm',state:'available',sources:[]}],deployments:[],credentialStatuses:{},usageDb:{state:'available',schemaVersion:3}};
  const sync={reviewSupported:true,enabled:false,phase:'disabled',selectedConnectionIds:[],ownedConnectionIds:[],results:[]};
  const plans=new Map();let counter=0;
  window.__fixture={state,sync,calls:[],saved:null,failApply:false};
  function importRows(targetIds) {
    return (window.__fixture.importCandidates||[]).map(row=>{
      const saved=state.connections.find(p=>p.baseUrl===row.baseUrl&&p.protocol===row.protocol);
      const pending=row.models.filter(m=>!saved?.models.some(existing=>existing.modelId===m.modelId));
      const keyStatus=saved?.hasSecret?undefined:row.keyStatus;
      return {...row,sourceIds:row.sourceIds.filter(id=>!targetIds||targetIds.includes(id)),
        action:saved?(pending.length?'extend':keyStatus==='available'?'fillKey':'saved'):'create',newModels:pending.length,keyStatus};
    }).filter(row=>row.sourceIds.length);
  }
  window.__TAURI__={core:{invoke:async(command,args={})=>{
    window.__fixture.calls.push(command);
    if(command==='set_tray_locale')return;
    if(command==='get_dashboard')return structuredClone(state);
    if(command==='list_existing_providers'){
      const rows=window.__fixture.existingProviders?.[args.targetId];
      if(!rows)throw 'unavailable';
      const inventoryId='existing-'+(++counter);
      plans.set(inventoryId,{targetId:args.targetId,rows});
      return {inventoryId,entries:structuredClone(rows),sharedInstances:2};
    }
    if(command==='preview_existing_provider_change'){
      const inventory=plans.get(args.inventoryId);
      assertFixture(inventory?.rows[args.providerIndex]);
      const planId='edit-existing-'+(++counter);
      plans.set(planId,{...inventory,providerIndex:args.providerIndex,change:args.change});
      return planId;
    }
    if(command==='apply_existing_provider_change'){
      const plan=plans.get(args.planId);plans.delete(args.planId);assertFixture(args.confirmed&&plan);
      if(plan.change.kind==='delete')plan.rows.splice(plan.providerIndex,1);
      else for(const change of plan.change.fields){
        const row=plan.rows[plan.providerIndex],field=row.fields[change.index];
        field.value=change.value;
        if(field.kind==='name')row.name=change.value;
      }
      state.clientConfigurations.find(c=>c.targetId===plan.targetId).sources=plan.rows.map(row=>({name:row.name,modelCount:row.modelCount}));
      return;
    }
    if(command==='get_provider_import_availability'){
      const targetIds=[...new Set(importRows().filter(row=>row.action!=='saved').flatMap(row=>row.sourceIds))];
      return {targetIds,batch:targetIds.length>0};
    }
    if(command==='preview_provider_import'){
      const selected=args.targetIds;
      window.__fixture.lastImportTargets=selected;
      const candidates=importRows(selected);
      const planId='extract-'+(++counter);
      plans.set(planId,{candidates});
      return {planId,candidates:structuredClone(candidates),issues:[]};
    }
    if(command==='apply_provider_import'){
      const plan=plans.get(args.planId);assertFixture(plan?.candidates);plans.delete(args.planId);
      const ids=[];let created=0,updated=0,keysImported=0;
      window.__fixture.lastImportConsent=args.includeApiKeys;
      for(const id of args.selectedIds){
        const row=plan.candidates.find(c=>c.id===id&&c.action!=='saved');assertFixture(row);
        assertFixture(row.action!=='fillKey'||args.includeApiKeys===true);
        const copyKey=args.includeApiKeys===true&&row.keyStatus==='available';
        const saved=state.connections.find(p=>p.baseUrl===row.baseUrl&&p.protocol===row.protocol);
        if(saved){
          if(row.newModels){
            saved.models.push(...row.models.filter(m=>!saved.models.some(existing=>existing.modelId===m.modelId)).map(m=>model(m.modelId,m.name)));
            updated++;
          }
          if(copyKey){saved.hasSecret=true;keysImported++;}
          ids.push(saved.id);
        }else{
          const connection={...provider('import-'+id,row.name),baseUrl:row.baseUrl,protocol:row.protocol,hasSecret:copyKey,headers:{},
            models:row.models.map(m=>model(m.modelId,m.name))};
          if(copyKey)keysImported++;
          ids.push(connection.id);state.connections.push(connection);created++;
        }
      }
      return {created,updated,keysImported,connectionIds:ids};
    }
    if(command==='get_app_sync_status')return structuredClone(sync);
    if(command==='enable_app_sync_waiting'){
      Object.assign(sync,{enabled:true,phase:'waitingForProviders',selectedConnectionIds:[]});
      const app=state.clients.find(c=>c.kind==='github-copilot-app');
      Object.assign(app,{supportsWrite:true,status:'available'});
      if(!state.clientConfigurations.some(c=>c.targetId===app.id))state.clientConfigurations.push({targetId:app.id,state:'available',sources:[]});
      return structuredClone(sync);
    }
    if(command==='get_manual_provider_status'||command==='get_installation_status'||command==='get_install_runs')return [];
    if(command==='get_setup_status')return {preferences:{},accounts:{surfaces:[],loginRuns:[]}};
    if(command==='get_window_behavior')return {trayAvailable:true,preferencesAvailable:true,closeAction:'tray',closeToTray:true};
    if(command==='set_close_action')return {trayAvailable:true,preferencesAvailable:true,closeAction:args.action,closeToTray:args.action==='tray'};
    if(command==='upsert_connection'){
      window.__fixture.saved=structuredClone(args.input);const input=args.input,existing=state.connections.find(c=>c.id===input.id);
      const saved={...existing,...input,id:input.id||'created-provider',hasSecret:existing?.hasSecret||Boolean(input.apiKey),enabled:existing?.enabled??true};delete saved.apiKey;delete saved.clearSecret;
      if(existing)state.connections[state.connections.indexOf(existing)]=saved;else state.connections.push(saved);return structuredClone(saved);
    }
    if(command==='set_connection_enabled'){state.connections.find(c=>c.id===args.connectionId).enabled=args.enabled;return true;}
    if(command==='discover_connection_models')return {status:'available',models:[{modelId:'synthetic-new',name:'New Model'}]};
    if(command==='preview_deployment'){
      const id='plan-'+(++counter),connection=state.connections.find(c=>c.id===args.connectionId);
      const operations=args.targetIds.map(targetId=>{
        const target=state.clients.find(c=>c.id===targetId);
        const missingKey=target.kind==='jetbrains-copilot'&&target.supportsWrite&&!connection.hasSecret;
        return {targetId,targetKind:target.kind,title:target.name,supported:!missingKey&&(target.supportsWrite||(target.kind==='github-copilot-app'&&sync.enabled)),
          blocker:missingKey?'missingProviderKey':undefined,description:missingKey?'Save a provider API key before publishing to JetBrains':'Synthetic owned provider update',changes:['Synthetic model catalog'],requiresRestart:true};
      });
      const plan={id,connectionId:connection.id,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString(),targetIds:args.targetIds,operations};
      if (plan.operations.some(op=>op.targetKind==='github-copilot-app'&&op.supported)) {
        const app=plan.operations.find(operation=>operation.targetKind==='github-copilot-app');
        if(window.__fixture.appRunning)Object.assign(app,{supported:false,blocker:'clientRunning',description:'Quit Copilot App and preview again'});
        else plan.appScopeConfirmation=!sync.selectedConnectionIds.includes(connection.id);
      }
      plans.set(id,plan);return structuredClone(plan);
    }
    if(command==='discard_deployment_preview'){plans.delete(args.planId);return;}
    if(command==='apply_deployment_plan'){
      const plan=plans.get(args.planId);plans.delete(args.planId);if(!plan||!args.confirmed)throw Error('One-shot plan unavailable');
      if(plan.appScopeConfirmation)assertFixture(args.appScopeConfirmed);
      if(window.__fixture.failApply)throw Error('Synthetic write failure');
      if(plan.appScopeConfirmation)sync.selectedConnectionIds.push(plan.connectionId);
      const records=plan.operations.map(op=>({id:'record-'+(++counter),planId:plan.id,connectionId:plan.connectionId,targetId:op.targetId,targetKind:op.targetKind,status:op.supported?'applied':'skipped',blocker:op.blocker,createdAt:new Date().toISOString()}));
      state.deployments.unshift(...records);
      for(const record of records.filter(r=>r.status==='applied')){
        const config=state.clientConfigurations.find(c=>c.targetId===record.targetId),provider=state.connections.find(c=>c.id===record.connectionId);
        if(config){config.sources=config.sources.filter(s=>s.connectionId!==provider.id);config.sources.push({connectionId:provider.id,name:provider.name,modelCount:provider.models.filter(m=>m.enabled).length});}
      }
      return {planId:plan.id,records};
    }
    if(command==='disable_app_sync'){sync.enabled=false;sync.phase='disabled';Object.assign(state.clients.find(c=>c.kind==='github-copilot-app'),{supportsWrite:false,status:'read-only'});return structuredClone(sync);}
    throw Error('Unallowlisted synthetic call: '+command);
  }},event:{listen:async()=>()=>{}}};
  function assertFixture(value){if(!value)throw Error('Invalid synthetic consent');}
}
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.COPILOT_BYOK_MANAGER_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const errors=[],results=[];
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'zh-CN'});await context.addInitScript(fixture);
  const origin='http://127.0.0.1:'+server.address().port;
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const visit=async route=>{await page.locator(`#primary-nav [data-route="${route}"]`).click();await page.locator(`#content[data-route="${route}"]`).waitFor();};
  const capture=async name=>{await page.screenshot({path:path.join(output,name+'.png'),fullPage:!(await page.locator('.modal').count())});};
  const geometry=async()=>{
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow');
    const icons=await page.locator('.app-icon:visible').evaluateAll(elements=>elements.map(element=>{const a=element.getBoundingClientRect(),b=element.querySelector('svg').getBoundingClientRect();return {dx:Math.abs(a.x+a.width/2-b.x-b.width/2),dy:Math.abs(a.y+a.height/2-b.y-b.height/2),ratio:b.width/a.width};}));
    for(const icon of icons){assert.ok(icon.dx<=1&&icon.dy<=1,'Application icon must be centered');assert.ok(icon.ratio>=.7,'Application icon must fill its icon area');}
    const actions=await page.locator('.text-button:visible, .button.ghost:visible, .icon-button:visible').evaluateAll(elements=>elements.map(element=>{const style=getComputedStyle(element);return {border:parseFloat(style.borderTopWidth),background:style.backgroundColor,height:element.getBoundingClientRect().height};}));
    for(const action of actions){assert.ok(action.border>=1&&action.height>=28,'Actions need visible boundaries and a usable hit area');assert.notEqual(action.background,'rgba(0, 0, 0, 0)');}
  };
  try{
    await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#content[data-route="overview"]').waitFor();
    if(process.argv.includes('--capture-only')){
      for(const route of ['overview','connections','clients','about']){await visit(route);await capture(route);}
      console.log(JSON.stringify({output,captureOnly:true}));return;
    }
    await geometry();await capture('overview-zh-light');
    assert.ok(await page.locator('#primary-nav').evaluate(element=>element.getBoundingClientRect().width>180),'Sidebar navigation must fill its pane');
    assert.equal(await page.locator('.app-status-list .status-row').count(),4);
    assert.equal(await page.evaluate(()=>window.__fixture.calls.some(c=>/get_setup_status|get_installation_status/.test(c))),false);
    results.push('Overview: real grouping, no eager installer/account queries');
    await visit('clients');await page.locator('[data-app-group="vscode"] [data-action="toggle-app-group"]').click();
    assert.equal(await page.locator('#instances-vscode .client-card:visible').count(),2);
    await page.locator('[data-app-group="jetbrains"] [data-action="toggle-app-group"]').click();
    assert.equal(await page.locator('#instances-jetbrains .client-card:visible').count(),2);
    await geometry();await capture('apps-grouped');results.push('Apps: four families and independent profile targets');
    await visit('connections');await page.locator('#provider-search').fill('团队');
    assert.equal(await page.locator('.provider-list-item').count(),1);await page.locator('#provider-search').fill('');
    await page.locator('[data-action="select-provider"][data-id="north"]').click();
    await capture('providers-zh-light');
    const modelRows=await page.locator('.provider-detail .model-row').evaluateAll(rows=>rows.map(row=>({x:row.getBoundingClientRect().x,y:row.getBoundingClientRect().y,bottom:row.getBoundingClientRect().bottom})));
    assert.ok(modelRows[1].y>=modelRows[0].bottom&&modelRows[1].x===modelRows[0].x,'Model rows must form a vertical list');
    await page.locator('.provider-detail-header [data-action="edit-connection"]').click();await page.locator('.modal.drawer').waitFor();
    const box=await page.locator('[data-draft-model="0"]').boundingBox();assert.equal(box.width,17);assert.equal(box.height,17);
    await page.locator('[data-draft-model="0"]').uncheck();
    await page.locator('.modal-header [data-modal-close]').click();await page.locator('.modal-discard').waitFor();
    await page.locator('[data-keep-editing]').click();
    await page.locator('[data-manual-model-id]').fill('manual-model');await page.locator('[data-manual-model-name]').fill('Manual Model');
    await page.locator('[data-add-manual-model]').click();
    await page.locator('[data-prefer-draft="2"]').click();await capture('provider-editor');
    await page.locator('#save-connection').click();await page.locator('.modal').waitFor({state:'detached'});
    const saved=await page.evaluate(()=>window.__fixture.saved);
    assert.equal(saved.models[0].modelId,'manual-model');assert.equal(saved.models.find(m=>m.modelId==='north-code').enabled,false);
    assert.equal(saved.models.find(m=>m.modelId==='north-code').capabilities.contextWindow,32000);assert.equal(saved.headers['X-Example'],'retained');
    results.push('Drawer: dirty close guard, model flags/order, manual IDs and native capabilities retained');
    await page.locator('.provider-detail [data-action="deploy-connection"]').click();await page.locator('#publication-provider').waitFor();
    assert.equal(await page.locator('.manager-route-warning').count(),0);
    assert.equal(await page.locator('[name="deployment-target"][value="cli"]').isChecked(),true);
    assert.doesNotMatch(await page.locator('.manager-targets').innerText(),/providers\.json|主动勾选/);
    for(const input of await page.locator('[name="deployment-target"]:not([value="cli"])').all())await input.uncheck();
    await page.getByRole('button',{name:'确认发布',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__fixture.calls.filter(c=>c==='apply_deployment_plan').length),0);
    assert.equal(await page.locator('.deployment-write-details').getAttribute('open'),null);
    assert.match(await page.locator('.deployment-write-details').textContent(),/providers\.json/);
    await capture('publication-review');
    await page.locator('#publication-provider').selectOption('team');
    assert.deepEqual(await page.locator('[name="deployment-target"]:checked').evaluateAll(inputs=>inputs.map(input=>input.value)),['cli']);
    await page.locator('#apply-deployment').click();
    await page.locator('.modal').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.__fixture.calls.filter(c=>c==='apply_deployment_plan').length),1);
    assert.equal(await page.evaluate(()=>window.__fixture.state.clientConfigurations.find(c=>c.targetId==='cli').sources.length),2);
    results.push('Publication: CLI preselected, selection retained across providers, explicit confirmation and coexistence');

    await page.evaluate(()=>window.__fixture.state.connections.find(connection=>connection.id==='north').hasSecret=false);
    await page.locator('#refresh-button').click();
    await page.locator('[data-action="select-provider"][data-id="north"]').click();
    await page.locator('.provider-detail [data-action="deploy-connection"]').click();
    const ideaStatus=page.locator('.manager-target:has([value="idea"]) [data-target-status]');
    await ideaStatus.getByText('缺少 API 密钥，请在供应商页保存后再发布。',{exact:true}).waitFor();
    assert.equal(await page.locator('.manager-target:has([value="idea"])').getByText('可自动发布',{exact:true}).count(),0);
    assert.equal(await page.locator('.modal').getByText('需手动处理',{exact:true}).count(),0);
    await capture('publication-missing-provider-key');
    await page.locator('#publication-provider').selectOption('team');
    await ideaStatus.getByText('可自动发布',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__fixture.calls.filter(c=>c==='apply_deployment_plan').length),1);
    await page.locator('.modal-header [data-modal-close]').click();
    await page.evaluate(()=>window.__fixture.state.connections.find(connection=>connection.id==='north').hasSecret=true);
    results.push('JetBrains: preview explains the missing key on the target card and refreshes on provider change');
    await visit('clients');
    const appGroup=page.locator('[data-app-group="copilot-app"] .app-config-main');
    await appGroup.locator('[data-action="app-sync-enable"]').click();
    await appGroup.locator('[data-action="publish-family"]').waitFor();
    assert.equal(await page.locator('[data-app-sync-panel]').count(),0);
    const beforeApp=await page.evaluate(()=>window.__fixture.calls.filter(c=>c==='apply_deployment_plan').length);
    await page.evaluate(()=>Object.assign(window.__fixture.state.clients.find(c=>c.id==='app'),{supportsWrite:false,status:'read-only'}));
    await page.locator('#refresh-button').click();await visit('overview');
    await page.locator('#overview-publish-button').click();
    assert.equal(await page.locator('[name="deployment-target"][value="app"]').isChecked(),true);
    await page.getByRole('button',{name:'确认发布',exact:true}).waitFor();
    await page.locator('.modal-header [data-modal-close]').click();
    await visit('clients');
    await page.evaluate(()=>window.__fixture.appRunning=true);
    await appGroup.locator('[data-action="publish-family"]').click();
    await page.locator('#publication-provider').selectOption('north');
    await page.locator('[name="deployment-target"][value="vscode:stable:default"]').check();
    await page.getByText('退出 Copilot App 后重新核对。',{exact:true}).waitFor();
    await page.locator('.manager-target:has([value="vscode:stable:default"])').getByText('可自动发布',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__fixture.calls.filter(c=>c==='apply_deployment_plan').length),beforeApp);
    await page.evaluate(()=>window.__fixture.appRunning=false);
    await page.locator('#preview-deployment').click();
    await page.getByText('Copilot App 会在本地数据库中以明文保存此供应商的密钥，数据库日志和备份也可能保留该密钥。').waitFor();
    assert.equal(await page.locator('#apply-deployment').textContent(),'确认发布');
    assert.equal(await page.evaluate(()=>window.__fixture.calls.filter(c=>c==='apply_deployment_plan').length),beforeApp);
    await capture('app-shared-publication');
    await page.locator('#apply-deployment').click();await page.locator('.modal').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.__fixture.calls.filter(c=>c==='apply_deployment_plan').length),beforeApp+1);
    const appPublish=await page.evaluate(()=>window.__fixture.state.deployments.slice(0,2).map(record=>record.targetId));
    assert.deepEqual(new Set(appPublish),new Set(['app','vscode:stable:default']));
    assert.deepEqual(await page.evaluate(()=>window.__fixture.sync.selectedConnectionIds),['north']);
    await appGroup.locator('[data-action="publish-family"]').waitFor();
    results.push('App: default selection after enabling, automatic review, close-and-retry and one confirmation');
    const codeCard=page.locator('[data-client-id="vscode:stable:default"]');
    await codeCard.locator('.app-provider-select').selectOption('north');
    await codeCard.locator('[data-action="deploy-client"]').click();
    await page.locator('.modal').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.__fixture.calls.filter(c=>c==='apply_deployment_plan').length),beforeApp+2);
    results.push('An instance with the provider selected publishes ordinary configuration in one click');
    await page.evaluate(()=>{
      window.__fixture.sync.phase='syncedConfiguration';
      for(const client of window.__fixture.state.clients){
        client.supportsWrite=true;
        let config=window.__fixture.state.clientConfigurations.find(c=>c.targetId===client.id);
        if(!config){config={targetId:client.id,state:'available',sources:[]};window.__fixture.state.clientConfigurations.push(config);}
        config.state='available';config.sources=[{connectionId:'north',name:'Northstar',modelCount:2}];
      }
    });
    await page.locator('#refresh-button').click();await visit('overview');
    assert.deepEqual(await page.locator('.status-row .app-identity strong').allTextContents(),['GitHub Copilot · VS Code','GitHub Copilot · CLI','GitHub Copilot · App','GitHub Copilot · JetBrains']);
    assert.deepEqual(await page.locator('.status-row > .status-pill').allTextContents(),['已配置','已配置','已配置','已配置']);
    await page.evaluate(()=>{window.__fixture.state.clientConfigurations.find(c=>c.targetId==='app').state='unavailable';});
    await page.locator('#refresh-button').click();await page.waitForFunction(()=>document.querySelectorAll('.status-row > .status-pill.unavailable').length===1);
    await page.evaluate(()=>{window.__fixture.state.clientConfigurations.find(c=>c.targetId==='app').state='available';});
    await page.locator('#refresh-button').click();await page.waitForFunction(()=>document.querySelectorAll('.status-row > .status-pill.configured').length===4);
    await capture('unified-app-text');
    results.push('App text: canonical names/order and one configuration vocabulary; sync success never masks read errors');
    await visit('about');const before=await page.evaluate(()=>window.__fixture.calls.length);
    await page.locator('[data-theme-value][data-value="dark"]').click();
    assert.equal(await page.evaluate(()=>window.__fixture.calls.length),before);
    await page.locator('[data-interface-language]').selectOption('en');
    await capture('about-en-dark');
    for(const viewport of [{width:1180,height:760},{width:960,height:640}]){
      await page.setViewportSize(viewport);
      for(const route of ['overview','connections','clients','about']){await visit(route);await geometry();}
      results.push(`English/dark layout: ${viewport.width}x${viewport.height}`);
    }
    await visit('connections');await page.locator('.provider-detail-header [data-action="edit-connection"]').click();
    await geometry();const saveBox=await page.locator('#save-connection').boundingBox();assert.ok(saveBox.y+saveBox.height<=page.viewportSize().height);await capture('editor-en-small');
    await page.locator('.modal-header [data-modal-close]').click();
    await page.evaluate(()=>{
      const {state,sync,calls}=window.__fixture;
      state.connections=[];state.clientConfigurations.forEach(c=>{c.sources=[];});
      const app=state.clients.find(c=>c.kind==='github-copilot-app');
      app.supportsWrite=false;app.status='read-only';
      Object.assign(sync,{enabled:false,phase:'disabled',selectedConnectionIds:[]});calls.length=0;
    });
    await page.locator('#refresh-button').click();
    await visit('clients');
    await appGroup.getByRole('button',{name:'Enable sync',exact:true}).click();
    await appGroup.locator('[data-action="publish-family"]').click();
    await page.locator('#connection-name').fill('First provider');
    await page.locator('input[name="baseUrl"]').fill('https://first.example.invalid/v1');
    await page.locator('[data-manual-model-id]').fill('first-model');
    await page.locator('[data-add-manual-model]').click();
    await page.locator('#save-connection').click();
    await page.locator('.modal').waitFor({state:'detached'});
    await visit('clients');
    await appGroup.locator('[data-action="publish-family"]').click();
    await page.getByText('After publishing, saved changes to this provider sync to Copilot App.').waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__fixture.sync.selectedConnectionIds),[]);
    await page.locator('#apply-deployment').click();
    await page.waitForFunction(()=>window.__fixture.sync.selectedConnectionIds.includes('created-provider'));
    await page.locator('.modal').waitFor({state:'detached'});
    results.push('Empty App: enable without providers, add one and publish through the shared flow');
    await visit('about');await page.locator('[data-interface-language]').selectOption('zh-CN');
    await page.setViewportSize({width:1320,height:880});
    await page.evaluate(()=>{
      const f=window.__fixture;
      f.state.connections=[];
      const ids=['vscode:stable:default','cli','app','idea'];
      f.state.clients=f.state.clients.filter(c=>ids.includes(c.id));
      for(const c of f.state.clientConfigurations)c.sources=['vscode:stable:default','idea'].includes(c.targetId)?[{name:'MiniMax',modelCount:2}]:[];
      Object.assign(f.sync,{enabled:true,phase:'waitingForProviders',selectedConnectionIds:[]});
      f.importCandidates=[
        {id:'mini',name:'MiniMax',baseUrl:'https://minimax.example.invalid/v1',protocol:'messages',kind:'anthropic',sourceIds:['vscode:stable:default','idea'],
          models:[{modelId:'example-code',name:'Example Code'},{modelId:'example-chat',name:'Example Chat'}],newModels:2},
      ];
      f.calls.length=0;
    });
    await page.locator('#refresh-button').click();await visit('overview');
    await page.getByRole('heading',{name:'在 2 类应用中发现了供应商'}).waitFor();
    const coordinates=await page.locator('.app-status-list').evaluate(el=>[...el.querySelectorAll('.status-row')].map(row=>
      ['.app-identity','.roster-providers','.status-pill','.roster-actions'].map(sel=>Math.round(row.querySelector(sel).getBoundingClientRect().x))));
    for(const row of coordinates)assert.deepEqual(row,coordinates[0]);
    await capture('provider-extraction-overview');
    await page.locator('[data-roster-app="jetbrains"] [data-action="import-family"]').click();
    await page.locator('.import-choice').waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__fixture.lastImportTargets),['idea']);
    await page.locator('.modal-header [data-modal-close]').click();
    assert.equal(await page.evaluate(()=>window.__fixture.state.connections.length),0);
    await page.locator('[data-roster-app="jetbrains"] [data-action="open-app-group"]').click();
    await page.locator('[data-client-id="idea"] [data-action="import-instance"]').click();
    await page.locator('.import-choice').waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__fixture.lastImportTargets),['idea']);
    await page.locator('.modal-header [data-modal-close]').click();
    await visit('overview');
    await page.evaluate(()=>{
      const f=window.__fixture;
      f.importCandidates.push({id:'lab',name:'Local Lab',baseUrl:'http://127.0.0.1:11434/v1',protocol:'chat-completions',kind:'local',
        sourceIds:['cli'],models:[{modelId:'local-code',name:'Local Code'}],newModels:1});
      f.state.clientConfigurations.find(c=>c.targetId==='cli').sources=[{name:'Local Lab',modelCount:1}];
    });
    await page.locator('#refresh-button').click();
    await page.getByRole('heading',{name:'在 3 类应用中发现了供应商'}).waitFor();
    await page.locator('[data-action="import-providers"]').click();
    await page.locator('[data-import-only="mini"]').click();
    assert.equal(await page.locator('[data-import-choice]:checked').count(),1);
    assert.equal(await page.locator('.import-choice').filter({hasText:'MiniMax'}).locator('.import-origin span').count(),2);
    await capture('provider-extraction-selection');
    await page.locator('[data-import-save]').click();await page.locator('#content[data-route="connections"]').waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__fixture.state.connections.map(p=>p.name)),['MiniMax']);
    await visit('overview');
    await page.locator('[data-roster-app="cli"] [data-action="import-family"]').waitFor();
    assert.equal(await page.locator('[data-roster-app="vscode"] [data-action="import-family"]').isVisible(),false);
    assert.equal(await page.locator('[data-roster-app="jetbrains"] [data-action="import-family"]').isVisible(),false);
    await page.locator('[data-roster-app="jetbrains"] [data-action="open-app-group"]').click();
    assert.equal(await page.locator('[data-client-id="idea"] [data-action="import-instance"]').isVisible(),false);
    await page.locator('#import-providers-button').click();
    await page.locator('[data-import-choice][value="lab"]').waitFor();
    assert.equal(await page.locator('[data-import-choice][value="mini"]').count(),0);
    await page.locator('[data-import-save]').click();await page.locator('.modal').waitFor({state:'detached'});
    await page.locator('#content[data-route="connections"]').waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__fixture.state.connections.map(p=>p.name)),['MiniMax','Local Lab']);
    await visit('overview');
    assert.equal(await page.locator('#import-providers-button').isVisible(),false);
    assert.equal(await page.locator('[data-action="import-family"]:visible').count(),0);
    await capture('provider-extraction-complete');

    await page.evaluate(()=>{
      const mini=window.__fixture.importCandidates.find(row=>row.id==='mini');
      mini.sourceIds=['app'];
      mini.models.push({modelId:'example-new',name:'Example New'});
    });
    await page.locator('#refresh-button').click();
    await page.locator('[data-roster-app="copilot-app"] [data-action="import-family"]').waitFor();
    assert.equal(await page.locator('[data-action="import-family"]:visible').count(),1);
    await page.locator('[data-roster-app="copilot-app"] [data-action="open-app-group"]').click();
    await page.locator('[data-client-id="app"] [data-action="import-instance"]').click();
    await page.getByText('补充 1 个模型',{exact:true}).waitFor();
    await page.locator('[data-import-save]').click();
    await page.locator('#content[data-route="connections"]').waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__fixture.state.connections[0].models.map(m=>m.modelId)),['example-code','example-chat','example-new']);
    assert.equal(await page.locator('#import-providers-button').isVisible(),false);
    results.push('Provider extraction: deduplicated review, saved actions disappear, a new model restores just its own action');

    assert.equal(await page.evaluate(()=>window.__fixture.lastImportConsent),false);
    await page.evaluate(()=>window.__fixture.importCandidates.find(row=>row.id==='mini').keyStatus='available');
    await page.locator('#refresh-button').click();
    await page.locator('#import-providers-button').click();
    await page.getByText('补充 API Key',{exact:true}).waitFor();
    const consent=page.locator('[data-import-key-consent]');
    assert.equal(await consent.isChecked(),false);
    assert.equal(await page.locator('[data-import-save]').isDisabled(),true);
    await page.getByText('密钥只保存在本机系统凭据库。提取过程不联网、不上传。',{exact:true}).waitFor();
    await page.locator('.modal-header [data-modal-close]').click();
    assert.equal(await page.evaluate(()=>window.__fixture.state.connections[0].hasSecret),false);
    await page.locator('#import-providers-button').click();
    await consent.check();
    await page.getByRole('button',{name:'保存 API Key',exact:true}).click();
    await page.getByText('已在本机保存 1 个 API Key。',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__fixture.lastImportConsent),true);
    assert.equal(await page.evaluate(()=>window.__fixture.state.connections[0].hasSecret),true);
    assert.equal(await page.locator('#import-providers-button').isVisible(),false);
    results.push('Provider keys: local-only disclosure, explicit opt-in, cancellation and key-only completion');

    await page.evaluate(()=>{
      window.__fixture.existingProviders={idea:[
        {name:'MiniMax',modelCount:2,fields:[{kind:'name',value:'MiniMax'},{kind:'modelEndpoint',value:'https://minimax.example.invalid/v1',model:'example-chat'}]},
        {name:'Another source',modelCount:1,fields:[{kind:'name',value:'Another source'}]},
      ]};
    });
    await visit('overview');
    await page.locator('[data-roster-app="jetbrains"] [data-action="open-app-group"]').click();
    const ide=page.locator('[data-client-id="idea"]');
    assert.equal(await ide.locator('[data-action="import-instance"]').isVisible(),false);
    const manage=ide.locator('[data-action="manage-existing-providers"]');
    await manage.click();
    await page.locator('[data-existing-edit="0"]').click();
    await page.locator('[data-existing-field="0"]').fill('Client MiniMax');
    await page.locator('[data-existing-save]').click();
    await ide.getByText('Client MiniMax',{exact:false}).waitFor();
    assert.equal(await page.evaluate(()=>window.__fixture.state.connections[0].name),'MiniMax');
    await manage.click();
    await page.locator('[data-existing-delete="0"]').click();
    await page.getByText('这份配置由 2 个应用实例共用。').waitFor();
    await page.getByRole('button',{name:'取消',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__fixture.existingProviders.idea.length),2);
    await manage.click();
    await page.locator('[data-existing-delete="0"]').click();
    await page.locator('[data-existing-confirm]').click();
    await ide.getByText('Another source',{exact:false}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__fixture.existingProviders.idea.map(row=>row.name)),['Another source']);
    assert.equal(await page.evaluate(()=>window.__fixture.state.connections[0].name),'MiniMax');
    results.push('Existing source management: edit without extracting, cancel deletion, confirm deletion only for the selected provider');

    for(const [state,hasProviders,writable,label] of [
      ['available',true,true,'已配置'],['available',false,true,'未配置'],
      ['unavailable',false,true,'需核对状态'],['unsupported',false,false,'不支持自动发布'],
    ]) {
      await page.evaluate(({state,hasProviders})=>{
        const f=window.__fixture;
        Object.assign(f.sync,{enabled:true,reviewSupported:true,selectedConnectionIds:[],ownedConnectionIds:[]});
        for(const client of f.state.clients)Object.assign(client,{supportsWrite:true,status:'available'});
        f.state.clientConfigurations=f.state.clients.map(client=>({targetId:client.id,state,
          sources:hasProviders?[{name:'Existing provider',connectionId:null,modelCount:1}]:[]}));
      },{state,hasProviders});
      await page.locator('#refresh-button').click();await visit('overview');
      const roster=page.locator('.status-row > .status-pill');
      await page.waitForFunction(expected=>[...document.querySelectorAll('.status-row > .status-pill')].map(node=>node.textContent).join('|')===Array(4).fill(expected).join('|'),label);
      assert.deepEqual(await roster.allTextContents(),Array(4).fill(label));
      await visit('clients');
      for(const button of await page.locator('[data-action="toggle-app-group"]').all())if(await button.getAttribute('aria-expanded')==='false')await button.click();
      assert.deepEqual(await page.locator('.app-config-main > .status-pill').allTextContents(),Array(4).fill(label));
      assert.deepEqual(await page.locator('.client-card:visible .client-header > .status-pill').allTextContents(),Array(4).fill(label));
      assert.equal(await page.locator('.app-config-main [data-action="publish-family"]').count(),writable?4:0);
      if(hasProviders){
        assert.equal(await page.locator('.client-card:visible [data-action="manage-existing-providers"]').count(),4);
        const appCard=page.locator('[data-client-id="app"]');
        await appCard.locator('[data-action="manage-existing-providers"]').click();
        await page.locator('.existing-provider-row').getByText('Existing provider',{exact:true}).waitFor();
        assert.equal(await page.locator('[data-existing-delete]').count(),0,'An unmanaged App row stays read-only');
        await page.locator('.modal-header [data-modal-close]').click();
      }
    }
    results.push('All four clients share configured, empty, unreadable and unsupported states across overview, group and instance');
    await page.evaluate(()=>{
      const f=window.__fixture;
      f.state.deployments=[{planId:'previous',targetId:'jetbrains:retired-profile-fixture',targetKind:'jetbrains-copilot',connectionId:f.state.connections[0].id,
        status:'skipped',blocker:'missingProviderKey',detail:'Fixture diagnostic',createdAt:new Date().toISOString()}];
    });
    await page.locator('#refresh-button').click();
    await page.locator('.manager-result-targets:visible').getByText('缺少 API 密钥，请在供应商页保存后再发布。',{exact:true}).waitFor();
    await page.locator('#publication-history > summary').click();
    const history=page.locator('#publication-history');
    await history.getByText('缺少 API 密钥，请在供应商页保存后再发布。',{exact:true}).waitFor();
    assert.match(await history.innerText(),/GitHub Copilot · JetBrains/);
    assert.doesNotMatch(await history.innerText(),/retired-profile-fixture/);
    results.push('Latest operation and history keep a canonical name and the same per-target reason');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,results,errors},null,2));
    console.log(JSON.stringify({output,passed:true,cases:results}));
  }finally{await browser.close();server.close();}
}
main().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),error.stack);console.error(error.stack);server.close();process.exitCode=1;});
