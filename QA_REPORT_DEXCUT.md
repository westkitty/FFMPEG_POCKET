# DEX//CUT — Rebrand, hardening and release QA

- **Date:** 2026-10-08
- **Repository:** [westkitty/FFMPEG_POCKET](https://github.com/westkitty/FFMPEG_POCKET)
- **Pages target:** https://westkitty.github.io/FFMPEG_POCKET/
- **Protected baseline:** `0cc2943cfe0342ef543208bf4197ee55d04c9017`

## Verification boundary

The tests below ran on **Big Mac, macOS ARM64, headless Brave (Chromium)** using the actual deployed-style static HTML and the real **single-thread FFmpeg WebAssembly core `@ffmpeg/core@0.12.10`**. They do **not** certify a physical iPhone or installed iOS PWA.

## Results

| Gate | Evidence | Result |
|---|---|---|
| Tool inventory | 30 unique job IDs, all expected definitions present | **PASS** |
| Protected behavior | Six source sections match the original: job table, worker wrapper, command builder, verification routine, decoding check, output semantics | **PASS** |
| Actual FFmpeg WebAssembly diagnostic | 30/30 conversions created decodable, semantically checked output; zero failures | **PASS** |
| Diagnostic report export | Copy report returned a complete JSON report with 30 individual test records | **PASS** |
| Mobile/tablet/desktop UI | 320×700, 390×844, 768×1024, 1440×900; zero horizontal overflow or browser exceptions | **PASS** |
| Navigation | Search/filter, file picker, tool dialog, install instructions, verification dialog, `?verify=1` | **PASS** |
| Normal user flow | Select video → Mute → inline MP4 decode → Save → Keep editing → JPEG extraction/preview | **PASS** |
| Cancellation race | Cancel during delayed engine startup; no late failure panel | **PASS after repair** |
| Immediate retry | Cancel, start conversion immediately, complete successfully | **PASS after repair** |
| Accessibility | axe-core WCAG 2 A/AA and WCAG 2.1 A/AA, four interface states | **0 automated violations** |
| Manifest, service worker, JS syntax | Parsed and checked in automated tests | **PASS** |
| `git diff --check` | No whitespace/diff errors | **PASS** |
| Physical iPhone Chrome/WebKit | No actual device report supplied | **UNVERIFIED** |
| Installed iOS PWA offline conversion, share-sheet and lifecycle | Requires on-device proof | **UNVERIFIED** |
| Long clips, uncommon codecs, memory pressure | Outside short synthetic sample scope | **UNVERIFIED** |

### Media details

The final desktop verification completed **30/30 actual FFmpeg.wasm tool operations in approximately 12 seconds** on this machine, with no browser issues recorded. Its diagnostic tested small synthetic media, not large user files.

The ordinary workflow produced a playable **160×90, 2.5-second MP4** after Mute and saved a **121,985-byte** download. That conversion took about **1.66 seconds** in the test session. Chained editing then produced a decoded **160×90 JPEG** in about **0.79 seconds**.

### What was repaired

Cancelling while the FFmpeg core was downloading or loading previously allowed a stale asynchronous operation to replace the restored tool controls with a failure result. The repair introduces an engine-load generation guard, explicitly terminates an in-progress worker when cancelled, prevents superseded jobs from changing current UI state, and allows immediate retry without allowing abandoned startup work to overwrite the active engine.

The original device-verification routine and 30 individual FFmpeg command implementations were preserved.

Accessibility corrections: user zoom restored, all generated tool inputs/selects receive accessible labels, and interactive red surfaces have AA-safe white text contrast while the canonical bright red remains an accent.

## Measured performance

Ten repeated local browser loads at **390×844**, alternating between the baseline and DEX//CUT on the same computer:

| Measure | Baseline median | DEX//CUT median |
|---|---:|---:|
| Local page load | 85.9 ms | 107.2 ms |
| DOMContentLoaded | 32.1 ms | 104.7 ms |
| 100 tool-search updates | 37.4 ms | 21.2 ms |
| JS heap after search | 4.72 MB | 4.72 MB |
| Secondary resource transfer | 1.7 KB | 78.2 KB |

The new art/stylesheet add roughly **76.5 KB of secondary transferred resources**, plus a modest HTML change. Search responsiveness improved in this repeatable synthetic loop. CSS and image loading introduce a small page-load regression. JS heap figures do **not** measure the complete FFmpeg WebAssembly heap; browser and device memory limits remain a separate risk.

These localhost measurements exclude real network latency, browser-cache history, mobile CPU throttling, thermal throttling, and background-tab termination. They are not universal load-time or iPhone performance promises.

## Privacy and architectural parity

- Same static Pages deployment model, no server media-upload path, no account requirement.
- Local FFmpeg processing, original command construction and tool inventory.
- Existing Share/Save/Keep Editing functions retained.
- Diagnostic remains opt-in and uses synthetic files.
- Offline app shell and the prior FFmpeg CDN cache behavior are preserved with a versioned app-shell cache.
- New illustration assets are local to the repository; no new remote tracking, fonts, frameworks or runtime JavaScript.

## Release acceptance

A GitHub Pages deployment is a separate gate from local verification. After pushing, check that the live HTML, CSS, mascot atlas, poster, manifest, icons and service worker reflect the new revision, that the device diagnostic still opens at `?verify=1`, and that a browser conversion works from the live URL.

**iPhone certification remains pending until an actual installed-iPhone report and representative real-file checks are observed.** Do not turn desktop results into a device-specific claim.
