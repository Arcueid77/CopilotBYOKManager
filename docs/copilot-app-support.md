# Copilot App operation flow

Updated 2026-11-01. User instructions: [English](user-guide.md#copilot-app) / [中文](user-guide.zh-CN.md#copilot-app). The manual flow was reviewed against `dcc5a8f`; the current source also implements the [experimental SQLite contract](copilot-app-sqlite-sync.md).

## Experimental automatic flow

**Enable sync** saves the local preference on a compatible installation. After enablement the App is a standard publish target. First publication for a provider confirms the destination and storage scope in the regular publish dialog. The native plan binds the App build and database, stages recovery metadata before writing and records the approved provider scope after the checked write.

Published providers sync compatible saved changes. Changes to endpoint, protocol, headers or credential mode require a fresh publication review. Quit the App before publishing, and review model references in the same publication preview before removing models.

The application details offer the sync switch and separate owned-configuration revocation. Current configuration and publication history use the shared client display.


## Manual fallback

The sections below apply with experimental sync off or to Connections outside its selected scope.

## Entry points

| Entry | Operation |
| --- | --- |
| Apps → GitHub Copilot app → Provider to configure manually → Manual setup | Open the guide for the chosen provider |
| Latest deployment → Manual setup for a named provider | Open the guide for the provider recorded in that publication |
| Overview → View app | Locate the App card and its local confirmation records |
| Apps → Installation and updates | Detect or review installation of the supported Windows App component |
| Apps → Sign-in and account checks (optional) | Review official account steps separately from provider setup |

Only providers with **Allow publishing** enabled appear in the manual-setup selector. Selecting one chooses the guide to open; the active provider and model are selected inside the App.

## Guide and confirmation

1. Open the guide for a saved provider. It shows the provider name, endpoint and recommended upstream model ID.
2. The manager reads local confirmation metadata and checks that the guide still matches the provider's update time. The confirmation button stays disabled during this read.
3. In the App's **Model providers**, add or update the provider, enter its API key if required, choose a model and check a request. Additional model IDs can be looked up in the manager's provider editor; the guide itself shows the recommended model.
4. Select **I completed manual setup**. The request contains the Connection ID, the native revision returned by the metadata read and explicit confirmation.
5. Native code rechecks the provider revision, writable state, write exclusion and pending recovery journal. A stale guide or failed write keeps the confirmation unsaved.
6. On success the dialog closes, a provider-named notification appears, and Overview/Apps refresh the local record. Closing the guide earlier leaves its confirmation unchanged; configuration already saved in the App remains there.

The guide uses the App's reviewed `Model providers` runbook. The manager does not retrieve the saved key for this guide; enter the provider key in the App if required.

## Record states

| Native state | Interface | Next action |
| --- | --- | --- |
| `notConfirmed` | No chip for that provider; the App card offers manual setup | Configure the provider and confirm |
| `userConfirmed` | Provider name · **Confirmed by you / 你已确认** | Use the provider/model selected in the App |
| `configurationChanged` | Provider name · **Confirm updated configuration / 修改后待确认** | Check or update the App entry, reopen the guide and confirm again |
| Metadata read failed | **Manual setup records could not be read / 手动配置记录读取失败** on the card, or a retry message in the guide | Close the guide, refresh and retry; handle any displayed storage/recovery issue |

Records are keyed by Connection ID. Confirming B preserves A's record; a newly created provider with the same display name has its own identity. Current revisions fingerprint the whole Connection, including its update time and publishing flag. Saving provider edits or toggling **Allow publishing** therefore invalidates an existing confirmation. If the App entry already matches, review it and confirm again. There is no time-based expiry for these provider records.

When the reviewed App catalog is available, the card shows its current provider names and model counts. The manual-only flow displays separate user-confirmation records. If you edit a manually confirmed provider, check the entry in the App and record a fresh confirmation.

## Mixed publication

The App is unchecked by default in the provider's target selector. When it is explicitly included alongside an automatic target, its operation is manual and the publication result records it as `skipped` (**Not processed automatically / 未自动处理**). The result retains a link to that exact provider's guide. Completing manual setup updates the separate confirmation record; it does not rewrite the original publication history as an automatic write.

An App-only selection has no supported automatic operation, so the publish button is disabled. Use the App card's **Manual setup** action for that workflow.

## Updates, pause and removal

| Action | Manager behavior | App behavior |
| --- | --- | --- |
| Save provider edits | Existing confirmation becomes changed; reopen its guide | Update the corresponding App entry yourself |
| Pause publishing | Provider leaves the manual-setup selector; its record follows the revision change | Existing App configuration remains |
| Stop managing only | Provider and publication records are removed; its confirmation is no longer shown | Remove the App entry yourself if desired |
| Revoke and delete | Normal reviewed revocation covers owned automatic targets, then removes the provider | Remove the App entry and its stored key inside the App |

A manual confirmation creates no App ownership proof. With experimental sync enabled, the user can separately select a manually entered BYOK group in **Apps → Manage configuration** and confirm deletion from the App. Confirmation metadata for deleted Connections is filtered from reads and pruned on a subsequent confirmation save.

## Storage and implementation

`setup_preferences` in the existing SQLite database stores a bounded `manualProviders` map of revisions and optional UTC confirmation times. An exact match can retain an older single confirmation without inventing a timestamp. State remains v2 and SQLite remains v3. Malformed, future-dated or excessive records fail explicitly. Confirmation metadata contains no App configuration, key, login token or conversation.

Relevant code:

- [App discovery and manual preview](../apps/desktop/src-tauri/src/adapters/github_app.rs)
- [Native confirmation records and guards](../apps/desktop/src-tauri/src/setup/manual.rs)
- [Guide and manual-setup action](../apps/desktop/web/app.js)
- [App states](../apps/desktop/web/client-presentation.js) and [Overview/publication follow-ups](../apps/desktop/web/manager-ui.js)

Temporary-database tests cover independent records, reopen, revision changes, old records, stale confirmation and invalid metadata. Web fixtures cover record presentation, exact-provider follow-ups and escaping. Actual App sign-in, model selection and provider requests remain tracked in [implementation status](implementation-status.md) and [local validation](local-validation-plan.md).
