# Performance rules in practice

The rules that keep games inside the budgets, why each exists, and what to do instead.

## Contents

- Per-frame work
- Re-renders
- Skia cost
- Frame callbacks and textures
- Lists and grids
- Bundle, Hermes and startup

## Per-frame work

- **Never put per-frame data in React state.** Positions, timelines and particles live in shared values and Skia pictures. React re-renders only on events (a move, a result, a setting). A React render per frame at 120 Hz cannot fit an 8.3 ms frame.
- HUD numbers (score, moves) change once per move and come from the session store through a primitive selector, never from a shared value read on the JS thread every frame.
- A per-frame UI-thread value that must reach JS (a real-time score) is batched once per frame with `scheduleOnRN` and throttled to the display, then written to the session store.
- Read and write shared values with `.get()` / `.set()`.

## Re-renders

- Pin the re-render boundary of hot components (Home, the Game screen top bar, any live counter) with a `<Profiler>` test that fails when the component subscribes to an unrelated store: over-subscription is invisible without one. (Verified: the test fails with "Expected number of calls: 1, Received: 2" once a component also subscribes to the whole settings object.)
- Pass a selector to every store hook; a selector that builds an object uses `useShallow`.

## Skia cost

Recording a picture costs roughly one command per draw call, and replaying it costs the GPU work. Reduce both:

| Do | Instead of |
|---|---|
| Create paints, colours, paths, fonts, paragraphs and picture recorders once (module scope, a `useState` initializer, or the render kit) | `Skia.Paint()` / `Skia.Color('#…')` inside the per-frame worklet |
| Draw static backgrounds (grid, frame) as retained nodes or one cached picture | Re-recording the static layer every frame |
| Use `<Atlas>` for 100 or more identical sprites (one draw call) | One `drawImage` / `drawCircle` each |
| Stop the frame callback when the timeline ends | Leaving it running on an idle board |

- Keep **at most 8 Skia canvases per screen** outside the board, and never one canvas per list item: each costs about 0.18 MB and 2.8 ms to mount. Single-colour icons are rasterized once and shown as tinted images (90 tiles of rasterized icons mount 4.8× faster and use 15 MB less than one canvas per tile).
- Board text: numbers formatted in JS and passed as strings; Latin strings and lone digits with `drawText`, Arabic script through a Skia `Paragraph`, built once per text change, not per frame.

## Frame callbacks and textures

- **Stop every frame callback** when its timeline ends, when the app goes to the background, while a full-screen ad shows, and when the Game screen loses focus (`useFrameCallback(cb, false)` plus `setActive(true/false)` from the board lifecycle). The frame recorder must show no frames while idle.
- **Dispose pre-rendered textures** (`SkImage`, `SkPicture`) with `.dispose()` when the palette or theme changes; textures cost w × h × 4 bytes.

## Lists and grids

- The levels grid is **one `ScrollView` with packs as sections and every tile mounted**. Measured with a Release build on the iOS 26.5 simulator (90 tiles of 72 pt, medians of 6 cold launches): ScrollView with plain views laid out the last tile at 26 ms (49–50 MB); FlatList 40 ms (50 MB); FlashList 40 ms and only 85 tiles after 1.5 s (51 MB); one Skia canvas per tile 264–280 ms (66 MB). At 90 items virtualization saves nothing.
- **At most 150 tiles mounted per screen** (`levelGridTilesMax`); a game with more levels shows one pack at a time (pack tabs).
- Core `FlatList` only for lists that grow without bound (none in v1). Key items by a stable id, never by index.

## Bundle, Hermes and startup

- **Check the bundle delta before adding a runtime dependency** (`expo export` before and after). Add no Intl locale data beyond en, de, fa and ckb: the forced FormatJS polyfills alone add 0.85 MB of JS and 0.59 MB of Hermes bytecode.
- **Keep Hermes**, the default engine (Hermes V1 in React Native 0.86): no `jsEngine` switch, no `RCT_HERMES_V1_ENABLED`. Measure only Release builds, where the bundle is precompiled.
- **Generate no code at runtime:** no `eval`, `new Function` or string `setTimeout`. Hermes runs precompiled bytecode; zod 4's JIT path uses `new Function` and is unverified on Hermes.
- **Keep module scope and the Splash cheap.** The Splash (S1) loads the save, settings, language and fonts. Everything else (ads, consent, the store connection, sprite textures) starts after the Home-interactive mark. No module may do I/O at import time; the Intl polyfills and the in-memory cold-start mark are the only module-level side effects.
