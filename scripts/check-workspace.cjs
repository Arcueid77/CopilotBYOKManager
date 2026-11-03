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
  window.__TAURI__={core:{invoke:async(command,args={})=>{
    window.__fixture.calls.push(command);
    if(command==='set_tray_locale')return;
    if(command==='get_dashboard')return structuredClone(state);
    if(command==='get_app_sync_status')return structuredClone(sync);
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
      const plan={id,connectionId:connection.id,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString(),targetIds:args.targetIds,operations:args.targetIds.map(targetId=>{const target=state.clients.find(c=>c.id===targetId);return {targetId,targetKind:target.kind,title:target.name,supported:target.supportsWrite,description:'Synthetic owned provider update',changes:['Synthetic model catalog'],requiresRestart:true};})};plans.set(id,plan);return structuredClone(plan);
    }
    if(command==='apply_deployment_plan'){
      const plan=plans.get(args.planId);plans.delete(args.planId);if(!plan||!args.confirmed)throw Error('One-shot plan unavailable');
      if(window.__fixture.failApply)throw Error('Synthetic write failure');
      const records=plan.operations.map(op=>({id:'record-'+(++counter),planId:plan.id,connectionId:plan.connectionId,targetId:op.targetId,targetKind:op.targetKind,status:op.supported?'applied':'skipped',createdAt:new Date().toISOString()}));
      state.deployments.unshift(...records);
      for(const record of records.filter(r=>r.status==='applied')){
        const config=state.clientConfigurations.find(c=>c.targetId===record.targetId),provider=state.connections.find(c=>c.id===record.connectionId);
        if(config){config.sources=config.sources.filter(s=>s.connectionId!==provider.id);config.sources.push({connectionId:provider.id,name:provider.name,modelCount:provider.models.filter(m=>m.enabled).length});}
      }
      return {planId:plan.id,records};
    }
    if(command==='preview_app_sync_enable')return {id:'sync-plan',appVersion:'1.1.25',databasePath:'C:\\fixture\\data.db',providers:state.connections.filter(c=>args.connectionIds.includes(c.id)).map(c=>({id:c.id,name:c.name,endpoint:c.baseUrl,protocol:c.protocol,modelCount:c.models.filter(m=>m.enabled).length}))};
    if(command==='enable_app_sync'){assertFixture(args.planId==='sync-plan'&&args.confirmed);sync.enabled=true;sync.phase='pendingSync';sync.selectedConnectionIds=['north'];return structuredClone(sync);}
    if(command==='disable_app_sync'){sync.enabled=false;sync.phase='disabled';return structuredClone(sync);}
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
    assert.equal(await page.locator('[name="deployment-target"][value="cli"]').isChecked(),false);
    assert.doesNotMatch(await page.locator('.manager-targets').innerText(),/providers\.json|主动勾选/);
    for(const input of await page.locator('[name="deployment-target"]').all())await input.uncheck();
    await page.locator('[name="deployment-target"][value="cli"]').check();await page.locator('#apply-deployment').click();
    assert.equal(await page.evaluate(()=>window.__fixture.calls.filter(c=>c==='apply_deployment_plan').length),0);
    assert.doesNotMatch(await page.locator('.manager-operation > p').innerText(),/providers\.json/);
    assert.match(await page.locator('.manager-operation details').textContent(),/providers\.json/);
    await capture('publication-review');
    await page.locator('#publication-provider').selectOption('team');
    for(const input of await page.locator('[name="deployment-target"]').all())await input.uncheck();await page.locator('[name="deployment-target"][value="cli"]').check();
    await page.locator('#apply-deployment').click();await page.locator('#apply-deployment').click();
    await page.locator('.modal').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.__fixture.calls.filter(c=>c==='apply_deployment_plan').length),1);
    assert.equal(await page.evaluate(()=>window.__fixture.state.clientConfigurations.find(c=>c.targetId==='cli').sources.length),2);
    results.push('Publication: provider changes invalidate preview, explicit CLI confirmation, one-shot apply and coexistence');
    await visit('clients');await page.locator('[data-app-group="copilot-app"] .app-config-main [data-action="app-sync-enable"]').click();
    await page.locator('[data-sync-provider][value="north"]').check();await page.locator('[data-sync-preview]').click();
    await page.locator('[data-sync-confirm]').waitFor();await capture('app-sync-risk');
    await page.locator('[data-sync-confirm]').click();await page.locator('.modal').waitFor({state:'detached'});
    await page.locator('[data-app-group="copilot-app"] [data-action="manage-app-sync"]').waitFor();
    results.push('App sync: primary enable/manage entry, selected providers and explicit risk confirmation');
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
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,results,errors},null,2));
    console.log(JSON.stringify({output,passed:true,cases:results}));
  }finally{await browser.close();server.close();}
}
main().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),error.stack);console.error(error.stack);server.close();process.exitCode=1;});
