# CopilotBYOKManager documentation

Start with the product overview in [English](../README.md) or [简体中文](../README.zh-CN.md). Full setup and everyday-use instructions are in the [English user guide](user-guide.md) / [中文用户手册](user-guide.zh-CN.md). The [current implementation status](implementation-status.md) distinguishes reviewed code, simulated previews and outstanding real acceptance.

## Release and user documentation

| Document | Purpose |
| --- | --- |
| [English user guide](user-guide.md) / [中文用户手册](user-guide.zh-CN.md) | Four pages, provider fields, model discovery, client follow-up, revoke/recovery and FAQ |
| [Release engineering](release-engineering.md) | English v0.1 scope, reproducible Windows/macOS builds, dry-run/Draft/publish and artifact checks |
| [Apple secrets and acceptance](release-secrets.md) | Maintainer-only account/credential/environment setup, real Intel/Apple Silicon/Windows checks |
| [Release notes template](release-notes-template.md) | Version/SHA-bound download, signing, client, privacy and pending-acceptance disclosures |
| [Screenshot provenance](images/README.md) | Current browser UI, simulated data, reproduction and privacy limits |

The first release is the four-page v0.1 core, not the complete extended MVP. The release gates and local validation procedures below are **in Chinese**; the English engineering and Apple guides explain the operational steps and remaining acceptance in English. Hidden feature acceptance stays deferred, not PASS.

## Current contracts and implementation

| Document | Purpose |
| --- | --- |
| [MVP implementation specification](mvp-implementation-spec.md) | Normative scope, state semantics and final acceptance criteria |
| [Architecture](architecture.md) | Current modules, trust boundaries, storage and required invariants |
| [Adversarial review](adversarial-review.md) | Failure cases and required mitigations |
| [Security policy](../SECURITY.md) | Private reporting and sensitive-data rules |
| [Agent entry point](../AGENTS.md) | Development workflow, product identities and required checks |
| [Local validation](local-validation-plan.md) | Browser, isolated native, host-observation and clean-Windows procedures |
| [Release criteria](release-criteria.md) | First-release gates, evidence, decision record and incident handling |
| [Promotion plan](promotion-plan.md) | Audience, positioning, staged outreach and opt-in feedback |
| [Interface localization](localization.md) | English/Chinese behavior and contributor checks |
| [Feature availability](feature-availability.md) | Four-page core edition, hidden capabilities and unfinished delivery work |

## Client and source contracts

| Document | Purpose |
| --- | --- |
| [JetBrains support](jetbrains-support.md) | Reviewed plugin versions, automatic shared BYOK writes and per-IDE acceptance |
| [VS Code detection](vscode-detection.md) | Versioned launcher/capability detection and no-surprise-window behavior |
| [Provider model discovery](provider-model-discovery.md) | Connection form, read-only catalog queries and saved-key binding |
| [Usage sources](usage-sources.md) | Runtime quota, personal Billing, local import, prices and coverage limits |
| [Deployment and operation hardening](hardening-handoff.md) | Ownership, Resources, pinned installations and account lifecycle |

Upstream review dates and fixed versions in these documents are provenance, not promises of compatibility with every newer release. The current status page does not replace adapter-specific contracts.

## Design and historical records

- [Approved interactive prototype](../prototype/copilot-byok-manager.html) and [implementation handoff](../prototype/handoff-prompt.md): approved product semantics and layout. The implemented web frontend is authoritative for current interaction behavior.
- [September hardening record](hardening-2026-09.md): historical slice; its remaining-work list is not the current backlog.
- [P0/P1 handoff](p0-p1-handoff.md): historical 2026-09-10 evidence; earlier navigation, default target selection, and Resources status have been superseded.

Use the [current status](implementation-status.md) before continuing work from an older handoff. Keep original test counts, dates and evidence limits attached to their original run.
