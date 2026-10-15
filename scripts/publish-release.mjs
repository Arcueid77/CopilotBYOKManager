import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReleaseVersion, ROOT, TAG_PATTERN } from './check-release-version.mjs';
import { REPOSITORY } from './release-policy.mjs';
import { fileDigest, verifyReleaseDirectory } from './release-artifacts.mjs';

export function githubCli(args, { allow404 = false } = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 });
  if (allow404 && result.status !== 0 && /\(HTTP 404\)/.test(result.stderr)) return null;
  assert.equal(result.status, 0, 'GitHub operation failed; inspect the Actions step (no token or private response logged)');
  return result.stdout.trim();
}

export function publishRelease({ directory, version, sha, tag, mode, cli = githubCli, downloadDirectory }) {
  assert.ok(['draft', 'publish'].includes(mode), 'dry-run cannot create a Release');
  assert.match(tag, TAG_PATTERN); assert.equal(tag, `v${version}`);
  assert.match(sha, /^[a-f0-9]{40}$/);
  // Promotion consumes the original Draft bytes. Rebuilding the same source can
  // change signatures/timestamps and must not replace package-acceptance evidence.
  const artifactMode = 'draft';
  const files = verifyReleaseDirectory(directory, { version, sha, mode: artifactMode });
  const api = endpoint => JSON.parse(cli(['api', `repos/${REPOSITORY}/${endpoint}`]));
  const checkTag = () => {
    let object = api(`git/ref/tags/${tag}`).object;
    for (let depth = 0; object.type === 'tag' && depth < 5; depth++) object = api(`git/tags/${object.sha}`).object;
    assert.equal(object.type, 'commit', 'Tag does not resolve to a commit');
    assert.equal(object.sha, sha, 'Tag moved after validation; refusing Release mutation');
  };
  checkTag();
  const response = cli(['api', `repos/${REPOSITORY}/releases/tags/${tag}`], { allow404: true });
  const existing = response === null ? null : JSON.parse(response);
  if (existing) assert.equal(existing.draft, true, 'Never overwrite an already public Release');
  if (mode === 'publish') assert.ok(existing, 'publish requires an existing Draft Release');
  if (!existing) {
    cli(['release', 'create', tag, '--repo', REPOSITORY, '--verify-tag', '--target', sha, '--draft', '--prerelease', '--title', `CopilotBYOKManager ${tag}`, '--notes-file', path.join(directory, 'RELEASE-NOTES.md')]);
  } else if (mode === 'draft') {
    const existingNames = existing.assets.map(asset => asset.name);
    assert.ok(existingNames.every(name => files.includes(name)), 'Draft contains unexpected attachments; reconcile manually before retrying');
    cli(['release', 'edit', tag, '--repo', REPOSITORY, '--target', sha, '--prerelease', '--latest=false', '--notes-file', path.join(directory, 'RELEASE-NOTES.md')]);
  }
  if (mode === 'draft') cli(['release', 'upload', tag, ...files.map(name => path.join(directory, name)), '--repo', REPOSITORY, '--clobber']);
  const uploaded = api(`releases/tags/${tag}`);
  assert.equal(uploaded.draft, true, 'Release became public during attachment upload');
  assert.deepEqual(uploaded.assets.map(asset => asset.name).sort(), files, 'Remote attachment set is incomplete');
  for (const asset of uploaded.assets) {
    assert.equal(asset.size, fileDigest(path.join(directory, asset.name)).size, 'Remote attachment size mismatch');
  }
  const downloaded = downloadDirectory || mkdtempSync(path.join(os.tmpdir(), 'copilot-byok-manager-release-verify-'));
  cli(['release', 'download', tag, '--repo', REPOSITORY, '--dir', downloaded]);
  verifyReleaseDirectory(downloaded, { version, sha, mode: artifactMode });
  for (const name of files) assert.deepEqual(fileDigest(path.join(downloaded, name)), fileDigest(path.join(directory, name)), 'Downloaded Draft asset differs from this run');
  assert.equal(uploaded.body.trim(), readFileSync(path.join(directory, 'RELEASE-NOTES.md'), 'utf8').trim(), 'Remote notes mismatch');
  checkTag();
  if (mode === 'publish') {
    const finalDraft = api(`releases/tags/${tag}`);
    assert.equal(finalDraft.draft, true, 'Release changed while verifying; refusing promotion');
    // Our own verification downloads change download_count. Compare only stable
    // asset identity/content metadata, so replacement is detected without making
    // a legitimate read-only verification invalidate itself.
    const identity = assets => assets.map(({ id, name, size, digest, updated_at }) => ({ id, name, size, digest, updated_at })).sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(identity(finalDraft.assets), identity(uploaded.assets), 'Draft attachments changed while verifying');
    assert.equal(finalDraft.body, uploaded.body, 'Draft notes changed while verifying');
    cli(['release', 'edit', tag, '--repo', REPOSITORY, '--draft=false', '--prerelease', '--latest=false']);
    assert.equal(api(`releases/tags/${tag}`).draft, false, 'GitHub did not confirm publication');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Release mutation is only available in the guarded Actions job');
    assert.equal(process.env.GITHUB_REPOSITORY, REPOSITORY);
    const { version } = checkReleaseVersion(ROOT, process.env.RELEASE_TAG);
    const directory = path.resolve(process.env.RELEASE_OUTPUT || 'target/release-assets');
    if (process.env.RELEASE_MODE === 'publish') {
      assert.ok(!existsSync(directory) || readdirSync(directory).length === 0, 'Draft download directory must be empty');
      mkdirSync(directory, { recursive: true });
      githubCli(['release', 'download', process.env.RELEASE_TAG, '--repo', REPOSITORY, '--dir', directory]);
    }
    publishRelease({ directory, version,
      sha: process.env.RELEASE_SHA, tag: process.env.RELEASE_TAG, mode: process.env.RELEASE_MODE });
    console.log(`Verified ${process.env.RELEASE_MODE} Release for ${process.env.RELEASE_TAG} at ${process.env.RELEASE_SHA}.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
