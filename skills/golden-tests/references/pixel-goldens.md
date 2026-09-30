# Board pixel goldens

How a board's pixels are frozen: the matcher, the sizes and moments, the font, where the PNGs go, and what a failure means. The board's own draw code, layout and timeline come from the board work (the `board-rendering-skia` skill); this page covers the golden mechanics every board shares.

## Contents

- Why pixel goldens exist and what they miss
- The matcher: skia-golden.ts
- The shape of a board golden test
- Fonts and text
- Accepting baselines
- Reading a failure
- Headless previews outside Jest

## Why pixel goldens exist and what they miss

A board is one Skia canvas without accessibility nodes, so RNTL cannot see inside it. The pixel golden renders the board through `paintBoardPng(Skia, request)`, which runs the same `draw()` and `layout()` the device runs on an offscreen CanvasKit surface, and compares the PNG with a committed baseline.

The tolerance is 0.1% of pixels (CanvasKit anti-aliasing noise). A two-digit label is about 0.035% of a phone board (77 of 218,400 pixels, measured), below the tolerance: pixels alone would not notice a missing number. So every localised label on a board is also asserted through a recording canvas in the `unit` project (the board work's draw-call test).

## The matcher: skia-golden.ts

`templates/test/goldens/boards/skia-golden.ts` is the one matcher every board golden uses:

```ts
/** 0.1% of pixels may differ (CanvasKit anti-aliasing noise); diffs land in reports/visual/diff. */
export const toMatchPixelGolden = configureToMatchImageSnapshot({
  failureThreshold: 0.001,
  failureThresholdType: 'percent',
  customDiffDir: join(process.cwd(), 'reports', 'visual', 'diff'),
});
```

- `jest-image-snapshot` 6.5.2 (with `@types/jest-image-snapshot` 6.4.2) as root devDependencies, exact pins; it uses pixelmatch 5 internally. Add them before the first pixel golden: `npm install --save-dev --save-exact jest-image-snapshot@6.5.2 @types/jest-image-snapshot@6.4.2` (`check-goldens.mjs` rule `pixel-deps`).
- `failureThreshold: 0.001` with `'percent'` means 0.1% of the pixels. The file is a gated path; the value changes only with the owner's agreement.
- A test registers it as `expect.extend({ toMatchImageSnapshot: toMatchPixelGolden })` and never passes its own `failureThreshold` per call.

## The shape of a board golden test

`templates/test/goldens/boards/__GAME_ID__-board.golden.test.ts` is the template game's (Tap Flip) golden test, one shared copy that board-rendering-skia ships too; for another game replace its `VIEW` and `EVENTS` with that game's busiest turn (a real-time game uses realtime-game-loop's variant, which steps the sim instead):

- It lives in `test/goldens/boards/<game-id>-board.golden.test.ts` (it reads the font with `node:fs` and uses `Buffer`).
- It renders at no fewer than three canvas sizes: `phone-portrait` 390 × 560, `tablet-landscape` 1024 × 700, `small` 320 × 400 (the narrow split-view case).
- At three moments of the busiest turn: 0, 50% and 100% of `timelineEndMs(tracks)`.
- Nine snapshots named `<game-id>-<size>-<moment>` through `customSnapshotIdentifier`, stored as `test/goldens/boards/__image_snapshots__/<game-id>-<size>-<moment>.png`.
- A realistic mid-game view with localised digits, the dark scheme by default (add light or mirrored cases when the game draws them differently).
- It runs in the `golden` Jest project: `testEnvironment: '@shopify/react-native-skia/jestEnv.js'` loads CanvasKit into `global.CanvasKit`, `setupFilesAfterEnv: ['@shopify/react-native-skia/jestSetup.js']` mocks the module with a CanvasKit-backed `Skia`. The `unit` project cannot render Skia ("Native Skia Module failed to correctly install JSI Bindings!").

## Fonts and text

Skia's `jestSetup` returns `null` for `useFont` / `matchFont`, so a golden that draws text loads the app's bundled font explicitly:

```ts
const FONT = join(process.cwd(), 'apps/<game-id>/assets/fonts/Vazirmatn-Regular.ttf');
const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
```

The font file is the same one the app bundles (`apps/<game-id>/assets/fonts/`), so the golden draws what players see. `measureText` is unimplemented in CanvasKit; widths come from glyph widths in the draw code.

## Accepting baselines

1. `npx jest test/goldens/boards/<game-id>-board.golden.test.ts --selectProjects golden -u` writes the nine PNGs (only this command writes; `jest --ci` refuses a missing baseline).
2. Open every new PNG with the Read tool and compare it with the intended look: pieces where the view says, effects mid-flight at 0.5, the final state at 1, nothing clipped at `small`.
3. `CI=1 npx jest --ci --selectProjects golden` passes.
4. Commit with `Gate-Change: <game-id> board goldens <created | re-accepted>: <why>, looked at all 9 PNGs`.

## Reading a failure

```
Expected image to match or be a close match to snapshot but was 3.7083333333333335% different from snapshot (6408 differing pixels).
See diff for details: reports/visual/diff/line-siege-phone-portrait-0.5-diff.png
```

Open the diff PNG (red marks changed pixels). If the change is a bug, fix the code; if it is intended, re-accept that file with `-u` and a Gate-Change trailer. A golden that varies between runs on the same commit means the draw path reads time or randomness; CanvasKit renders are byte-identical run to run.

A new Skia version shifts anti-aliasing: re-accept all board goldens in one dedicated commit after the upgrade, with the old goldens passing on the old version first.

## Headless previews outside Jest

For board previews in plain Node (the owner's gallery, store art), the same draw modules load without React Native because they import only Skia types and receive every Skia object through `kit`. A small loader (`LoadSkiaWeb()` then `headless.getSkiaExports().Skia` from `@shopify/react-native-skia/lib/commonjs/headless/index.js`) gives the Skia API, `paintBoardPng` renders, and a pixelmatch comparator (`comparePng`, with `pixelmatch` 7.2.0 and `pngjs` 7.0.0) compares with baselines under `apps/<game-id>/e2e/baselines/boards/`. Run such scripts with `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON <script>.ts`. These previews are tools, not the gate: the Jest board golden is the gate.
