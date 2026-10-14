# CopilotBYOKManager documentation

Start with the user manual in [English](../README.md) or [简体中文](../README.zh-CN.md) for setup and everyday use, then the [current implementation status](implementation-status.md) for coverage, validation evidence and remaining acceptance work.

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
