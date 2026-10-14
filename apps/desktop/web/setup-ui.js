(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerSetup = api;
})(globalThis, () => {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  const escape = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const label = (s) => ({ inSync: tr("In sync"), notDeployed: tr("Not deployed"), outOfDate: tr("Out of date"), notInstalled: tr("Not installed"), userConfirmedSameAccount: tr("Same account · user confirmed"), verifiedSameAccount: tr("Same account · verified"), partiallyVerified: tr("Requires confirmation"), notSignedIn: tr("Choose and confirm an account"), actionRequired: tr("Action required"), successfulEmpty: tr("No observations imported"), networkError: tr("Network unavailable"), schemaError: tr("Unsupported data schema") })[s] ?? String(s ?? tr("Unknown")).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  const date = (s) => s && !Number.isNaN(Date.parse(s)) ? new Date(s).toLocaleString(i18n.locale()) : tr("Unavailable");
  const value = (n) => n == null ? tr("Unknown") : String(n);
  function derive(snapshot, data, native = true) {
    const setup = data.setup;
    const components = data.components ?? [];
    const scanned = native && Boolean(setup && components.length >= 4) && !data.errors?.setup && !data.errors?.components;
    const installed = scanned && components.length >= 4 && components.every((c) => c.status === "ready");
    const missing = components.filter((c) => ["missing", "broken"].includes(c.status));
    const aligned = scanned && ["verifiedSameAccount", "userConfirmedSameAccount"].includes(setup?.alignment);
    const connections = snapshot.connections.filter(c => c.enabled !== false);
    const selected = connections.find((c) => c.id === setup?.preferences?.connectionId) ?? connections[0];
    const writable = snapshot.clients.filter((c) => c.detected && c.supportsWrite);
    // The saved manual confirmation belongs only to the Copilot app. Optional
    // JetBrains never inherits app confirmation. Reviewed writable profiles use
    // real deployment fingerprints; missing/unsupported profiles remain optional.
    const manual = snapshot.clients.filter((c) => c.kind === "github-copilot-app" && c.detected && !c.supportsWrite);
    const inSync = writable.filter((c) => setup?.targets?.find((t) => t.targetId === c.id)?.state === "inSync").length;
    const deployed = scanned && !snapshot.stateRecovery && !snapshot.deploymentRecovery && Boolean(selected) && writable.length > 0 && inSync === writable.length && (!manual.length || setup?.manualConfirmed);
    const complete = [scanned, installed, aligned, deployed].filter(Boolean).length;
    let next = { action: "route", route: "usage", text: tr("View usage insights") };
    if (!scanned) next = { action: "refresh", text: native ? tr("Scan this computer") : tr("Preview only · open the desktop app") };
    else if (snapshot.deploymentRecovery) next = { action: "preview-recovery", text: tr("Review interrupted deployment") };
    else if (snapshot.stateRecovery) next = { action: "route", route: "settings", text: tr("Review storage recovery") };
    else if (!installed) next = missing.length ? { action: "setup-install", text: tr("Install {0} missing components", missing.length) } : { action: "route", route: "clients", text: tr("Review component issues") };
    else if (!aligned) next = { action: "setup-accounts", text: tr("Verify the same GitHub account") };
    else if (!selected) next = { action: "add-connection", text: tr("Add a model connection") };
    else if (!deployed) next = inSync === writable.length && manual.length ? { action: "setup-manual", text: tr("Complete Copilot app setup") } : { action: "setup-deploy", text: tr("Preview and deploy {0}", selected.name) };
    return { scanned, installed, missing, aligned, selected, writable, manual, inSync, deployed, complete, next };
  }
  const badge = (state) => `<span class="setup-badge ${["ready", "inSync", "verified", "verifiedSameAccount", "userConfirmedSameAccount"].includes(state) ? "good" : ""}">${escape(label(state))}</span>`;
  function connectionCard(snapshot, data, s, native) {
    const blocked = Boolean(snapshot.stateRecovery || snapshot.deploymentRecovery);
    const models = s.selected?.models?.filter(m => m.enabled) ?? [];
    return `<section class="setup-step setup-connection-card" aria-label="${tr("Connection and models")}"><div class="step-body">
      <div class="step-heading"><h2>${tr("Connection and models")}</h2>${badge(s.deployed ? "ready" : "actionRequired")}</div>
      <p>${tr("Choose or edit your provider, then preview the configuration changes for your clients.")}</p>
      <div class="setup-connection-controls"><label class="setup-select">${tr("Current connection")}<select id="setup-connection" ${!snapshot.connections.length || blocked ? "disabled" : ""}>${snapshot.connections.map(c => `<option value="${escape(c.id)}" ${c.id === s.selected?.id ? "selected" : ""}>${escape(c.name)}</option>`).join("") || `<option>${tr("No connections yet")}</option>`}</select></label>
      <button class="button ghost small" data-action="edit-connection" data-id="${escape(s.selected?.id)}" ${!s.selected || blocked ? "disabled" : ""}>${tr("Edit connection")}</button><button class="button ghost small" data-action="add-connection" ${blocked ? "disabled" : ""}>${tr("Add connection")}</button></div>
      ${s.selected ? `<p class="setup-endpoint">${escape(s.selected.baseUrl ?? "")} · ${escape(s.selected.protocol ?? "")}</p><div class="model-list">${models.slice(0, 8).map(m => `<span class="model-chip">${escape(m.name)}</span>`).join("")}${models.length > 8 ? `<span class="model-chip">${tr("+{0} more", models.length - 8)}</span>` : ""}</div><p>${tr("{0} enabled models · Edit connection to add, remove or discover models.", models.length)}</p>` : `<p>${tr("Add a URL and API key to discover models and create your first connection.")}</p>`}
      <div class="inline-actions"><button class="button primary small" data-action="setup-deploy" ${!native || !s.selected || !s.writable.length || blocked ? "disabled" : ""}>${s.deployed ? tr("Review deployment") : tr("Preview deployment to {0} clients", s.writable.length)}</button>${s.manual.length ? `<button class="button ghost small" data-action="setup-manual">${data.setup?.manualConfirmed ? tr("Review manual setup") : tr("Copilot app: manual setup")}</button>` : ""}${snapshot.clients.filter(c => c.kind === "jetbrains-copilot").map(c => `<button class="button ghost small" data-action="jetbrains-guide" data-id="${escape(c.id)}">${escape(c.name)}: ${c.supportsWrite ? tr("automatic BYOK") : tr("BYOK guide")}</button>`).join("")}</div>
      <details class="setup-target-details" ${!s.deployed ? "open" : ""}><summary>${tr("Deployment status · {0}/{1} automatic targets in sync{2}", s.inSync, s.writable.length, s.manual.length ? tr(" · {0} app manual", s.manual.length) : "")}</summary><div class="setup-rows">${snapshot.clients.map(c => { const state = data.setup?.targets?.find(t => t.targetId === c.id); const confirmed = c.kind === "github-copilot-app" && !c.supportsWrite && c.detected && data.setup?.manualConfirmed; return `<div><span>${escape(c.name)}</span>${badge(confirmed ? "userConfirmed" : state?.state ?? "unknown")}<small>${escape(confirmed ? tr("Provider setup confirmed by you for this connection") : state?.detail ?? tr("Configuration has not been checked"))}</small></div>`; }).join("")}</div></details>
    </div></section>`;
  }
  function render(snapshot, data, native) {
    const s = derive(snapshot, data, native);
    const account = data.setup?.target;
    const local = data.localUsage;
    const runtime = ["available", "successfulEmpty"].includes(data.quota?.latest?.status) ? data.quota.latest : data.quota?.lastSuccessful ?? data.quota?.latest;
    const quota = runtime?.status === "available" ? runtime.quotas?.find((q) => q.key === "premium_interactions") ?? runtime.quotas?.[0] : null;
    const next = s.next;
    return `
      ${!native ? `<div class="preview-banner" role="status">${tr("Browser preview · disposable sample data · no computer scan, installation or sign-in")}</div>` : ""}
      <section class="setup-hero"><div><p class="eyebrow">${tr("YOUR COPILOT SETUP")}</p><h2>${s.complete === 4 ? tr("Your core Copilot setup is ready") : tr("Set up GitHub Copilot on this computer")}</h2><p>${tr("Install apps, confirm one GitHub account, deploy one model setup, and track usage.")}</p></div>
        <div class="setup-progress"><strong>${native ? tr("{0} of 4", s.complete) : tr("Preview")}</strong><span>${tr("Core steps ready")}</span><button class="button primary" data-action="${next.action}" data-route="${next.route ?? ""}" ${!native ? "disabled" : ""}>${escape(next.text)}</button></div></section>
      ${connectionCard(snapshot, data, s, native)}
      <details class="setup-checks" ${!s.installed || !s.aligned ? "open" : ""}><summary>${tr("Installation and accounts · {0}", s.installed && s.aligned ? tr("Ready") : tr("Needs attention"))}</summary><div class="setup-steps">
        <section class="setup-step"><div class="step-number">1</div><div class="step-body"><div class="step-heading"><h2>${tr("Scan this computer")}</h2>${badge(s.scanned ? "ready" : "unknown")}</div><p>${s.scanned ? tr("Last scanned {0}", escape(date(data.setup.scannedAt))) : tr("A complete native scan is required to determine readiness.")}</p>${data.errors?.setup ? `<p class="inline-error">${escape(data.errors.setup)}</p>` : ""}${data.setup?.preferencesError ? `<p class="inline-error">${tr("Saved setup preferences are unavailable: {0}", escape(data.setup.preferencesError))}</p>` : ""}<button class="button ghost small" data-action="refresh">${tr("Rescan")}</button></div></section>
        <section class="setup-step"><div class="step-number">2</div><div class="step-body"><div class="step-heading"><h2>${tr("Install Copilot apps")}</h2>${badge(s.installed ? "ready" : "actionRequired")}</div>
          <div class="setup-rows">${(data.components ?? []).map((c) => `<div><span>${escape(c.name)}</span>${badge(c.status)}${["missing", "broken"].includes(c.status) ? `<button class="button ghost small" data-install-action="install-one" data-component-id="${escape(c.id)}" ${!native ? "disabled" : ""}>${c.status === "broken" ? tr("Repair") : tr("Install")}</button>` : ""}</div>`).join("") || `<p>${tr("Component status unavailable")}</p>`}</div>
          <button class="button ghost small" data-install-action="install-all" ${!native || !s.missing.length ? "disabled" : ""}>${tr("Install all missing{0}", s.missing.length ? ` (${s.missing.length})` : "")}</button></div></section>
        <section class="setup-step"><div class="step-number">3</div><div class="step-body"><div class="step-heading"><h2>${tr("Verify one GitHub account")}</h2>${badge(data.setup?.alignment ?? "unknown")}</div>
          <p>Target: <strong>${escape(account ? `${account.login}@${account.host}` : tr("Choose an account in the confirmation dialog"))}</strong></p>
          <div class="setup-rows">${(data.setup?.accounts?.surfaces ?? []).map((a) => `<div><span>${escape(({ vsCodeCopilot: tr("VS Code Copilot"), copilotCli: tr("Copilot CLI"), githubCopilotApp: tr("Copilot app"), jetBrainsCopilot: tr("JetBrains GitHub Copilot · each IDE") })[a.surface] ?? a.surface)}</span>${badge(s.aligned && data.setup.alignment === "userConfirmedSameAccount" && a.state !== "verified" ? "userConfirmed" : a.state)}<button class="button ghost small" data-action="setup-signin" data-surface="${escape(a.surface)}" ${!native || a.state === "notInstalled" ? "disabled" : ""}>${a.surface === "vsCodeCopilot" ? tr("VS Code sign-in") : tr("Review sign-in")}</button><details><summary>${tr("Evidence · {0}", escape(label(a.state)))}</summary><p>${escape(a.evidence)}</p><p>${escape(a.detail)}</p></details></div>`).join("")}</div>
          ${s.aligned && data.setup?.alignment === "userConfirmedSameAccount" ? `<p class="muted">${tr("Confirmed by you {0}. This confirmation expires after 30 days or when observed evidence changes.", escape(date(data.setup.preferences.accountConfirmation?.confirmedAt)))}</p>` : ""}
          <div class="inline-actions"><button class="button ghost small" data-action="setup-accounts" ${!native ? "disabled" : ""}>${tr("Confirm accounts")}</button></div></div></section>
      </div></details>
      <section class="usage-home"><div class="step-heading"><h2>${tr("Usage insights")}</h2><span class="setup-badge">${tr("Optional · does not block core setup")}</span></div><div class="usage-home-grid">
        <div><h3>${tr("Official runtime quota")}</h3><strong>${quota ? (quota.unlimited ? tr("Unlimited") : `${escape(value(quota.used))} / ${escape(value(quota.entitlement))}`) : escape(label(runtime?.status ?? "unavailable"))}</strong><p>${quota ? tr("{0} · reset {1}", escape(quota.key), escape(quota.resetAt ?? "unknown")) : tr("Refresh from the signed-in Copilot runtime in Usage.")}</p><small>${runtime ? `${escape(runtime.account ?? tr("Account unavailable"))} · ${escape(date(runtime.fetchedAt))}${data.quota?.stale ? tr(" · Stale") : ""}` : tr("Not refreshed")}</small></div>
        <div><h3>${tr("Local observations")}</h3><strong>${local?.totalRecords ? tr("{0} input · {1} output", escape(value(local.totals.inputReported)), escape(value(local.totals.output))) : data.errors?.localUsage || !local || local.status === "unavailable" ? tr("Unavailable") : tr("No observations imported")}</strong><p>${tr("Cache hit: {0}", local?.totals.cacheHitRate == null ? tr("Unknown") : tr("{0}% of covered input", (Number(local.totals.cacheHitRate) * 100).toFixed(1)))}</p><small>${tr("{0}API-equivalent estimate: {1} · {2}", local?.start ? tr("{0} – {1} (UTC) · ", escape(local.start), escape(local.end)) : "", local?.totals.estimateUsd == null ? tr("Unavailable") : tr("${0} · {1}/{2} records priced", escape(local.totals.estimateUsd), local.totals.pricedRecords, local.totalRecords), escape(date(local?.lastImported)))}</small></div></div><button class="button ghost small" data-action="route" data-route="usage">${tr("Open usage and data sources")}</button></section>`;
  }
  return { escape, label, date, derive, render };
});
