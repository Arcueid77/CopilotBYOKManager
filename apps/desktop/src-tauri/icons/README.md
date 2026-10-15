# Application icons

The maintainer requested a new application icon and a recognizable Copilot
reference on 2026-10-15. The artwork combines a Copilot-inspired robot/goggle
outline with a key on an indigo tile: a bring-your-own-key manager for Copilot
clients. This adapted project icon does not imply GitHub or Microsoft
affiliation, sponsorship or endorsement; their marks remain their property.

## Source and exports

- `icon-source.png`: original high-resolution, square, transparent PNG created
  with the built-in image-generation tool (not the API/CLI fallback).
- `icon.png`: official Tauri 512px export, used by packaging and the READMEs.
- `icon.ico`: official multi-size Windows export, including 16/32/256px.
- `icon.icns`: official Mac export, including the 1024px Retina representation.
- `../../web/assets/app-icon.png`: official 256px export, used by the app header
  and browser favicon. It is packaged locally; no remote image is fetched.

Regenerate with the repository's locked CLI from the repository root:

```sh
npm exec -- tauri icon apps/desktop/src-tauri/icons/icon-source.png --output target/icon-refresh
```

Copy `icon.png`, `icon.ico` and `icon.icns` from that output into this directory;
copy `128x128@2x.png` to `apps/desktop/web/assets/app-icon.png`. Keep the original
source, preserve alpha and inspect the 16/32px Windows sizes and Mac Retina
representation. Do not commit the CLI's unrelated Android/iOS/Appx exports.
`npm run test:release` checks the raster headers and required ICO/ICNS sizes.
The Windows tray uses the same default application icon without changing its
close/restore/quit behavior.

## Final edit prompt

The edit used the initial indigo key/routing icon as its visual reference and
replaced only the white emblem. The original tile and transparent outer margin
were preserved. The built-in image-generation tool was used for both steps.

```text
Use case: precise-object-edit / logo-brand
Asset type: production app icon for CopilotBYOKManager, an independent provider/API-key manager for GitHub Copilot clients.
Input image: edit target. Preserve its indigo rounded-square tile, straight-on orientation, dimensions, subtle enamel depth, generous margins, and true transparent alpha outside the tile.
Requested change: replace ONLY the white routing/key symbol with a clean, instantly recognizable Copilot-related emblem. The dominant shape should be a friendly compact coding-assistant robot head with the distinctive two large rounded rectangular aviator-goggle lenses, a connecting bridge and short side earpieces that people associate with GitHub Copilot. White/off-white outline with indigo negative space in the lenses, simple lower face/head contour. Integrate one short unmistakable key stem with two teeth into the lower-right of the head silhouette, so the overall mark reads Copilot plus bring-your-own-key. The robot/goggles must remain the dominant focal point, the key a subordinate integrated element, not a separate sticker.
Composition: one centered integrated white emblem filling roughly 65 percent of the opaque tile. Bold, balanced geometry, strong open negative space, readable at 16/32 pixels. No tiny eyes, mouth, circuit lines, intricate detail, branch diagram or extra symbols.
Keep the original background/tile and restrained visual finish unchanged. No text, letters, official badge, seal, watermark, extra icons, mockups, or perspective. Transparent background stays genuinely transparent. Output only the finished app icon.
```
