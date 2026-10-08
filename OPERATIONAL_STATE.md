# OPERATIONAL_STATE

project_id: ffmpeg-pocket
project_name: DEX//CUT (formerly FFmpeg Pocket)
revision: 8

## Current baseline
- Repository: westkitty/FFMPEG_POCKET
- Branch: main
- Delivery: GitHub Pages from main /(root)
- Runtime: Chrome on iPhone and other modern browsers
- Processing: local ffmpeg.wasm single-thread core @ffmpeg/core@0.12.10
- Tool count: 30

## Protected invariants
- No App Store dependency, a-Shell, terminal, user account, or media upload.
- PWA installation, Home Screen icon, offline shell, and in-app output playback remain in place.
- All 30 media tools remain exposed. Chained editing and Share/Save remain available.
- Device-specific claims require device-specific evidence.

## 2026-10-08 repair pass
- Fixed Keep the ending and Cut a clip to accurately re-encode the requested section rather than seeking via stream copy.
- Fixed audio-only trim output extension to .m4a.
- Compression now uses source duration and size to target a reduction without upscaling. A non-shrinking result is rejected with honest feedback.
- Pixelate now preserves parsed source dimensions.
- Track preflight inspects streams before audio-dependent tools execute; silent videos are correctly classified and produce clear guidance.
- Temporary FFmpeg input/output paths are cleaned in both success and failure cases.
- Added an opt-in on-device 30-tool test dialog using synthetic sample media; report stays on device and may be copied.
- Service worker v5 caches the sample and retains network-first updates.

## Verification evidence
- PASS: 30 unique tool definitions and 30 command implementations.
- PASS: 100 mobile-sized Chromium UI cases across video, audio, and silent-video inputs (no page errors or overflow).
- PASS: 46/46 desktop native FFmpeg output tests and semantic assertions, including accurate 10-second ending and 5-second clip, source dimensions, and source-size compression guard.
- PASS: 30/30 simulated-engine runs of the new on-device tester, with output browser decoding; this tests the harness and does NOT prove ffmpeg.wasm execution.
- VERIFIED: 30/30 commands executed by @ffmpeg/core WASM in headless Brave on macOS ARM64, with stream probes and browser decoding of every result.
- VERIFIED: actual user-flow Mute -> inline playback -> download -> continue-editing -> JPEG preview, and offline conversion after initial CDN cache, all in headless Brave.
- UNVERIFIED: those same 30 operations on the actual iPhone/installed PWA.
- UNVERIFIED: realistic phone storage/memory limits, long reverse/boomerang clips, iOS Chrome Share behavior on the device.
- VERIFIED IN BRAVE: offline PWA shell and FFmpeg conversion after the core was downloaded and cached.
- UNVERIFIED ON IPHONE: offline FFmpeg processing and iOS background/lifecycle behavior.

## 2026-10-08 browser-native verification
- Source commit: ccb7e4d8bfd91af25e8dd3ab68648d46d61d35d5
- Actual FFmpeg.wasm browser run: 30/30 PASS in desktop headless Brave; 0 browser page errors.
- Repaired device-test fixture byte-size accounting and explicit audio input paths.
- Native desktop regression: 46/46; mobile UI regression: 100/100.
- Release evidence: QA_REPORT.md and tests/wasm_browser_results_2026-10-08.json.
- Crucial boundary: physical iPhone Chrome/WebKit verification remains pending; never equate desktop Chromium with iOS.

## Decisive next proof
Open the installed FFmpeg Pocket PWA on the target iPhone. Tap 'Verify tools on this device' (or use ?verify=1). Run the 30-tool check while online, then Copy report. A per-tool PASS requires nonempty decoded media and expected semantics. Do not upgrade to iPhone-certified until that actual device report is observed.

## Prior deployment failure
Historical custom GitHub Actions Pages enablement failed; branch-based Pages publishing subsequently succeeded. It is unrelated to current tool behavior.

## 2026-10-08 DEX//CUT rebrand and release evidence
- The product name is DEX//CUT; the repository and Pages URL retain FFMPEG_POCKET for compatibility with existing links.
- Canonical Dexter artwork, the DEX//CUT poster, icons, typography, interaction copy, PWA manifest, and app-shell cache are updated.
- All 30 original tool definitions, command handlers, and the device-verification engine remain available. The diagnostic has a prominent entry point and preserves ?verify=1 and Copy report.
- A cancellation-generation guard now prevents stale engine startup or late worker results from overriding the UI after cancellation or immediate retry.
- Automated accessibility audit: zero WCAG A/AA violations across landing, tool, verification, and installation dialogs.
- Post-rebrand desktop Brave/macOS ARM64: 30/30 real FFmpeg.wasm device diagnostic, normal mute/playback/save/continue/JPEG workflow, 4 responsive viewports, cancelled-startup and immediate-retry scenarios all PASS.
- Performance is measured against original commit 0cc2943; a secondary-resource/page-load cost is documented rather than concealed.
- Physical iPhone installed-PWA verification remains pending. See QA_REPORT_DEXCUT.md; no desktop result is iPhone certification.

## 2026-10-08 high-resolution artwork correction
- The screenshot-confirmed pixelation arose from a 3.7 KB, 480 × 572 atlas with individual 160px artwork cells. That source is now superseded.
- Master source-of-truth PNGs are preserved under `assets/source/`: expression 1254², poster 1731×909, wordmark 2172×724, PWA icon 1254².
- Active web assets are versioned `-v2`: 1254² WebP expression atlas (627px per sprite cell), 1731×909 WebP poster, 2172×724 WebP wordmark, native-resolution PWA/touch icons and favicon.
- CSS sprite state mapping is 2×2 via 200% background-size. Desktop maximum displayed mascot is 310px, retaining >2 source pixels per CSS pixel.
- `dexcut-app-v2` cache revision is required so previous installed PWAs refresh their cached shell and images. Never promote a low-resolution social thumbnail into canonical master artwork.
- A persistent `tests/dexcut_artwork_qa.cjs` guard verifies 12 source/export SHA hashes, dimensions, browser decoding and 4 responsive DPR-3 viewports. See `assets/README.md`.
- Protected 30 tools and device verification logic remain unchanged. Full candidate browser and FFmpeg.wasm tests passed on Big Mac; **actual physical phone verification remains unknown** until run on-device.
