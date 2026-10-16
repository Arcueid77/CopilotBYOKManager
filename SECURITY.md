# CopilotBYOKManager security policy

CopilotBYOKManager manages developer-tool configuration, may launch allowlisted application installers, orchestrates official GitHub sign-in flows, stores a separate GitHub personal-usage authorization, and reads local usage metadata. Treat reports and diagnostic files as potentially sensitive.

The v0.1 four-page core edition does not expose or automatically query Usage, Billing, separate personal-usage authorization or Resources. Their existing data and backend security contracts remain protected; the sections below cover retained code as well as currently exposed features.

The product has not had a public release. Its dedicated configuration directory and credential namespace are not permission to adopt other applications' secrets or client authentication material.

## Do not publish secrets or private workspace content

Do not include any of the following in a public issue, discussion, screenshot, or log attachment:

- API keys, GitHub tokens, authorization headers, device codes, cookies, or refresh tokens;
- browser profile data, VS Code SecretStorage data, Copilot CLI authentication files, or GitHub Copilot app credential data;
- JetBrains Password Safe data, Copilot authentication settings, raw `github-copilot/byok.json`, private rollback snapshots, or IDE conversation/debug logs;
- full environment dumps;
- complete VS Code, Copilot CLI, or Copilot app configuration files when they contain materialized credentials;
- raw Copilot session or Agent Debug Log files;
- prompts, assistant responses, tool arguments/results, source-code excerpts, repository contents, or private absolute paths;
- unredacted installer output that includes a username, home directory, proxy credential, or access token.

Use synthetic credentials and a minimal temporary fixture whenever possible.

## Reporting a vulnerability

Use the [repository security page](https://github.com/Arcueid77/CopilotBYOKManager/security) and report suspected vulnerabilities privately through GitHub's private vulnerability reporting feature when enabled. Do not open a public proof of concept before the maintainer has had a reasonable opportunity to investigate.

Reports are especially valuable for:

- credential or token disclosure;
- extraction or copying of client authentication material;
- command, argument, deep-link, or installer injection;
- execution of a non-allowlisted package or asset;
- release redirect, digest, or publisher-validation bypass;
- unsafe elevation behavior;
- path traversal, symlink, junction, or reparse-point bypass;
- unsafe file replacement, ownership bypass, or rollback corruption;
- cross-account sign-in confusion;
- a Copilot runtime quota or GitHub Billing permission/schema/error being represented as zero usage;
- AI-credit and premium-request unit confusion;
- usage-log ingestion that stores prompt, response, tool, code, environment, or credential content;
- usage double counting, cursor corruption, or shared CLI/app deduplication failure;
- incorrect price snapshot selection that materially misstates historical cost;
- secrets appearing in frontend errors, audit records, tracing, panic output, or database rows.

## What to include

Include:

- the CopilotBYOKManager commit;
- operating system, architecture, and relevant client versions;
- the affected logical surface and physical target/profile;
- whether the issue occurs during detection, preview, install, sign-in, deployment, Billing refresh, usage sync, pricing, or rollback;
- a minimal reproduction using fake credentials and temporary files;
- expected versus actual behavior;
- whether another process edited the target or an operation was interrupted;
- redacted status codes, package/asset identity, parser/schema version, and timestamps when relevant;
- whether the problem is deterministic.

Do not attach a real token or raw session log. Extract the smallest synthetic record that reproduces the issue.

## Credential handling expectations

- Connection API keys and CopilotBYOKManager's least-privilege personal-usage GitHub token use separate operating-system credential-store references.
- CopilotBYOKManager must never import client-owned OAuth tokens, cookies, passwords, passkeys, or credential databases.
- Credential-store failure must be distinguishable from a missing credential.
- Redaction must occur before errors or progress events cross into the frontend.
- URL, header, process, tracing, and panic diagnostics must be tested for secret leakage.
- Editor focus/dirty-state tracking must not copy field values or serialize passwords into drafts. Closing a credential dialog clears its password fields; failed saves retain input only in the current editor.

## Installer handling expectations

These rules concern **third-party client/component installers launched by the manager**, not an Authenticode requirement on the manager's own first Windows package.

- Install operations are selected by native, compiled allowlists.
- The frontend and remote metadata cannot supply an executable command line.
- Downloaded GitHub Copilot app assets must pass bounded-download, architecture, digest when available, and expected-publisher validation before launch.
- Redirects must remain inside a documented allowlist and must never downgrade transport security.
- Installation success is confirmed by post-install rediscovery, not by process exit code alone.
- CopilotBYOKManager does not automatically uninstall or downgrade applications as rollback.

## Manager release artifacts

- The Windows x64 NSIS/standalone community build is explicitly **Unsigned community build**. Authenticode is not required for v0.1; do not imply a verified Windows publisher or instruct users to disable SmartScreen.
- Formal macOS Universal DMGs require Developer ID Application, Hardened Runtime, notarization and stapled tickets. Ad-hoc/not-notarized testing artifacts are named separately and cannot be promoted as formal packages.
- Check the precise source SHA, version, architecture and SHA-256 list. A checksum verifies agreement with the published bytes, not authorship by itself or runtime correctness.
- Draft-first publication verifies the complete asset set, downloads and checks hashes before public promotion, and refuses already-public asset replacement. No auto-updater is enabled.
- P12/P8 files, certificate passwords, private signing identities, API identifiers and signing-key material must never appear in the repository, reports or attachments. Secrets belong only in the maintainer's protected release environment; see [release secrets](docs/release-secrets.md).
- Standalone ZIPs can write app state, OS credentials and client configuration outside their folder. Uninstalling the manager must not remove unrelated/client configuration.

## Sign-in expectations

- CopilotBYOKManager launches official client/browser/device sign-in flows only.
- It may compare non-secret account observations, but must not copy authentication state between applications.
- Verified, inferred, user-confirmed, unknown, unsupported, and conflict states remain distinct.
- Conflicting verified accounts block automatic completion; CopilotBYOKManager does not silently sign a client out.

## Official usage and Billing expectations

- Runtime quota, GitHub personal Billing data, and locally observed token usage remain separate datasets.
- Unauthorized, forbidden, unsupported, stale, schema-error, network-error, not-covered, successful-empty, and zero are distinct states.
- AI credits and legacy premium requests are never added together.
- Personal Billing data is not presented as organization or enterprise coverage.
- GitHub actual amounts and locally calculated API-equivalent estimates are labeled and stored separately.

## Usage-data expectations

- Usage collection stores metadata only: client/source identity, model, route attribution, token buckets, timestamps, coverage, and price-snapshot references.
- Raw prompt, response, tool, code, environment, cookie, or authentication content is not persisted.
- Missing token fields remain unknown rather than becoming zero.
- Importers are bounded, incremental, idempotent, and resilient to active/incomplete final log lines.
- Shared runtime data must not be counted once as CLI usage and again as Copilot app usage.

## Pricing expectations

- Money and rates use exact decimal/fixed-point arithmetic.
- Historical estimates bind to immutable price snapshots.
- Unknown or ambiguous model aliases and pricing tiers produce partial/unavailable estimates, not fabricated zero-cost rows.
- Current-price comparisons may be calculated separately but must not rewrite historical estimates.

## Supported status

CopilotBYOKManager is pre-release. Security fixes are applied to `main`; there is not yet a stable-version support matrix.
