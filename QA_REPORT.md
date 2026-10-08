# FFmpeg Pocket — release verification
**Date:** 2026-10-08  
**Target:** [Live PWA](https://westkitty.github.io/FFMPEG_POCKET/)  
**Deployed code:** `ccb7e4d8bfd91af25e8dd3ab68648d46d61d35d5`  

## Verdict
**30/30 actual WebAssembly tools PASS in headless Brave on macOS ARM64.** This is browser-runtime proof, **not iPhone certification**.

| Check | Result | Evidence scope |
|---|---|---|
| GitHub Pages deployment | PASS | GitHub native Pages build and deploy succeeded for this commit |
| Installed tool inventory | PASS | 30 exposed tools; 30 matching command handlers |
| Desktop native FFmpeg | 46/46 PASS | Tool outputs + semantic assertions, including accurate clip/ending, compression, and pixelation |
| Responsive UI regression | 100/100 PASS | 390×844 Chromium test; no horizontal overflow or JS errors |
| Simulated diagnostic engine | 30/30 PASS | Tests UI/control flow only; not FFmpeg.wasm proof |
| **Actual FFmpeg.wasm** | **30/30 PASS** | Live page, single-thread @ffmpeg/core@0.12.10, 2.5-second synthetic media, real FFmpeg execution, output stream probes and browser playback |
| Normal workflow | PASS | Pick video → Mute → inline play → download (121,985 bytes) → Keep editing → Save a picture → inline JPEG decode |
| Offline after warm-up | PASS | Service worker app shell + JS/WASM CDN cache; reload offline and perform Mute conversion |
| Physical installed iPhone PWA | **NOT RUN** | Requires an iPhone; macOS Brave is not iOS WebKit |
| Large/long clips and uncommon codecs | **NOT RUN** | WebKit memory, per-codec and performance limitations remain |

## Confirmed corrections
- Accurate clip and ending cuts use re-encoding to avoid keyframe seeking inaccuracies.
- Compression refuses to report a file-size increase as success.
- Pixelation preserves source dimensions.
- Audio-dependent operations preflight input tracks, including silent-video cases.
- Temporary media files are cleaned even on error.
- The device diagnostic retains original sample byte size across transferred ArrayBuffers.
- Audio-filter helpers consume their explicitly provided input path, so production and verification paths agree.

## Individual per-tool execution
See [machine-readable 30-tool proof](tests/wasm_browser_results_2026-10-08.json). All 30 show PASS in the stated browser environment.

## Closing the iPhone-specific gate
On the target iPhone, open the **installed FFmpeg Pocket PWA**, tap **Verify tools on this device**, then **Run 30 tests**. Keep the screen active. When complete, use **Copy report**. Per-tool PASS on the phone, plus representative real-file playback/Share, is the only appropriate basis for an iPhone-specific claim.

These synthetic browser tests do not upload personal media. The app downloads its browser FFmpeg engine while online; an offline run requires the engine to have been downloaded and cached previously.
