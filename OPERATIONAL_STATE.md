# OPERATIONAL_STATE

project_id: ffmpeg-pocket
project_name: FFmpeg Pocket
revision: 3

## Current baseline
- Repository: westkitty/FFMPEG_POCKET
- Branch: main
- Artifact: root-hosted browser app
- Intended delivery: GitHub Pages
- Preferred Pages mode: Deploy from a branch -> main -> /(root)
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
- verified: repository is public and writable.
- verified: index.html, manifest.json, icon.svg, sw.js, .nojekyll, and workflow files exist on main.
- verified: custom Pages workflow was reduced to manual-only to avoid repeated failed automatic runs.
- verified: repository root is suitable for branch-based Pages publishing.
- pending: repository owner must select Settings -> Pages -> Deploy from a branch -> main -> /(root) -> Save.
- unknown: final public Pages URL has not yet been observed live.
- unknown: physical Chrome-on-iPhone runtime remains device-unverified.

## Prior failure evidence
- Workflow run: https://github.com/westkitty/FFMPEG_POCKET/actions/runs/37741994835
- Failed step: Configure Pages
- Provider error: Resource not accessible by integration

## Next action
1. Open repository Settings -> Pages.
2. Under Build and deployment, set Source to Deploy from a branch.
3. Set Branch to main.
4. Set Folder to /(root).
5. Save.
6. Verify https://westkitty.github.io/FFMPEG_POCKET/
