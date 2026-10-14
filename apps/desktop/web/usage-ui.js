(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerUsage = api;
})(globalThis, () => {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  const e = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const labels = {
    get officialGithub() { return tr("GitHub 官方"); }, get OfficialGithub() { return tr("GitHub 官方"); }, byok: "BYOK", Byok: "BYOK",
    get successfulEmpty() { return tr("读取成功，无记录"); }, get personalAccountOnly() { return tr("仅个人账单"); }, get userConfirmedSameAccount() { return tr("用户已确认"); },
    get exactConnectionIdentity() { return tr("精确连接标识"); }, get uniqueTimelineInference() { return tr("唯一时间线推断"); }, get explicit() { return tr("来源明确报告"); },
    get notCovered() { return tr("未覆盖"); }, get insufficientPermission() { return tr("权限不足"); }, get rateLimited() { return tr("请求受限，稍后重试"); },
    get sessionCumulative() { return tr("会话 / 模型累计"); }, get requestDelta() { return tr("请求"); }, get available() { return tr("可用"); }, get unavailable() { return tr("不可用"); },
    get unknown() { return tr("未知"); }, get stale() { return tr("已过期，显示旧快照"); }, get partial() { return tr("部分完成"); }, get missing() { return tr("缺失"); }, get disabled() { return tr("已停用"); },
    get schemaError() { return tr("格式不受支持"); }, get networkError() { return tr("网络错误"); }, get unauthorized() { return tr("授权失效"); }, get forbidden() { return tr("无权限"); },
    get unsupported() { return tr("不支持"); }, get failed() { return tr("失败"); }, get canceled() { return tr("已取消"); }, get cancelled() { return tr("已取消"); }, get interrupted() { return tr("已中断"); },
    get inProgress() { return tr("进行中"); }, get running() { return tr("运行中"); }, get complete() { return tr("已结束"); }, get completed() { return tr("已完成"); }, get applied() { return tr("已写入配置"); },
    get skipped() { return tr("已跳过"); }, get rolledBack() { return tr("已回滚"); }, get prepared() { return tr("已准备"); }, get applying() { return tr("写入中"); }, get actionRequired() { return tr("需要操作"); },
    get conflict() { return tr("冲突"); }, get timedOut() { return tr("已超时"); }, get pending() { return tr("待处理"); }, get ready() { return tr("已就绪"); }, get broken() { return tr("需要修复"); },
    get verified() { return tr("已验证"); }, get inferred() { return tr("推断，待确认"); }, get skippedNotInstalled() { return tr("未安装，已跳过"); }, get "read-only"() { return tr("只读"); },
    get completedAndVerified() { return tr("完成并已核验"); }, get processSucceededVerificationFailed() { return tr("安装程序结束，但核验失败"); },
    get skippedAlreadyReady() { return tr("已就绪，无需安装"); }, get skippedDependencyFailed() { return tr("依赖失败，已跳过"); }, get elevationDenied() { return tr("管理员确认被拒绝"); },
    "vs-code-copilot": "VS Code Copilot", get "shared-copilot-runtime"() { return tr("Copilot 共享运行时"); },
    get "copilot-session-events"() { return tr("Copilot 共享会话元数据"); }, get "vscode-otel"() { return tr("VS Code 元数据导出"); }, "github-copilot-app": "Copilot App",
  };
  const label = (s) => Object.hasOwn(labels, s) ? labels[s] : String(s ?? tr("未知"));
  const value = (v) => v == null ? `<span class="unknown">${tr("未知")}</span>` : e(v);
  // Money arrives as an exact decimal string. Never convert it to Number.
  const money = (v) => v == null ? `<span class="unknown">${tr("不可用")}</span>` : `$${e(v)}`;
  const percent = (v) => v == null ? tr("未知") : `${(Number(v) * 100).toFixed(1)}%`;
  const time = (v) => v && !Number.isNaN(Date.parse(v)) ? new Date(v).toLocaleString(i18n.locale()) : tr("不可用");
  const success = (v) => ["available", "successfulEmpty"].includes(v);
  const badge = (s) => `<span class="setup-badge ${success(s) ? "good" : ""}">${e(label(s))}</span>`;
  const today = () => new Date().toISOString().slice(0, 10);
  function defaultFilters() {
    const start = new Date(); start.setUTCDate(start.getUTCDate() - 29);
    return { start: start.toISOString().slice(0, 10), end: today(), surface: null, route: null, connectionId: null, model: null, confidence: null, sourceId: null, sourceStatus: null, page: 0, pageSize: 50 };
  }
  const filters = defaultFilters();
  let tab = "official", billingMonth = today().slice(0, 7), modelPage = 0, priceSearch = "", advancedOpen = false, summaryOpen = false;
  function resetFilters() { Object.assign(filters, defaultFilters()); modelPage = 0; advancedOpen = false; }
  function preserveDraft(container) {
    // Only allowlisted, non-sensitive filter fields. Never collect generic
    // form inputs, passwords, headers or resource/connection editor contents.
    const selectors = [...Object.keys(filters).filter(key => !["page", "pageSize"].includes(key)).map(key => `#usage-filters [name="${key}"]`), '#price-filter [name="priceSearch"]'];
    const values = selectors.map(selector => [selector, container.querySelector(selector)?.value]);
    const detailsOpen = container.querySelector("#usage-advanced-filters")?.open;
    const totalsOpen = container.querySelector("#usage-local-summary")?.open;
    return target => {
      for (const [selector, value] of values) {
        const field = target.querySelector(selector);
        if (field && value !== undefined) field.value = value;
      }
      const details = target.querySelector("#usage-advanced-filters");
      if (details && detailsOpen !== undefined) details.open = detailsOpen;
      const totals = target.querySelector("#usage-local-summary");
      if (totals && totalsOpen !== undefined) totals.open = totalsOpen;
    };
  }
  let context = null;
  const busy = new Set();
  const progress = new Map();
  const options = (items, selected, all = tr("全部")) => `<option value="">${e(all)}</option>${items.map(([id, name]) => `<option value="${e(id)}" ${id === selected ? "selected" : ""}>${e(name)}</option>`).join("")}`;
  const button = (action, text, disabled = false, extra = "") => `<button class="button ghost small" data-usage-action="${action}" ${disabled ? "disabled" : ""} ${extra}>${e(text)}</button>`;
  const sectionError = (data, key) => data.errors?.[key] ? `<p class="inline-error" role="alert">${e(data.errors[key])}</p>` : "";
  const empty = (text) => `<p class="usage-empty">${e(text)}</p>`;
  function modelUnion(snapshot, data) {
    const rows = new Map();
    const get = (raw, route, confidence = null) => {
      if (confidence === null) {
        const existing = [...rows.values()].find((r) => r.rawModel === raw && r.route === route);
        if (existing) return existing;
      }
      const key = `${raw}\0${route}\0${confidence ?? "catalog"}`;
      if (!rows.has(key)) rows.set(key, { rawModel: raw, canonicalModel: null, route, confidence: "unknown", surfaces: [], origins: [], totals: null, quality: [], official: [], availability: [] });
      return rows.get(key);
    };
    for (const m of data.localUsage?.models ?? []) {
      const row = get(m.rawModel, m.route, m.confidence);
      Object.assign(row, m); row.origins.push(tr("本地观察"));
    }
    const runtime = data.quota?.latest?.models?.length ? data.quota.latest : data.quota?.lastSuccessful;
    for (const m of runtime?.models ?? []) {
      const row = get(m.id, "officialGithub"); row.origins.push(tr("运行时目录")); row.availability.push(m.policy ?? tr("策略未提供"));
    }
    for (const c of snapshot.connections ?? []) for (const m of c.models) {
      const row = get(m.modelId, "byok"); row.origins.push(tr("配置： {0}", c.name)); row.availability.push(m.enabled ? tr("配置中已启用") : tr("配置中已停用"));
    }
    for (const family of data.billing?.families ?? []) {
      const source = success(family.latest?.status) ? family.latest : family.lastSuccessful;
      for (const item of source?.items ?? []) {
        if (!item.model && !item.sku) continue;
        const row = get(item.model ?? `SKU: ${item.sku}`, "officialGithub");
        row.origins.push(tr("个人账单")); row.official.push({ family: family.endpointFamily, ...item, stale: !success(family.latest?.status), period: source.periodStart });
      }
    }
    return [...rows.values()].map((r) => ({ ...r, origins: [...new Set(r.origins)], availability: [...new Set(r.availability)] })).sort((a, b) => a.rawModel.localeCompare(b.rawModel) || a.route.localeCompare(b.route));
  }
  function coverage(t) {
    if (!t) return tr("暂无本地观察");
    return tr("{0}/{1} 条已计价 · {2} 个模型未确定 · {3} 条输入语义未知", t.pricedRecords, t.records, t.unresolvedModels, t.unknownSemantics);
  }
  function metrics(t) {
    const cards = [[tr("来源报告的输入"), value(t?.inputReported)], [tr("归一化输入"), value(t?.normalizedInput)], [tr("未缓存输入"), value(t?.freshInput)], [tr("缓存读取"), value(t?.cacheRead)], [tr("缓存写入"), value(t?.cacheWrite)], [tr("输出"), value(t?.output)], [tr("缓存命中率"), e(percent(t?.cacheHitRate))], [tr("API 等价估算"), money(t?.estimateUsd)]];
    return `<div class="usage-metrics">${cards.map(([name, v]) => `<div><span>${name}</span><strong>${v}</strong></div>`).join("")}</div>`;
  }
  function filterForm(snapshot, data) {
    const suggestions = [...new Set(modelUnion(snapshot, data).flatMap(model => [model.rawModel, model.canonicalModel]).filter(Boolean))].slice(0, 256);
    const advancedCount = ["connectionId", "model", "confidence", "sourceId", "sourceStatus"].filter(key => filters[key]).length;
    return `<form id="usage-filters" class="usage-filters"><label>${tr("起始日期（UTC）")}<input name="start" type="date" value="${e(filters.start)}" required /></label><label>${tr("结束日期（UTC）")}<input name="end" type="date" value="${e(filters.end)}" required max="${today()}" /></label>
      <label>${tr("客户端")}<select name="surface">${options([["vs-code-copilot", "VS Code Copilot"], ["shared-copilot-runtime", tr("CLI / App 共享运行时")]], filters.surface)}</select></label>
      <label>${tr("路由")}<select name="route">${options([["officialGithub", tr("GitHub 官方")], ["byok", "BYOK"], ["unknown", tr("未知")]], filters.route)}</select></label>
      <details id="usage-advanced-filters" class="usage-filter-advanced" ${advancedOpen ? "open" : ""}><summary>${tr("高级筛选{0}", advancedCount ? tr(" · 已启用 {0} 项", advancedCount) : "")}</summary><div class="usage-filters">
      <label>${tr("连接")}<select name="connectionId">${options(snapshot.connections.map((c) => [c.id, c.name]), filters.connectionId)}</select></label>
      <label>${tr("模型")}<input name="model" list="usage-model-suggestions" maxlength="160" value="${e(filters.model ?? "")}" placeholder="${tr("选择或输入精确模型 ID")}" /></label><datalist id="usage-model-suggestions">${suggestions.map(id => `<option value="${e(id)}"></option>`).join("")}</datalist>
      <label>${tr("归因置信度")}<select name="confidence">${options([["explicit", tr("来源明确报告")], ["exactConnectionIdentity", tr("精确连接标识")], ["unknown", tr("未知")]], filters.confidence)}</select></label>
      <label>${tr("来源")}<select name="sourceId">${options((data.sources ?? []).map((s) => [s.id, s.name]), filters.sourceId)}</select></label>
      <label>${tr("来源最近状态")}<select name="sourceStatus">${options(["available", "partial", "successfulEmpty", "disabled", "missing", "schemaError", "canceled", "interrupted"].map((s) => [s, label(s)]), filters.sourceStatus)}</select></label>
      </div></details><div class="usage-filter-actions"><button id="apply-usage-filters" class="button primary small" type="submit">${tr("应用筛选")}</button><button class="button ghost small" type="button" data-usage-action="reset-filters">${tr("重置筛选")}</button></div></form>`;
  }
  function overview(snapshot, data) {
    const local = data.localUsage;
    return `<details id="usage-local-summary" class="usage-panel usage-local-summary" ${summaryOpen ? "open" : ""}><summary>${tr("本地 Token 汇总与覆盖范围")}</summary>
      ${metrics(local?.totals)}<p>${e(coverage(local?.totals))}</p><details><summary>${tr("覆盖范围与计算")}</summary>
      <p>${e(local?.detail ?? tr("启用支持的来源并导入元数据后查看用量。"))}</p>
      <p>${tr("缓存命中率 = 已知记录的缓存读取 Token 总和 ÷ 归一化输入总和。 {0} 条记录有覆盖；缺失值保持未知。", value(local?.totals?.cacheCoveredRecords))}</p>
      <p>${tr("已计价请求： {0} · 未计价请求： {1} · 已计价 Token： {2} · 未计价 Token： {3}", value(local?.totals?.pricedRequests), value(local?.totals?.unpricedRequests), value(local?.totals?.pricedTokens), value(local?.totals?.unpricedTokens))}</p>
      <p>${tr("观察范围： {0} – {1}. 最近导入： {2}.", e(time(local?.coverageStart)), e(time(local?.coverageEnd)), e(time(local?.lastImported)))}</p>
      <p>${tr("估算仅按公开 API 文本 Token 价格换算，与 GitHub 账单分开；不按当前配置猜测历史路由。")}</p>
      <p>${tr("绑定价格快照： {0}", (local?.totals?.priceSnapshots ?? []).map((s) => `<code>${e(s)}</code>`).join(" ") || tr("无"))}</p></details>
      </details>`;
  }
  function localFilters(snapshot, data) {
    return `<section class="usage-panel usage-query"><div class="usage-local-status">${badge(data.localUsage?.status ?? "unavailable")}<span>${e(coverage(data.localUsage?.totals))}</span></div>${sectionError(data, "localUsage")}${filterForm(snapshot, data)}<p class="usage-filter-boundary">${tr("筛选仅影响本地观察，不改变官方额度或账单。")}</p></section>`;
  }
  function official(data, native) {
    const runtime = data.quota?.latest, previous = data.quota?.lastSuccessful;
    const shown = success(runtime?.status) ? runtime : previous;
    return `<section class="usage-panel"><div class="step-heading"><h2>${tr("官方运行时额度")}</h2>${button("runtime", busy.has("runtime") ? tr("读取运行时中…") : tr("刷新额度与模型"), !native || busy.has("runtime"))}${button("cancel", tr("取消进行中的任务"), !native || (!busy.has("runtime") && !busy.has("billing")))}</div>
      ${sectionError(data, "quota")}<div class="inline-actions">${badge(runtime?.status ?? "unavailable")}${data.quota?.stale ? badge("stale") : ""}</div><p>${e(runtime?.detail ?? tr("通过本机官方运行时读取，不复用客户端登录凭据。"))}</p>
      ${shown ? `<p><strong>${e(shown.account ?? tr("账号未知"))}</strong> ${tr("· 运行时 {0} · 观察时间 {1}{2}", e(shown.runtimeVersion ?? "unknown"), e(time(shown.fetchedAt)), shown !== runtime ? tr(" · 上次成功快照，当前账号可能不可用") : "")}</p>
      <div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>${tr("额度 / 单位标识")}</th><th>${tr("已使用")}</th><th>${tr("额度")}</th><th>${tr("剩余")}</th><th>${tr("重置时间")}</th></tr></thead><tbody>${shown.quotas.map((q) => `<tr><td>${e(q.key)}</td><td>${value(q.used)}</td><td>${q.unlimited ? tr("不限量") : value(q.entitlement)}</td><td>${q.remainingPercentage == null ? tr("未知") : `${e(q.remainingPercentage)}%`}</td><td>${e(q.resetAt ?? tr("未提供"))}</td></tr>`).join("")}</tbody></table></div>${!shown.quotas.length ? empty(tr("运行时返回空额度列表，不能推断额度为零。")) : ""}` : empty(tr("尚未取得额度，请核对运行时及官方登录。"))}
      <p class="muted">${tr("该接口不提供套餐名；额度保留原单位。模型目录： {0}.", e(label(runtime?.modelStatus ?? "unavailable")))}</p></section>
      <section class="usage-panel"><div class="step-heading"><h2>${tr("GitHub 个人账单")}</h2><div class="inline-actions"><label>${tr("月份")}<input type="month" id="billing-month" value="${e(billingMonth)}" max="${today().slice(0, 7)}" /></label>${button("billing", busy.has("billing") ? tr("刷新中…") : tr("刷新个人账单"), !native || busy.has("billing") || !data.billing?.authorization?.hasSecret)}</div></div>
        ${sectionError(data, "billing")}<p>${data.billing?.account ? tr("{0}@{1} · GitHub 用户 ID {2}", e(data.billing.account.login), e(data.billing.account.host), e(data.billing.account.userId)) : tr("读取个人账单需要本软件的独立授权。")} ${button("authorize", tr("管理授权"), !native)}</p>
        <p class="muted">${tr("仅覆盖个人账单；组织支付或不可访问的数据保持未知。AI 积分与高级请求不相加。")}</p>
        ${(data.billing?.families ?? [{ endpointFamily: "aiCredit" }, { endpointFamily: "premiumRequest" }]).map(billingFamily).join("")}</section>`;
  }
  function billingFamily(f) {
    const latest = f.latest, shown = success(latest?.status) ? latest : f.lastSuccessful;
    const stale = shown && (shown !== latest || Date.now() - Date.parse(shown.fetchedAt) > 15 * 60000);
    return `<article class="billing-family"><div class="step-heading"><h3>${f.endpointFamily === "aiCredit" ? tr("AI 积分") : tr("高级请求")}</h3>${badge(latest?.status ?? "unavailable")}${stale ? badge("stale") : ""}</div>
      <p>${e(latest?.error ?? (latest ? label(latest.coverage) : tr("此账号和月份暂无快照")))}</p>${latest?.retryAt ? `<p>${tr("GitHub 可重试时间： {0}", e(time(latest.retryAt)))}</p>` : ""}
      <small>${tr("最近尝试：{0}{1}", e(time(latest?.fetchedAt)), shown ? tr(" · 显示快照：{0} · API {1} · 时间范围：{2} 至 {3}（不含结束日）", e(time(shown.fetchedAt)), e(shown.apiVersion), e(shown.periodStart.slice(0, 10)), e(shown.periodEnd.slice(0, 10))) : "")}</small>
      ${shown?.items?.length ? `<div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>${tr("模型 / SKU")}</th><th>${tr("数量")}</th><th>${tr("单位")}</th><th>${tr("原始金额（USD）")}</th><th>${tr("优惠金额（USD）")}</th><th>${tr("官方净额（USD）")}</th><th>${tr("额度 / 剩余")}</th></tr></thead><tbody>${shown.items.map((i) => `<tr><td>${e(i.model ?? i.sku ?? i.product ?? tr("未提供"))}<small>${e(i.sku ?? "")}</small></td><td>${value(i.quantity)}</td><td>${e(i.unit)}</td><td>${money(i.grossAmountUsd)}</td><td>${money(i.discountAmountUsd)}</td><td>${money(i.netAmountUsd)}</td><td>${value(i.allowance)} / ${value(i.remaining)}<small>${tr("重置： {0}", e(i.resetAt ?? tr("未提供")))}</small></td></tr>`).join("")}</tbody></table></div>${shown.itemsTruncated ? `<p>${tr("显示前 {0} / {1} 条，不从部分列表推断总额。", shown.items.length, shown.totalItemCount)}</p>` : ""}` : empty(shown?.status === "successfulEmpty" ? tr("查询成功，无条目；不代表个人覆盖范围外的用量为零。") : tr("尚无官方金额。"))}</article>`;
  }
  function models(snapshot, data) {
    const union = modelUnion(snapshot, data).filter((r) => (!filters.route || filters.route === r.route) && (!filters.model || r.rawModel === filters.model || r.canonicalModel === filters.model));
    const pageCount = Math.max(1, Math.ceil(union.length / 40)); modelPage = Math.min(modelPage, pageCount - 1);
    return `<section class="usage-panel"><div class="step-heading"><h2>${tr("全部来源中的模型")}</h2><span>${tr("{0} 个模型 / 路由条目", union.length)}</span></div><p>${tr("目录条目不证明已使用；本地用量按上方条件筛选。")}</p>
      <p class="usage-model-scroll-note">${tr("可左右滚动查看完整指标，模型、路由与来源固定；聚焦表格后也可用左右方向键。")}</p><div class="usage-table-wrap" role="region" aria-label="${tr("模型统计表，可左右滚动")}" tabindex="0"><table class="usage-table model-table"><thead><tr><th>${tr("模型 / 路由 / 来源")}</th><th>${tr("路由 / 归因置信度")}</th><th>${tr("客户端 / 来源")}</th><th>${tr("记录 / 请求")}</th><th>${tr("报告输入 / 归一化输入")}</th><th>${tr("未缓存输入")}</th><th>${tr("缓存读取 / 写入")}</th><th>${tr("输出")}</th><th>${tr("缓存命中")}</th><th>${tr("API 等价估算")}</th><th>${tr("官方账单")}</th><th>${tr("覆盖范围 / 质量")}</th></tr></thead><tbody>${union.slice(modelPage * 40, modelPage * 40 + 40).map((m) => {
        const t = m.totals;
        return `<tr><td class="model-identity"><strong>${e(m.rawModel)}</strong><small>${e(m.canonicalModel ?? tr("规范 ID 未确定"))}</small><small class="model-identity-route">${e(label(m.route))} · ${e(label(m.confidence))}</small><small class="model-identity-origins">${m.origins.map(e).join(" · ")}</small></td><td>${e(label(m.route))}<small>${e(label(m.confidence))}</small></td><td>${m.surfaces.map((s) => e(label(s))).join(", ") || tr("未观察到")}<small>${m.origins.map(e).join(" · ")}</small></td><td>${value(t?.records)} / ${value(t?.requests)}</td><td>${value(t?.inputReported)} / ${value(t?.normalizedInput)}</td><td>${value(t?.freshInput)}</td><td>${value(t?.cacheRead)} / ${value(t?.cacheWrite)}</td><td>${value(t?.output)}</td><td>${e(percent(t?.cacheHitRate))}</td><td>${money(t?.estimateUsd)}</td><td>${m.official.map((i) => `${value(i.quantity)} ${e(i.unit)} · ${money(i.netAmountUsd)}${i.stale ? tr("（旧快照）") : ""}`).join("<br>") || tr("不可用")}</td><td><details><summary>${e(coverage(t))}</summary><p>${m.quality.map(e).join("<br>") || tr("暂无本地质量观察")}</p><p>${m.availability.map(e).join(" · ")}</p></details></td></tr>`;
      }).join("")}</tbody></table></div>${!union.length ? empty(tr("无匹配模型。请添加连接、刷新运行时或导入来源。")) : ""}
      <div class="usage-pagination">${button("models-prev", tr("上一页"), modelPage === 0)}<span>${tr("第 {0} / {1}", modelPage + 1, pageCount)}</span>${button("models-next", tr("下一页"), modelPage >= pageCount - 1)}</div><details><summary>${tr("目录与本地观察的区别")}</summary><p>${tr("本地用量遵循上方筛选。配置、运行时及所选账单月份的模型仍可显示；目录中的模型不证明请求路由。")}</p></details></section>`;
  }
  function breakdown(title, rows) {
    return `<details class="usage-panel"><summary>${e(title)}</summary>${rows?.length ? `<div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>${tr("分组")}</th><th>${tr("记录")}</th><th>${tr("输入")}</th><th>${tr("输出")}</th><th>${tr("缓存命中")}</th><th>${tr("估算金额（USD）")}</th><th>${tr("已计价记录")}</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${e(label(r.key))}</td><td>${r.totals.records}</td><td>${value(r.totals.inputReported)}</td><td>${value(r.totals.output)}</td><td>${e(percent(r.totals.cacheHitRate))}</td><td>${money(r.totals.estimateUsd)}</td><td>${r.totals.pricedRecords}/${r.totals.records}</td></tr>`).join("")}</tbody></table></div>` : empty(tr("当前筛选下无记录。"))}</details>`;
  }
  function sessions(data) {
    const rows = data.localUsage?.records ?? [], count = data.localUsage?.totalRecords ?? 0;
    const pages = Math.max(1, Math.ceil(count / filters.pageSize));
    return `<section class="usage-panel"><div class="step-heading"><h2>${tr("会话与请求")}</h2><span>${tr("{0} 条匹配观察", count)}</span></div><p>${tr("会话累计值替换旧值，VS Code 请求按稳定标识去重；会话和请求 ID 已哈希。")}</p>
      <div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>${tr("结束时间")}</th><th>${tr("模型 / 记录类型")}</th><th>${tr("来源 / 路由")}</th><th>${tr("输入 / 输出")}</th><th>${tr("估算")}</th><th>${tr("详情")}</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${e(time(r.finishedAt))}</td><td>${e(r.rawModel)}<small>${e(label(r.counterKind))}</small></td><td>${e(r.sourceId)}<small>${e(label(r.route))} · ${e(label(r.confidence))}</small></td><td>${value(r.inputReported)} / ${value(r.output)}</td><td>${money(r.estimateUsd)}</td><td>${button("record", tr("查看"), false, `data-record-id="${e(r.id)}"`)}</td></tr>`).join("")}</tbody></table></div>
      ${!rows.length ? empty(tr("此范围内无导入记录，请到数据来源页核对。")) : ""}<div class="usage-pagination">${button("prev", tr("上一页"), filters.page === 0)}<span>${tr("第 {0} / {1}", filters.page + 1, pages)}</span>${button("next", tr("下一页"), filters.page >= pages - 1)}</div></section>`;
  }
  function sources(data, native) {
    return `<section class="usage-panel"><div class="step-heading"><h2>${tr("数据来源与覆盖")}</h2><div class="inline-actions">${button("sync", busy.has("sync") ? tr("导入中…") : tr("导入已启用来源"), !native || busy.has("sync") || !(data.sources ?? []).some((s) => s.enabled))}${button("cancel", tr("取消进行中的任务"), !native || (!busy.has("sync") && !busy.has("runtime") && !busy.has("billing") && !busy.has("prices")))}</div></div>
      <p>${tr("仅经同意后在本地导入元数据，不保存原日志行或对话内容。")}</p>${sectionError(data, "sources")}
      <div class="usage-progress" aria-live="polite">${[...progress.values()].map((r) => `<p>${tr("{0}: {1} · {2} 个文件 · {3} 条观察已处理", e(r.sourceId), e(label(r.status)), r.filesSeen, r.recordsSeen)}</p>`).join("")}</div>
      ${(data.sources ?? []).map((s) => `<article class="usage-source"><div class="step-heading"><h3>${e(s.name)}</h3>${badge(s.status)}</div><p>${e(s.detail)}</p><small>${tr("{0} · 解析器 {1}", e(s.pathHint), e(s.parser))}</small><p>${tr("{0} 条已保存记录 · 最近扫描：{1} · 最近成功扫描：{2}", s.recordCount, e(time(s.lastScanAt)), e(time(s.lastSuccessAt)))}</p><div class="inline-actions">
        ${button(s.enabled ? "disable-source" : "enable-source", s.enabled ? tr("停用导入") : tr("启用导入…"), !native || s.status === "unsupported" || busy.has("sync"), `data-source-id="${e(s.id)}"`)}
        ${button("source-info", tr("配置与隐私"), false, `data-source-id="${e(s.id)}"`)}${button("clear-source", tr("清除已导入元数据…"), !native || busy.has("sync"), `data-source-id="${e(s.id)}"`)}</div></article>`).join("") || empty(tr("来源状态不可用，请刷新。"))}
      <details><summary>${tr("覆盖限制")}</summary><p>${tr("CLI 累计记录不能证明输入语义或具体客户端。VS Code 仅贡献同意后导出的支持记录。停用保留元数据，清除只删除本软件导入的数据；停止 VS Code 导出还需关闭 OTel。")}</p></details></section>${prices(data, native)}`;
  }
  function prices(data, native) {
    const view = data.catalog, catalog = view?.catalog;
    const rows = (catalog?.models ?? []).filter((m) => m.model.toLowerCase().includes(priceSearch.toLowerCase()));
    return `<section class="usage-panel"><div class="step-heading"><h2>${tr("价格目录与历史估算")}</h2>${button("prices", busy.has("prices") ? tr("刷新中…") : tr("刷新官方 OpenRouter 目录"), !native || busy.has("prices"))}${button("cancel", tr("取消进行中的任务"), !native || !busy.has("prices"))}</div>
      ${sectionError(data, "catalog")}<p>${e(view?.latest?.detail ?? tr("刷新价格目录，将兼容的观察记录绑定到不可变价格快照。"))}</p>${view?.stale ? badge("stale") : ""}
      ${catalog ? `<p>${e(catalog.detail)}</p><p>${tr("核对时间：{0} · 快照创建：{1} · 解析器 v{2} ·", e(time(view?.checkedAt)), e(time(catalog.fetchedAt)), catalog.parserVersion)} <a href="https://openrouter.ai/api/v1/models" target="_blank" rel="noreferrer">${tr("官方来源")}</a></p><details><summary>${tr("快照标识")}</summary><code>${e(catalog.id)}</code><p>${tr("来源版本： {0}", e(catalog.sourceVersion))}</p><p>${tr("历史估算保留原快照。Token 缺失或价格档位不明时不估算；零价格不等于价格缺失。")}</p></details>
      <form id="price-filter" class="inline-actions"><label>${tr("查找价格")}<input name="priceSearch" value="${e(priceSearch)}" maxlength="160" placeholder="${tr("模型 ID")}" /></label><button id="apply-price-filter" class="button ghost small">${tr("查找")}</button></form>
      <p>${tr("显示 {0} / {1} 个匹配模型；单位为 USD / 百万文本 Token。", Math.min(rows.length, 80), rows.length)}</p><div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>${tr("规范模型")}</th><th>${tr("输入门槛")}</th><th>${tr("输入")}</th><th>${tr("缓存读取")}</th><th>${tr("缓存写入 / 1 h")}</th><th>${tr("输出")}</th></tr></thead><tbody>${rows.slice(0, 80).flatMap((m) => m.supported ? m.tiers.map((t) => `<tr><td>${e(m.model)}</td><td>≥ ${t.minInput}</td><td>${money(t.input)}</td><td>${money(t.cacheRead)}</td><td>${money(t.cacheWrite)} / ${money(t.cacheWrite1h)}</td><td>${money(t.output)}</td></tr>`) : [`<tr><td>${e(m.model)}</td><td colspan="5">${tr("价格格式不受支持，不生成估算")}</td></tr>`]).join("")}</tbody></table></div>` : empty(tr("尚无价格快照；取得兼容价格和完整 Token 数据后才能估算。"))}</section>`;
  }
  function render(snapshot, data, native) {
    return `${!native ? `<div class="preview-banner">${tr("浏览器试用 · 不读取真实用量、额度或账单")}</div>` : ""}
      ${(snapshot.clients ?? []).some(c => c.kind === "jetbrains-copilot" && c.path) ? `<p class="security-note" role="status">${tr("JetBrains 用量：未覆盖。尚未验证其 OTel 导入格式，不读取 IDE 日志，也不将 CLI 记录猜测为 JetBrains 用量。缺失数据保持未知，不是零。")}</p>` : ""}
      <nav class="usage-tabs" aria-label="${tr("用量视图")}">${[["official", tr("官方订阅 / 用量")], ["models", tr("模型统计")], ["sessions", tr("会话 / 详情")], ["sources", tr("数据来源 / 价格")]].map(([id, name]) => `<button class="${tab === id ? "active" : ""}" data-usage-tab="${id}" aria-current="${tab === id ? "page" : "false"}">${name}</button>`).join("")}</nav>
      ${["models", "sessions"].includes(tab) ? localFilters(snapshot, data) : ""}
      ${{ official: () => official(data, native), models: () => models(snapshot, data), sessions: () => sessions(data), sources: () => sources(data, native) }[tab]()}
      ${["models", "sessions"].includes(tab) ? overview(snapshot, data) : ""}
      ${tab === "models" ? `${breakdown(tr("每日观察（UTC）"), data.localUsage?.days)}${breakdown(tr("客户端 / 共享运行时"), data.localUsage?.surfaces)}${breakdown(tr("路由"), data.localUsage?.routes)}${breakdown(tr("来源报告的供应商"), data.localUsage?.providers)}` : ""}`;
  }
  function setupInstructions(source) {
    const settings = source.id === "vscode-otel" ? { "github.copilot.chat.otel.enabled": true, "github.copilot.chat.otel.exporterType": "file", "github.copilot.chat.otel.outfile": source.setupPath, "github.copilot.chat.otel.captureContent": false } : null;
    return `<p>${e(source.pathHint)}</p>${settings ? `<p>${tr("启用导入后，请自行把以下配置加入 VS Code 用户设置并重启。软件只创建自己的接收目录，不改 VS Code 设置；仅影响后续观察。")}</p><pre class="usage-code">${e(JSON.stringify(settings, null, 2))}</pre><p>${tr("停止导出请将")} <code>github.copilot.chat.otel.enabled</code> ${tr("设为")} <code>false</code>。</p>` : source.id === "copilot-session-events" ? `<p>${tr("正常使用官方运行时即可。已结束且含支持的 v1 模型指标的会话可导入；CLI / App 共享记录只计一次，客户端归属保持未知。")}</p>` : `<p>${tr("App 尚无已审核的独立用量来源，不读取私有存储。")}</p>`}
      <p>${tr("源日志可能包含对话。本软件只保存模型标识、哈希 ID、计数及时间，不上传日志。停用停止读取；清除移除本软件中的该来源记录与游标。")}</p>`;
  }
  function recordDetails(record) {
    const fields = ["id", "sourceId", "sessionHash", "requestHash", "rawModel", "canonicalModel", "route", "confidence", "connectionId", "provider", "surfaces", "counterKind", "requestCount", "inputSemantics", "inputReported", "normalizedInput", "freshInput", "cacheRead", "cacheWrite", "output", "startedAt", "finishedAt", "importedAt", "quality", "priceSnapshotId", "estimateUsd", "estimateDetail"];
    const metadata = Object.fromEntries(fields.filter(field => Object.hasOwn(record, field)).map(field => [field, record[field]]));
    const summary = [[tr("原始模型"), value(record.rawModel)], [tr("规范模型"), value(record.canonicalModel)], [tr("来源 / 路由"), `${e(record.sourceId)} · ${e(label(record.route))}`], [tr("归因置信度"), e(label(record.confidence))], [tr("记录类型"), e(label(record.counterKind))], [tr("观察时间"), `${e(time(record.startedAt))} – ${e(time(record.finishedAt))}`], [tr("API 等价估算"), money(record.estimateUsd)], [tr("价格快照"), value(record.priceSnapshotId)]];
    return `<p>${tr("只显示允许保存的元数据，标识已哈希；不保留原日志行或对话。")}</p><dl class="usage-record-summary">${summary.map(([name, detail]) => `<div><dt>${name}</dt><dd>${detail}</dd></div>`).join("")}</dl>${metrics(record)}<p>${e(record.estimateDetail ?? tr("未提供"))}</p><details><summary>${tr("查看完整元数据 JSON")}</summary><pre class="usage-code">${e(JSON.stringify(metadata, null, 2))}</pre></details>`;
  }
  function confirm(title, body, text, action) {
    context.openModal({ title, body, wide: true, footer: `<button class="button ghost" data-modal-close>${tr("取消")}</button><button class="button primary" id="usage-confirm">${e(text)}</button>`, onOpen(root) {
      root.querySelector("#usage-confirm").addEventListener("click", async (event) => {
        event.target.disabled = true;
        context.setBusy?.(true);
        try { await action(); if (root.isConnected) context.closeModal(); await context.refresh(); }
        catch (err) { context.showToast(err?.message ?? String(err), "error"); event.target.disabled = false; }
        finally { if (root.isConnected) context.setBusy?.(false); }
      });
    } });
  }
  async function run(key, command, args) {
    if (!context.native || busy.has(key)) return;
    busy.add(key); context.render();
    try { await context.invoke(command, args); }
    catch (err) { context.showToast(err?.message ?? String(err), "error"); }
    finally { busy.delete(key); await context.refresh(); }
  }
  async function action(buttonElement) {
    const name = buttonElement.dataset.usageAction, sourceId = buttonElement.dataset.sourceId;
    const data = context.getData(), source = data.sources?.find((s) => s.id === sourceId);
    if (name === "reset-filters") { resetFilters(); await context.refresh(); }
    else if (name === "record") {
      const record = data.localUsage?.records.find((r) => r.id === buttonElement.dataset.recordId);
      if (record) context.openModal({ title: tr("已导入元数据"), wide: true, body: recordDetails(record), footer: `<button class="button ghost" data-modal-close>${tr("关闭")}</button>` });
    } else if (name === "source-info" && source) {
      context.openModal({ title: tr("{0} 配置", source.name), wide: true, body: setupInstructions(source), footer: `<button class="button ghost" data-modal-close>${tr("关闭")}</button>` });
    } else if (name === "enable-source" && source && context.native) {
      confirm(tr("启用 {0} 导入", source.name), setupInstructions(source), tr("启用本地元数据导入"), () => context.invoke("set_usage_source_enabled", { sourceId, enabled: true }));
    } else if (name === "disable-source") {
      await run("sources", "set_usage_source_enabled", { sourceId, enabled: false });
    } else if (name === "clear-source" && source && context.native) {
      confirm(tr("清除 {0} 元数据", source.name), `<p>${tr("删除 {0} 条导入记录、该来源游标及导入历史，并停用导入。保留原日志、账单和价格快照；重新导入可从原日志重建记录。", source.recordCount)}</p>`, tr("清除已导入元数据"), () => context.invoke("clear_local_usage", { sourceId, confirmed: true }));
    } else if (name === "runtime") await run("runtime", "refresh_official_runtime_usage");
    else if (name === "billing") await run("billing", "refresh_personal_github_usage", billingQuery());
    else if (name === "prices") await run("prices", "refresh_price_catalog");
    else if (name === "sync") { progress.clear(); await run("sync", "sync_local_usage", { sourceIds: [] }); }
    else if (name === "cancel" && context.native) await context.invoke("cancel_usage_sync");
    else if (name === "authorize") globalThis.CopilotBYOKManagerGithubAuth?.openAuthorize?.();
    else if (name === "prev" || name === "next") { filters.page = Math.max(0, filters.page + (name === "next" ? 1 : -1)); await context.refresh(); }
    else if (name === "models-prev" || name === "models-next") { modelPage = Math.max(0, modelPage + (name === "models-next" ? 1 : -1)); context.render(); }
  }
  function configure(api) {
    context = api;
    document.addEventListener("click", (event) => {
      const tabButton = event.target.closest("[data-usage-tab]");
      if (tabButton && ["official", "models", "sessions", "sources"].includes(tabButton.dataset.usageTab)) { tab = tabButton.dataset.usageTab; context.render(); }
      const target = event.target.closest("[data-usage-action]");
      if (target && !target.disabled) action(target).catch((err) => context.showToast(err?.message ?? String(err), "error"));
    });
    document.addEventListener("toggle", event => {
      if (event.target.id === "usage-advanced-filters") advancedOpen = event.target.open;
      if (event.target.id === "usage-local-summary") summaryOpen = event.target.open;
    }, true);
    document.addEventListener("submit", async (event) => {
      if (event.target.id === "usage-filters") {
        event.preventDefault(); const form = new FormData(event.target);
        for (const field of Object.keys(filters)) if (!["page", "pageSize"].includes(field)) filters[field] = String(form.get(field) ?? "").trim() || null;
        filters.page = 0; modelPage = 0; await context.refresh();
      } else if (event.target.id === "price-filter") { event.preventDefault(); priceSearch = String(new FormData(event.target).get("priceSearch") ?? ""); context.render(); }
    });
    document.addEventListener("change", async (event) => {
      if (event.target.id === "billing-month" && event.target.value) { billingMonth = event.target.value; await context.refresh(); }
    });
    globalThis.__TAURI__?.event?.listen("usage-progress", (event) => {
      progress.set(event.payload.sourceId, event.payload);
      const region = document.querySelector(".usage-progress");
      if (region) region.textContent = [...progress.values()].map((r) => tr("{0} · {1} · {2} 个文件 · {3} 条观察已处理", label(r.status), r.sourceId, r.filesSeen, r.recordsSeen)).join("\n");
    }).catch((err) => context.showToast(tr("导入进度不可用： {0}", String(err)), "error"));
  }
  function billingQuery() { const [year, month] = billingMonth.split("-").map(Number); return { year, month }; }
  function preview(command, snapshot) {
    const unavailable = { status: "unavailable", detail: tr("浏览器试用不提供真实本地数据") };
    if (command === "get_usage_overview") return { ...unavailable, start: filters.start, end: filters.end, totals: { records: 0, pricedRecords: 0, unpricedRecords: 0, unresolvedModels: 0, unknownSemantics: 0, priceSnapshots: [] }, models: [], days: [], routes: [], surfaces: [], providers: [], records: [], totalRecords: 0 };
    if (command === "get_official_runtime_usage") return { latest: null, lastSuccessful: null, stale: false };
    if (command === "get_price_catalog") return { catalog: null, latest: null, stale: false };
    if (command === "get_github_billing") return { authorization: { hasSecret: false }, account: null, families: [] };
    if (command === "get_usage_runs") return [];
    if (command === "get_usage_sources") return ["copilot-session-events", "vscode-otel", "github-copilot-app"].map((id) => ({ id, name: label(id), enabled: false, status: id === "github-copilot-app" ? "unsupported" : "disabled", detail: tr("浏览器试用不读取本地来源"), pathHint: tr("本地路径不可用"), setupPath: null, parser: tr("仅供试用"), recordCount: 0 }));
    if (command === "get_setup_status") return { preferences: { connectionId: snapshot.connections[0]?.id }, target: null, alignment: "notSignedIn", accounts: globalThis.CopilotBYOKManagerAccount.previewStatus(), targets: [], manualConfirmed: false, scannedAt: null };
    if (command === "get_installation_status") return globalThis.CopilotBYOKManagerInstaller.previewStatus();
    if (command === "get_github_authorization_status") return globalThis.CopilotBYOKManagerGithubAuth.previewStatus();
    throw new Error(tr("此操作需要桌面软件"));
  }
  return { configure, render, query: () => ({ ...filters }), billingQuery, preview, modelUnion, money, value, percent, setupInstructions, label, metrics, coverage, filterForm, resetFilters, preserveDraft, recordDetails };
});
