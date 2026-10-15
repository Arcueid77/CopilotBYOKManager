import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './check-release-version.mjs';

// Local documentation links only. Never request external URLs or read secrets.
function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const file = path.join(directory, item.name);
    return item.isDirectory() ? markdownFiles(file) : item.isFile() && item.name.endsWith('.md') ? [file] : [];
  });
}
function prose(file) {
  return readFileSync(file, 'utf8').replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
}
function anchors(file) {
  const text = prose(file), ids = new Set([...text.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)].map(m => m[1]));
  const counts = new Map();
  for (const match of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = match[1].replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-');
    const count = counts.get(base) || 0; counts.set(base, count + 1);
    ids.add(count ? `${base}-${count}` : base);
  }
  return ids;
}
try {
  const files = [
    ...readdirSync(ROOT).filter(name => name.endsWith('.md')).map(name => path.join(ROOT, name)),
    ...markdownFiles(path.join(ROOT, 'docs')),
    path.join(ROOT, 'apps/desktop/src-tauri/icons/README.md'),
  ];
  const failures = [], cache = new Map(); let checked = 0;
  for (const file of files) {
    const text = prose(file);
    const links = [...text.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)].map(m => m[1].replace(/^<|>$/g, '').split(/\s+["']/)[0]);
    links.push(...[...text.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map(m => m[1]));
    for (const link of links) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(link)) continue;
      checked++;
      try {
        const [rawTarget, rawFragment] = link.split('#');
        const target = rawTarget ? path.resolve(path.dirname(file), decodeURIComponent(rawTarget.split('?')[0])) : file;
        assert.ok(target === ROOT || target.startsWith(ROOT + path.sep), 'Link escapes repository');
        assert.ok(existsSync(target), 'Missing target');
        if (rawFragment && target.endsWith('.md') && statSync(target).isFile()) {
          if (!cache.has(target)) cache.set(target, anchors(target));
          assert.ok(cache.get(target).has(decodeURIComponent(rawFragment)), 'Missing Markdown anchor');
        }
      } catch (error) { failures.push(`${path.relative(ROOT, file)}: ${link} (${error.message})`); }
    }
  }
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log(`Documentation: ${files.length} Markdown files; ${checked} local links/anchors passed.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
