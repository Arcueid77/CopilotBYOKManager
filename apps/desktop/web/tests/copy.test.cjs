const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const messages = require('../i18n-messages.js');
const i18n = require('../i18n.js');
const discovery = require('../model-discovery.js');

const boilerplate = /不(?:代表|证明|等于|意味着)|\b(?:does|(?:tests|results|checks|builds|screenshots) do) not (?:prove|imply|mean|constitute)\b|\b(?:is|are) not (?:proof|evidence)\b/i;

test('bilingual catalog results are concise and retain distinct failure states', () => {
  for (const [locale, success] of [['zh-CN', '模型目录可访问。'], ['en', 'Model catalog available.']]) {
    i18n.setLocale(locale, { persist: false });
    assert.equal(discovery.statusText('available'), success);
    const statuses = ['available', 'empty', 'partial', 'unauthorized', 'networkError', 'schemaError', 'credentialUnavailable'];
    assert.equal(new Set(statuses.map(discovery.statusText)).size, statuses.length);
    assert.notEqual(discovery.statusText('unknown'), success);
  }
});

test('the bilingual message catalog keeps result copy free of repetitive disclaimers', () => {
  for (const [key, translations] of Object.entries(messages)) {
    for (const text of translations) assert.doesNotMatch(text, boilerplate, key);
  }
});

test('repository documentation follows the same concise-copy convention', () => {
  const repo = path.resolve(__dirname, '../../../..');
  function markdownFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith('.md') ? [file] : [];
    });
  }
  const files = ['README.md', 'README.zh-CN.md', 'AGENTS.md', 'SECURITY.md', 'apps/desktop/src-tauri/icons/README.md']
    .map(file => path.join(repo, file)).concat(markdownFiles(path.join(repo, 'docs')), markdownFiles(path.join(repo, 'prototype')));
  for (const file of files) assert.equal(boilerplate.test(fs.readFileSync(file, 'utf8')), false, path.relative(repo, file));
});
