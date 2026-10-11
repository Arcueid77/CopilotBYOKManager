(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PilotWeaveJetBrains = api;
})(globalThis, () => {
  "use strict";
  const e = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  function guide(connection, target, operation) {
    const automatic = Boolean(operation?.supported);
    return `<p>${e(target.detail)}</p><p>${e(target.path ?? "Only standard JetBrains product/version profiles are detected. Custom and portable paths are manual.")}</p>
      ${automatic ? `<p><strong>Automatic BYOK deployment is available.</strong> Preview and confirm the native plan to write this Connection's endpoint, protocol, enabled models, capability/token limits, headers and provider key. IDE profiles sharing the runtime root share one <code>github-copilot/byok.json</code>; it is written once and unmanaged providers are preserved.</p>
        <p>Close IDEs before applying, then reopen them to refresh cached model pickers. Select a deployed model in Copilot Chat. Configuration on disk is not proof of a successful provider request or GitHub sign-in.</p>` : "<p>Automatic writes require a reviewed plugin version, a stored key and a compatible endpoint. The native review below explains any unsupported selection.</p>"}
      ${automatic ? `<ol class="manual-steps"><li>Close IDEs using this shared runtime root before applying.</li>
        <li>Click <strong>Preview automatic BYOK</strong> and review the selected IDE/profile, enabled models and native changes.</li>
        <li>Confirm the reviewed plan. PilotWeave writes the provider key, endpoint and model configuration automatically; you do not need to re-enter them in Manage Models.</li>
        <li>Reopen the IDE, select a deployed model in <strong>Copilot Chat → model picker</strong>, and verify a real request. Organization policy may restrict available providers.</li></ol>
        <p>If you are not signed in, use the separate official <strong>Tools → GitHub Copilot → Login to GitHub</strong> flow. Automatic BYOK deployment does not change your GitHub account.</p>` : `<ol class="manual-steps"><li>In this IDE, open <strong>Settings / Preferences → Plugins → Marketplace</strong> and install or enable <strong>GitHub Copilot</strong> by GitHub. Restart if requested.</li>
        <li>Use <strong>Tools → GitHub Copilot → Login to GitHub</strong>. Complete the official browser flow and check the account separately in every IDE.</li>
        <li>Open <strong>GitHub Copilot Chat → model picker → Manage Models → Add Models</strong>. Choose a provider or an OpenAI-compatible custom endpoint and enter the provider API key in the IDE.</li>
        <li>Save, enable the desired models, select one in Chat, and verify it works. Plugin version and organization policy may restrict available providers.</li></ol>`}
      ${connection ? `<h3>Selected connection: ${e(connection.name)}</h3><p>Endpoint: <code>${e(connection.baseUrl)}</code></p><p>Protocol: <code>${e(connection.protocol)}</code> · Verify compatibility in the IDE; provider fields are not interchangeable.</p>
        <ul>${connection.models.filter(m => m.enabled).map(m => `<li>Model: <code>${e(m.modelId)}</code></li>`).join("")}</ul>
        ${connection.headers && Object.keys(connection.headers).length ? `<p>Header values are never displayed here. ${automatic ? "They are materialized only in the native BYOK configuration." : "Configure only fields supported by the IDE's provider UI."}</p>` : ""}` : "<p>Add a Connection to see its endpoint and enabled model IDs here.</p>"}
      ${operation ? `<details><summary>Native adapter review · ${automatic ? "automatic deployment available" : "unsupported automatic write"}</summary><p>${e(operation.description)}</p><ul>${operation.changes.map(c => `<li>${e(c)}</li>`).join("")}</ul></details>` : ""}
      <p>Previewing this guide does not write anything or expose a key. Confirmed deployment materializes your Connection's key in the dedicated BYOK file and keeps private rollback data. PilotWeave never inspects Password Safe, copies GitHub login credentials, installs an IDE, or marks manual account steps verified. Copilot app confirmation does not cover this IDE.</p>
      <p><a href="https://plugins.jetbrains.com/plugin/17718-github-copilot" target="_blank" rel="noreferrer">Official plugin</a> · <a href="https://github.blog/changelog/2026-07-14-github-copilot-for-jetbrains-expands-byok-capabilities/" target="_blank" rel="noreferrer">Official custom endpoint support</a></p>`;
  }
  return { guide };
});
