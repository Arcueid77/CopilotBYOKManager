// Acorn is development-only: parse real JavaScript, not regex approximations
// that confuse HTML templates, regular expressions and nested substitutions.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { parse } = require("acorn");
const root = path.resolve(__dirname, "../apps/desktop/web");
const messages = require(path.join(root, "i18n-messages.js"));
const placeholders = value => [...value.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
const used = new Set();
for (const [key, values] of Object.entries(messages)) {
  assert.equal(values.length, 2, `Both languages required: ${key}`);
  for (const value of values) {
    assert.ok(typeof value === "string" && value.trim(), `Empty translation: ${key}`);
    assert.deepEqual(placeholders(value), placeholders(key), `Placeholder mismatch: ${key}`);
    assert.doesNotMatch(value, /<\/?[a-z][^>]*>/i, `Keep markup out of translations: ${key}`);
  }
  assert.doesNotMatch(values[1], /[\u3400-\u9fff]/, `Untranslated English: ${key}`);
}
function checkKey(key) { assert.ok(Object.hasOwn(messages, key), `Missing bilingual message: ${key}`); used.add(key); }
for (const file of fs.readdirSync(root).filter(name => name.endsWith(".js") && name !== "i18n-messages.js")) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert.ok(!source.includes("\0"), `Literal NUL in ${file}`);
  assert.doesNotMatch(source, /Intl\.DateTimeFormat\((?:undefined|["'])|\.toLocaleString\((?:["']|\))/, `Dates must follow the active UI locale in ${file}`);
  const ast = parse(source, { ecmaVersion: "latest", locations: true });
  function walk(node, parent) {
    if (!node || typeof node !== "object") return;
    const key = parent?.type === "CallExpression" && parent.callee.name === "tr" && parent.arguments[0] === node;
    if (key) {
      assert.equal(node.type, "Literal", `Dynamic translation key in ${file}:${node.loc.start.line}`);
      checkKey(node.value);
      const count = Math.max(-1, ...placeholders(node.value).map(value => Number(value.slice(1,-1)))) + 1;
      assert.equal(parent.arguments.length - 1, count, `Translation parameters in ${file}:${node.loc.start.line}`);
    }
    if (node.type === "Literal" && typeof node.value === "string" && /[\u3400-\u9fff]/.test(node.value)) {
      assert.ok(key, `Unlocalized literal in ${file}:${node.loc.start.line}`);
    }
    if (node.type === "TemplateElement") assert.doesNotMatch(node.value.cooked, /[\u3400-\u9fff]/, `Unlocalized template in ${file}:${node.loc.start.line}`);
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(value => value?.type && walk(value, node));
      else if (child?.type) walk(child, node);
    }
  }
  walk(ast);
}
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const match of html.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)) checkKey(match[1]);
assert.ok(html.indexOf('src="i18n-messages.js"') < html.indexOf('src="i18n.js"'));
assert.ok(html.indexOf('src="i18n.js"') < html.indexOf('src="app.js"'));
console.log(`i18n: ${Object.keys(messages).length} bilingual messages; ${used.size} explicit UI keys checked`);
