(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerLoader = api;
})(globalThis, function () {
  "use strict";
  function create({ invoke, data, onSettled = () => {} }) {
    const versions = new Map();
    function invalidate(key) { versions.set(key, (versions.get(key) ?? 0) + 1); }
    async function load(sections) {
      await Promise.all(sections.map(async ([key, command, args]) => {
        invalidate(key);
        const version = versions.get(key);
        try {
          const value = await invoke(command, args);
          if (versions.get(key) !== version) return;
          data[key] = value; delete data.errors[key];
        } catch (error) {
          if (versions.get(key) !== version) return;
          data[key] = null; data.errors[key] = error?.message ?? String(error);
        }
        onSettled(key);
      }));
    }
    return { load, invalidate };
  }
  return { create };
});
