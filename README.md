# DEX//CUT

![DEX//CUT — Your files. My judgment.](assets/dexcut-poster.webp)

**YOUR FILES. MY JUDGMENT.**

*Media processing. Under protest.*

A compact, local-first video and audio workshop from **Stinky Weasel Productions**, overseen by Dexter, the Furious Little Stinkweasel. The software is useful. Dexter is unimpressed.

[**Open DEX//CUT**](https://westkitty.github.io/FFMPEG_POCKET/) · [**Verify this device**](https://westkitty.github.io/FFMPEG_POCKET/?verify=1)

## What it does

Thirty practical media tools retain the original FFmpeg Pocket workflow: choose a file, select a correction, inspect the result, and then preview, save, share, or keep editing. Categories cover timing, compression and formats, audio, visual effects, and playful transformations.

Media processing runs in the browser using the pinned single-thread **`@ffmpeg/core@0.12.10` WebAssembly engine**. The app does **not** upload selected media to a server, require an account, or require an App Store installation. The FFmpeg runtime is downloaded on first use; offline processing depends on it already being cached.

## Device verification — a protected feature

Tap **VERIFY ALL 30 TOOLS**, or open the [diagnostic deep link](https://westkitty.github.io/FFMPEG_POCKET/?verify=1).

The diagnostic uses a small synthetic media sample to execute **all thirty real FFmpeg WebAssembly operations**, inspect the output streams, verify key semantics, and check whether the browser can decode the results. **Copy report** produces a per-tool record on the device; it does not upload personal media or automatically certify other devices.

A pass in desktop Brave is **not an iPhone pass**. For iPhone-specific claims, run this diagnostic in the installed iPhone PWA, then test real-file playback, save/share, and the iOS app lifecycle. Large files and unusual codecs remain device-dependent.

## PWA and offline operation

DEX//CUT supports a Home Screen installation, maskable icons, offline app shell, and caching of the FFmpeg runtime after a successful online load. GitHub Pages deploys from `main` at `/(root)`; the project URL remains `/FFMPEG_POCKET/` to preserve bookmarks.

## Technical invariants

- All 30 original tool definitions and FFmpeg commands remain available.
- Preview, download, share, and chained edits remain operational.
- Client-side processing, user-initiated diagnostics, cancellation, and error recovery are retained.
- Single-thread FFmpeg avoids the cross-origin isolation requirements of multithreaded builds on GitHub Pages.
- Reduced-motion support, keyboard focus, labelled form controls, mobile zoom, and accessible contrast are required.
- No new third-party runtime JavaScript dependencies or tracking.

## Validation

Static invariants, including a locked comparison with the original baseline commit:

```sh
node tests/dexcut_static_regression.cjs
```

For browser and real-WebAssembly tests, install Playwright and axe-core in a development-only location:

```sh
npm install --prefix /tmp/dexcut-playwright --no-audit --no-fund playwright@1.64.0 @axe-core/playwright
DEXCUT_PLAYWRIGHT=/tmp/dexcut-playwright/node_modules/playwright node tests/dexcut_browser_qa.cjs
DEXCUT_PLAYWRIGHT=/tmp/dexcut-playwright/node_modules/playwright node tests/dexcut_real_flow.cjs
DEXCUT_PLAYWRIGHT=/tmp/dexcut-playwright/node_modules/playwright node tests/dexcut_cancellation_qa.cjs
DEXCUT_PLAYWRIGHT=/tmp/dexcut-playwright/node_modules/playwright node tests/dexcut_wasm_qa.cjs
DEXCUT_PLAYWRIGHT=/tmp/dexcut-playwright/node_modules/playwright node tests/dexcut_pages_qa.cjs
DEXCUT_PLAYWRIGHT=/tmp/dexcut-playwright/node_modules/playwright DEXCUT_AXE=/tmp/dexcut-playwright/node_modules/@axe-core/playwright node tests/dexcut_accessibility_qa.cjs
```

Tests default to installed macOS Brave; set `DEXCUT_BROWSER` to a different Chromium-compatible executable path if needed. These development-only packages are **not used by the deployed site**.

See [DEX//CUT QA report](QA_REPORT_DEXCUT.md) for the evidence scope and performance comparison. The historical [FFmpeg Pocket QA report](QA_REPORT.md) remains intact.

---

**DEX//CUT** — Stinky Weasel Productions. Dexter disapproves.