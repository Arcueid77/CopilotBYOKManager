import path from 'node:path';
import { checkReleaseVersion, ROOT } from './check-release-version.mjs';
import { assembleRelease, verifyReleaseDirectory } from './release-artifacts.mjs';

try {
  const { version } = checkReleaseVersion(ROOT, process.env.RELEASE_TAG);
  const config = { version, sha: process.env.RELEASE_SHA, mode: process.env.RELEASE_MODE, platform: process.env.RELEASE_PLATFORM || 'all' };
  const output = path.resolve(process.env.RELEASE_OUTPUT || 'target/release-assets');
  if (process.argv.includes('--verify')) verifyReleaseDirectory(output, config);
  else assembleRelease({ ...config, output, input: path.resolve(process.env.RELEASE_INPUT || 'target/platform-assets'), notesTemplate: path.join(ROOT, 'docs/release-notes-template.md') });
  console.log(`Release assets ${process.argv.includes('--verify') ? 'verified' : 'assembled'}: v${version}, ${config.sha}, ${config.mode}, ${config.platform}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
