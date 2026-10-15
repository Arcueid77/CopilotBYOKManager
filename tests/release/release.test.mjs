import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkReleaseVersion, ROOT } from '../../scripts/check-release-version.mjs';
import { APPLE_SECRET_NAMES, assetNames, releaseRequest, requireAppleCredentials } from '../../scripts/release-policy.mjs';
import { assembleRelease, fileDigest, peArchitecture, verifyReleaseDirectory } from '../../scripts/release-artifacts.mjs';
import { publishRelease } from '../../scripts/publish-release.mjs';
import Ajv from 'ajv';

const sha = 'a'.repeat(40), version = '0.1.0';
function temporary(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'copilot-byok-manager-release-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function fixture(t, mode = 'draft', platform = 'all') {
  const root = temporary(t), input = path.join(root, 'input'), output = path.join(root, 'output');
  for (const target of platform === 'all' ? ['windows', 'macos'] : [platform]) {
    const directory = path.join(input, target); mkdirSync(directory, { recursive: true });
    const file = path.join(directory, assetNames(version, mode === 'dry-run')[target]);
    writeFileSync(file, `SYNTHETIC ${target} test bytes, NOT an executable or disk image`);
    writeFileSync(path.join(directory, 'platform.json'), JSON.stringify({ schema: 1, version, commit: sha, sourceDirty: false, mode,
      platform: target, architecture: target === 'windows' ? 'x64' : 'x86_64+arm64',
      signature: target === 'windows' ? 'unsigned' : mode === 'dry-run' ? 'ad-hoc' : 'developer-id',
      notarization: target === 'windows' ? 'not-applicable' : mode === 'dry-run' ? 'not-notarized' : 'stapled',
      product: 'CopilotBYOKManager', identifier: 'io.github.avalonero.copilotbyokmanager', executable: 'copilot-byok-manager', files: [fileDigest(file)] }));
  }
  const config = { input, output, version, sha, mode, platform, notesTemplate: path.join(ROOT, 'docs/release-notes-template.md') };
  return { root, ...config };
}
function editPlatform(config, target, edit) {
  const file = path.join(config.input, target, 'platform.json');
  const value = JSON.parse(readFileSync(file, 'utf8')); edit(value); writeFileSync(file, JSON.stringify(value));
}

test('all shipped version sources agree with the exact release tag', () => {
  const shipped = checkReleaseVersion(ROOT).version;
  assert.equal(checkReleaseVersion(ROOT, `v${shipped}`).version, shipped);
  const other = shipped === '9.9.9' ? '9.9.8' : '9.9.9';
  for (const tag of [`v${other}`, shipped, 'v01.1.0', `v${shipped}-rc.1`, `v${shipped}\n`, 'main']) {
    assert.throws(() => checkReleaseVersion(ROOT, tag));
  }
});

test('file-version drift and missing locks are hard failures', t => {
  const root = temporary(t);
  const shipped = checkReleaseVersion(ROOT).version;
  const other = shipped === '9.9.9' ? '9.9.8' : '9.9.9';
  const paths = ['package.json', 'package-lock.json', 'Cargo.lock', 'apps/desktop/src-tauri/Cargo.toml', 'apps/desktop/src-tauri/tauri.conf.json', 'apps/desktop/web/core-ui.js', 'apps/desktop/web/i18n-messages.js'];
  for (const name of paths) { mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); copyFileSync(path.join(ROOT, name), path.join(root, name)); }
  for (const name of paths) {
    const file = path.join(root, name), original = readFileSync(file, 'utf8');
    writeFileSync(file, original.replaceAll(shipped, other));
    assert.throws(() => checkReleaseVersion(root, `v${shipped}`), name);
    writeFileSync(file, original);
  }
  rmSync(path.join(root, 'Cargo.lock'));
  assert.throws(() => checkReleaseVersion(root));
});

test('tag push defaults to Draft; dispatch dry-run can select a platform', () => {
  assert.deepEqual(releaseRequest({ event: 'push', ref: 'refs/tags/v0.1.0' }), { mode: 'draft', platform: 'all', ref: 'v0.1.0', tag: 'v0.1.0' });
  assert.equal(releaseRequest({ event: 'workflow_dispatch', ref: 'refs/heads/main', platform: 'windows' }).mode, 'dry-run');
});

test('release policy rejects PRs, forks, branch publication, partial formal sets and malicious refs', () => {
  const base = { event: 'workflow_dispatch', ref: 'refs/heads/main' };
  for (const override of [
    { event: 'pull_request' }, { event: 'pull_request_target' }, { repository: 'fork/repo' },
    { ref: 'refs/heads/unreviewed' }, { mode: 'publish', requestedRef: 'main' },
    { mode: 'draft', requestedRef: 'v0.1.0', platform: 'windows' },
    { requestedRef: '--upload-pack=evil' }, { requestedRef: 'main\n$(echo injection)' },
    { requestedRef: 'refs/pull/1/head' }, { requestedRef: 'v0.1.0:main' },
    { requestedRef: 'v0.1.0\n' }, { requestedRef: 'a'.repeat(40) + '\n' },
    { mode: 'other' }, { platform: 'linux' },
  ]) assert.throws(() => releaseRequest({ ...base, ...override }));
});

test('formal Apple signing requires every secret and a Developer ID Application identity', () => {
  const env = Object.fromEntries(APPLE_SECRET_NAMES.map(name => [name, 'synthetic-test-value']));
  env.APPLE_SIGNING_IDENTITY = 'Developer ID Application: Synthetic Test';
  requireAppleCredentials(env);
  for (const key of APPLE_SECRET_NAMES) assert.throws(() => requireAppleCredentials({ ...env, [key]: '' }));
  assert.throws(() => requireAppleCredentials({ ...env, APPLE_SIGNING_IDENTITY: '-' }));
});

test('bundle uses standard NSIS/DMG, stable identity, current-user installation and no updater', () => {
  const config = JSON.parse(readFileSync(path.join(ROOT, 'apps/desktop/src-tauri/tauri.conf.json'), 'utf8'));
  const mac = JSON.parse(readFileSync(path.join(ROOT, 'apps/desktop/src-tauri/tauri.macos.conf.json'), 'utf8'));
  const schema = JSON.parse(readFileSync(path.join(ROOT, 'node_modules/@tauri-apps/cli/config.schema.json'), 'utf8'));
  // The locked draft-07 Tauri schema contains escaped punctuation accepted by
  // its Rust validator but invalid under JS's optional Unicode regex flag.
  // Keep every schema constraint; compile its patterns without that flag.
  const ajv = new Ajv({ strict: false, allErrors: true, unicodeRegExp: false });
  ajv.addFormat('uri', value => { try { return new URL(value).protocol.length > 1; } catch { return false; } });
  ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  ajv.addFormat('double', { type: 'number', validate: Number.isFinite });
  for (const [name, minimum, maximum] of [
    ['uint8', 0, 255], ['uint32', 0, 4294967295], ['int32', -2147483648, 2147483647],
    ['int64', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  ]) ajv.addFormat(name, { type: 'number', validate: value => Number.isSafeInteger(value) && value >= minimum && value <= maximum });
  const validate = ajv.compile(schema);
  assert.ok(validate(config), JSON.stringify(validate.errors));
  assert.ok(validate({ ...config, bundle: { ...config.bundle, ...mac.bundle } }), JSON.stringify(validate.errors));
  assert.equal(config.bundle.active, true);
  assert.deepEqual(config.bundle.targets, ['nsis']); assert.deepEqual(mac.bundle.targets, ['dmg']);
  assert.equal(config.bundle.createUpdaterArtifacts, false);
  assert.equal(config.bundle.windows.nsis.installMode, 'currentUser');
  assert.equal(config.bundle.windows.nsis.template, undefined);
  assert.equal(config.bundle.windows.nsis.installerHooks, undefined);
  assert.equal(config.bundle.macOS.hardenedRuntime, true);
  assert.equal(config.bundle.macOS.minimumSystemVersion, '15.0');
  assert.equal(config.bundle.macOS.infoPlist, undefined);
  for (const icon of config.bundle.icon) assert.ok(readFileSync(path.join(ROOT, 'apps/desktop/src-tauri', icon)).length > 0);
});

test('PE inspection distinguishes the x64 payload from a normal x86 NSIS bootstrapper', t => {
  const file = path.join(temporary(t), 'synthetic.exe');
  const bytes = Buffer.alloc(512); bytes.writeUInt16LE(0x5a4d); bytes.writeUInt32LE(0x80, 0x3c); bytes.writeUInt32LE(0x4550, 0x80);
  bytes.writeUInt16LE(0x8664, 0x84); writeFileSync(file, bytes); assert.equal(peArchitecture(file), 'x64');
  bytes.writeUInt16LE(0x14c, 0x84); writeFileSync(file, bytes); assert.equal(peArchitecture(file), 'x86');
  bytes.writeUInt16LE(0xaa64, 0x84); writeFileSync(file, bytes); assert.throws(() => peArchitecture(file));
});

test('formal assembly produces complete checksums and bound source metadata', t => {
  const config = fixture(t); assembleRelease(config);
  assert.equal(verifyReleaseDirectory(config.output, config).length, 5);
  assert.match(readFileSync(path.join(config.output, 'RELEASE-NOTES.md'), 'utf8'), /Developer ID signed and notarized/);
});

test('single-platform dry-run is explicitly testing-only and cannot be promoted', t => {
  const config = fixture(t, 'dry-run', 'macos'); assembleRelease(config);
  assert.ok(readdirSync(config.output).some(name => name.endsWith('-testing-adhoc.dmg')));
  assert.throws(() => verifyReleaseDirectory(config.output, { ...config, mode: 'publish', platform: 'all' }));
});

test('missing, empty, mismatched, adhoc, dirty and traversal artifacts fail assembly', t => {
  for (const change of [
    c => rmSync(path.join(c.input, 'windows', assetNames(version).windows)),
    c => writeFileSync(path.join(c.input, 'windows', assetNames(version).windows), ''),
    c => editPlatform(c, 'macos', m => { m.version = '0.1.1'; }),
    c => editPlatform(c, 'macos', m => { m.commit = 'b'.repeat(40); }),
    c => editPlatform(c, 'macos', m => { m.signature = 'ad-hoc'; }),
    c => editPlatform(c, 'macos', m => { m.notarization = 'not-notarized'; }),
    c => editPlatform(c, 'windows', m => { m.sourceDirty = true; }),
    c => editPlatform(c, 'windows', m => { m.files[0].name = '../../outside.exe'; }),
  ]) { const config = fixture(t); change(config); assert.throws(() => assembleRelease(config)); }
});

test('verification detects checksum tampering, added attachments and removed mandatory packages', t => {
  for (const change of [
    c => writeFileSync(path.join(c.output, 'SHA256SUMS.txt'), 'forged sums'),
    c => writeFileSync(path.join(c.output, 'unknown.zip'), 'unexpected'),
    c => rmSync(path.join(c.output, assetNames(version).macos)),
    c => writeFileSync(path.join(c.output, assetNames(version).windows), 'tampered'),
  ]) { const config = fixture(t); assembleRelease(config); change(config); assert.throws(() => verifyReleaseDirectory(config.output, config)); }
});

test('publication refuses dry-run or incomplete assets before any GitHub call', t => {
  const config = fixture(t, 'draft'); assembleRelease(config);
  const options = { directory: config.output, version, sha, tag: 'v0.1.0', mode: 'publish', cli: () => { throw Error('Network must never be reached'); } };
  assert.throws(() => publishRelease({ ...options, mode: 'dry-run' }), /dry-run/);
  rmSync(path.join(config.output, assetNames(version).macos));
  assert.throws(() => publishRelease(options), error => !error.message.includes('Network must'));
});

test('publication refuses moved tags and already-public Releases', t => {
  const config = fixture(t, 'draft'); assembleRelease(config);
  const options = { directory: config.output, version, sha, tag: 'v0.1.0', mode: 'publish' };
  assert.throws(() => publishRelease({ ...options, cli: () => JSON.stringify({ object: { type: 'commit', sha: 'b'.repeat(40) } }) }), /Tag moved/);
  assert.throws(() => publishRelease({ ...options, cli: args => args[1].includes('/git/') ? JSON.stringify({ object: { type: 'commit', sha } }) : JSON.stringify({ draft: false }) }), /already public/);
});

test('publishing waits for downloaded asset verification before making a Draft public', t => {
  const config = fixture(t, 'draft'); assembleRelease(config);
  const downloads = path.join(config.root, 'downloads'); mkdirSync(downloads);
  const calls = [], filenames = readdirSync(config.output).sort(); let draft = true, downloadCount = 0;
  const cli = args => {
    calls.push(args);
    if (args[0] === 'api') {
      if (args[1].includes('/git/')) return JSON.stringify({ object: { type: 'commit', sha } });
      return JSON.stringify({ draft, body: readFileSync(path.join(config.output, 'RELEASE-NOTES.md'), 'utf8'), assets: filenames.map((name, index) => ({ id: index + 1, name, size: fileDigest(path.join(config.output, name)).size, download_count: downloadCount })) });
    }
    if (args[1] === 'download') {
      for (const name of filenames) copyFileSync(path.join(config.output, name), path.join(downloads, name));
      downloadCount++;
    }
    if (args.includes('--draft=false')) draft = false;
    return '';
  };
  publishRelease({ directory: config.output, version, sha, tag: 'v0.1.0', mode: 'publish', cli, downloadDirectory: downloads });
  assert.equal(draft, false);
  assert.ok(calls.findIndex(c => c[1] === 'download') < calls.findIndex(c => c.includes('--draft=false')));
  assert.equal(calls.filter(c => c[1] === 'upload' || c[1] === 'create').length, 0, 'Promotion must not replace accepted packages');
  assert.deepEqual(calls.filter(c => c[1] === 'edit').map(c => c.slice(3)), [['--repo', 'AvaloNero/CopilotBYOKManager', '--draft=false', '--prerelease', '--latest=false']]);
});

test('publish rejects rebuilt publish-mode artifacts instead of replacing the accepted Draft', t => {
  const config = fixture(t, 'publish'); assembleRelease(config);
  let calls = 0;
  assert.throws(() => publishRelease({ directory: config.output, version, sha, tag: 'v0.1.0', mode: 'publish', cli: () => { calls++; } }));
  assert.equal(calls, 0);
});

test('tampered downloads or concurrently replaced Draft assets never reach public promotion', t => {
  for (const corruption of ['bytes', 'identity']) {
    const config = fixture(t, 'draft'); assembleRelease(config);
    const downloads = path.join(config.root, 'downloads'); mkdirSync(downloads);
    const filenames = readdirSync(config.output).sort(); let downloaded = false, promoted = false;
    const cli = args => {
      if (args[0] === 'api') {
        if (args[1].includes('/git/')) return JSON.stringify({ object: { type: 'commit', sha } });
        return JSON.stringify({ draft: true, body: readFileSync(path.join(config.output, 'RELEASE-NOTES.md'), 'utf8'),
          assets: filenames.map((name, index) => ({ id: index + (downloaded && corruption === 'identity' ? 100 : 1), name, size: fileDigest(path.join(config.output, name)).size })) });
      }
      if (args[1] === 'download') {
        for (const name of filenames) copyFileSync(path.join(config.output, name), path.join(downloads, name));
        if (corruption === 'bytes') writeFileSync(path.join(downloads, assetNames(version).windows), 'tampered remote bytes');
        downloaded = true;
      }
      if (args.includes('--draft=false')) promoted = true;
      return '';
    };
    assert.throws(() => publishRelease({ directory: config.output, version, sha, tag: 'v0.1.0', mode: 'publish', cli, downloadDirectory: downloads }));
    assert.equal(promoted, false);
  }
});
