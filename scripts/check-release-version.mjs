import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$(?![\s\S])/;
export const TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$(?![\s\S])/;

export function checkReleaseVersion(root = ROOT, tag) {
  const read = name => readFileSync(path.join(root, name), 'utf8');
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const config = JSON.parse(read('apps/desktop/src-tauri/tauri.conf.json'));
  const cargo = read('apps/desktop/src-tauri/Cargo.toml').match(/^\[package\]\s*([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1];
  const cargoVersion = cargo?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  const packages = read('Cargo.lock').split('[[package]]').slice(1);
  const ownPackages = packages.filter(p => /^name = "copilot-byok-manager"$/m.test(p));
  assert.equal(ownPackages.length, 1, 'Cargo.lock must contain exactly one application package');
  const cargoLockVersion = ownPackages[0].match(/^version = "([^"]+)"/m)?.[1];
  assert.match(pkg.version, VERSION_PATTERN, 'Application version must be X.Y.Z');
  const sources = {
    'package.json': pkg.version,
    'package-lock.json': lock.version,
    'package-lock.json root package': lock.packages?.['']?.version,
    'Cargo.toml application': cargoVersion,
    'Cargo.lock application': cargoLockVersion,
    'tauri.conf.json': config.version,
  };
  // About currently uses a localized literal. Guard it too, so a future bump cannot
  // silently leave the visible application version behind the packaged binary.
  for (const file of ['apps/desktop/web/core-ui.js', 'apps/desktop/web/i18n-messages.js']) {
    const matches = [...read(file).matchAll(/(?:核心配置版 · 预发布 · |Core configuration edition · Pre-release · )(\d+\.\d+\.\d+)/g)];
    assert.ok(matches.length, `Missing About version in ${file}`);
    matches.forEach((match, i) => { sources[`${file} About ${i + 1}`] = match[1]; });
  }
  for (const [source, version] of Object.entries(sources)) {
    assert.equal(version, pkg.version, `Version mismatch: ${source}`);
  }
  assert.equal(pkg.name, 'copilot-byok-manager');
  assert.equal(config.productName, 'CopilotBYOKManager');
  assert.equal(config.identifier, 'io.github.avalonero.copilotbyokmanager');
  assert.equal(lock.lockfileVersion, 3, 'Use the checked-in npm lockfile');
  assert.ok(lock.packages['node_modules/@tauri-apps/cli']?.integrity, 'Tauri CLI must be locked');
  if (tag !== undefined && tag !== '') {
    assert.match(tag, TAG_PATTERN, 'Release tag must be exactly vX.Y.Z');
    assert.equal(tag, `v${pkg.version}`, 'Tag and application version differ');
  }
  return { version: pkg.version, tag: `v${pkg.version}`, sources };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--tag'), 'Usage: node scripts/check-release-version.mjs [--tag vX.Y.Z]');
    const result = checkReleaseVersion(ROOT, args[1]);
    console.log(`Release version ${result.version}: ${Object.keys(result.sources).length} sources agree${args[1] ? ` with ${args[1]}` : ''}.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
