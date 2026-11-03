# Interface screenshot provenance

Captured 2026-11-03 from the 0.2.3 release-candidate `apps/desktop/web/` source, based on `f96970c` plus the reviewed workspace changes. These are **browser fallback previews with simulated data**. Exact package source is recorded in Release metadata.

| Files | View |
| --- | --- |
| `overview-en.png`, `overview-zh-CN.png` | Four-page Overview, light theme |
| `provider-en.png`, `provider-zh-CN.png` | Provider editing drawer, light theme |
| `publication-en.png`, `publication-zh-CN.png` | Shared publication dialog and native-plan-controller review, dark theme |

The fixture uses `Example Provider`, `https://api.example.com/v1`, fictional model IDs, empty API key, synthetic app labels and no personal paths/accounts. The current UI and captured review identify browser/demo state. No native bridge, real configuration write, model request or login is used.

Reproduce with an already installed Playwright module and browser executable:

```powershell
$env:COPILOT_BYOK_MANAGER_PLAYWRIGHT = '<absolute path to the installed playwright module>'
$env:COPILOT_BYOK_MANAGER_BROWSER = '<absolute path to a supported Chromium browser>'
node scripts/capture-readme.cjs
```

The script serves only the current frontend on an ephemeral localhost port, uses fresh isolated browser contexts, blocks non-local requests and records three views in each language. It also checks the packaged icon and sidebar bounds in 18 combinations: English/Chinese, Light/Dark/System and 960/1180/1440px widths. No browser is installed and no normal browser profile is accessed. Inspect all six images for layout/privacy after changes. Keep the preview disclosure in README.

For isolated layout and interaction checks, run `node scripts/check-workspace.cjs` (also available through `check-layout.cjs`) with the same browser/module settings. `COPILOT_BYOK_MANAGER_CAPTURE_DIR` selects a unique output prefix under which captures are created; the default is ignored `target/workspace-review-*`. `--capture-only` captures the four pages without submitting fixture actions. The normal suite uses an in-memory synthetic native API, covers grouped instances, model saving, explicit CLI review, App sync consent, current-state errors and shared app naming, plus English/dark 1180×760 and 960×640 layouts. It never connects to a real native bridge, installs software, sends provider requests or reads real client configuration.
