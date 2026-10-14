(function (root, factory) {
  const create = factory();
  if (typeof module === "object" && module.exports) module.exports = { create };
  else root.CopilotBYOKManagerAppearance = create(root);
})(globalThis, function () {
  "use strict";
  return function create(environment) {
    const STORAGE_KEY = "copilot-byok-manager.appearance";
    const modes = Object.freeze(["system", "light", "dark"]);
    const media = environment.matchMedia?.("(prefers-color-scheme: dark)");
    let preference = "system";
    try {
      const saved = environment.localStorage?.getItem(STORAGE_KEY);
      if (modes.includes(saved)) preference = saved;
    } catch { /* A denied preference store must not prevent launch. */ }
    function resolved() { return preference === "system" ? (media?.matches ? "dark" : "light") : preference; }
    function apply() {
      const document = environment.document;
      if (!document) return;
      document.documentElement.dataset.theme = resolved();
      document.documentElement.style.colorScheme = resolved();
      document.querySelectorAll('[data-appearance-select]').forEach(select => { select.value = preference; });
    }
    function set(value) {
      if (!modes.includes(value)) return { changed: false, persisted: false };
      const changed = preference !== value;
      preference = value;
      let persisted = false;
      try { environment.localStorage?.setItem(STORAGE_KEY, value); persisted = Boolean(environment.localStorage); } catch { /* Session-only choice still works. */ }
      // CSS-only: never redraw an editor, consume a plan or call native IPC.
      apply();
      return { changed, persisted };
    }
    media?.addEventListener?.("change", () => { if (preference === "system") apply(); });
    apply();
    return Object.freeze({ preference: () => preference, resolved, set, apply, modes, STORAGE_KEY });
  };
});
