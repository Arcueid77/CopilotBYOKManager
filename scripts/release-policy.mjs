import assert from 'node:assert/strict';
import { TAG_PATTERN, VERSION_PATTERN } from './check-release-version.mjs';

export const REPOSITORY = 'Arcueid77/CopilotBYOKManager';
export const PRODUCT = 'CopilotBYOKManager';
export const APPLE_SECRET_NAMES = ['APPLE_CERTIFICATE_BASE64', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_SIGNING_IDENTITY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER_ID', 'APPLE_API_PRIVATE_KEY_BASE64'];

export function releaseRequest({ event, ref, requestedRef = '', mode = 'dry-run', platform = 'all', macosSigning = 'ad-hoc', repository = REPOSITORY }) {
  assert.equal(repository, REPOSITORY, 'Release workflow is restricted to the upstream repository');
  assert.ok(['push', 'workflow_dispatch'].includes(event), 'PR events cannot enter release workflow');
  if (event === 'push') {
    assert.ok(ref.startsWith('refs/tags/'), 'Only tag pushes enter release workflow');
    requestedRef = ref.slice('refs/tags/'.length);
    mode = 'draft'; platform = 'all'; macosSigning = 'ad-hoc';
  } else {
    assert.equal(ref, 'refs/heads/main', 'Dispatch release.yml from main, with the target in the ref input');
    requestedRef ||= 'main';
  }
  assert.ok(['dry-run', 'draft', 'publish'].includes(mode), 'Unknown release mode');
  assert.ok(['all', 'windows', 'macos'].includes(platform), 'Unknown release platform');
  assert.ok(['ad-hoc', 'developer-id'].includes(macosSigning), 'Unknown macOS signing mode');
  if (mode === 'dry-run') assert.equal(macosSigning, 'ad-hoc', 'Dry-run does not receive Apple credentials');
  assert.ok(typeof requestedRef === 'string' && requestedRef.length <= 80 && !/[\s\x00-\x1f\x7f]/.test(requestedRef), 'Ref must be bounded and contain no whitespace/control characters');
  // Only exact tags, the development branch or a full SHA. No refspecs, option
  // injection, expressions, pull refs, remote URLs or arbitrary checkout paths.
  assert.ok(requestedRef === 'main' || TAG_PATTERN.test(requestedRef) || /^[a-f0-9]{40}$/.test(requestedRef), 'Use main, a full lowercase commit SHA, or vX.Y.Z');
  if (mode !== 'dry-run') {
    assert.match(requestedRef, TAG_PATTERN, 'Draft/publish requires an existing fixed vX.Y.Z tag');
    assert.equal(platform, 'all', 'Draft/publish requires both Windows and macOS');
  }
  return { mode, platform, macosSigning, ref: requestedRef, tag: TAG_PATTERN.test(requestedRef) ? requestedRef : '' };
}

export function requireAppleCredentials(env) {
  const missing = APPLE_SECRET_NAMES.filter(name => !env[name]?.trim());
  assert.equal(missing.length, 0, `Formal macOS build requires secrets: ${missing.join(', ')}`);
  assert.ok(env.APPLE_SIGNING_IDENTITY.startsWith('Developer ID Application:'), 'Formal macOS build requires Developer ID Application identity');
}

export function assetNames(version, testing = false) {
  assert.match(version, VERSION_PATTERN);
  const stem = `${PRODUCT}-v${version}`;
  return {
    windows: `${stem}-windows-x64-setup.exe`,
    standalone: `${stem}-windows-x64-standalone.zip`,
    macos: `${stem}-macos-universal${testing ? '-testing-adhoc' : ''}.dmg`,
  };
}
