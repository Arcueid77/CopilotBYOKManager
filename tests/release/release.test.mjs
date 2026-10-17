import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkReleaseVersion, ROOT } from '../../scripts/check-release-version.mjs';
import { APPLE_SECRET_NAMES, assetNames, releaseRequest, requireAppleCredentials } from '../../scripts/release-policy.mjs';
import { assembleRelease, assertWindowsGuiApplication, fileDigest, peArchitecture, verifyReleaseDirectory } from '../../scripts/release-artifacts.mjs';
import { findRelease, publishRelease } from '../../scripts/publish-release.mjs';
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
  assert.deepEqual(releaseRequest({ event: 'push', ref: 'refs/tags/v0.1.0' }), { mode: 'draft', platform: 'all', macosSigning: 'ad-hoc', ref: 'v0.1.0', tag: 'v0.1.0' });
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
    { mode: 'other' }, { platform: 'linux' }, { macosSigning: 'unknown' },
    { mode: 'dry-run', macosSigning: 'developer-id' },
  ]) assert.throws(() => releaseRequest({ ...base, ...override }));
});

test('formal Apple signing requires every secret and a Developer ID Application identity', () => {
  const env = Object.fromEntries(APPLE_SECRET_NAMES.map(name => [name, 'synthetic-test-value']));
  env.APPLE_SIGNING_IDENTITY = 'Developer ID Application: Synthetic Test';
  requireAppleCredentials(env);
  for (const key of APPLE_SECRET_NAMES) assert.throws(() => requireAppleCredentials({ ...env, [key]: '' }));
  assert.throws(() => requireAppleCredentials({ ...env, APPLE_SIGNING_IDENTITY: '-' }));
});

test('default Mac packaging needs no secrets; Developer ID builds are explicitly selected', () => {
  const workflow = readFileSync(path.join(ROOT, '.github/workflows/release.yml'), 'utf8');
  const job = name => {
    const match = workflow.match(new RegExp(`^  ${name}:\\r?\\n([\\s\\S]*?)(?=^  [a-z][a-z-]+:|(?![\\s\\S]))`, 'm'));
    assert.ok(match, `Missing job: ${name}`);
    return match[1];
  };
  const testing = job('build-macos-adhoc'), formal = job('build-macos');
  assert.match(testing, /needs\.validate\.outputs\.macosSigning == 'ad-hoc'/);
  assert.match(testing, /RELEASE_MACOS_SIGNING: ad-hoc/);
  assert.match(testing, /name: macos-adhoc-/);
  assert.doesNotMatch(testing, /^\s+environment:|secrets\.|contents: write/m);
  assert.match(formal, /needs\.validate\.outputs\.macosSigning == 'developer-id'/);
  assert.match(formal, /RELEASE_MACOS_SIGNING: developer-id/);
  assert.match(formal, /environment: release/);
  for (const name of APPLE_SECRET_NAMES) assert.ok(formal.includes(`secrets.${name}`));
  const publication = job('publish-release');
  assert.doesNotMatch(publication, /^\s+environment:|secrets\./m);
  assert.match(publication, /needs\.validate\.outputs\.mode == 'publish' && needs\.assemble-release\.result == 'skipped'/);
  assert.match(publication, /needs\.test\.result == 'success'/);
  for (const build of ['build-windows', 'build-macos-adhoc', 'build-macos']) {
    assert.match(job(build), /needs\.validate\.outputs\.mode != 'publish'/);
  }
  const assembly = job('assemble-release');
  assert.match(assembly, /needs: \[validate, test, build-windows, build-macos-adhoc, build-macos\]/);
  assert.match(assembly, /needs\.build-macos-adhoc\.result == 'success' \|\| needs\.build-macos-adhoc\.result == 'skipped'/);
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

test('new icon source and platform exports retain high-resolution and small-size representations', () => {
  const directory = path.join(ROOT, 'apps/desktop/src-tauri/icons');
  const png = file => {
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
    assert.equal(bytes[25], 6, 'Icons must preserve RGBA transparency');
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    assert.equal(width, height);
    return width;
  };
  assert.ok(png(path.join(directory, 'icon-source.png')) >= 1024);
  assert.equal(png(path.join(directory, 'icon.png')), 512);
  assert.equal(png(path.join(ROOT, 'apps/desktop/web/assets/app-icon.png')), 256);
  const ico = readFileSync(path.join(directory, 'icon.ico'));
  assert.equal(ico.readUInt32LE(0), 0x10000);
  const sizes = [];
  for (let index = 0; index < ico.readUInt16LE(4); index++) {
    const offset = 6 + index * 16;
    sizes.push(ico[offset] || 256);
    assert.equal(ico[offset], ico[offset + 1]);
    assert.ok(ico.readUInt32LE(offset + 8) > 0);
    assert.ok(ico.readUInt32LE(offset + 12) + ico.readUInt32LE(offset + 8) <= ico.length);
  }
  for (const size of [16, 32, 256]) assert.ok(sizes.includes(size), `Missing ICO size ${size}`);
  const icns = readFileSync(path.join(directory, 'icon.icns')), types = [];
  assert.equal(icns.toString('ascii', 0, 4), 'icns');
  assert.equal(icns.readUInt32BE(4), icns.length);
  let offset = 8;
  while (offset < icns.length) {
    types.push(icns.toString('ascii', offset, offset + 4));
    const length = icns.readUInt32BE(offset + 4);
    assert.ok(length > 8 && offset + length <= icns.length);
    offset += length;
  }
  assert.equal(offset, icns.length);
  assert.ok(types.includes('ic10'), 'Mac icon must contain the 1024px representation');
});

test('Mac packaging retains the official app bundle before verifying both app and DMG payload', () => {
  const script = readFileSync(path.join(ROOT, 'scripts/package-macos.mjs'), 'utf8');
  // Regression: locked Tauri cleans the intermediate .app when only DMG is
  // requested. A DMG build can succeed while the subsequent plist check fails.
  assert.match(script, /'--bundles', 'app,dmg'/);
  assert.doesNotMatch(script, /'--bundles', 'dmg'/);
  assert.match(script, /assert\.ok\(existsSync\(plist\)/);
  assert.match(script, /verifyApp\(path\.join\(bundleRoot, 'macos', appName\)\)/);
  assert.match(script, /verifyApp\(path\.join\(mount, appName\)\)/);
  assert.match(script, /'codesign', \['--verify', '--deep', '--strict', app\]/);
});

test('PE inspection distinguishes the x64 payload from a normal x86 NSIS bootstrapper', t => {
  const file = path.join(temporary(t), 'synthetic.exe');
  const bytes = Buffer.alloc(512); bytes.writeUInt16LE(0x5a4d); bytes.writeUInt32LE(0x80, 0x3c); bytes.writeUInt32LE(0x4550, 0x80);
  bytes.writeUInt16LE(0x8664, 0x84); writeFileSync(file, bytes); assert.equal(peArchitecture(file), 'x64');
  bytes.writeUInt16LE(0x14c, 0x84); writeFileSync(file, bytes); assert.equal(peArchitecture(file), 'x86');
  bytes.writeUInt16LE(0xaa64, 0x84); writeFileSync(file, bytes); assert.throws(() => peArchitecture(file));
});

function windowsApplicationFixture() {
  const bytes = Buffer.alloc(512);
  bytes.writeUInt16LE(0x5a4d);
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.writeUInt32LE(0x4550, 0x80);
  bytes.writeUInt16LE(0x8664, 0x84);
  bytes.writeUInt16LE(0xf0, 0x94);
  bytes.writeUInt16LE(0x20b, 0x98);
  bytes.writeUInt16LE(2, 0xdc);
  return bytes;
}

test('Windows package gate accepts GUI payloads and rejects console or non-x64 applications', t => {
  const file = path.join(temporary(t), 'synthetic.exe');
  writeFileSync(file, windowsApplicationFixture());
  assert.doesNotThrow(() => assertWindowsGuiApplication(file));
  for (const subsystem of [0, 1, 3, 9]) {
    const bytes = windowsApplicationFixture();
    bytes.writeUInt16LE(subsystem, 0xdc);
    writeFileSync(file, bytes);
    assert.throws(() => assertWindowsGuiApplication(file), /Windows GUI subsystem/);
  }
  const x86 = windowsApplicationFixture();
  x86.writeUInt16LE(0x14c, 0x84);
  writeFileSync(file, x86);
  assert.throws(() => assertWindowsGuiApplication(file), /not x64/);
});

test('Windows GUI inspection fails closed on missing, malformed or truncated PE headers', t => {
  const file = path.join(temporary(t), 'synthetic.exe');
  for (const mutate of [
    bytes => bytes.subarray(0, 64),
    bytes => { bytes.writeUInt16LE(0, 0); return bytes; },
    bytes => { bytes.writeUInt32LE(0xfffffff0, 0x3c); return bytes; },
    bytes => { bytes.writeUInt32LE(0, 0x80); return bytes; },
    bytes => { bytes.writeUInt16LE(0, 0x94); return bytes; },
    bytes => { bytes.writeUInt16LE(69, 0x94); return bytes; },
    bytes => { bytes.writeUInt16LE(0xffff, 0x94); return bytes; },
    bytes => { bytes.writeUInt16LE(0x10b, 0x98); return bytes; },
    bytes => bytes.subarray(0, 300),
  ]) {
    writeFileSync(file, mutate(windowsApplicationFixture()));
    assert.throws(() => assertWindowsGuiApplication(file));
  }
});

test('Windows release entry point and both build paths enforce the GUI subsystem', () => {
  const main = readFileSync(path.join(ROOT, 'apps/desktop/src-tauri/src/main.rs'), 'utf8').replace(/\s+/g, '');
  assert.ok(main.includes('#![cfg_attr(all(target_os="windows",not(debug_assertions)),windows_subsystem="windows")]'));
  const packaging = readFileSync(path.join(ROOT, 'scripts/package-windows.ps1'), 'utf8');
  const ci = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  assert.match(packaging, /assertWindowsGuiApplication\(process\.env\.COPILOT_BYOK_MANAGER_PACKAGE_BINARY\)/);
  assert.ok(packaging.indexOf('assertWindowsGuiApplication(') < packaging.indexOf('Compress-Archive'));
  assert.match(ci, /assertWindowsGuiApplication\('target\/release\/copilot-byok-manager\.exe'\)/);
});

test('formal assembly produces complete checksums and bound source metadata', t => {
  const config = fixture(t); assembleRelease(config);
  assert.equal(verifyReleaseDirectory(config.output, config).length, 5);
  const notes = readFileSync(path.join(config.output, 'RELEASE-NOTES.md'), 'utf8');
  assert.match(notes, /Copilot Chat/);
  assert.doesNotMatch(notes, /signed|notarized|acceptance|签名|验收/i);
});

test('a release can contain an ad-hoc Mac package without promoting dry-run bytes', t => {
  const config = fixture(t);
  editPlatform(config, 'macos', m => { m.signature = 'ad-hoc'; m.notarization = 'not-notarized'; });
  assembleRelease(config);
  assert.ok(verifyReleaseDirectory(config.output, config).includes(assetNames(version).macos));
  const metadata = JSON.parse(readFileSync(path.join(config.output, 'release-metadata.json'), 'utf8'));
  assert.equal(metadata.builds.find(build => build.platform === 'macos').signature, 'ad-hoc');
  assert.throws(() => verifyReleaseDirectory(config.output, { ...config, mode: 'dry-run' }));
});

test('single-platform dry-run is explicitly testing-only and cannot be promoted', t => {
  const config = fixture(t, 'dry-run', 'macos'); assembleRelease(config);
  assert.ok(readdirSync(config.output).some(name => name.endsWith('-testing-adhoc.dmg')));
  assert.throws(() => verifyReleaseDirectory(config.output, { ...config, mode: 'publish', platform: 'all' }));
});

test('missing, empty, mismatched, inconsistent signature, dirty and traversal artifacts fail assembly', t => {
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
  assert.throws(() => publishRelease({ ...options, cli: args => args[1].includes('/git/') ? JSON.stringify({ object: { type: 'commit', sha } }) : JSON.stringify([{ id: 42, tag_name: 'v0.1.0', draft: false }]) }), /already public/);
});

test('Draft lookup uses the authenticated release list and follows bounded pages', () => {
  const calls = [];
  const draft = { id: 42, tag_name: 'v0.1.0', draft: true };
  assert.equal(findRelease('v0.1.0', args => {
    calls.push(args);
    assert.doesNotMatch(args[1], /releases\/tags\//);
    return JSON.stringify(calls.length === 1 ? Array.from({ length: 100 }, (_, index) => ({ id: index + 100, tag_name: `v9.0.${index}` })) : [draft]);
  }).id, 42);
  assert.equal(calls.length, 2);
  assert.match(calls[1][1], /page=2$/);
  assert.equal(findRelease('v0.1.0', () => '[]'), null);
  assert.throws(() => findRelease('v0.1.0', () => JSON.stringify([draft, draft])), /Ambiguous/);
  assert.throws(() => findRelease('v0.1.0', () => JSON.stringify([{ ...draft, id: '../other' }])), /identity/);
  assert.throws(() => findRelease('v0.1.0', () => JSON.stringify(Array.from({ length: 100 }, () => ({ tag_name: 'v9.0.0' })))), /limit/);
});

test('publishing waits for downloaded asset verification before making a Draft public', t => {
  const config = fixture(t, 'draft'); assembleRelease(config);
  const downloads = path.join(config.root, 'downloads'); mkdirSync(downloads);
  const calls = [], filenames = readdirSync(config.output).sort(); let draft = true, downloadCount = 0;
  const cli = args => {
    calls.push(args);
    if (args.includes('draft=false')) { draft = false; return '{}'; }
    if (args[0] === 'api') {
      if (args[1].includes('/git/')) return JSON.stringify({ object: { type: 'commit', sha } });
      const release = { id: 42, tag_name: 'v0.1.0', draft, body: readFileSync(path.join(config.output, 'RELEASE-NOTES.md'), 'utf8'), assets: filenames.map((name, index) => ({ id: index + 1, name, size: fileDigest(path.join(config.output, name)).size, download_count: downloadCount })) };
      assert.doesNotMatch(args[1], /releases\/tags\//);
      return JSON.stringify(args[1].includes('releases?') ? [release] : release);
    }
    if (args[1] === 'download') {
      for (const name of filenames) copyFileSync(path.join(config.output, name), path.join(downloads, name));
      downloadCount++;
    }
    return '';
  };
  publishRelease({ directory: config.output, version, sha, tag: 'v0.1.0', mode: 'publish', cli, downloadDirectory: downloads });
  assert.equal(draft, false);
  assert.ok(calls.findIndex(c => c[1] === 'download') < calls.findIndex(c => c.includes('draft=false')));
  assert.equal(calls.filter(c => c[1] === 'upload' || c[1] === 'create').length, 0, 'Promotion must not replace accepted packages');
  assert.deepEqual(calls.filter(c => c.includes('PATCH')), [['api', '--method', 'PATCH', 'repos/Arcueid77/CopilotBYOKManager/releases/42', '-F', 'draft=false', '-F', 'prerelease=true', '-f', 'make_latest=false']]);
});

test('publish rejects rebuilt publish-mode artifacts instead of replacing the accepted Draft', t => {
  const config = fixture(t, 'publish'); assembleRelease(config);
  let calls = 0;
  assert.throws(() => publishRelease({ directory: config.output, version, sha, tag: 'v0.1.0', mode: 'publish', cli: () => { calls++; } }));
  assert.equal(calls, 0);
});

test('tampered downloads or concurrently replaced Draft assets never reach public promotion', t => {
  for (const corruption of ['bytes', 'identity', 'release-id', 'release-tag']) {
    const config = fixture(t, 'draft'); assembleRelease(config);
    const downloads = path.join(config.root, 'downloads'); mkdirSync(downloads);
    const filenames = readdirSync(config.output).sort(); let downloaded = false, promoted = false;
    const cli = args => {
      if (args.includes('draft=false')) { promoted = true; return '{}'; }
      if (args[0] === 'api') {
        if (args[1].includes('/git/')) return JSON.stringify({ object: { type: 'commit', sha } });
        const release = { id: downloaded && corruption === 'release-id' ? 43 : 42,
          tag_name: downloaded && corruption === 'release-tag' ? 'v0.1.1' : 'v0.1.0', draft: true, body: readFileSync(path.join(config.output, 'RELEASE-NOTES.md'), 'utf8'),
          assets: filenames.map((name, index) => ({ id: index + (downloaded && corruption === 'identity' ? 100 : 1), name, size: fileDigest(path.join(config.output, name)).size })) };
        return JSON.stringify(args[1].includes('releases?') ? [release] : release);
      }
      if (args[1] === 'download') {
        for (const name of filenames) copyFileSync(path.join(config.output, name), path.join(downloads, name));
        if (corruption === 'bytes') writeFileSync(path.join(downloads, assetNames(version).windows), 'tampered remote bytes');
        downloaded = true;
      }
      return '';
    };
    assert.throws(() => publishRelease({ directory: config.output, version, sha, tag: 'v0.1.0', mode: 'publish', cli, downloadDirectory: downloads }));
    assert.equal(promoted, false);
  }
});
