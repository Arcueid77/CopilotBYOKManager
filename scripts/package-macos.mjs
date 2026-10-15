import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, checkReleaseVersion } from './check-release-version.mjs';
import { assetNames, requireAppleCredentials } from './release-policy.mjs';
import { fileDigest } from './release-artifacts.mjs';

// This wraps the official Tauri universal/DMG bundler, not a custom app/DMG layout.
// Secret-bearing subprocess arguments and output are never included in errors.
function run(command, args, label, options = {}) {
  try { return execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options })?.trim() || ''; }
  catch { throw new Error(`${label} failed; no signing credentials or command arguments logged`); }
}
function decodeSecret(value, file) {
  const text = value.replace(/\s/g, '');
  assert.ok(text.length > 0 && text.length <= 1024 * 1024 && /^[A-Za-z0-9+/]+={0,2}$/.test(text), 'Invalid or oversized signing secret');
  writeFileSync(file, Buffer.from(text, 'base64'), { mode: 0o600, flag: 'wx' });
}

try {
  assert.equal(process.platform, 'darwin', 'macOS package verification requires a Mac');
  process.chdir(ROOT);
  const mode = process.env.RELEASE_MODE || 'dry-run';
  assert.ok(['dry-run', 'draft', 'publish'].includes(mode));
  const formal = mode !== 'dry-run';
  if (formal) {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Formal signing is restricted to the release environment job');
    requireAppleCredentials(process.env);
  }
  const { version } = checkReleaseVersion(ROOT, process.env.RELEASE_TAG);
  const commit = run('git', ['rev-parse', 'HEAD'], 'Source identification');
  const sourceDirty = Boolean(run('git', ['status', '--porcelain', '--untracked-files=normal'], 'Source cleanliness check'));
  if (process.env.GITHUB_ACTIONS === 'true') assert.equal(sourceDirty, false, 'CI package source must be clean');
  if (process.env.RELEASE_SHA) assert.equal(commit, process.env.RELEASE_SHA);
  const output = path.resolve(process.env.RELEASE_PLATFORM_OUTPUT || 'target/platform-assets/macos');
  assert.ok(!existsSync(output) || readdirSync(output).length === 0, 'Choose an empty output directory');
  const taskTemp = mkdtempSync(path.join(os.tmpdir(), 'copilot-byok-manager-sign-'));
  const keychain = path.join(taskTemp, 'release.keychain-db');
  const certificate = path.join(taskTemp, 'certificate.p12');
  const privateKey = path.join(taskTemp, 'notary.p8');
  let keychainCreated = false, originalKeychains, mounted = false;
  const mount = path.join(taskTemp, 'mounted-dmg');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('APPLE_') && !key.startsWith('TAURI_SIGNING_')));
  env.APPLE_SIGNING_IDENTITY = formal ? process.env.APPLE_SIGNING_IDENTITY : '-';
  try {
    if (formal) {
      const password = randomBytes(32).toString('hex');
      decodeSecret(process.env.APPLE_CERTIFICATE_BASE64, certificate);
      decodeSecret(process.env.APPLE_API_PRIVATE_KEY_BASE64, privateKey);
      originalKeychains = [...run('security', ['list-keychains', '-d', 'user'], 'Read keychain search list').matchAll(/"([^"]+)"/g)].map(match => match[1]);
      assert.ok(originalKeychains.length > 0, 'Could not preserve original keychain search list');
      run('security', ['create-keychain', '-p', password, keychain], 'Create temporary keychain');
      keychainCreated = true;
      run('security', ['set-keychain-settings', '-lut', '21600', keychain], 'Configure temporary keychain');
      run('security', ['unlock-keychain', '-p', password, keychain], 'Unlock temporary keychain');
      run('security', ['import', certificate, '-k', keychain, '-P', process.env.APPLE_CERTIFICATE_PASSWORD, '-T', '/usr/bin/codesign'], 'Import Developer ID certificate');
      run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', password, keychain], 'Allow codesign access');
      run('security', ['list-keychains', '-d', 'user', '-s', keychain, ...originalKeychains], 'Use temporary keychain');
      const identities = run('security', ['find-identity', '-v', '-p', 'codesigning', keychain], 'Verify imported identity');
      assert.ok(identities.includes(`"${process.env.APPLE_SIGNING_IDENTITY}"`), 'Expected Developer ID identity was not imported');
      env.APPLE_API_KEY = process.env.APPLE_API_KEY_ID;
      env.APPLE_API_ISSUER = process.env.APPLE_API_ISSUER_ID;
      env.APPLE_API_KEY_PATH = privateKey;
    }
    // Tauri 2.11.4 removes the intermediate .app for a DMG-only build. Request
    // both official bundles so verification below can inspect the signed .app
    // before checking its copy in the final DMG. Only the DMG is distributed.
    run(process.execPath, ['node_modules/@tauri-apps/cli/tauri.js', 'build', '--config', 'apps/desktop/src-tauri/tauri.conf.json', '--ci', '--target', 'universal-apple-darwin', '--bundles', 'app,dmg', '--', '--locked'], 'Tauri universal DMG build', { env, stdio: 'inherit' });
    const bundleRoot = path.join(ROOT, 'target/universal-apple-darwin/release/bundle');
    const appName = 'CopilotBYOKManager.app';
    const verifyApp = app => {
      const plist = path.join(app, 'Contents/Info.plist');
      assert.ok(existsSync(plist), 'Expected app bundle is missing; retain both app and dmg outputs for verification');
      const value = key => run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist], 'Bundle identity verification');
      assert.equal(value('CFBundleIdentifier'), 'io.github.avalonero.copilotbyokmanager');
      assert.equal(value('CFBundleShortVersionString'), version);
      assert.equal(value('CFBundleExecutable'), 'copilot-byok-manager');
      assert.equal(value('LSMinimumSystemVersion'), '15.0');
      const architectures = run('lipo', ['-archs', path.join(app, 'Contents/MacOS/copilot-byok-manager')], 'Universal architecture verification').split(/\s+/).sort();
      assert.deepEqual(architectures, ['arm64', 'x86_64']);
      run('codesign', ['--verify', '--deep', '--strict', app], 'App code signature verification');
      // codesign -d writes its report to stderr. Capture both without echoing identity.
      let report;
      try {
        const { spawnSync } = process.getBuiltinModule('node:child_process');
        const result = spawnSync('codesign', ['-d', '--verbose=4', app], { encoding: 'utf8' });
        assert.equal(result.status, 0); report = result.stderr + result.stdout;
      } catch { throw new Error('Read app signing report failed'); }
      assert.ok(report.includes('runtime'), 'Hardened Runtime is not enabled');
      if (formal) {
        assert.ok(report.includes('Authority=Developer ID Application:') && !report.includes('Signature=adhoc'), 'App is not Developer ID signed');
        run('spctl', ['--assess', '--type', 'execute', '--verbose=2', app], 'Gatekeeper app assessment');
        run('xcrun', ['stapler', 'validate', app], 'App notarization ticket verification');
      } else assert.ok(report.includes('Signature=adhoc'), 'Dry-run must use ad-hoc signing');
    };
    verifyApp(path.join(bundleRoot, 'macos', appName));
    console.log('Verified retained app: identity, version, both architectures and code signature.');
    const dmgs = readdirSync(path.join(bundleRoot, 'dmg')).filter(name => name.endsWith('.dmg'));
    assert.equal(dmgs.length, 1, 'Expected exactly one fresh DMG');
    const dmg = path.join(bundleRoot, 'dmg', dmgs[0]);
    fileDigest(dmg);
    if (formal) {
      // Tauri notarizes/staples the .app. Notarize the final container too, then
      // staple the DMG ticket; there is no handwritten DMG or Info.plist layout.
      const response = JSON.parse(run('xcrun', ['notarytool', 'submit', dmg, '--key', privateKey, '--key-id', env.APPLE_API_KEY, '--issuer', env.APPLE_API_ISSUER, '--wait', '--timeout', '30m', '--output-format', 'json'], 'DMG notarization'));
      assert.equal(response.status, 'Accepted', 'Apple did not accept the DMG');
      run('xcrun', ['stapler', 'staple', dmg], 'Staple DMG ticket');
      run('xcrun', ['stapler', 'validate', dmg], 'DMG ticket verification');
      run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', dmg], 'Gatekeeper DMG assessment');
    }
    mkdirSync(mount);
    try {
      run('hdiutil', ['attach', '-readonly', '-nobrowse', '-noautoopen', '-mountpoint', mount, dmg], 'Mount final DMG for verification');
      mounted = true;
      verifyApp(path.join(mount, appName));
      console.log('Verified the app inside the final read-only mounted DMG.');
    } finally {
      if (mounted) {
        run('hdiutil', ['detach', mount], 'Unmount verified DMG');
        mounted = false;
      }
    }
    assert.equal(run('git', ['rev-parse', 'HEAD'], 'Recheck source commit'), commit, 'Source commit changed during the build');
    if (!sourceDirty) assert.equal(run('git', ['status', '--porcelain', '--untracked-files=normal'], 'Recheck source cleanliness'), '', 'Source became dirty during the build');
    mkdirSync(output, { recursive: true });
    const destination = path.join(output, assetNames(version, !formal).macos);
    copyFileSync(dmg, destination);
    writeFileSync(path.join(output, 'platform.json'), JSON.stringify({ schema: 1, version, commit, sourceDirty, mode,
      platform: 'macos', architecture: 'x86_64+arm64', signature: formal ? 'developer-id' : 'ad-hoc', notarization: formal ? 'stapled' : 'not-notarized',
      product: 'CopilotBYOKManager', identifier: 'io.github.avalonero.copilotbyokmanager', executable: 'copilot-byok-manager',
      files: [fileDigest(destination)], node: process.version, rust: run('rustc', ['--version'], 'Rust version') }, null, 2) + '\n');
    console.log(`Verified macOS universal package (${formal ? 'Developer ID + notarization' : 'testing: ad-hoc, not notarized'}).`);
  } finally {
    try {
      if (keychainCreated) {
        try { run('security', ['list-keychains', '-d', 'user', '-s', ...originalKeychains], 'Restore keychain search list'); }
        finally { run('security', ['delete-keychain', keychain], 'Delete temporary keychain'); }
      }
    } finally {
      // Delete only the secret files even if detaching a read-only DMG failed.
      // Never recurse into a still-mounted filesystem. An ephemeral CI runner
      // disposes of an abandoned mount; local dry-runs report a cleanup failure.
      for (const file of [certificate, privateKey]) rmSync(file, { force: true });
      // Only this process-created random directory; never a home/workspace root.
      assert.equal(path.dirname(taskTemp), os.tmpdir());
      if (!mounted) rmSync(taskTemp, { recursive: true, force: true });
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
