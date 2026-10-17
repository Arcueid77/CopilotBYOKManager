# Release engineering: v0.1 core configuration edition

The maintainer's **2026-10-17 decision permits publication without publisher signing or completed manual acceptance**, and requests feature/download notes without signing or acceptance notices. Automated checks, exact source/package provenance and native safety contracts remain required. The scope is Overview / Providers / Apps / About; hidden Usage, Billing and Resources stay retained and unmounted. See [release criteria (中文)](release-criteria.md) and [specification §21](mvp-implementation-spec.md#21-final-acceptance).

Configure one provider. Publish it safely across your Copilot clients.

## Outputs and identities

| Output | Policy |
| --- | --- |
| `CopilotBYOKManager-vX.Y.Z-windows-x64-setup.exe` | Required; Tauri NSIS, current user |
| `CopilotBYOKManager-vX.Y.Z-macos-universal.dmg` | Required for Draft/public release; both architectures, Hardened Runtime; Developer ID optional |
| `SHA256SUMS.txt` | Required; covers every attachment except itself, including metadata and release notes |
| `CopilotBYOKManager-vX.Y.Z-windows-x64-standalone.zip` | Optional extra; EXE + license + data-location warning, not a fully portable app |
| `release-metadata.json`, `RELEASE-NOTES.md` | Exact source SHA, version, toolchain, architecture/build results and concise feature/install notes |

Mac dry-run uses `CopilotBYOKManager-vX.Y.Z-macos-universal-testing-adhoc.dmg` and cannot be promoted. A fresh Draft build uses the regular release filename and may use ad-hoc signing. Actual signature/notarization results remain in machine-readable metadata. A platform-only dry-run is valid; Draft/public releases require both platforms.

Stable identities are unchanged: product `CopilotBYOKManager`, executable/package `copilot-byok-manager`, Bundle ID `io.github.avalonero.copilotbyokmanager`, configuration root `CopilotBYOKManager`, credential service `io.github.avalonero.copilotbyokmanager.connections`. No data migration, credential adoption, updater, Linux distribution, Windows ARM64/MSI or store publishing is introduced.

Windows uses the official current-user NSIS template, start menu and uninstall registration, with no custom uninstall hook. Uninstall must not remove client configuration; verify this on a clean user. The WebView2 strategy downloads Microsoft's bootstrapper when required: missing network, denied permission or bootstrapper failure must be tested, not disguised as offline support. NSIS's bootstrap executable may be x86; the packaged application must be PE x64 with the **Windows GUI subsystem (2)**, not Console (3). The release entry point selects that subsystem while debug builds retain console diagnostics. Both ordinary Windows CI and packaging inspect the compiled payload's PE headers and reject console/malformed outputs before distribution. See the [Rust subsystem contract](https://doc.rust-lang.org/reference/runtime.html#the-windows_subsystem-attribute).

Mac uses the standard Tauri `.app`/DMG layout and generated Info.plist. Minimum macOS is **15.0**, aligned with the selected official `macos-15` runner. Lowering it requires separate dependency and real-machine evidence. The replacement app icon is generated from the checked-in high-resolution transparent source with the locked official Tauri CLI, including a 1024px ICNS representation. See [icon provenance and generation prompt](../apps/desktop/src-tauri/icons/README.md).

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
| Dispatch `draft` | Existing strict version tag, `platform=all` | Full checks + both packages; creates/updates only a Draft |
| Dispatch `publish` | Existing strict version tag, `platform=all`, existing Draft | Rechecks the same source; downloads and verifies the Draft's exact bytes before making it public as a Pre-release |

Dispatch the workflow **from main**. `ref` is the separate source input, not the workflow execution branch. No pull_request/pull_request_target event or fork repository is accepted. A target must be reachable from origin/main, and for formal modes its workflow blob must match the executing workflow. Ref syntax is bounded and passed as argument arrays, never executable shell text. Resolution freezes a full SHA; all subsequent jobs check out that SHA.

Draft jobs are validate → Windows/macOS tests → platform builds → assembly → verified Release upload. Publish reruns checks, skips builds/assembly and **promotes the existing Draft attachments without replacing them**. If a Draft needs different bytes or notes, explicitly rerun `draft`, verify its new hashes, and then publish. Public releases are never overwritten.

Build failure, changed tag, missing/extra/empty attachments, dirty CI source, mismatched version/SHA, inconsistent architecture/signing metadata or any hash mismatch stops the process. Missing Apple secrets fail only an explicitly selected Developer ID build; it never silently falls back. Public promotion downloads all Draft attachments and verifies the complete set, digest list, provenance and notes again. Recovery is an explicit rerun against the same tag, not a moved tag or automatic attachment deletion.

The default `build-macos-adhoc` job uses no environment or Apple secrets in either dry-run or Draft mode. Optional `macos_signing=developer-id` selects the protected `build-macos` job and its `release` environment. The final Release job needs only its scoped Actions token; public promotion requires an explicit maintainer-authorized publish dispatch. No Apple or repository environment setup is needed for the default release.

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

`check` includes local documentation links/anchors, formatting, locked Rust tests and strict Clippy. If installed locally, run `actionlint .github/workflows/ci.yml .github/workflows/release.yml`; otherwise use a task-local official release verified against its published checksums. Policy tests cover optional Apple credentials, ad-hoc release assembly, forbidden dry-run promotion, fork/PR/ref rejection, version drift, attachment loss, byte tampering and moved tags. Tests use synthetic files and a fake GitHub CLI.

On Windows x64 with PowerShell 7 and the Rust/MSVC toolchain:

```powershell
pwsh -NoProfile -File scripts/package-windows.ps1 -Mode dry-run
```

The default output is `target/platform-assets/windows/`. Supply `-OutputDirectory` for another **empty** directory; existing output is not overwritten. The script uses `--target x86_64-pc-windows-msvc --bundles nsis -- --locked`, checks both ProductVersion fields, verifies x64/GUI-subsystem payload and unsigned status, then records sizes/hashes/toolchains. It never installs or launches the resulting application.

On a Mac, install the two Rust targets first, then build an ad-hoc test DMG:

```bash
rustup target add x86_64-apple-darwin aarch64-apple-darwin
node scripts/package-macos.mjs
```

The script uses `universal-apple-darwin` and `--bundles app,dmg` with Tauri's official bundler, retaining the app for verification before checking it again inside a read-only mounted DMG. Only the final DMG is distributed. It checks `lipo`, Info.plist and hardened code signatures. `RELEASE_MACOS_SIGNING` defaults to `ad-hoc`; optional `developer-id` is restricted to the protected CI job described in [Apple setup](release-secrets.md). That mode notarizes/staples both app and DMG and cleans temporary credentials/keychain on success or failure. A detach failure never leads to recursive deletion through a mounted filesystem.

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

# Mac-only preview, no Apple account, certificate, environment or Release needed:
gh workflow run release.yml --ref main -f ref=<FULL_REVIEWED_SHA> -f platform=macos -f mode=dry-run

# Only after version alignment and approval to create/push the actual tag:
git tag -a v0.1.0 <FULL_REVIEWED_SHA> -m "CopilotBYOKManager v0.1.0 core candidate"
git push origin v0.1.0

# A tag push defaults to Draft. Explicitly rerun/update a Draft if needed:
gh workflow run release.yml --ref main -f ref=v0.1.0 -f platform=all -f mode=draft

# After verifying the Draft files, with maintainer publication authorization:
gh workflow run release.yml --ref main -f ref=v0.1.0 -f platform=all -f mode=publish
```

Download and inspect Draft assets, SHA256SUMS and metadata before promotion. Update the [release notes template](release-notes-template.md) **before tagging**. Internal evidence stays truthful; release notes need no signing or acceptance notices. The workflow does not change repository settings or create Apple credentials. Stable/Latest promotion remains a separate maintainer decision.

## Evidence still required

The [Mac dry-run at `dad7bd4`](https://github.com/Arcueid77/CopilotBYOKManager/actions/runs/38706651589) passed on the hosted Mac, including the final DMG payload. Real-machine checks remain tracked separately, without blocking the maintainer-authorized release or being reported as passed. Rider remains deferred. Full details: [release criteria (中文)](release-criteria.md), [local validation (中文)](local-validation-plan.md), [current evidence](implementation-status.md).

The engineering host's default tests pass, but requiring file-symlink fixtures with `COPILOT_BYOK_MANAGER_TEST_REQUIRE_LINKS=1` fails locally with Windows privilege error 1314. That local limitation remains; it is not a passed local symlink branch. Both ordinary CI and Release tests retain the strict setting, and the hosted Windows/Mac release suites passed it at `dad7bd4` with Node 22. Local Windows packaging used Node 24; keep these evidence layers distinct.

## Official implementation references

- [Tauri Windows installers](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri macOS signing and notarization](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri app bundles](https://v2.tauri.app/distribute/macos-application-bundle/) and [DMG bundler](https://v2.tauri.app/distribute/dmg/)
- [Locked CLI v2.11.4 signing implementation](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-bundler/src/bundle/macos/sign.rs)
- [Locked CLI v2.11.4 bundle retention/cleanup](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-bundler/src/bundle.rs#L225-L249)
- [GitHub hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

References were checked for this engineering change on 2026-10-15. Recheck official support before upgrading tools or platform scope; do not copy migration-specific compatibility bundles from other projects.
