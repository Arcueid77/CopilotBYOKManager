# Copilot CLI provider registry

Reviewed 2026-10-22. The adapter writes `~/.copilot/providers.json` on Windows, macOS and Linux. Multiple providers coexist, each with all enabled models. Updating or revoking a Connection changes only its scoped group. Manual providers and other Connections remain. Start a new CLI session and choose a model with `/model`; this manager leaves the saved default unchanged. A session without GitHub sign-in can start with `copilot --model <provider>/<model>` using the IDs shown in the publication preview.

## Official provenance

- [GitHub configuration-directory reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference) documents the default path, `providers`/`models`, precedence over legacy `COPILOT_PROVIDER_*`, and `COPILOT_PROVIDERS_CONFIG`.
- The exact reviewed artifact is [@github/copilot-win32-x64 1.0.101](https://www.npmjs.com/package/@github/copilot-win32-x64/v/1.0.101), fetched from the official npm registry without installation scripts. Its SHA-512 integrity is `7PPJYAXevr94eKTdexSDqHNnjIZ7oRuQ+cT0eqEJwlZIYO82znLN18zJLBQATi9Mz/JDISSWR6Z0WOHZgpHJPw==`.
- The extracted `copilot.exe` SHA-256 is `76326203b73b12b5ef02d1061110dc27df52b24fa349f2af4380062fc4f5401b`. The optional smoke script refuses any other binary.
- Its bundled `schemas/api.schema.json` defines `NamedProviderConfig` and `ProviderModelConfig`. An isolated official-CLI run confirmed **arrays**, provider-qualified selection, the actual wire model, custom headers and the fake API key against a loopback HTTP fixture. A map-shaped `providers` is rejected by that CLI. The schema identifier in this adapter is `copilot-cli-registry-1.0.101-v1`.
- [Official SDK heterogeneous-provider E2E test, pinned source](https://github.com/github/copilot-sdk/blob/f2b720c8ec368e035a4d5c72b012fd41b0d533e4/go/internal/e2e/multi_provider_registry_e2e_test.go) covers coexistence and provider-qualified model selection.

## Projection and ownership

`providers` contains named entries with `name`, `type`, `baseUrl`, optional `apiKey`, `headers` and non-Anthropic `wireApi`. `models` contains `id`, `provider`, `name`, `modelId`, `wireModel` and supplied token/vision metadata. Protocol selection maps Chat Completions → `openai/completions`, Responses → `openai/responses`, Messages → `anthropic`; Azure uses `azure` with its selected OpenAI wire API. Local endpoints can omit a key. Explicitly non-tool-calling models are rejected.

The provider name is a stable hash of installation owner and Connection ID. Model display names include the Connection name. Identical upstream model IDs under different providers remain independent. Renaming a Connection updates display names without duplicating its provider. Current configuration observations expose only names, Connection IDs and model counts, with credential redaction; they confer no write authority.

Publication accepts a confirmed scoped update without historical ownership. Revocation checks the durable owner/Connection/physical-resource binding and targets the exact derived provider name. The owned-subset projection and whole-file stale/rollback fingerprints have different jobs. Proofs for other Connections survive publication. A no-op preserves existing bytes; foreign fields and arbitrary-precision numbers are retained.

## Credentials, upgrade and recovery

Only the selected Connection's OS-held provider key is materialized. The registry and transaction journal are private, native-only files. The adapter never reads `config.json`, client sign-in secrets, conversations, CLI OAuth tokens, or executes a credential command found in someone else's provider entry. `settings.json` is not modified.

Republishing a Connection with a durably owned legacy environment route removes that same route in the prepared transaction, after verifying its live ownership markers. Old proofs still support revocation. Other Connections' and independently configured environment routes remain; when the registry becomes empty those routes may become active again. Existing terminals can retain legacy variables; open a new terminal after an upgrade.

The registry is included in native fingerprints, prepare-all writes, before/after journaling, conditional rollback and recovery path allowlists. Invalid/ambiguous JSON, unknown top-level schemas, dangling references, oversized data and linked/reparse paths stop publication. Custom `COPILOT_HOME` or `COPILOT_PROVIDERS_CONFIG` remains unsupported in this slice; the default file is never silently used in its place.

On Unix, writes use mode `600`. If an otherwise byte-identical credential file is readable by other users, publication refuses the no-op and requests owner-only permissions rather than reporting a private write that did not happen.

## Validation layers

Rust fixtures cover coexistence, all enabled models, independent proofs, update/revoke, rename, no-op, protocol/key/header/limit projection, no-key local endpoints, invalid schemas, exact-number preservation, fresh plans and conditional rollback. Browser tests cover bilingual review/confirmation and simulated multi-provider results. Official-CLI loopback tests validate runtime schema/routing with synthetic data. These do not use or alter real client configuration, accounts or provider credentials.

To repeat the pinned Windows runtime smoke, extract the official npm artifact into an isolated folder, then set `COPILOT_BYOK_MANAGER_CLI_TEST_BINARY` to its absolute `copilot.exe` path and run `node scripts/check-cli-registry.cjs`. The script verifies the digest, creates a fresh synthetic home, clears inherited credential variables and uses a fake loopback streaming server. No installation or GitHub authentication is performed. It tests three model selections and one rejected schema, not the real `/model` window or a paid provider request.
