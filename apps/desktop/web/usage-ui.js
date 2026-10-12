(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PilotWeaveUsage = api;
})(globalThis, () => {
  "use strict";
  const e = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const labels = {
    officialGithub: "GitHub 官方", OfficialGithub: "GitHub 官方", byok: "BYOK", Byok: "BYOK",
    successfulEmpty: "读取成功，无记录", personalAccountOnly: "仅个人账单", userConfirmedSameAccount: "用户已确认",
    exactConnectionIdentity: "精确连接标识", uniqueTimelineInference: "唯一时间线推断", explicit: "来源明确报告",
    notCovered: "未覆盖", insufficientPermission: "权限不足", rateLimited: "请求受限，稍后重试",
    sessionCumulative: "会话 / 模型累计", requestDelta: "请求", available: "可用", unavailable: "不可用",
    unknown: "未知", stale: "已过期，显示旧快照", partial: "部分完成", missing: "缺失", disabled: "已停用",
    schemaError: "格式不受支持", networkError: "网络错误", unauthorized: "授权失效", forbidden: "无权限",
    unsupported: "不支持", failed: "失败", canceled: "已取消", cancelled: "已取消", interrupted: "已中断",
    inProgress: "进行中", running: "运行中", complete: "已结束", completed: "已完成", applied: "已写入配置",
    skipped: "已跳过", rolledBack: "已回滚", prepared: "已准备", applying: "写入中", actionRequired: "需要操作",
    conflict: "冲突", timedOut: "已超时", pending: "待处理", ready: "已就绪", broken: "需要修复",
    verified: "已验证", inferred: "推断，待确认", skippedNotInstalled: "未安装，已跳过", "read-only": "只读",
    completedAndVerified: "完成并已核验", processSucceededVerificationFailed: "安装程序结束，但核验失败",
    skippedAlreadyReady: "已就绪，无需安装", skippedDependencyFailed: "依赖失败，已跳过", elevationDenied: "管理员确认被拒绝",
    "vs-code-copilot": "VS Code Copilot", "shared-copilot-runtime": "Copilot 共享运行时",
    "copilot-session-events": "Copilot 共享会话元数据", "vscode-otel": "VS Code 元数据导出", "github-copilot-app": "Copilot App",
  };
  const label = (s) => Object.hasOwn(labels, s) ? labels[s] : String(s ?? "未知");
  const value = (v) => v == null ? '<span class="unknown">未知</span>' : e(v);
  // Money arrives as an exact decimal string. Never convert it to Number.
  const money = (v) => v == null ? '<span class="unknown">不可用</span>' : `$${e(v)}`;
  const percent = (v) => v == null ? "未知" : `${(Number(v) * 100).toFixed(1)}%`;
  const time = (v) => v && !Number.isNaN(Date.parse(v)) ? new Date(v).toLocaleString("zh-CN") : "不可用";
  const success = (v) => ["available", "successfulEmpty"].includes(v);
  const badge = (s) => `<span class="setup-badge ${success(s) ? "good" : ""}">${e(label(s))}</span>`;
  const today = () => new Date().toISOString().slice(0, 10);
  const start = new Date(); start.setUTCDate(start.getUTCDate() - 29);
  const filters = { start: start.toISOString().slice(0, 10), end: today(), surface: null, route: null, connectionId: null, model: null, confidence: null, sourceId: null, sourceStatus: null, page: 0, pageSize: 50 };
  let tab = "official", billingMonth = today().slice(0, 7), modelPage = 0, priceSearch = "";
  let context = null;
  const busy = new Set();
  const progress = new Map();
  const options = (items, selected, all = "全部") => `<option value="">${e(all)}</option>${items.map(([id, name]) => `<option value="${e(id)}" ${id === selected ? "selected" : ""}>${e(name)}</option>`).join("")}`;
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
      Object.assign(row, m); row.origins.push("本地观察");
    }
    const runtime = data.quota?.latest?.models?.length ? data.quota.latest : data.quota?.lastSuccessful;
    for (const m of runtime?.models ?? []) {
      const row = get(m.id, "officialGithub"); row.origins.push("运行时目录"); row.availability.push(m.policy ?? "策略未提供");
    }
    for (const c of snapshot.connections ?? []) for (const m of c.models) {
      const row = get(m.modelId, "byok"); row.origins.push(`配置： ${c.name}`); row.availability.push(m.enabled ? "配置中已启用" : "配置中已停用");
    }
    for (const family of data.billing?.families ?? []) {
      const source = success(family.latest?.status) ? family.latest : family.lastSuccessful;
      for (const item of source?.items ?? []) {
        if (!item.model && !item.sku) continue;
        const row = get(item.model ?? `SKU: ${item.sku}`, "officialGithub");
        row.origins.push("个人账单"); row.official.push({ family: family.endpointFamily, ...item, stale: !success(family.latest?.status), period: source.periodStart });
      }
    }
    return [...rows.values()].map((r) => ({ ...r, origins: [...new Set(r.origins)], availability: [...new Set(r.availability)] })).sort((a, b) => a.rawModel.localeCompare(b.rawModel) || a.route.localeCompare(b.route));
  }
  function coverage(t) {
    if (!t) return "暂无本地观察";
    return `${t.pricedRecords}/${t.records} 条已计价 · ${t.unresolvedModels} 个模型未确定 · ${t.unknownSemantics} 条输入语义未知`;
  }
  function metrics(t) {
    const cards = [["来源报告的输入", value(t?.inputReported)], ["归一化输入", value(t?.normalizedInput)], ["未缓存输入", value(t?.freshInput)], ["缓存读取", value(t?.cacheRead)], ["缓存写入", value(t?.cacheWrite)], ["输出", value(t?.output)], ["缓存命中率", e(percent(t?.cacheHitRate))], ["API 等价估算", money(t?.estimateUsd)]];
    return `<div class="usage-metrics">${cards.map(([name, v]) => `<div><span>${name}</span><strong>${v}</strong></div>`).join("")}</div>`;
  }
  function filterForm(snapshot, data) {
    return `<form id="usage-filters" class="usage-filters"><label>起始日期（UTC）<input name="start" type="date" value="${e(filters.start)}" required /></label><label>结束日期（UTC）<input name="end" type="date" value="${e(filters.end)}" required max="${today()}" /></label>
      <label>客户端<select name="surface">${options([["vs-code-copilot", "VS Code Copilot"], ["shared-copilot-runtime", "CLI / App 共享运行时"]], filters.surface)}</select></label>
      <label>路由<select name="route">${options([["officialGithub", "GitHub 官方"], ["byok", "BYOK"], ["unknown", "未知"]], filters.route)}</select></label>
      <label>连接<select name="connectionId">${options(snapshot.connections.map((c) => [c.id, c.name]), filters.connectionId)}</select></label>
      <label>模型<input name="model" maxlength="160" value="${e(filters.model ?? "")}" placeholder="精确原始或规范模型 ID" /></label>
      <label>归因置信度<select name="confidence">${options([["explicit", "来源明确报告"], ["exactConnectionIdentity", "精确连接标识"], ["unknown", "未知"]], filters.confidence)}</select></label>
      <label>来源<select name="sourceId">${options((data.sources ?? []).map((s) => [s.id, s.name]), filters.sourceId)}</select></label>
      <label>来源最近状态<select name="sourceStatus">${options(["available", "partial", "successfulEmpty", "disabled", "missing", "schemaError", "canceled", "interrupted"].map((s) => [s, label(s)]), filters.sourceStatus)}</select></label>
      <button class="button primary small" type="submit">应用筛选</button></form>`;
  }
  function overview(snapshot, data) {
    const local = data.localUsage;
    return `<section class="usage-panel"><div class="step-heading"><h2>本地 Token 观察</h2>${badge(local?.status ?? "unavailable")}</div>${sectionError(data, "localUsage")}
      ${metrics(local?.totals)}<p>${e(coverage(local?.totals))}</p><details><summary>覆盖范围与计算</summary>
      <p>${e(local?.detail ?? "启用支持的来源并导入元数据后查看用量。")}</p>
      <p>缓存命中率 = 已知记录的缓存读取 Token 总和 ÷ 归一化输入总和。 ${value(local?.totals?.cacheCoveredRecords)} 条记录有覆盖；缺失值保持未知。</p>
      <p>已计价请求： ${value(local?.totals?.pricedRequests)} · 未计价请求： ${value(local?.totals?.unpricedRequests)} · 已计价 Token： ${value(local?.totals?.pricedTokens)} · 未计价 Token： ${value(local?.totals?.unpricedTokens)}</p>
      <p>观察范围： ${e(time(local?.coverageStart))} – ${e(time(local?.coverageEnd))}. 最近导入： ${e(time(local?.lastImported))}.</p>
      <p>估算仅按公开 API 文本 Token 价格换算，与 GitHub 账单分开；不按当前配置猜测历史路由。</p>
      <p>绑定价格快照： ${(local?.totals?.priceSnapshots ?? []).map((s) => `<code>${e(s)}</code>`).join(" ") || "无"}</p></details>
      ${filterForm(snapshot, data)}</section>`;
  }
  function official(data, native) {
    const runtime = data.quota?.latest, previous = data.quota?.lastSuccessful;
    const shown = success(runtime?.status) ? runtime : previous;
    return `<section class="usage-panel"><div class="step-heading"><h2>官方运行时额度</h2>${button("runtime", busy.has("runtime") ? "读取运行时中…" : "刷新额度与模型", !native || busy.has("runtime"))}${button("cancel", "取消进行中的任务", !native || (!busy.has("runtime") && !busy.has("billing")))}</div>
      ${sectionError(data, "quota")}<div class="inline-actions">${badge(runtime?.status ?? "unavailable")}${data.quota?.stale ? badge("stale") : ""}</div><p>${e(runtime?.detail ?? "通过本机官方运行时读取，不复用客户端登录凭据。")}</p>
      ${shown ? `<p><strong>${e(shown.account ?? "账号未知")}</strong> · 运行时 ${e(shown.runtimeVersion ?? "unknown")} · 观察时间 ${e(time(shown.fetchedAt))}${shown !== runtime ? " · 上次成功快照，当前账号可能不可用" : ""}</p>
      <div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>额度 / 单位标识</th><th>已使用</th><th>额度</th><th>剩余</th><th>重置时间</th></tr></thead><tbody>${shown.quotas.map((q) => `<tr><td>${e(q.key)}</td><td>${value(q.used)}</td><td>${q.unlimited ? "不限量" : value(q.entitlement)}</td><td>${q.remainingPercentage == null ? "未知" : `${e(q.remainingPercentage)}%`}</td><td>${e(q.resetAt ?? "未提供")}</td></tr>`).join("")}</tbody></table></div>${!shown.quotas.length ? empty("运行时返回空额度列表，不能推断额度为零。") : ""}` : empty("尚未取得额度，请核对运行时及官方登录。")}
      <p class="muted">该接口不提供套餐名；额度保留原单位。模型目录： ${e(label(runtime?.modelStatus ?? "unavailable"))}.</p></section>
      <section class="usage-panel"><div class="step-heading"><h2>GitHub 个人账单</h2><div class="inline-actions"><label>月份<input type="month" id="billing-month" value="${e(billingMonth)}" max="${today().slice(0, 7)}" /></label>${button("billing", busy.has("billing") ? "刷新中…" : "刷新个人账单", !native || busy.has("billing") || !data.billing?.authorization?.hasSecret)}</div></div>
        ${sectionError(data, "billing")}<p>${data.billing?.account ? `${e(data.billing.account.login)}@${e(data.billing.account.host)} · GitHub 用户 ID ${e(data.billing.account.userId)}` : "读取个人账单需要本软件的独立授权。"} ${button("authorize", "管理授权", !native)}</p>
        <p class="muted">仅覆盖个人账单；组织支付或不可访问的数据保持未知。AI 积分与高级请求不相加。</p>
        ${(data.billing?.families ?? [{ endpointFamily: "aiCredit" }, { endpointFamily: "premiumRequest" }]).map(billingFamily).join("")}</section>`;
  }
  function billingFamily(f) {
    const latest = f.latest, shown = success(latest?.status) ? latest : f.lastSuccessful;
    const stale = shown && (shown !== latest || Date.now() - Date.parse(shown.fetchedAt) > 15 * 60000);
    return `<article class="billing-family"><div class="step-heading"><h3>${f.endpointFamily === "aiCredit" ? "AI 积分" : "高级请求"}</h3>${badge(latest?.status ?? "unavailable")}${stale ? badge("stale") : ""}</div>
      <p>${e(latest?.error ?? (latest ? label(latest.coverage) : "此账号和月份暂无快照"))}</p>${latest?.retryAt ? `<p>GitHub 可重试时间： ${e(time(latest.retryAt))}</p>` : ""}
      <small>最近尝试：${e(time(latest?.fetchedAt))}${shown ? ` · 显示快照：${e(time(shown.fetchedAt))} · API ${e(shown.apiVersion)} · 时间范围：${e(shown.periodStart.slice(0, 10))} 至 ${e(shown.periodEnd.slice(0, 10))}（不含结束日）` : ""}</small>
      ${shown?.items?.length ? `<div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>模型 / SKU</th><th>数量</th><th>单位</th><th>原始金额（USD）</th><th>优惠金额（USD）</th><th>官方净额（USD）</th><th>额度 / 剩余</th></tr></thead><tbody>${shown.items.map((i) => `<tr><td>${e(i.model ?? i.sku ?? i.product ?? "未提供")}<small>${e(i.sku ?? "")}</small></td><td>${value(i.quantity)}</td><td>${e(i.unit)}</td><td>${money(i.grossAmountUsd)}</td><td>${money(i.discountAmountUsd)}</td><td>${money(i.netAmountUsd)}</td><td>${value(i.allowance)} / ${value(i.remaining)}<small>重置： ${e(i.resetAt ?? "未提供")}</small></td></tr>`).join("")}</tbody></table></div>${shown.itemsTruncated ? `<p>显示前 ${shown.items.length} / ${shown.totalItemCount} 条，不从部分列表推断总额。</p>` : ""}` : empty(shown?.status === "successfulEmpty" ? "查询成功，无条目；不代表个人覆盖范围外的用量为零。" : "尚无官方金额。")}</article>`;
  }
  function models(snapshot, data) {
    const union = modelUnion(snapshot, data).filter((r) => (!filters.route || filters.route === r.route) && (!filters.model || r.rawModel === filters.model || r.canonicalModel === filters.model));
    const pageCount = Math.max(1, Math.ceil(union.length / 40)); modelPage = Math.min(modelPage, pageCount - 1);
    return `<section class="usage-panel"><div class="step-heading"><h2>全部来源中的模型</h2><span>${union.length} 个模型 / 路由条目</span></div><p>本地用量遵循上方筛选。配置、运行时及所选账单月份的模型仍可显示；目录中的模型不证明请求路由。</p>
      <div class="usage-table-wrap"><table class="usage-table model-table"><thead><tr><th>原始 / 规范模型</th><th>路由 / 归因置信度</th><th>客户端 / 来源</th><th>记录 / 请求</th><th>报告输入 / 归一化输入</th><th>未缓存输入</th><th>缓存读取 / 写入</th><th>输出</th><th>缓存命中</th><th>API 等价估算</th><th>官方账单</th><th>覆盖范围 / 质量</th></tr></thead><tbody>${union.slice(modelPage * 40, modelPage * 40 + 40).map((m) => {
        const t = m.totals;
        return `<tr><td><strong>${e(m.rawModel)}</strong><small>${e(m.canonicalModel ?? "规范 ID 未确定")}</small></td><td>${e(label(m.route))}<small>${e(label(m.confidence))}</small></td><td>${m.surfaces.map((s) => e(label(s))).join(", ") || "未观察到"}<small>${m.origins.map(e).join(" · ")}</small></td><td>${value(t?.records)} / ${value(t?.requests)}</td><td>${value(t?.inputReported)} / ${value(t?.normalizedInput)}</td><td>${value(t?.freshInput)}</td><td>${value(t?.cacheRead)} / ${value(t?.cacheWrite)}</td><td>${value(t?.output)}</td><td>${e(percent(t?.cacheHitRate))}</td><td>${money(t?.estimateUsd)}</td><td>${m.official.map((i) => `${value(i.quantity)} ${e(i.unit)} · ${money(i.netAmountUsd)}${i.stale ? "（旧快照）" : ""}`).join("<br>") || "不可用"}</td><td><details><summary>${e(coverage(t))}</summary><p>${m.quality.map(e).join("<br>") || "暂无本地质量观察"}</p><p>${m.availability.map(e).join(" · ")}</p></details></td></tr>`;
      }).join("")}</tbody></table></div>${!union.length ? empty("无匹配模型。请添加连接、刷新运行时或导入来源。") : ""}
      <div class="usage-pagination">${button("models-prev", "上一页", modelPage === 0)}<span>第 ${modelPage + 1} / ${pageCount}</span>${button("models-next", "下一页", modelPage >= pageCount - 1)}</div></section>
      ${breakdown("每日观察（UTC）", data.localUsage?.days)}${breakdown("客户端 / 共享运行时", data.localUsage?.surfaces)}${breakdown("路由", data.localUsage?.routes)}${breakdown("来源报告的供应商", data.localUsage?.providers)}`;
  }
  function breakdown(title, rows) {
    return `<details class="usage-panel"><summary>${e(title)}</summary>${rows?.length ? `<div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>分组</th><th>记录</th><th>输入</th><th>输出</th><th>缓存命中</th><th>估算金额（USD）</th><th>已计价记录</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${e(label(r.key))}</td><td>${r.totals.records}</td><td>${value(r.totals.inputReported)}</td><td>${value(r.totals.output)}</td><td>${e(percent(r.totals.cacheHitRate))}</td><td>${money(r.totals.estimateUsd)}</td><td>${r.totals.pricedRecords}/${r.totals.records}</td></tr>`).join("")}</tbody></table></div>` : empty("当前筛选下无记录。")}</details>`;
  }
  function sessions(data) {
    const rows = data.localUsage?.records ?? [], count = data.localUsage?.totalRecords ?? 0;
    const pages = Math.max(1, Math.ceil(count / filters.pageSize));
    return `<section class="usage-panel"><div class="step-heading"><h2>会话与请求</h2><span>${count} 条匹配观察</span></div><p>会话累计值替换旧值，VS Code 请求按稳定标识去重；会话和请求 ID 已哈希。</p>
      <div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>结束时间</th><th>模型 / 记录类型</th><th>来源 / 路由</th><th>输入 / 输出</th><th>估算</th><th>详情</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${e(time(r.finishedAt))}</td><td>${e(r.rawModel)}<small>${e(label(r.counterKind))}</small></td><td>${e(r.sourceId)}<small>${e(label(r.route))} · ${e(label(r.confidence))}</small></td><td>${value(r.inputReported)} / ${value(r.output)}</td><td>${money(r.estimateUsd)}</td><td>${button("record", "查看", false, `data-record-id="${e(r.id)}"`)}</td></tr>`).join("")}</tbody></table></div>
      ${!rows.length ? empty("此范围内无导入记录，请到数据来源页核对。") : ""}<div class="usage-pagination">${button("prev", "上一页", filters.page === 0)}<span>第 ${filters.page + 1} / ${pages}</span>${button("next", "下一页", filters.page >= pages - 1)}</div></section>`;
  }
  function sources(data, native) {
    return `<section class="usage-panel"><div class="step-heading"><h2>数据来源与覆盖</h2><div class="inline-actions">${button("sync", busy.has("sync") ? "导入中…" : "导入已启用来源", !native || busy.has("sync") || !(data.sources ?? []).some((s) => s.enabled))}${button("cancel", "取消进行中的任务", !native || (!busy.has("sync") && !busy.has("runtime") && !busy.has("billing") && !busy.has("prices")))}</div></div>
      <p>仅经同意后在本地导入元数据，不保存原日志行或对话内容。</p>${sectionError(data, "sources")}
      <div class="usage-progress" aria-live="polite">${[...progress.values()].map((r) => `<p>${e(r.sourceId)}: ${e(label(r.status))} · ${r.filesSeen} 个文件 · ${r.recordsSeen} 条观察已处理</p>`).join("")}</div>
      ${(data.sources ?? []).map((s) => `<article class="usage-source"><div class="step-heading"><h3>${e(s.name)}</h3>${badge(s.status)}</div><p>${e(s.detail)}</p><small>${e(s.pathHint)} · 解析器 ${e(s.parser)}</small><p>${s.recordCount} 条已保存记录 · 最近扫描：${e(time(s.lastScanAt))} · 最近成功扫描：${e(time(s.lastSuccessAt))}</p><div class="inline-actions">
        ${button(s.enabled ? "disable-source" : "enable-source", s.enabled ? "停用导入" : "启用导入…", !native || s.status === "unsupported" || busy.has("sync"), `data-source-id="${e(s.id)}"`)}
        ${button("source-info", "配置与隐私", false, `data-source-id="${e(s.id)}"`)}${button("clear-source", "清除已导入元数据…", !native || busy.has("sync"), `data-source-id="${e(s.id)}"`)}</div></article>`).join("") || empty("来源状态不可用，请刷新。")}
      <details><summary>覆盖限制</summary><p>CLI 累计记录不能证明输入语义或具体客户端。VS Code 仅贡献同意后导出的支持记录。停用保留元数据，清除只删除本软件导入的数据；停止 VS Code 导出还需关闭 OTel。</p></details></section>${prices(data, native)}`;
  }
  function prices(data, native) {
    const view = data.catalog, catalog = view?.catalog;
    const rows = (catalog?.models ?? []).filter((m) => m.model.toLowerCase().includes(priceSearch.toLowerCase()));
    return `<section class="usage-panel"><div class="step-heading"><h2>价格目录与历史估算</h2>${button("prices", busy.has("prices") ? "刷新中…" : "刷新官方 OpenRouter 目录", !native || busy.has("prices"))}${button("cancel", "取消进行中的任务", !native || !busy.has("prices"))}</div>
      ${sectionError(data, "catalog")}<p>${e(view?.latest?.detail ?? "刷新价格目录，将兼容的观察记录绑定到不可变价格快照。")}</p>${view?.stale ? badge("stale") : ""}
      ${catalog ? `<p>${e(catalog.detail)}</p><p>核对时间：${e(time(view?.checkedAt))} · 快照创建：${e(time(catalog.fetchedAt))} · 解析器 v${catalog.parserVersion} · <a href="https://openrouter.ai/api/v1/models" target="_blank" rel="noreferrer">官方来源</a></p><details><summary>快照标识</summary><code>${e(catalog.id)}</code><p>来源版本： ${e(catalog.sourceVersion)}</p><p>历史估算保留原快照。Token 缺失或价格档位不明时不估算；零价格不等于价格缺失。</p></details>
      <form id="price-filter" class="inline-actions"><label>查找价格<input name="priceSearch" value="${e(priceSearch)}" maxlength="160" placeholder="模型 ID" /></label><button class="button ghost small">查找</button></form>
      <p>显示 ${Math.min(rows.length, 80)} / ${rows.length} 个匹配模型；单位为 USD / 百万文本 Token。</p><div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>规范模型</th><th>输入门槛</th><th>输入</th><th>缓存读取</th><th>缓存写入 / 1 h</th><th>输出</th></tr></thead><tbody>${rows.slice(0, 80).flatMap((m) => m.supported ? m.tiers.map((t) => `<tr><td>${e(m.model)}</td><td>≥ ${t.minInput}</td><td>${money(t.input)}</td><td>${money(t.cacheRead)}</td><td>${money(t.cacheWrite)} / ${money(t.cacheWrite1h)}</td><td>${money(t.output)}</td></tr>`) : [`<tr><td>${e(m.model)}</td><td colspan="5">价格格式不受支持，不生成估算</td></tr>`]).join("")}</tbody></table></div>` : empty("尚无价格快照；取得兼容价格和完整 Token 数据后才能估算。")}</section>`;
  }
  function render(snapshot, data, native) {
    return `${!native ? '<div class="preview-banner">浏览器试用 · 不读取真实用量、额度或账单</div>' : ""}${overview(snapshot, data)}
      ${(snapshot.clients ?? []).some(c => c.kind === "jetbrains-copilot" && c.path) ? '<p class="security-note" role="status">JetBrains 用量：未覆盖。尚未验证其 OTel 导入格式，不读取 IDE 日志，也不将 CLI 记录猜测为 JetBrains 用量。缺失数据保持未知，不是零。</p>' : ""}
      <nav class="usage-tabs" aria-label="用量视图">${[["official", "官方订阅 / 用量"], ["models", "模型统计"], ["sessions", "会话 / 详情"], ["sources", "数据来源 / 价格"]].map(([id, name]) => `<button class="${tab === id ? "active" : ""}" data-usage-tab="${id}" aria-current="${tab === id ? "page" : "false"}">${name}</button>`).join("")}</nav>
      ${{ official: () => official(data, native), models: () => models(snapshot, data), sessions: () => sessions(data), sources: () => sources(data, native) }[tab]()}`;
  }
  function setupInstructions(source) {
    const settings = source.id === "vscode-otel" ? { "github.copilot.chat.otel.enabled": true, "github.copilot.chat.otel.exporterType": "file", "github.copilot.chat.otel.outfile": source.setupPath, "github.copilot.chat.otel.captureContent": false } : null;
    return `<p>${e(source.pathHint)}</p>${settings ? `<p>启用导入后，请自行把以下配置加入 VS Code 用户设置并重启。软件只创建自己的接收目录，不改 VS Code 设置；仅影响后续观察。</p><pre class="usage-code">${e(JSON.stringify(settings, null, 2))}</pre><p>停止导出请将 <code>github.copilot.chat.otel.enabled</code> 设为 <code>false</code>。</p>` : source.id === "copilot-session-events" ? "<p>正常使用官方运行时即可。已结束且含支持的 v1 模型指标的会话可导入；CLI / App 共享记录只计一次，客户端归属保持未知。</p>" : "<p>App 尚无已审核的独立用量来源，不读取私有存储。</p>"}
      <p>源日志可能包含对话。本软件只保存模型标识、哈希 ID、计数及时间，不上传日志。停用停止读取；清除移除本软件中的该来源记录与游标。</p>`;
  }
  function confirm(title, body, text, action) {
    context.openModal({ title, body, wide: true, footer: `<button class="button ghost" data-modal-close>取消</button><button class="button primary" id="usage-confirm">${e(text)}</button>`, onOpen(root) {
      root.querySelector("#usage-confirm").addEventListener("click", async (event) => {
        event.target.disabled = true;
        try { await action(); context.closeModal(); await context.refresh(); }
        catch (err) { context.showToast(err?.message ?? String(err), "error"); event.target.disabled = false; }
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
    if (name === "record") {
      const record = data.localUsage?.records.find((r) => r.id === buttonElement.dataset.recordId);
      if (record) context.openModal({ title: "已导入元数据", wide: true, body: `<p>只显示允许保存的元数据，标识已哈希；不保留原日志行或对话。</p><pre class="usage-code">${e(JSON.stringify(record, null, 2))}</pre>`, footer: '<button class="button ghost" data-modal-close>关闭</button>' });
    } else if (name === "source-info" && source) {
      context.openModal({ title: `${source.name} 配置`, wide: true, body: setupInstructions(source), footer: '<button class="button ghost" data-modal-close>关闭</button>' });
    } else if (name === "enable-source" && source && context.native) {
      confirm(`启用 ${source.name} 导入`, setupInstructions(source), "启用本地元数据导入", () => context.invoke("set_usage_source_enabled", { sourceId, enabled: true }));
    } else if (name === "disable-source") {
      await run("sources", "set_usage_source_enabled", { sourceId, enabled: false });
    } else if (name === "clear-source" && source && context.native) {
      confirm(`清除 ${source.name} 元数据`, `<p>删除 ${source.recordCount} 条导入记录、该来源游标及导入历史，并停用导入。保留原日志、账单和价格快照；重新导入可从原日志重建记录。</p>`, "清除已导入元数据", () => context.invoke("clear_local_usage", { sourceId, confirmed: true }));
    } else if (name === "runtime") await run("runtime", "refresh_official_runtime_usage");
    else if (name === "billing") await run("billing", "refresh_personal_github_usage", billingQuery());
    else if (name === "prices") await run("prices", "refresh_price_catalog");
    else if (name === "sync") { progress.clear(); await run("sync", "sync_local_usage", { sourceIds: [] }); }
    else if (name === "cancel" && context.native) await context.invoke("cancel_usage_sync");
    else if (name === "authorize") globalThis.PilotWeaveGithubAuth?.openAuthorize?.();
    else if (name === "prev" || name === "next") { filters.page = Math.max(0, filters.page + (name === "next" ? 1 : -1)); await context.refresh(); }
    else if (name === "models-prev" || name === "models-next") { modelPage = Math.max(0, modelPage + (name === "models-next" ? 1 : -1)); context.render(); }
  }
  function configure(api) {
    context = api;
    document.addEventListener("click", (event) => {
      const tabButton = event.target.closest("[data-usage-tab]");
      if (tabButton) { tab = tabButton.dataset.usageTab; context.render(); }
      const target = event.target.closest("[data-usage-action]");
      if (target && !target.disabled) action(target).catch((err) => context.showToast(err?.message ?? String(err), "error"));
    });
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
      if (region) region.textContent = [...progress.values()].map((r) => `${label(r.status)} · ${r.sourceId} · ${r.filesSeen} 个文件 · ${r.recordsSeen} 条观察已处理`).join("\n");
    }).catch((err) => context.showToast(`导入进度不可用： ${String(err)}`, "error"));
  }
  function billingQuery() { const [year, month] = billingMonth.split("-").map(Number); return { year, month }; }
  function preview(command, snapshot) {
    const unavailable = { status: "unavailable", detail: "浏览器试用不提供真实本地数据" };
    if (command === "get_usage_overview") return { ...unavailable, start: filters.start, end: filters.end, totals: { records: 0, pricedRecords: 0, unpricedRecords: 0, unresolvedModels: 0, unknownSemantics: 0, priceSnapshots: [] }, models: [], days: [], routes: [], surfaces: [], providers: [], records: [], totalRecords: 0 };
    if (command === "get_official_runtime_usage") return { latest: null, lastSuccessful: null, stale: false };
    if (command === "get_price_catalog") return { catalog: null, latest: null, stale: false };
    if (command === "get_github_billing") return { authorization: { hasSecret: false }, account: null, families: [] };
    if (command === "get_usage_runs") return [];
    if (command === "get_usage_sources") return ["copilot-session-events", "vscode-otel", "github-copilot-app"].map((id) => ({ id, name: label(id), enabled: false, status: id === "github-copilot-app" ? "unsupported" : "disabled", detail: "浏览器试用不读取本地来源", pathHint: "本地路径不可用", setupPath: null, parser: "仅供试用", recordCount: 0 }));
    if (command === "get_setup_status") return { preferences: { connectionId: snapshot.connections[0]?.id }, target: null, alignment: "notSignedIn", accounts: globalThis.PilotWeaveAccount.previewStatus(), targets: [], manualConfirmed: false, scannedAt: null };
    if (command === "get_installation_status") return globalThis.PilotWeaveInstaller.previewStatus();
    if (command === "get_github_authorization_status") return globalThis.PilotWeaveGithubAuth.previewStatus();
    throw new Error("此操作需要桌面软件");
  }
  return { configure, render, query: () => ({ ...filters }), billingQuery, preview, modelUnion, money, value, percent, setupInstructions, label, metrics, coverage };
});
