import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { releaseRequest } from './release-policy.mjs';

try {
  const request = releaseRequest({ event: process.env.GITHUB_EVENT_NAME, ref: process.env.GITHUB_REF,
    repository: process.env.GITHUB_REPOSITORY, requestedRef: process.env.INPUT_REF,
    mode: process.env.INPUT_MODE || 'dry-run', platform: process.env.INPUT_PLATFORM || 'all' });
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const sourceRef = request.tag ? `refs/tags/${request.tag}` : request.ref === 'main' ? 'refs/remotes/origin/main' : request.ref;
  const sha = git(['rev-parse', '--verify', `${sourceRef}^{commit}`]);
  assert.match(sha, /^[a-f0-9]{40}$/);
  // Credentials are never supplied to code outside the reviewed development line.
  git(['merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main']);
  if (request.mode !== 'dry-run') {
    const workflow = git(['rev-parse', '--verify', 'HEAD:.github/workflows/release.yml']);
    assert.equal(git(['rev-parse', '--verify', `${sha}:.github/workflows/release.yml`]), workflow,
      'Tag workflow differs from the executing workflow; review on main before release');
  }
  for (const [key, value] of Object.entries({ ...request, sha })) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
  console.log(`Resolved ${request.mode} / ${request.platform} to ${sha}${request.tag ? ` (${request.tag})` : ''}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
