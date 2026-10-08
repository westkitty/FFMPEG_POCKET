# OPERATIONAL_STATE

project_id: ffmpeg-pocket
project_name: FFmpeg Pocket
revision: 2

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
- verified: repository is public and writable.
- verified: index.html, manifest.json, icon.svg, sw.js, .nojekyll, and Pages workflow exist on main.
- verified: Pages workflow triggered from main.
- failed: run 37741994835 stopped at Configure Pages because the GitHub App token cannot create the repository Pages site; error: Resource not accessible by integration.
- pending: repository owner must enable Pages / select GitHub Actions as the Pages source in repository settings.
- pending: rerun deployment after Pages enablement.
- unknown: physical Chrome-on-iPhone runtime remains device-unverified.

## Failure evidence
- Workflow run: https://github.com/westkitty/FFMPEG_POCKET/actions/runs/37741994835
- Failed step: Configure Pages
- Provider error: Resource not accessible by integration

## Next action
1. Open repository Settings -> Pages.
2. Under Build and deployment, set Source to GitHub Actions / enable Pages.
3. Re-run the failed Pages workflow.
