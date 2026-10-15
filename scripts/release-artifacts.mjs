import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assetNames } from './release-policy.mjs';
import { VERSION_PATTERN } from './check-release-version.mjs';

export function fileDigest(file) {
  const stat = lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 1024 ** 3,
    `Missing, empty, linked or oversized artifact: ${path.basename(file)}`);
  return { name: path.basename(file), size: stat.size, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') };
}

export function peArchitecture(file) {
  const bytes = readFileSync(file);
  assert.ok(bytes.length > 256 && bytes.readUInt16LE(0) === 0x5a4d, 'Missing PE header');
  const offset = bytes.readUInt32LE(0x3c);
  assert.ok(offset + 24 <= bytes.length && bytes.readUInt32LE(offset) === 0x4550, 'Invalid PE header');
  const machine = bytes.readUInt16LE(offset + 4);
  assert.ok([0x8664, 0x14c].includes(machine), 'Unexpected PE architecture');
  return machine === 0x8664 ? 'x64' : 'x86';
}

export function validatePlatformMetadata(metadata, { version, sha, mode, platform }) {
  assert.equal(metadata.schema, 1);
  assert.equal(metadata.version, version, 'Artifact version mismatch');
  assert.match(version, VERSION_PATTERN);
  assert.match(sha, /^[a-f0-9]{40}$/);
  assert.equal(metadata.commit, sha, 'Artifact source SHA mismatch');
  assert.equal(metadata.platform, platform);
  assert.equal(metadata.product, 'CopilotBYOKManager');
  assert.equal(metadata.identifier, 'io.github.avalonero.copilotbyokmanager');
  assert.equal(metadata.executable, 'copilot-byok-manager');
  assert.equal(metadata.mode, mode, 'Do not promote dry-run artifacts');
  assert.equal(metadata.sourceDirty, false, 'Release artifacts require a clean source tree');
  const testing = mode === 'dry-run';
  const names = assetNames(version, testing);
  const allowed = platform === 'windows' ? [names.windows, names.standalone] : [names.macos];
  assert.ok(Array.isArray(metadata.files) && metadata.files.length >= 1 && metadata.files.length <= allowed.length);
  assert.equal(new Set(metadata.files.map(f => f.name)).size, metadata.files.length, 'Duplicate artifact');
  assert.ok(metadata.files.some(f => f.name === names[platform]), 'Missing required platform package');
  for (const file of metadata.files) {
    assert.ok(allowed.includes(file.name), 'Unexpected artifact filename');
    assert.ok(Number.isSafeInteger(file.size) && file.size > 0 && file.size <= 1024 ** 3);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
  }
  if (platform === 'windows') {
    assert.equal(metadata.architecture, 'x64');
    assert.equal(metadata.signature, 'unsigned');
    assert.equal(metadata.notarization, 'not-applicable');
  } else {
    assert.equal(metadata.architecture, 'x86_64+arm64');
    assert.equal(metadata.signature, testing ? 'ad-hoc' : 'developer-id');
    assert.equal(metadata.notarization, testing ? 'not-notarized' : 'stapled');
  }
}

export function assembleRelease({ input, output, version, sha, mode, platform, notesTemplate }) {
  assert.ok(['dry-run', 'draft', 'publish'].includes(mode));
  assert.ok(['all', 'windows', 'macos'].includes(platform));
  assert.ok(mode === 'dry-run' || platform === 'all', 'Formal release requires both platforms');
  const platforms = platform === 'all' ? ['windows', 'macos'] : [platform];
  assert.ok(!readdirSafe(output).length, 'Assembly output must be empty');
  mkdirSync(output, { recursive: true });
  const manifests = platforms.map(target => {
    const directory = path.join(input, target);
    const metadata = JSON.parse(readFileSync(path.join(directory, 'platform.json'), 'utf8'));
    validatePlatformMetadata(metadata, { version, sha, mode, platform: target });
    assert.deepEqual(readdirSync(directory).sort(), [...metadata.files.map(f => f.name), 'platform.json'].sort(), 'Unexpected platform artifact files');
    for (const expected of metadata.files) {
      const source = path.join(directory, expected.name);
      assert.deepEqual(fileDigest(source), expected, 'Artifact bytes changed since platform verification');
      copyFileSync(source, path.join(output, expected.name));
    }
    return metadata;
  });
  writeFileSync(path.join(output, 'release-metadata.json'), JSON.stringify({ schema: 1, version, commit: sha, mode, platform, builds: manifests }, null, 2) + '\n');
  const values = {
    VERSION: version, COMMIT: sha,
    MACOS_STATUS: platforms.includes('macos') ? mode === 'dry-run' ? 'Ad-hoc signed, not notarized; testing only' : 'Developer ID signed and notarized; stapled ticket verified' : 'Not built in this platform-only dry-run',
    WINDOWS_STATUS: platforms.includes('windows') ? 'Unsigned community build' : 'Not built in this platform-only dry-run',
    FILES: manifests.flatMap(m => m.files).map(f => `- \`${f.name}\``).join('\n'),
    CHANNEL: mode === 'dry-run' ? 'Testing artifacts only; not a public Release.' : 'v0.1 core configuration release candidate (pre-release, not Latest).',
  };
  const notes = readFileSync(notesTemplate, 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    assert.ok(key in values, `Unknown release-note placeholder ${key}`); return values[key];
  });
  writeFileSync(path.join(output, 'RELEASE-NOTES.md'), notes);
  const sums = readdirSync(output).sort().map(name => `${fileDigest(path.join(output, name)).sha256}  ${name}\n`).join('');
  writeFileSync(path.join(output, 'SHA256SUMS.txt'), sums);
  verifyReleaseDirectory(output, { version, sha, mode, platform });
}

function readdirSafe(directory) {
  try { return readdirSync(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export function verifyReleaseDirectory(directory, { version, sha, mode, platform = 'all' }) {
  const meta = JSON.parse(readFileSync(path.join(directory, 'release-metadata.json'), 'utf8'));
  assert.equal(meta.schema, 1);
  assert.equal(meta.version, version); assert.equal(meta.commit, sha);
  assert.equal(meta.mode, mode); assert.equal(meta.platform, platform);
  assert.ok(mode === 'dry-run' || platform === 'all', 'Both mandatory packages are required');
  const expectedPlatforms = platform === 'all' ? ['macos', 'windows'] : [platform];
  assert.deepEqual(meta.builds.map(b => b.platform).sort(), expectedPlatforms);
  const filenames = ['release-metadata.json', 'RELEASE-NOTES.md'];
  for (const build of meta.builds) {
    validatePlatformMetadata(build, { version, sha, mode, platform: build.platform });
    for (const file of build.files) {
      assert.deepEqual(fileDigest(path.join(directory, file.name)), file);
      filenames.push(file.name);
    }
  }
  assert.deepEqual(readdirSync(directory).sort(), [...filenames, 'SHA256SUMS.txt'].sort(), 'Missing or unexpected release files');
  const expectedSums = filenames.sort().map(name => `${fileDigest(path.join(directory, name)).sha256}  ${name}\n`).join('');
  assert.equal(readFileSync(path.join(directory, 'SHA256SUMS.txt'), 'utf8'), expectedSums, 'Checksum list does not match the complete artifact set');
  const notes = readFileSync(path.join(directory, 'RELEASE-NOTES.md'), 'utf8');
  assert.ok(notes.includes(sha) && notes.includes(`v${version}`), 'Release notes provenance mismatch');
  if (expectedPlatforms.includes('windows')) assert.ok(notes.includes('Unsigned community build'));
  if (expectedPlatforms.includes('macos')) assert.ok(notes.includes(mode === 'dry-run' ? 'Ad-hoc signed, not notarized; testing only' : 'Developer ID signed and notarized'));
  return [...filenames, 'SHA256SUMS.txt'].sort();
}
