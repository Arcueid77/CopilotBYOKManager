(function (root, factory) {
  const commonJS = typeof module === "object" && module.exports;
  const api = factory(commonJS ? require("./i18n-messages.js") : root.CopilotBYOKManagerMessages, root);
  if (commonJS) module.exports = api;
  else root.CopilotBYOKManagerI18n = api;
})(globalThis, function (messages, environment) {
  "use strict";
  const STORAGE_KEY = "copilot-byok-manager.locale";
  const supported = Object.freeze(["zh-CN", "en"]);
  const valid = value => supported.includes(value);
  const listeners = new Set();
  function systemLocale(languages) {
    for (const language of languages ?? []) {
      if (typeof language !== "string") continue;
      if (/^zh(?:-|$)/i.test(language)) return "zh-CN";
      if (/^en(?:-|$)/i.test(language)) return "en";
    }
    return "en";
  }
  let current = systemLocale(environment.navigator?.languages ?? [environment.navigator?.language]);
  try { const saved = environment.localStorage?.getItem(STORAGE_KEY); if (valid(saved)) current = saved; } catch { /* Storage can be denied in browser preview. */ }

  function t(key, ...parameters) {
    // Never run remote diagnostics, user names, model IDs or endpoint values
    // through message lookup. Only explicit, source-owned keys belong here.
    const entry = Object.hasOwn(messages, key) ? messages[key] : null;
    const text = entry?.[current === "zh-CN" ? 0 : 1] ?? String(key);
    return text.replace(/\{(\d+)\}/g, (placeholder, index) => Number(index) < parameters.length ? String(parameters[Number(index)] ?? "") : placeholder);
  }
  function localizeStatic(document = environment.document) {
    if (!document) return;
    document.documentElement.lang = current;
    document.querySelectorAll("[data-i18n]").forEach(element => { element.textContent = t(element.dataset.i18n); });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(element => { element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel)); });
  }
  function setLocale(value, { persist = true } = {}) {
    if (!valid(value)) return { changed: false, persisted: false };
    let persisted = false;
    if (persist) {
      try { environment.localStorage?.setItem(STORAGE_KEY, value); persisted = Boolean(environment.localStorage); } catch { /* The current session can still change language. */ }
    }
    const changed = current !== value;
    current = value;
    localizeStatic();
    if (changed) for (const listener of listeners) listener(current);
    return { changed, persisted };
  }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  return Object.freeze({ t, locale: () => current, setLocale, subscribe, localizeStatic, systemLocale, supported, STORAGE_KEY });
});
