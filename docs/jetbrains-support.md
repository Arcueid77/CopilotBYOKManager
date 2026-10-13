# JetBrains GitHub Copilot integration

CopilotBYOKManager implements the automatic adapter below. The reviewed version list and fixed inspection dates remain authoritative; the repository rename does not broaden supported plugin versions. See [current implementation status](implementation-status.md) for validation evidence. Rider runtime acceptance is deferred at the maintainer's request as of 2026-10-13.

## Automatic BYOK deployment

The maintainer requires automatic configuration, not manual instructions as the completed integration. Home and Clients expose an automatic BYOK review, and bulk deployment includes detected writable JetBrains profiles. Viewing the guide reads no key and allocates no apply-plan slot. Apply receives only the native-held reviewed plan ID and confirmation.

The adapter publishes endpoint, protocol (`chatCompletions`, `responses`, `messages`), enabled model IDs/names, registration, tool calling/vision/reasoning, explicit input/output limits, request headers with native secret substitution, and the Connection's own provider key. It writes the official runtime's **dedicated BYOK namespace**, not per-IDE preference XML, authentication stores or Password Safe. No keys/header values cross the frontend preview. The native BYOK file and private rollback journal may contain materialized provider keys; never publish them.

Each owner/Connection gets a stable provider name with exactly three managed keys: `<provider>-api-key`, `<provider>-provider-config`, `<provider>-models-config`. Provider config contains upstream `groupName`/`apiType` plus CopilotBYOKManager owner/Connection/schema markers, ignored by the upstream reader. Markers alone are not authority: replacement/revocation requires matching persisted owner/Connection/physical-resource/projection proof. Missing, foreign, partial, externally changed or per-model overriding keys cause conflict. Other providers and unknown values (including precise JSON numbers) survive. Semantic no-ops preserve source bytes. Revoke removes only owned keys and does not require the current Connection's key/endpoint to remain deployable; the current target/schema and ownership checks still apply. Detach leaves client data untouched.

Reviewed runtime root selection:

- Absolute `XDG_CONFIG_HOME`, any platform: `<XDG_CONFIG_HOME>/github-copilot/byok.json`.
- Windows default: `<home>/AppData/Local/github-copilot/byok.json`.
- macOS/Linux default: `<home>/.config/github-copilot/byok.json`.

IDE profiles using the same root share one physical file. Multiple selected IDE targets produce one deduplicated write with per-profile proofs/audit, not a last-writer-wins sequence. All IDEs using that root can observe the shared change, including unselected profiles. IDE-specific environment overrides are not inferred from private process/IDE settings.

Close IDEs before applying and reopen them to refresh cached model pickers. Select a deployed model in Copilot Chat and verify provider compatibility. Native post-write verification proves bytes on disk, **not** live IDE behavior, successful network requests, policy eligibility, GitHub sign-in or a changed open chat selection. CopilotBYOKManager never kills/restarts/installs an IDE automatically.

## Version and compatibility boundary

Schema `jetbrains-byok-1.19-v1` admits the official all-platform `1.19.0-252` bundle and the six exact `1.19.0-261-{windows,macos,linux}-{x64,arm64}` distribution versions. The reviewed 252 and 261 Windows x64 language servers are byte-identical; their BYOK save commands and capability/provider contracts match. Unknown/future versions remain explicit read-only/unsupported until fixed schemas/fixtures are verified. This is a version-pinned adapter, not a promised public/stable external-write API.

The upstream custom-provider flow requires a nonempty key. Missing keys refuse writing; local endpoints require an explicitly supplied key accepted by that endpoint, not an invented secret. Query-bearing URLs are unsupported because the reviewed upstream custom endpoint resolver rewrites them. This includes Azure URLs relying on `api-version`; use a query-free compatible endpoint or the IDE's built-in Azure flow pending a separately verified adapter.

Preview shows the effective inference URL. A host root uses `/v1` by default; Chat Completions/Responses accept versioned bases ending in `/vN`, while Messages requires `/v1`. A full terminal URL must match the selected protocol and survive the upstream resolver exactly. Ambiguous unversioned paths (for example `/api` or `/v1beta/openai`), mismatched protocol routes and Messages `/v2` are explicitly unsupported rather than silently changed. The adapter stores the original Connection URL; this check models the reviewed runtime's normalization, not a network probe.

## Discovery and other boundaries

Recognized default JetBrains profiles: IntelliJ IDEA/Community, PyCharm/Community, WebStorm, GoLand, CLion, Rider, PhpStorm, RubyMine, DataGrip, RustRover. Windows/macOS plugin root is `<config>/JetBrains/<product><version>/plugins`; Linux uses separate XDG data `JetBrains/<product><version>`. Custom/portable roots, Android Studio/Google roots, remote backends and renamed plugin roots are not scanned. Recognizing a product profile is not runtime validation of every IDE.

Discovery reads public classic JAR `META-INF/plugin.xml` (or loose metadata), exact ID `com.github.copilot`, vendor `GitHub`, version and `disabled_plugins.txt`. Descriptor candidates are public `github-copilot-intellij*.jar` / legacy `copilot.jar`, not every dependency JAR. Metadata can survive uninstall and is neither a binary signature nor running/installed IDE or account proof. Missing, disabled, unreviewed versions and unsafe/error states stay distinct.

Bounds: 128 root/plugin/library entries, 32 profiles, 64 MiB per descriptor JAR / 128 MiB total candidate bytes, 8192 classic ZIP entries / 2 MiB central directory, 256 KiB XML / depth 32 / 32768 events / bounded identities. Dedicated BYOK JSON: 4 MiB, depth 32, 2048 keys/array values, 512-byte keys, 64 KiB strings. Reject duplicate keys, malformed metadata, XML document types/custom entities, ZIP64/multipart layouts, linked/junction/reparse parents and nonregular sensitive files. Discovery never extracts/executes archives. Diagnostics never echo raw values.

Every enabled profile still needs official per-IDE sign-in/account checking; changed observations invalidate manual confirmation. BYOK deployment and Copilot app confirmation cannot verify a JetBrains account. Resource paths and JetBrains OTel import need separately verified contracts/parsers; unsupported coverage stays unknown, not zero or invented CLI attribution. JetBrains is not a mandatory installation dependency of the original three-surface setup. No SQLite migration is needed; existing ownership/state and older account histories remain compatible.

## Fixed upstream evidence

### Handoff reconciliation, 2026-10-12

The original handoff section 1.3 confused shared supplier configuration with per-IDE preferences. Its [JetBrains BYOK article](https://blog.jetbrains.com/ai/2025/12/bring-your-own-key-byok-is-now-live-in-jetbrains-ides/) describes **JetBrains AI Assistant**, not GitHub Copilot. The handoff now retains shared BYOK writes and separate IDE preferences; per-IDE XML is not an alternative supplier-write target.

The fixed Windows x64 update 1190136 was downloaded again: 127292229 bytes, SHA-256 `3cbd534f931872fb9ce6f68e9a7441dfd6513a9ebe6e7d4231bd9e6562c54369`. Its language server retains valid GitHub Authenticode. Static inspection (no upstream execution or real client data) established:

- `BYOKPersistence` uses namespace `byok` and the three supplier keys above; `FilePersistenceManager` reads/writes `<directory>/<namespace>.json`. `getXdgConfigPath` selects the shared root, not an IDE options directory.
- `core-1.19.0-261.jar`, SHA-256 `edba3a5c5ffda524908846f1eb4bc42d859a1eaed3e2f432111bda13c198b85c`, declares `CopilotBYOKGroupNames`, `CopilotBYOKProviderLabels`, `CopilotModelEnabledState`, `CopilotContextWindows` and `CopilotReasoningEfforts` with storage `github-copilot.xml`. These hold per-IDE grouping, labels, disablement and model preferences; XML is not unrelated to BYOK or merely an authentication file.
- `BYOKModelService` fetches `listCustomProviderConfigs`, derives server group names and calls `reconcileLocalGroupNames`. This supports the two-layer interpretation, not a claim that disk publication guarantees picker visibility or clears existing disablement.

The [official XML documentation](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/set-up-copilot/configure-in-ide?tool=jetbrains) documents language enablement and per-IDE paths; it does not document the complete XML BYOK preference schema or a stable external provider-write API. No real IDE XML, Password Safe, authentication store or conversation was opened or modified. CopilotBYOKManager leaves preferences unchanged and requires separate per-IDE official sign-in and runtime acceptance. Locally computed hashes are inspection evidence, not authoritative published checksums. See the [isolated runtime acceptance procedure](local-validation-plan.md#jetbrains-隔离真机验收).

Dashboard source chips verify each owned provider projection independently against persisted proofs and report only its observed model count. Adding another Connection does not remove existing suppliers or select a model in a running IDE. Unknown versions, inaccessible catalogs and changed ownership remain explicit unavailable/changed states.

Verified 2026-10-10 before automatic implementation:

- [Marketplace metadata](https://plugins.jetbrains.com/api/plugins/17718) and [updates API](https://plugins.jetbrains.com/api/plugins/17718/updates?size=10) establish the GitHub identity and fixed distributions.
- [Windows x64 artifact, update 1190136](https://plugins.jetbrains.com/files/17718/1190136/github-copilot-intellij-1.19.0-261-windows-x64.zip): 127292229 bytes; locally computed SHA-256 `3cbd534f931872fb9ce6f68e9a7441dfd6513a9ebe6e7d4231bd9e6562c54369`. This digest is inspection evidence, not an authoritative published checksum. The contained language-server executable passed Windows Authenticode with publisher `GitHub, Inc.`. No plugin/IDE was installed; no live client credentials/configuration were inspected.
- [All-platform 252 artifact, update 1190135](https://plugins.jetbrains.com/files/17718/1190135/github-copilot-intellij-1.19.0-252.zip): fixed 575005627-byte ZIP; bounded range inspection of its central directory, public descriptor/core JARs and Windows x64 language server, not a live-latest test dependency. The descriptor is `1.19.0-252`; inspected core JAR SHA-256 is `ed8f166314b667bb40d65b7c92063dea98ed916e90e226b5fc4ea7a84b666819`. Its Windows language server is byte-identical to 261, SHA-256 `3744f0e4cdce6864b17151f422e49abce76d1fabdb3d8eb336995989ed7b8ee5`, with valid GitHub Authenticode. BYOK capability differences are Kotlin metadata, not fields; provider operations decompile identically and custom-model dispatch fields agree. These are locally computed inspection hashes, not authoritative release checksums. No upstream code was executed.
- Static public artifact inspection of `core-1.19.0-261.jar` BYOK command classes and the signed language server's compressed pkg JavaScript establishes `BYOKPersistence`, `FilePersistenceManager`, `getXdgConfigPath`, the `byok` namespace/key names, save-provider/model fields, protocol values and token/header semantics. The language-server runtime was not executed for this inspection.
- [Custom endpoints](https://github.blog/changelog/2026-07-14-github-copilot-for-jetbrains-expands-byok-capabilities/), [model limits/OTel](https://github.blog/changelog/2026-07-27-github-copilot-for-jetbrains-adds-improvved-opentelemetry-configuration-and-model-management/), [BYOK concepts](https://docs.github.com/en/copilot/concepts/models/bring-your-own-key), and [official sign-in](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/set-up-copilot/install-copilot-extension?tool=jetbrains) establish client capability, not a stable external settings API.
- [Standard directories](https://www.jetbrains.com/help/idea/directories-used-by-the-ide-to-store-settings-caches-plugins-and-logs.html), [plugin content](https://plugins.jetbrains.com/docs/intellij/plugin-content.html), and [descriptor structure](https://plugins.jetbrains.com/docs/intellij/plugin-configuration-file.html) establish public observation conventions.

## Fixtures and acceptance

`plugin-v1.xml` and `plugin-252-v1.xml` are synthetic sanitized metadata matching the inspected ID/vendor/versions. `byok-v1.json` is a synthetic inspected-namespace fixture with fake keys, model metadata and unknown user values. Tests use temporary roots; no real account, client settings, installation or live-latest dependency. Materialized files/journals reuse protected owner/LocalSystem Windows ACLs and Unix 0600 files; the Windows ACL is regression-tested before and after replacement.

Coverage: three protocols, enabled-model filtering, limits/capabilities/headers/key projection, preview non-disclosure, unmanaged/precision preservation, no-op, ownership/revocation, absent keys, unknown versions, duplicate/deep/oversize JSON, unsafe paths, shared write deduplication, one-shot/stale plans, private interrupted recovery and conditional rollback refusal. UI/browser checks exercise automatic review → single-target preview → confirmed ID-only apply, manual/version/account/usage boundaries.

Still required: an isolated current Windows IDE run to validate visibility after restart, real provider requests, policy and multi-IDE sharing. Static upstream inspection and fixture/browser tests are not real runtime or release-ready proof.

The UI retains per-profile publication outcomes and restart/model-selection guidance after the notification disappears. This is a usability improvement to the existing audit data, not additional runtime evidence; the latest browser pass must not be described as a successful IDE request.

Dependencies: `quick-xml` parses bounded public XML without entity resolution; `zip` 6 reads classic descriptor JARs with only the required deflate backend. No new dependency is needed for BYOK JSON projection.
