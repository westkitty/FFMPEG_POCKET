# OPERATIONAL_STATE

project_id: ffmpeg-pocket
project_name: FFmpeg Pocket
revision: 1

## Current baseline
- Repository: westkitty/FFMPEG_POCKET
- Branch: main
- Artifact: root-hosted browser app
- Intended delivery: GitHub Pages
- Runtime target: Chrome on iPhone/iPad and other modern browsers
- Media processing: client-side ffmpeg.wasm
- Media upload: none by design

## Protected invariants
- No App Store dependency.
- No terminal or a-Shell dependency.
- Selected media remains local to the browser.
- Result playback remains available in-page.
- 30 media tools remain available.
- Mobile-first interaction and reduced-motion handling remain intact.

## Verification state
- current-baseline: site source copied to repository root.
- verified: repository is public and writable.
- verified: index.html, manifest.json, icon.svg, sw.js, and .nojekyll exist on main.
- pending: GitHub Pages deployment must complete successfully.
- unknown: physical Chrome-on-iPhone runtime remains device-unverified.

## Pending
- Confirm Pages is enabled.
- Confirm deployment workflow succeeds.
- Confirm final public URL serves FFmpeg Pocket.
