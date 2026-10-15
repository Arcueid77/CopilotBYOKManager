# Current-interface screenshot provenance

Captured 2026-10-15 from `apps/desktop/web/`, based on application source `83a82db3555eb0defa278bd6e042b7c55a76088f` plus the release/documentation changes in this candidate. These are **browser fallback previews with simulated data**, not native client or provider-request acceptance.

| Files | View |
| --- | --- |
| `overview-en.png`, `overview-zh-CN.png` | Four-page Overview, light theme |
| `provider-en.png`, `provider-zh-CN.png` | Provider editor, light theme |
| `publication-en.png`, `publication-zh-CN.png` | Inline publication review, dark theme; cropped to the review section |

The fixture uses `Example Provider`, `https://api.example.com/v1`, fictional model IDs, empty API key, synthetic app labels and no personal paths/accounts. The current UI and captured review identify browser/demo state. No native bridge, real configuration write, model request or login is used. Screenshots are documentation assets, not stale prototype mockups.

Reproduce with an already installed Playwright module and browser executable:

```powershell
$env:COPILOT_BYOK_MANAGER_PLAYWRIGHT = '<absolute path to the installed playwright module>'
$env:COPILOT_BYOK_MANAGER_BROWSER = '<absolute path to a supported Chromium browser>'
node scripts/capture-readme.cjs
```

The script serves only the current frontend on an ephemeral localhost port, uses fresh isolated browser contexts, blocks non-local requests and records three views in each language. It does not install a browser or access a normal browser profile. Inspect all six images for layout/privacy after changes. Keep the preview disclosure in README; replace them with native screenshots only after separately authorized, sanitized native acceptance.
