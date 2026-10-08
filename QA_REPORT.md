# FFmpeg Pocket — bounded repair verification

**Date:** 2026-10-08  
**Repository:** `westkitty/FFMPEG_POCKET`  
**Scope:** Repair incorrect cuts, non-shrinking compression, pixelation dimensions, missing-audio behavior and failure cleanup; preserve the installed PWA and all 30 tools.

## Evidence tiers

| Test | Outcome | What it proves |
|---|---|---|
| JavaScript + service-worker syntax | PASS | Parsed locally by Node |
| Mobile browser control matrix | 100/100 PASS | Every tool opens/updates correctly across audio, video, silent-video and longer-video inputs at 390×844 (desktop Chromium mobile emulation) |
| Native FFmpeg executions | 46/46 PASS | 30 video tools + 10 audio-only paths + 6 longer/silent-video cases produce valid media |
| Semantic assertions | PASS | Accurate 10-second ending, 5-second clip, compressed output smaller, pixelate retains dimensions, correct audio/video stream composition |
| Simulated-engine device-test workflow | 30/30 PASS | Diagnostic UI loops, checks, creates playable previews and completes correctly with prerecorded test media |
| Actual WebAssembly on iPhone PWA | NOT RUN | Cannot be certified without the target device |
| iOS memory, storage, offline cold start | NOT RUN | Requires phone observation |

## Tool inventory

1. Keep the ending
2. Cut a clip
3. Make it smaller
4. Save just the audio
5. Mute
6. Make a GIF
7. Resize
8. Rotate / flip
9. Save a picture
10. Change speed
11. Crop for a screen
12. Fit inside a frame
13. Reverse
14. Loop video
15. Boomerang
16. Fix phone compatibility
17. Convert to WebM
18. Make an MP3
19. Make a WAV
20. Even out loudness
21. Change volume
22. Trim edge silence
23. Make audio mono
24. Adjust picture
25. Blur
26. Sharpen
27. Black + white
28. Pixelate
29. Change frame rate
30. Strip metadata

## Device verification

Open `https://westkitty.github.io/FFMPEG_POCKET/?verify=1` on the target iPhone or tap **Verify tools on this device** inside the installed PWA. Press **Run 30 tests**. Keep the PWA foregrounded and on power if possible. This uses a public synthetic 2.5-second H.264/AAC test clip, processes sequentially with the actual current browser FFmpeg worker, and checks that every output is readable with its expected type/dimensions/duration. **Copy report** to preserve per-tool outcomes.

A diagnostic PASS only proves the small sample in the current browser session. Actual user media may still exceed WebKit memory limits, contain unsupported codecs, or trigger edge conditions. Real iPhone hardware is required to close this final gate. No personal media leaves the browser.

## Recovery

Failures are presented by tool. If the engine cannot load, verify online connectivity for the first download and that the app is served through HTTPS. Reopen the installed PWA after a crash; avoid large media for the first proof. Do not conflate a successful GitHub Pages deployment with a successful FFmpeg conversion.
