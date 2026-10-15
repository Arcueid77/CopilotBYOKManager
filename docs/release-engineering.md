# Release engineering: v0.1 core configuration edition

**Status: engineering candidate, not an accepted or published release.** The first scope is Overview / Providers / Apps / About. Hidden Usage, Billing and Resources remain retained and unmounted; their live acceptance belongs to the extended milestone, not this release. Startup safety, stored-data preservation and all native write/recovery contracts still apply. See [release gates (中文)](release-criteria.md) and [specification §21](mvp-implementation-spec.md#21-final-acceptance).

Configure one provider. Publish it safely across your Copilot clients.

## Outputs and identities

| Output | Policy |
| --- | --- |
| `CopilotBYOKManager-vX.Y.Z-windows-x64-setup.exe` | Required; Tauri NSIS, current user, **Unsigned community build** |
| `CopilotBYOKManager-vX.Y.Z-macos-universal.dmg` | Required for Draft/public release; Developer ID signed, Hardened Runtime, notarized, stapled |
| `SHA256SUMS.txt` | Required; covers every attachment except itself, including metadata and release notes |
| `CopilotBYOKManager-vX.Y.Z-windows-x64-standalone.zip` | Optional extra; EXE + license + data-location warning, not a fully portable app |
| `release-metadata.json`, `RELEASE-NOTES.md` | Exact source SHA, version, toolchain, architecture/signing results and user disclosures |

Mac dry-run uses `CopilotBYOKManager-vX.Y.Z-macos-universal-testing-adhoc.dmg` and a `testing-adhoc` Actions artifact name. It is **Ad-hoc signed, not notarized; testing only**. It cannot pass formal assembly. A platform-only dry-run is valid, but missing either mandatory platform is a hard failure in formal modes.

Stable identities are unchanged: product `CopilotBYOKManager`, executable/package `copilot-byok-manager`, Bundle ID `io.github.avalonero.copilotbyokmanager`, configuration root `CopilotBYOKManager`, credential service `io.github.avalonero.copilotbyokmanager.connections`. No data migration, credential adoption, updater, Linux distribution, Windows ARM64/MSI or store publishing is introduced.

Windows uses the official current-user NSIS template, start menu and uninstall registration, with no custom uninstall hook. Uninstall must not remove client configuration; verify this on a clean user. The WebView2 strategy downloads Microsoft's bootstrapper when required: missing network, denied permission or bootstrapper failure must be tested, not disguised as offline support. NSIS's bootstrap executable may be x86; the packaged application must be PE x64.

Mac uses the standard Tauri `.app`/DMG layout and generated Info.plist. Minimum macOS is conservatively **15.0**, aligned with the selected official `macos-15` runner; this is a candidate floor, not proof of macOS 15 or both CPU families being accepted. Lowering it requires separate dependency and real-machine evidence. The existing 128px logo was used to generate ICNS with the locked official CLI; it is resampled, not a new high-resolution design. See [icon provenance](../apps/desktop/src-tauri/icons/README.md).

## Version and dependency contract

CI uses Node **22**, Rust **1.88.0**, `npm ci` and Cargo `--locked`. Tauri CLI/native versions come from package-lock.json/Cargo.lock, not a live latest install. Updating these locks is a normal reviewed source change. `Ajv` is a pinned development-only dependency for validating both bundle configurations against the **installed, locked Tauri JSON Schema**; it adds no runtime application dependency. Non-Unicode regex compilation handles the schema's escaped punctuation; numeric/URI/UUID formats remain validated.

`npm run check:version` verifies package.json, both package-lock version entries, the application Cargo.toml/Cargo.lock package, tauri.conf.json and the existing About version labels. It also checks stable product identity and lock presence. Run with `node scripts/check-release-version.mjs --tag vX.Y.Z` to require exact tag/file agreement. Tags must be strict `vX.Y.Z`; no `-rc` suffix. GitHub Pre-release represents candidate status, not a semver suffix.

For a version bump, update those application sources together (not every third-party dependency version), regenerate affected lock metadata through the package managers, update the About message parameters, then run the checker and tests. The checker intentionally fails rather than silently changing files. Bump versions before tagging; never move an already used tag to repair a package.

## Workflow behavior

[release.yml](../.github/workflows/release.yml) is separate from normal [CI](../.github/workflows/ci.yml). Official checkout/setup/artifact actions are fixed to full commit SHAs. GitHub CLI is used for Release API operations. Default permission is `contents: read`; only the last job receives `contents: write`. Credentials are not persisted by checkout. Release concurrency is serialized with cancellation disabled.

| Trigger / mode | Source | Result |
| --- | --- | --- |
| Push `v*` | Must resolve to existing strict `vX.Y.Z`, version matches | Full checks + both formal packages → **Draft only** |
| Dispatch `dry-run` | `main`, full 40-character SHA on main ancestry, or strict existing tag | Full checks, selected platform(s), Actions artifacts only; no Release API mutation |
| Dispatch `draft` | Existing strict version tag, `platform=all` | Full checks + formally signed Mac; creates/updates only a Draft |
| Dispatch `publish` | Existing strict version tag, `platform=all`, existing Draft | Rechecks same source and formal builds; verifies the already-reviewed Draft's exact downloaded bytes before making that Draft public as a Pre-release |

Dispatch the workflow **from main**. `ref` is the separate source input, not the workflow execution branch. No pull_request/pull_request_target event or fork repository is accepted. A target must be reachable from origin/main, and for formal modes its workflow blob must match the executing workflow. Ref syntax is bounded and passed as argument arrays, never executable shell text. Resolution freezes a full SHA; all subsequent jobs check out that SHA.

The jobs are validate → Windows/macOS tests → platform builds → assembly → guarded Release operation. Publish repeats checks/builds but **does not replace reviewed Draft attachments or notes with rebuilt bytes**: timestamps/signatures can change between builds. Acceptance must refer to the Draft files that will actually become public. If a Draft needs different bytes or notes, explicitly rerun `draft`, review/accept its new hashes, and then publish. Public releases are never overwritten by this workflow.

Formal build failure, missing Apple secrets, changed tag, missing/extra/empty attachments, dirty CI source, mismatched version/SHA, incorrect architecture/signing metadata or any hash mismatch stops the process. Public-release promotion downloads all Draft attachments and checks their complete set, digest list, provenance and notes again. Recovery is an explicit rerun against the same tag, not forcing a moved tag or deleting unexpected attachments automatically.

Both Mac signing and the final Release job use the `release` environment. Configure reviewers before formal use. Mac dry-run uses the same environment approval but receives **no Apple secrets**. The workflow cannot replace maintainer approval of real-machine/client gates; never approve public promotion solely because automated checks are green.

## Local verification and packages

Run from the repository root:

```bash
npm ci
npm run check:version
npm run test:release
npm run check:web
npm run check
git diff --check
```

`check` includes local documentation links/anchors, formatting, locked Rust tests and strict Clippy. If installed locally, run `actionlint .github/workflows/ci.yml .github/workflows/release.yml`; otherwise use a task-local official release verified against its published checksums, not a global installation. Schema/policy tests include missing Apple credentials, fork/PR/ref rejection, version drift, mandatory attachment loss, ad-hoc promotion, byte tampering and moved tags. They use synthetic files and a fake GitHub CLI; no credentials or real Release mutations.

On Windows x64 with PowerShell 7 and the Rust/MSVC toolchain:

```powershell
pwsh -NoProfile -File scripts/package-windows.ps1 -Mode dry-run
```

The default output is `target/platform-assets/windows/`. Supply `-OutputDirectory` for another **empty** directory; existing output is not overwritten. The script uses `--target x86_64-pc-windows-msvc --bundles nsis -- --locked`, checks both ProductVersion fields, verifies x64 payload and unsigned status, then records sizes/hashes/toolchains. It never installs or launches the resulting application.

On a Mac, install the two Rust targets first, then build an ad-hoc test DMG:

```bash
rustup target add x86_64-apple-darwin aarch64-apple-darwin
node scripts/package-macos.mjs
```

The script uses `universal-apple-darwin`, Tauri's official DMG bundler, and verifies `lipo`, Info.plist, hardened code signatures and the app inside a read-only mounted DMG. Formal signing is restricted to the environment job; see [Apple setup](release-secrets.md). Tauri notarizes/staples the app; the script also submits/staples/validates the final DMG. Temporary credentials/keychain are cleaned on success or failure. A detach failure never leads to recursively deleting through a mounted filesystem.

To assemble an exact clean local source's Windows-only test outputs (PowerShell):

```powershell
$env:RELEASE_MODE = 'dry-run'
$env:RELEASE_PLATFORM = 'windows'
$env:RELEASE_SHA = (git rev-parse HEAD).Trim()
node scripts/assemble-release.mjs
node scripts/assemble-release.mjs --verify
```

Assembly writes `target/release-assets/`, which must be empty. Local packages from a dirty tree are marked `sourceDirty: true` and intentionally cannot enter checksum/release assembly. Commit reviewed changes locally and rebuild before assembling provenance-bound artifacts. Both `target/` trees are ignored; do not commit binaries, installers, logs or private credentials.

## Maintainer-only remote operations (examples, not executed)

These actions need explicit maintainer authorization and a pushed, reviewed source. They are not part of local implementation:

```bash
# After independently reviewing and authorizing the source push:
gh workflow run release.yml --ref main -f ref=main -f platform=all -f mode=dry-run

# Only after version alignment and approval to create/push the actual tag:
git tag -a v0.1.0 <FULL_REVIEWED_SHA> -m "CopilotBYOKManager v0.1.0 core candidate"
git push origin v0.1.0

# A tag push defaults to Draft. Explicitly rerun/update a Draft if needed:
gh workflow run release.yml --ref main -f ref=v0.1.0 -f platform=all -f mode=draft

# Only after final Draft package acceptance and environment approval:
gh workflow run release.yml --ref main -f ref=v0.1.0 -f platform=all -f mode=publish
```

Download and inspect Draft assets before approval, including SHA256SUMS, metadata, Windows unsigned disclosure and Mac signing/notary tickets. Update the checked-in [release notes template](release-notes-template.md) and versioned support evidence **before tagging**; pending acceptance must remain pending until real evidence exists. The release workflow neither changes repository settings nor creates Apple credentials. Stable/Latest promotion is a separate future maintainer decision, not a hidden effect of publish.

## Evidence still required

Local Windows packaging is not clean-user installation, desktop/tray acceptance or a successful client request. A Windows host cannot validate macOS packaging/notarization. First run the Mac dry-run in Actions, then the protected formal build after Apple setup; test final DMGs on both Intel and Apple Silicon, final NSIS on clean Windows, and each advertised client/version. Rider remains deferred unless the maintainer resumes it. Full details and reporting fields: [release gates (中文)](release-criteria.md), [local validation (中文)](local-validation-plan.md), [current evidence](implementation-status.md).

The engineering host's default tests pass, but requiring file-symlink fixtures with `COPILOT_BYOK_MANAGER_TEST_REQUIRE_LINKS=1` fails with Windows privilege error 1314. This is not a passed symlink security check. Both ordinary CI and Release tests retain the strict setting; run on a capable runner rather than disabling that gate or silently skipping it. Hosted CI and Node 22 remain separate from local Node 24 verification.

## Official implementation references

- [Tauri Windows installers](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri macOS signing and notarization](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri app bundles](https://v2.tauri.app/distribute/macos-application-bundle/) and [DMG bundler](https://v2.tauri.app/distribute/dmg/)
- [Locked CLI v2.11.4 signing implementation](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-bundler/src/bundle/macos/sign.rs)
- [GitHub hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

References were checked for this engineering change on 2026-10-15. Recheck official support before upgrading tools or platform scope; do not copy migration-specific compatibility bundles from other projects.
