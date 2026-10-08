# OPERATIONAL_STATE

project_id: ffmpeg-pocket
project_name: FFmpeg Pocket
revision: 4

## Current baseline
- Repository: westkitty/FFMPEG_POCKET
- Branch: main
- Delivery: GitHub Pages from main /(root)
- Public app: FFmpeg Pocket browser media utility
- Runtime target: Chrome on iPhone/iPad and other modern browsers
- Media processing: client-side ffmpeg.wasm
- Media upload: none by design
- Tool count: 30

## Protected invariants
- No App Store dependency for FFmpeg Pocket itself.
- No terminal or a-Shell dependency.
- Selected media remains local to the browser.
- Result playback remains available in-page.
- All 30 media tools remain exposed.
- Mobile-first interaction and reduced-motion handling remain intact.
- Existing Pages delivery remains functional.

## PWA state
- verified: manifest declares standalone display, app identity, scope, theme/background colors, categories, and no related native-app requirement.
- verified: PNG app icons exist at 192x192 and 512x512.
- verified: a 512x512 maskable icon exists.
- verified: a 180x180 Apple Home Screen icon exists and is linked from index.html.
- verified: visible Install app control exists.
- verified: beforeinstallprompt/appinstalled handling exists for browsers that expose native PWA installation.
- verified: iPhone/iPad fallback instructions use Chrome Share -> Add to Home Screen.
- verified: standalone-display detection changes the install control to Installed.
- verified: service worker v4 caches the app shell and install assets while retaining network-first app refresh behavior.
- verified: install-script syntax check passed.
- verified: generated raster icon dimensions and RGBA format passed.
- verified: GitHub Pages deployment for PWA cache commit ec791b4ff615c0a8477366a01633bf144d1ca144 completed successfully.
- unknown: physical Chrome-on-iPhone Add to Home Screen flow remains device-unverified.

## Current installation path
### Chrome on iPhone/iPad
1. Open the live FFmpeg Pocket page in Chrome.
2. Tap Install app in the page.
3. Tap Chrome Share.
4. Tap Add to Home Screen.
5. Tap Add.
6. Launch FFmpeg Pocket from the Home Screen icon.

### Browsers exposing native PWA prompts
1. Open FFmpeg Pocket.
2. Tap Install app.
3. Confirm the browser's native install prompt.

## Prior Pages failure evidence
- Historical run 37741994835 failed before Pages was enabled.
- Later native branch-based Pages deployments succeeded.
- Historical failure is superseded and retained only as evidence.

## Remaining proof
- Run the Home Screen-installed app on Greyson's physical iPhone in Chrome and confirm standalone launch plus one representative media job.
