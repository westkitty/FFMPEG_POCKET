# OPERATIONAL_STATE

project_id: ffmpeg-pocket
project_name: FFmpeg Pocket
revision: 5

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
- UNVERIFIED: all 30 commands executed by @ffmpeg/core WASM on Greyson's actual iPhone/installed PWA.
- UNVERIFIED: realistic phone storage/memory limits, long reverse/boomerang clips, iOS Chrome Share behavior on the device.
- UNVERIFIED: offline FFmpeg engine availability until it has been downloaded and cached once.

## Decisive next proof
Open the installed FFmpeg Pocket PWA on the target iPhone. Tap 'Verify tools on this device' (or use ?verify=1). Run the 30-tool check while online, then Copy report. A per-tool PASS requires nonempty decoded media and expected semantics. Do not upgrade to iPhone-certified until that actual device report is observed.

## Prior deployment failure
Historical custom GitHub Actions Pages enablement failed; branch-based Pages publishing subsequently succeeded. It is unrelated to current tool behavior.
