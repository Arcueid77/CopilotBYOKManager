# Application icons

`icon.png` (128 × 128) and `icon.ico` are the existing application artwork.
`icon.icns` is generated from that PNG with the locked Tauri CLI, without a new
logo or a change to the Windows icons:

```sh
npm exec -- tauri icon apps/desktop/src-tauri/icons/icon.png --output target/release-icons
```

Copy only the generated `icon.icns` into this directory. The generated larger
representations are resampled from 128 pixels, **not** new high-resolution art.
They unblock package testing; a maintainer-approved transparent 1024 × 1024 PNG
or vector source is still needed for crisp Retina distribution. Regenerate with
the official command and inspect all sizes before replacing any icons.
