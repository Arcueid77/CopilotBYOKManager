# Application icons

The maintainer requested a new application icon on 2026-10-15. The artwork uses
one white key/routing symbol with three branches on an indigo tile: configure
one provider, then publish to multiple clients. It is not a GitHub, Microsoft
or client logo and does not imply their endorsement.

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

## Final generation prompt

```text
Use case: logo-brand
Asset type: production desktop application icon for CopilotBYOKManager, a local tool to configure one provider/API key and safely publish it to several Copilot clients.
Primary request: design a completely new, original, memorable application icon expressing one key, multiple connections. One single bold white key-shaped routing emblem: a large clean hollow ring connects through a short stem to three substantial rounded branches/endpoints. Treat it as one integrated symbol, not a diagram or collection of tiny icons. Strong silhouette readable at 16 and 32 pixels.
Style/medium: polished restrained desktop app icon, precise simple geometry, gently tactile enamel finish, minimal detail. Use the existing app's indigo/periwinkle accent palette (#7c8cff) with a deep indigo tile and an ivory-white emblem. Subtle controlled tonal depth, no neon effects.
Composition/framing: one centered icon only, straight-on orthographic view, square 1024x1024 image. A rounded-square icon tile fills about 86 percent of the canvas with even transparent margin, smooth crisp corners. Emblem comfortably centered with generous internal padding and bold consistent stroke thickness. No mockup or device frame.
Background: true transparent alpha outside the rounded-square tile, no checkerboard baked into pixels. Tile itself opaque.
Constraints: no text, letters, watermark, gradients with rainbow colors, sparkles, tiny circuits, padlock overlay, robot face, GitHub Copilot or Microsoft branding, duplicate icons, perspective, or surrounding scene. This is one final app icon asset, not a presentation sheet.
```
