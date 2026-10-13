(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PilotWeaveUI = api;
})(globalThis, function () {
  "use strict";
  const focusable = 'button, input:not([type="hidden"]), select, textarea, a[href], summary, [tabindex]';
  const identityKeys = ["name", "data-action", "data-id", "data-route", "data-usage-tab", "data-usage-action", "data-source-id", "data-record-id", "data-resource-action", "data-resource-id", "data-install-action", "data-component-id", "data-account-action", "data-github-auth-action"];
  const owners = new WeakMap();
  // Describe controls, never their values (in particular passwords and headers).
  function capture(container) {
    const element = container.ownerDocument.activeElement;
    if (!element || !container.contains(element)) return null;
    const attributes = Object.fromEntries(identityKeys.map(key => [key, element.getAttribute(key)]).filter(([, value]) => value !== null));
    return element.id || Object.keys(attributes).length ? { id: element.id, tag: element.tagName, attributes } : null;
  }
  function restore(container, identity) {
    if (!identity) return false;
    const element = Array.from(container.querySelectorAll(focusable)).find(candidate => candidate.tagName === identity.tag && (identity.id ? candidate.id === identity.id : Object.entries(identity.attributes).every(([key, value]) => candidate.getAttribute(key) === value)));
    if (!element || element.disabled || !element.getClientRects().length) return false;
    element.focus({ preventScroll: true });
    return true;
  }
  function modal({ root, background, cleanup }) {
    const doc = root.ownerDocument;
    let active = false, dirty = false, busy = false, opener, identity, previousInert, guard;
    const items = () => Array.from(root.querySelectorAll(focusable)).filter(element => !element.disabled && !element.closest("[inert]") && element.tabIndex >= 0 && element.getClientRects().length);
    function close() {
      if (!active) return true;
      active = false;
      if (owners.get(root) === controller) owners.delete(root);
      doc.removeEventListener("keydown", keydown, true);
      root.removeEventListener("input", changed);
      root.removeEventListener("change", changed);
      root.querySelectorAll('input[type="password"]').forEach(input => { input.value = ""; });
      background.inert = previousInert;
      cleanup();
      if (opener?.isConnected && !opener.disabled) opener.focus({ preventScroll: true });
      else restore(background, identity);
      opener = identity = guard = null;
      dirty = busy = false;
      return true;
    }
    function changed(event) {
      if (event.target.name && event.target.closest("#connection-form, #resource-form")) dirty = true;
    }
    function requestClose() {
      if (!active) return true;
      if (busy) return false;
      if (!dirty) return close();
      if (!guard) {
        guard = doc.createElement("div");
        guard.className = "modal-discard";
        guard.setAttribute("role", "alert");
        guard.innerHTML = '<p>有未保存的修改。关闭后将放弃这些修改；密钥不会保存为草稿。</p><div class="inline-actions"><button type="button" class="button primary" data-keep-editing>继续编辑</button><button type="button" class="button ghost" data-discard-editing>放弃修改并关闭</button></div>';
        root.querySelector(".modal-footer, .modal-body").append(guard);
        guard.querySelector("[data-keep-editing]").addEventListener("click", () => { guard.hidden = true; (root.querySelector('form input:not([type="hidden"])') ?? root.querySelector("[data-modal-close]")).focus(); });
        guard.querySelector("[data-discard-editing]").addEventListener("click", close);
      }
      guard.hidden = false;
      guard.querySelector("[data-keep-editing]").focus();
      return false;
    }
    function keydown(event) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); requestClose(); }
      else if (event.key === "Tab") {
        const list = items(), current = doc.activeElement;
        if (!list.length) { event.preventDefault(); root.querySelector(".modal-header h2").focus(); }
        else if (!root.contains(current) || (event.shiftKey ? current === list[0] || !list.includes(current) : current === list[list.length - 1])) {
          event.preventDefault(); (event.shiftKey ? list[list.length - 1] : list[0]).focus();
        }
      }
    }
    function mount() {
      owners.set(root, controller);
      opener = doc.activeElement;
      identity = capture(background);
      previousInert = background.inert;
      background.inert = true;
      active = true; dirty = busy = false;
      root.addEventListener("input", changed);
      root.addEventListener("change", changed);
      doc.addEventListener("keydown", keydown, true);
      root.querySelector(".modal-backdrop").addEventListener("click", event => { if (event.target.classList.contains("modal-backdrop")) requestClose(); });
      root.querySelectorAll("[data-modal-close]").forEach(button => button.addEventListener("click", requestClose));
      const title = root.querySelector(".modal-header h2"); title.tabIndex = -1;
      (root.querySelector('form input:not([type="hidden"])') ?? title).focus();
    }
    function setBusy(value) {
      busy = value;
      root.querySelector(".modal")?.setAttribute("aria-busy", String(value));
      root.querySelectorAll("form").forEach(form => { form.inert = value; });
      root.querySelectorAll("[data-modal-close], [data-resource-close]").forEach(button => { button.disabled = value; });
    }
    const controller = { mount, close, requestClose, setBusy, prepare() { return owners.get(root)?.requestClose() ?? true; }, get active() { return active; } };
    return controller;
  }
  return { capture, restore, modal };
});
