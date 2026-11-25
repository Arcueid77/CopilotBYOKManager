(function (root, factory) {
  const commonJS = typeof module === "object" && module.exports;
  const api = factory(commonJS ? require("./i18n.js") : root.CopilotBYOKManagerI18n,
    commonJS ? require("./client-presentation.js") : root.CopilotBYOKManagerClients);
  if (commonJS) module.exports = api;
  else root.CopilotBYOKManagerProviderImport = api;
})(globalThis, function (i18n, clients) {
  "use strict";
  const tr = i18n.t;
  const esc = value => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const canSave = row => ["create", "extend", "fillKey"].includes(row.action);
  const keyNotice = () => tr("密钥只保存在本机系统凭据库。提取过程不联网、不上传。");
  function sourceNames(ids, snapshot) {
    return [...new Set(ids.map(id => snapshot.clients.find(c => c.id === id)).filter(Boolean).map(c => clients.name(c)))];
  }
  function issueLabel(kind) {
    switch (kind) {
      case "closeApp": return tr("退出 Copilot App 后可重新扫描。");
      case "permissions": return tr("请检查 App 数据目录的读取权限。");
      case "unsupported": return tr("此配置格式暂不支持提取。");
      case "skipped": return tr("部分条目缺少可提取的端点或模型。");
      case "limit": return tr("配置较大，请单独提取此应用。");
      default: return tr("无法读取供应商配置。");
    }
  }
  function errorLabel(error, fallback) {
    if (error === "stale") return tr("配置已变化或预览已过期，请重新扫描。");
    if (error === "busy") return tr("另一项配置操作正在进行，请稍后重新扫描。");
    if (error === "limit") return tr("超过提取上限，请减少选择或单独扫描一个应用。");
    if (error === "credentialStore") return tr("无法保存 API Key，请检查系统凭据库后重试。");
    return fallback;
  }
  function choice(row, snapshot, multiple) {
    const names = sourceNames(row.sourceIds, snapshot);
    const keyOnly = row.action === "fillKey";
    const action = keyOnly ? tr("补充 API Key") : row.action === "create" ? tr("新增供应商") : tr("补充 {0} 个模型", row.newModels);
    return `<article class="import-choice">
      <label class="import-choice-label"><input type="checkbox" data-import-choice value="${esc(row.id)}" ${keyOnly ? "data-import-key-only disabled" : ""} checked>
      <span class="import-choice-info"><strong>${esc(row.name)}</strong><code>${esc(row.baseUrl)}</code></span>
      <span class="import-badge">${esc(action)}</span></label>
      <div class="import-origin">${names.map(n => `<span>${esc(n)}</span>`).join("")}
      ${multiple ? `<button type="button" class="import-only" data-import-only="${esc(row.id)}">${tr("只选此项")}</button>` : ""}</div>
      ${row.keyStatus === "conflict" ? `<p class="manager-meta">${tr("来源的 API Key 不同，请从对应应用单独提取。")}</p>` : row.keyStatus === "available" && !keyOnly ? `<p class="manager-meta">${tr("可同时保存 API Key")}</p>` : ""}
      ${keyOnly ? "" : `<details class="import-models"><summary>${esc(row.protocol)} · ${tr("{0} 个模型",row.models.length)}</summary>
      <ul>${row.models.map(m=>`<li><code>${esc(m.modelId)}</code>${m.name!==m.modelId ? ` · ${esc(m.name)}` : ""}</li>`).join("")}</ul></details>`}
    </article>`;
  }
  function body(plan, snapshot) {
    const available=plan.candidates.filter(canSave);
    const keysAvailable=available.some(row=>row.keyStatus==="available");
    const list=available.length ? `<div class="import-choices">${available.map(row=>choice(row,snapshot,available.length>1)).join("")}</div>`
      : `<p class="import-empty">${tr("所选应用里尚未发现可提取的供应商。")}</p>`;
    const issues=plan.issues.length ? `<details class="import-issues" ${available.length ? "" : "open"}><summary>${tr("扫描提示（{0}）",plan.issues.length)}</summary><ul>${plan.issues.map(item=>{
      const names=sourceNames(item.sourceIds,snapshot);
      return `<li><strong>${esc(names.join(", ") || clients.surfaceName(item.app))}</strong> · ${esc(issueLabel(item.kind))}</li>`;
    }).join("")}</ul></details>` : "";
    return `<div class="import-review">${keysAvailable ? `<div class="import-consent"><label class="checkbox-row"><input type="checkbox" data-import-key-consent aria-describedby="import-key-notice"><span>${tr("同时提取所选供应商的 API Key")}</span></label><p id="import-key-notice" class="manager-meta">${keyNotice()}</p></div>` : ""}
      ${available.length ? `<div class="import-toolbar"><label><input type="checkbox" data-import-all checked>${tr("全选")}</label><span data-import-count aria-live="polite"></span></div>` : ""}
      ${list}${issues}<p data-import-error class="inline-error" role="alert" hidden></p></div>`;
  }
  function create({invoke,snapshot,openModal,closeModal,setBusy,refresh,done}) {
    function open(targetIds=null, title=tr("从应用提取供应商")) {
      openModal({title,body:`<p class="import-empty" role="status">${tr("正在扫描供应商配置…")}</p>`,async onOpen(root){
        try {
          const plan=await invoke("preview_provider_import",{targetIds});
          if(root.isConnected) review(plan,targetIds,title);
        } catch (reason) {
          if(root.isConnected) openModal({title,body:`<p class="inline-error" role="alert">${esc(errorLabel(reason,tr("扫描未完成，请刷新应用后重试。")))}</p>`,footer:`<button class="button ghost" data-modal-close>${tr("关闭")}</button>`});
        }
      }});
    }
    function review(plan,targetIds,title) {
      const available=plan.candidates.some(canSave);
      const saveButton=available ? `<button class="button primary" data-import-save>${tr("保存所选")}</button>` : "";
      openModal({title,wide:true,body:body(plan,snapshot()),footer:`<button class="button ghost small" data-import-rescan>${tr("重新扫描")}</button><button class="button ghost" data-modal-close>${available ? tr("取消") : tr("关闭")}</button>${saveButton}`,onOpen(root){
        const choices=[...root.querySelectorAll("[data-import-choice]")], all=root.querySelector("[data-import-all]");
        const consent=root.querySelector("[data-import-key-consent]");
        const save=root.querySelector("[data-import-save]"),rescan=root.querySelector("[data-import-rescan]"),error=root.querySelector("[data-import-error]");
        rescan.addEventListener("click",()=>open(targetIds,title));
        if(!save)return;
        let planId=plan.planId;
        const onlyButtons=[...root.querySelectorAll("[data-import-only]")];
        function update() {
          for(const box of choices) box.disabled=!planId||(box.hasAttribute("data-import-key-only")&&!consent?.checked);
          const selectable=choices.filter(box=>!box.disabled), selected=selectable.filter(box=>box.checked);
          const count=selected.length;
          if(all){ all.disabled=!selectable.length;all.checked=selectable.length>0&&count===selectable.length;all.indeterminate=count>0&&count<selectable.length;root.querySelector("[data-import-count]").textContent=tr("已选 {0} / {1}",count,choices.length); }
          for(const button of onlyButtons) button.disabled=!selectable.some(box=>box.value===button.dataset.importOnly);
          const willSaveKeys=consent?.checked&&plan.candidates.some(row=>row.keyStatus==="available"&&selected.some(box=>box.value===row.id));
          save.textContent=willSaveKeys ? (selected.every(box=>box.hasAttribute("data-import-key-only")) ? tr("保存 API Key") : tr("保存配置和密钥")) : tr("保存所选");
          save.disabled=!planId||count===0;
        }
        consent?.addEventListener("change",update);
        all?.addEventListener("change",()=>{for(const box of choices) if(!box.disabled)box.checked=all.checked;update();});
        for(const box of choices) box.addEventListener("change",update);
        for(const button of onlyButtons) button.addEventListener("click",()=>{
          for(const box of choices) box.checked=box.value===button.dataset.importOnly;
          update();
        });
        update();
        save.addEventListener("click",async()=>{
          if(!planId||save.disabled||!root.isConnected)return;
          const selectedIds=choices.filter(c=>c.checked&&!c.disabled).map(c=>c.value);
          const includeApiKeys=consent?.checked===true;
          const id=planId;planId=null;setBusy(true);save.disabled=true;rescan.disabled=true;
          if(all)all.disabled=true;
          if(consent)consent.disabled=true;
          for(const box of choices)box.disabled=true;
          for(const button of onlyButtons)button.disabled=true;
          try {
            const result=await invoke("apply_provider_import",{planId:id,selectedIds,includeApiKeys});
            setBusy(false);closeModal();await refresh();done(result);
          } catch (reason) {
            if(root.isConnected){setBusy(false);rescan.disabled=false;error.hidden=false;error.textContent=errorLabel(reason,tr("提取未保存，请重新扫描后选择。"));rescan.focus();}
          }
        });
      }});
    }
    return {open};
  }
  return {body,create};
});
