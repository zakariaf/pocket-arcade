# 15 · Performance and accessibility

> **What this doc decides.** The performance budgets (cold start under 1 s, animation hitch rate at most 10 ms/s, save write p95 under 5 ms, at most 1,000 draw calls per frame, bundle and memory caps) and how each one is measured. On the device that means a frame-time recorder and a cold-start log, both exportable from the debug menu. In Jest it means a save-write perf test and a draw-call budget test. On the simulator it means launch and footprint runs.
> It also sets the performance rules (re-renders, per-frame data, Skia Picture cost, stopping frame callbacks, memory, bundle and polyfill cost, Hermes) and the accessibility rules: roles, labels and hints through i18n; 44 pt targets; text up to 200%; WCAG AA contrast; a colour-blind palette check; reduce motion; a spoken board summary for VoiceOver. Accessibility is tested with RNTL role queries, Maestro at the largest text size, and an owner VoiceOver checklist.
> **Binding source:** [99-final-decisions.md](99-final-decisions.md) B.12, B.15, B.19, C.29, D.38, D.40, D.42, D.46, D.47. Problems are listed under [Open issues](#open-issues).
> **Related docs:** [05-components-hooks-styling.md](05-components-hooks-styling.md) (components and hooks), [07-testing-and-tdd.md](07-testing-and-tdd.md) (RNTL, Maestro, screenshots), [08-game-engine.md](08-game-engine.md) (frame callbacks and draw-call test), [06-navigation-state-persistence.md](06-navigation-state-persistence.md) (save database), [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md) (quality-gates.json). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

---

## 1. Introduction

Performance numbers come from three places, and each has its own job:

| Where | What it proves | Who runs it |
|---|---|---|
| **The owner's iPhone** (TestFlight test build) | The truth: cold start, frame times and save time on real hardware at 120 Hz | Owner, from the debug menu. Claude reads the exported JSON |
| **The iOS simulator** (Release, test variant) | Regressions: launch time, memory footprint, layouts at 200% text | Claude, from the tooling scripts and Maestro |
| **Jest** | Fast guards that fail a commit: save write time, draw calls per frame, re-render boundaries, contrast, colour-blind separation, roles and labels | Claude, through `npm run verify` |

The simulator is not a device. It runs on the Mac's CPU and caps at 60 fps, so its numbers are only compared with earlier simulator numbers. Measure only **Release** builds: "JavaScript thread performance suffers greatly when running in dev mode… Always make sure to test performance in release builds" ([React Native: Performance](https://reactnative.dev/docs/performance)).

Component-level rules (buttons, `AppText`, icons, lists, the theme) are in doc 05, and this doc refers to them. Paths and import style follow doc 05 section 1. Every TypeScript block below is a copy of a file that passed doc 04's ESLint config (plus doc 05's additions), doc 04's tsconfigs, Prettier and Jest on 2026-09-26.

---

## 2. Rules

### Budgets

1. **Keep cold start (process start → Home interactive) under 1,000 ms** as the median of 5 cold launches on the owner's current iPhone, read from the cold-start log.
   *Why:* spec S1 ("under 1 second where possible") and FINAL D.47.
2. **Keep the hitch rate at or below 10 ms/s and p95 frame time at or below 17 ms while boards animate,** measured by the frame-time recorder during a play test of at least 5 levels (or 60 s of a real-time game) on the owner's iPhone.
   *Why:* Apple rates a hitch rate "at or below 10 ms/s" as good, "at or below 25 ms/s" as a warning and "at or below 50 ms/s" as critical. **Source:** [Understanding hitches](https://developer.apple.com/documentation/xcode/understanding-hitches-in-your-app).
3. **Keep the save-write p95 under 5 ms.** The Jest perf test guards it on every `npm run verify`, and the on-device save benchmark confirms it before each release.
   *Why:* a save follows every move and every settings change (FINAL A.6, D.47).
4. **Cap every game's per-frame draw-call budget at 1,000.** Each game's draw-call test (doc 08: a recording canvas over the busiest frame of a turn) asserts the game's own number, for example Line Siege ≤ 200, and no game's number may exceed `perf.drawCallsPerFrameMax`.
   *Why:* counting canvas calls is a headless stand-in for GPU cost (FINAL D.47). A simulator scene with about 265 draw calls re-recorded every frame held 60 fps.
5. **Keep the store build's minified JS (`expo export --no-bytecode`) at or under 6,000,000 bytes,** and do not let it grow more than 10% over the committed baseline without a `Gate-Change:` trailer.
   *Why:* bundle size is startup work. The measured reference points are in [3.7](#37-performance-rules-in-practice).
6. **Keep `phys_footprint` at or under 150 MB after the smoke flow on the simulator.**
   *Why:* memory growth shows up before crashes do. Measured baselines were 42–66 MB for a probe app ([3.7](#37-performance-rules-in-practice)).
7. **Keep every budget in `quality-gates.json` under `perf` and `a11y` ([3.1](#31-budgets-and-quality-gatesjson)).** Tests read them from there. Changing one requires the `Gate-Change:` trailer (FINAL D.42).
   *Why:* one checked-in source that the owner can review.

### Measurement

8. **Measure only Release builds of the `test` variant,** never Metro or development builds.
   *Why:* dev mode slows JS down on purpose. **Source:** [RN Performance](https://reactnative.dev/docs/performance).
9. **The frame-time recorder never owns a frame callback.** The board host's existing callback calls `sampleFrame(...)`. The recorder is off until switched on in the debug menu. The debug-menu pieces (the switch, `createPerfLog`, `sharePerfReport`, the save benchmark) are test-only code: `test-only-entry.ts` exports them and callers reach them only through `TEST_ONLY` (doc 14 rule 5). In a store build `isRecording` stays false, so `sampleFrame` returns after one read.
   *Why:* an extra display link would keep an idle screen rendering (FINAL B.12) and change what it measures. Only doc 14's inline variant check removes code from the store bundle.
10. **The cold-start log records process start (from the native `ProcessStart` module), the JS entry and Home interactive (one frame after Home renders real data), once per process.**
    *Why:* on the simulator, 484 ms of a 539 ms launch (medians of 66 runs) passed before our JS module ran (measured). JS-only timing would miss about 90% of the cold start.
11. **Keep performance data on the device.** It goes to the `perf_log` table of the save database (test builds) and leaves the phone only through the iOS share sheet from the debug menu.
    *Why:* spec N2/N3 (no analytics, and our code makes no request).
12. **Time Jest perf tests with `performance` from `node:perf_hooks`,** never the global `performance.now()`. Such tests import a Node built-in, so they live under the root `test/` folder (docs/07 rule 7).
    *Why:* the React Native Jest preset replaces the global with a 1 ms `Date.now` mock, so the first version of our save test reported p50 = 0.00 ms (verified).

### Performance rules

13. **Never put per-frame data in React state.** Positions, timelines and particles live in shared values and Skia pictures. React re-renders only on events (a move, a result, a setting).
    *Why:* FINAL B.12/B.13. A React render per frame at 120 Hz cannot fit an 8.3 ms frame.
14. **Pin the re-render boundaries of hot components with a `<Profiler>` test** (doc 05 rule 21).
    *Why:* over-subscription is invisible without one, and the verified test fails when it happens.
15. **Allocate nothing Skia in a per-frame worklet.** Create paints, colours, paths, fonts and paragraphs once, outside it. Keep static art in retained nodes or a cached picture. Re-record only the dynamic layer each frame.
    *Why:* `Skia.Paint()` and `Skia.Color()` allocate native objects. The Skia docs capture module-level paints and recorders.
16. **Draw 100 or more identical sprites with `<Atlas>`, not one draw call each.**
    *Why:* FINAL B.11. An atlas is one draw call, and the draw-call budget counts it as one.
17. **Stop every frame callback when its timeline ends, when the app goes to the background, while a full-screen ad shows, and when the Game screen loses focus.**
    *Why:* FINAL B.12/B.19. The frame recorder must show no frames recorded while idle.
18. **Dispose of pre-rendered textures (`SkImage`, `SkPicture`) with `.dispose()` when the palette or theme changes.** Keep at most 8 Skia canvases per screen outside the board (doc 05 rule 45).
    *Why:* each canvas costs about 0.18 MB (measured) and textures cost w × h × 4 bytes.
19. **Check the bundle delta (`expo export` before and after) before adding a runtime dependency.** Add no Intl locale data beyond en, de, fa and ckb.
    *Why:* the forced FormatJS polyfills alone add 0.85 MB of JS and 0.59 MB of Hermes bytecode (measured) and are accepted only because Hermes needs them (FINAL C.29).
20. **Generate no code at runtime** (`eval`, `new Function`, string `setTimeout`), and keep Hermes, the default engine.
    *Why:* Hermes runs precompiled bytecode. Runtime compilation defeats that. zod 4's JIT path uses `new Function`, which the stack research flagged as unverified on Hermes. **Source:** [Hermes](https://reactnative.dev/docs/hermes).
21. **Keep module scope and the Splash cheap.** Splash (S1) loads the save, settings, language and fonts. Everything else (ads, consent, store connection, sprite textures) starts after the Home interactive mark.
    *Why:* spec S1 and N8 (no ad on start), and the cold-start budget.

### Accessibility rules

22. **Give every interactive element a role and a translated accessible name,** plus a hint only when the outcome is not obvious (doc 05 rules 35–38). Every screen test ends with `expect(findInaccessiblePressables(screen.container)).toStrictEqual([])`.
    *Why:* spec 8.11 and FINAL D.46. VoiceOver reads role and name, and RNTL's `getByRole` finds them.
23. **Group each settings row into one accessible element** (label, value and control read together). Custom sliders use `accessibilityRole="adjustable"` with `accessibilityValue` and the `increment`/`decrement` actions.
    *Why:* one swipe per row, and volume controls must be operable with VoiceOver (spec S11).
24. **Make every Shell touch target at least 44 × 44 pt** (doc 05 rule 37). Board layouts expose their smallest hit region, and a Jest test in each game asserts it is at least 44 pt at 402 × 874 pt. An exception needs the owner's sign-off in the game's design pass.
    *Why:* spec S5 ("Touch targets are at least 44x44 points"). **Source:** [HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).
25. **Support text at 200%:** `maxFontSizeMultiplier` 2 (in `AppText`), `minHeight` rather than fixed `height` on containers of text, no `numberOfLines` on sentences, and rows that stack when `isLargeText` (doc 05).
    *Why:* spec 8.11 ("up to 200%, … reflow rather than cut off").
26. **Meet WCAG 2.2 AA contrast in every palette mode and scheme:** 4.5:1 for text, 3:1 for icons and control shapes. `checkPaletteContrast(palette)` returns `[]` in each game's tests.
    *Why:* spec 8.11. Apple uses the same WCAG AA values. **Source:** [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility).
27. **Never convey meaning by colour alone.** Every game category carries a symbol or shape in addition to its colour. In colour-blind mode the categorical colours must pass `checkCategoricalColors` (smallest OKLab distance ≥ 0.07 under simulated protanopia, deuteranopia and tritanopia).
    *Why:* spec S11 DISPLAY and 8.11. The threshold passes the Okabe-Ito colour-blind-safe palette (0.076) and fails red/green sets (0.007) (measured).
28. **Honour reduce motion everywhere:** `useReduceMotion()`, `<MotionConfig/>`, `buildTimeline(…, 'reduced')` (doc 05 rule 51). When it is on there is no screen shake, no particles, no zoom and no parallax, and navigation transitions become fades.
    *Why:* spec 8.11/S11. Apple's guidance is to replace x/y/z motion with fades. **Source:** [HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).
29. **Expose every board as one `image` element whose label is `t()` of the game's `board.describe(view)`** ("Level 12, 3 monsters, your turn"). Doc 08's `BoardCanvas` does this, and the label updates with every new view. Announce results and important events with `useAnnounce()` (only while VoiceOver runs; one short announcement per move).
    *Why:* spec 8.11. Skia content is invisible to the accessibility tree (research notes).
30. **Keep VoiceOver order equal to visual order.** Overlays (Pause, dialogs) set `accessibilityViewIsModal`. Text in a language other than the UI language (the language names in S2/S11a) sets `accessibilityLanguage`.
    *Why:* a modal overlay otherwise lets VoiceOver wander into the board behind it. A Persian name read by an English voice is unintelligible.

### How accessibility is tested

31. **Query by role and name first in every component and screen test** (`getByRole('button', { name })`), and end every screen test with `expect(findInaccessiblePressables(screen.container)).toStrictEqual([])`.
    *Why:* a missing role or name fails the test, not a user (verified in both directions).
32. **Run the `a11y`-tagged Maestro flows at `content_size accessibility-extra-extra-extra-large`** in en and fa on the phone and iPad simulators, plus doc 07's screenshot matrix at the same size (`npm run screenshots:ios -- --app <game> --text-size accessibility-extra-extra-extra-large`), and inspect the screenshots.
    *Why:* this is the largest Dynamic Type size (`fontScale` 3.571, capped to 2 by `AppText`). Verified that `simctl` changes the size and Maestro finds elements by `id`.
33. **The owner runs the VoiceOver checklist ([3.10](#310-owner-voiceover-checklist)) on each release candidate** in English and Persian.
    *Why:* automated tests cannot judge whether spoken output makes sense (FINAL D.46).

---

## 3. Details

### 3.1 Budgets and `quality-gates.json`

| Budget | Value | Measured by | Runs in |
|---|---|---|---|
| Cold start, process → Home interactive | < 1,000 ms (median of 5, device) | cold-start log ([3.3](#33-cold-start-log)) | owner, each release |
| Cold start on the simulator | ≤ 1.2 × committed baseline | cold-start log read from the simulator | `npm run e2e:ios` |
| Hitch rate while animating | ≤ 10 ms/s | frame-time recorder ([3.2](#32-frame-time-recorder)) | owner play test |
| p95 frame time while animating | ≤ 17 ms (the recorder reports 17 as an upper bound) | frame-time recorder | owner play test |
| Save write p95 | < 5 ms | Jest perf test + on-device benchmark ([3.4](#34-save-write-performance)) | `npm run test` (and `verify`, via `test:coverage`), release |
| Draw calls per frame, busiest frame | per game (Line Siege 200), never > 1,000 | doc 08's recording-canvas test ([3.5](#35-draw-call-budget)) | `npm run test` |
| Minified JS, store build | ≤ 6,000,000 bytes, ≤ +10% vs baseline | `expo export --no-bytecode` | `npm run audit:network` |
| Memory after the smoke flow | ≤ 150 MB `phys_footprint` | `footprint <pid>` on the simulator | `npm run e2e:ios` |
| Level-grid tiles mounted | ≤ 150 | doc 05 rule 41 | review |
| Touch target | ≥ 44 pt | RNTL `toHaveStyle`, board layout test | `npm run test` |
| Text scale cap | 2.0 | `AppText` + Maestro at AX5 ([3.9](#39-testing-accessibility)) | a11y flow + `npm run screenshots:ios -- --text-size …` |
| Contrast | text 4.5:1, non-text 3:1 | `checkPaletteContrast` | `npm run test` |
| Colour-blind separation | ≥ 0.07 OKLab | `checkCategoricalColors` | `npm run test` |

The keys this doc adds to `quality-gates.json` (the file itself is owned by doc 16):

```json
{
  "perf": {
    "coldStartHomeMsMax": 1000,
    "coldStartSimRegressionFactor": 1.2,
    "hitchMsPerSecondMax": 10,
    "frameP95MsMax": 17,
    "saveWriteP95MsMax": 5,
    "drawCallsPerFrameMax": 1000,
    "bundleJsBytesMax": 6000000,
    "bundleGrowthMaxRatio": 1.1,
    "memoryFootprintMbMax": 150,
    "levelGridTilesMax": 150,
    "skiaCanvasesPerScreenMax": 8
  },
  "a11y": {
    "minTouchPt": 44,
    "maxFontScale": 2,
    "textContrastMin": 4.5,
    "nonTextContrastMin": 3,
    "minCvdDistanceOk": 0.07
  }
}
```

### 3.2 Frame-time recorder

**Design.** The histogram is a small immutable record: 7 buckets bounded at 9 / 17 / 25 / 34 / 50 / 100 ms and above, plus frames, total, min, max, and hitch time for both 120 Hz and 60 Hz. The board host's frame callback calls `sampleFrame` with `frame.timeSincePreviousFrame`, and `sampleFrame` only records while `isRecording` is true. At the end of a level (or on pause, background, or leaving the screen) the JS side calls `stop()`, turns the histogram into a `FrameReport`, and appends it to the perf log.

Hitch time is `Σ max(0, dt − frame budget)`, and the hitch rate is hitch time divided by the recorded duration in seconds, which is Apple's metric. The report picks 120 Hz when the shortest recorded interval is under 12 ms, otherwise 60 Hz. ProMotion needs `CADisableMinimumFrameDurationOnPhone` (FINAL B.19).

```ts
// packages/shell/src/app/perf/frame-histogram.ts
'worklet';

/** Upper bounds (ms) of the buckets; the last bucket holds everything slower. */
export const BUCKET_BOUNDS_MS = [9, 17, 25, 34, 50, 100] as const;
const FRAME_MS_120 = 1000 / 120;
const FRAME_MS_60 = 1000 / 60;

export type FrameHistogram = {
  readonly buckets: readonly number[];
  readonly frames: number;
  readonly totalMs: number;
  readonly maxMs: number;
  readonly minMs: number;
  readonly hitchMs120: number;
  readonly hitchMs60: number;
};

export function createFrameHistogram(): FrameHistogram {
  return {
    buckets: [0, 0, 0, 0, 0, 0, 0],
    frames: 0,
    totalMs: 0,
    maxMs: 0,
    minMs: Number.POSITIVE_INFINITY,
    hitchMs120: 0,
    hitchMs60: 0,
  };
}

function bucketIndex(dtMs: number): number {
  for (let index = 0; index < BUCKET_BOUNDS_MS.length; index += 1) {
    if (dtMs <= (BUCKET_BOUNDS_MS[index] ?? 0)) return index;
  }
  return BUCKET_BOUNDS_MS.length;
}

/** Pure; runs on the UI thread once per frame while recording. */
export function recordFrame(histogram: FrameHistogram, dtMs: number): FrameHistogram {
  if (dtMs <= 0) return histogram;
  const index = bucketIndex(dtMs);
  return {
    buckets: histogram.buckets.map((count, i) => (i === index ? count + 1 : count)),
    frames: histogram.frames + 1,
    totalMs: histogram.totalMs + dtMs,
    maxMs: Math.max(histogram.maxMs, dtMs),
    minMs: Math.min(histogram.minMs, dtMs),
    hitchMs120: histogram.hitchMs120 + Math.max(0, dtMs - FRAME_MS_120),
    hitchMs60: histogram.hitchMs60 + Math.max(0, dtMs - FRAME_MS_60),
  };
}
```

```ts
// packages/shell/src/app/perf/frame-report.ts
import { BUCKET_BOUNDS_MS } from './frame-histogram.ts';

import type { FrameHistogram } from './frame-histogram.ts';

export type FrameReport = {
  readonly frames: number;
  readonly seconds: number;
  readonly refreshHz: 60 | 120;
  readonly p50UpToMs: number;
  readonly p95UpToMs: number;
  readonly maxMs: number;
  /** Apple's metric: ms of hitch per second. Good <= 10, warning <= 25, critical <= 50. */
  readonly hitchMsPerS: number;
  readonly buckets: readonly number[];
};

function percentileBound(buckets: readonly number[], frames: number, p: number): number {
  let seen = 0;
  for (const [index, count] of buckets.entries()) {
    seen += count;
    if (seen >= (p / 100) * frames) return BUCKET_BOUNDS_MS[index] ?? Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}

/** Pure, JS thread: turns a finished histogram into the numbers the owner exports. */
export function summarizeFrames(histogram: FrameHistogram): FrameReport | null {
  if (histogram.frames === 0) return null;
  const isProMotion = histogram.minMs < 12;
  const hitchMs = isProMotion ? histogram.hitchMs120 : histogram.hitchMs60;
  const seconds = histogram.totalMs / 1000;
  return {
    frames: histogram.frames,
    seconds: Math.round(seconds * 10) / 10,
    refreshHz: isProMotion ? 120 : 60,
    p50UpToMs: percentileBound(histogram.buckets, histogram.frames, 50),
    p95UpToMs: percentileBound(histogram.buckets, histogram.frames, 95),
    maxMs: Math.round(histogram.maxMs),
    hitchMsPerS: Math.round((hitchMs / seconds) * 10) / 10,
    buckets: [...histogram.buckets],
  };
}
```

```ts
// packages/shell/src/app/perf/use-frame-recorder.ts
import { useSharedValue } from 'react-native-reanimated';

import { createFrameHistogram, recordFrame } from './frame-histogram.ts';
import { summarizeFrames } from './frame-report.ts';

import type { FrameHistogram } from './frame-histogram.ts';
import type { FrameReport } from './frame-report.ts';
import type { SharedValue } from 'react-native-reanimated';

export type FrameRecorder = {
  readonly histogram: SharedValue<FrameHistogram>;
  readonly isRecording: SharedValue<boolean>;
  readonly start: () => void;
  /** Stops and returns the summary (null when no frame ran). */
  readonly stop: () => FrameReport | null;
};

/**
 * The recorder never owns a frame callback: the board host's existing callback calls
 * sampleFrame(...) so idle screens stay idle (no extra display link).
 */
export function useFrameRecorder(): FrameRecorder {
  const histogram = useSharedValue(createFrameHistogram());
  const isRecording = useSharedValue(false);
  const start = (): void => {
    histogram.set(createFrameHistogram());
    isRecording.set(true);
  };
  const stop = (): FrameReport | null => {
    isRecording.set(false);
    return summarizeFrames(histogram.get());
  };
  return { histogram, isRecording, start, stop };
}

/** Worklet: call from the board host's frame callback with frame.timeSincePreviousFrame. */
export function sampleFrame(
  histogram: SharedValue<FrameHistogram>,
  isRecording: SharedValue<boolean>,
  dtMs: number | null,
): void {
  'worklet';
  if (!isRecording.get() || dtMs === null) return;
  histogram.set(recordFrame(histogram.get(), dtMs));
}
```

How it wires into doc 08's frame callbacks (doc 08 section 2.5 owns the code): each `useFrameCallback` body stays one call into its worklet runner (doc 08 rule 13), and in test builds `sampleFrame(histogram, isRecording, frameInfo.timeSincePreviousFrame)` is the first statement inside the `try` of `runBoardFrame` and `runLoopFrame`. The runner receives the frame info and the recorder's two shared values through its wiring object; `recorder` comes from `useFrameRecorder()` in the board host. On level end, pause, background or blur, the JS side calls `recorder.stop()` and appends the report to the perf log.

```ts
// packages/shell/src/app/perf/frame-report.test.ts
import { createFrameHistogram, recordFrame } from './frame-histogram.ts';
import { summarizeFrames } from './frame-report.ts';

import type { FrameHistogram } from './frame-histogram.ts';

function record(intervalsMs: readonly number[]): FrameHistogram {
  return intervalsMs.reduce(recordFrame, createFrameHistogram());
}

describe('summarizeFrames', () => {
  it('returns null when no frame was recorded', () => {
    expect(summarizeFrames(createFrameHistogram())).toBeNull();
  });

  it('reports a clean 120 Hz second as hitch-free', () => {
    const report = summarizeFrames(record(Array.from({ length: 120 }, () => 1000 / 120)));
    expect(report).toMatchObject({ refreshHz: 120, p95UpToMs: 9, hitchMsPerS: 0 });
  });

  it('charges one 50 ms stall as 41.7 ms of hitch at 120 Hz', () => {
    const intervals = [...Array.from({ length: 114 }, () => 1000 / 120), 50];
    const report = summarizeFrames(record(intervals));
    expect(report?.maxMs).toBe(50);
    expect(report?.hitchMsPerS).toBeCloseTo(41.7, 1);
  });

  it('ignores the null first-frame interval (recorded as 0)', () => {
    expect(record([0, 16.7]).frames).toBe(1);
  });
});
```

```ts
// packages/shell/src/app/perf/use-frame-recorder.test.ts
import { act, renderHook } from '@testing-library/react-native';

import { sampleFrame, useFrameRecorder } from './use-frame-recorder.ts';

describe('useFrameRecorder', () => {
  it('records only between start and stop', async () => {
    const { result } = await renderHook(() => useFrameRecorder());
    const recorder = result.current;

    sampleFrame(recorder.histogram, recorder.isRecording, 8.3);
    await act(() => {
      recorder.start();
    });
    for (const dt of [null, 8.3, 8.4, 33])
      sampleFrame(recorder.histogram, recorder.isRecording, dt);
    const report = recorder.stop();

    expect(report?.frames).toBe(3);
    expect(report?.maxMs).toBe(33);
  });
});
```

**The owner's side** (test build from TestFlight):

1. Debug menu (S15) → Performance → switch on "Record frame times".
2. Play 5 levels normally. For a real-time game, play at least 60 s.
3. Debug menu → Performance → "Share performance report" → AirDrop it to the Mac, or paste it into the chat with Claude.

**Claude's side on the simulator.** The perf log is one row in the save database, so it can be read without the share sheet:

```sh
DATA=$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)
sqlite3 "$DATA/Documents/SQLite/save.db" "SELECT payload FROM perf_log WHERE id = 1" | python3 -m json.tool
```

The database path `Documents/SQLite/<name>.db` was verified by the app-stack researcher; docs/06 owns the file name (`SAVE_DB_FILE = 'save.db'`, section 6.3).

A report entry looks like this:

```json
{ "kind": "frames", "label": "line-siege/level-12", "atEpochMs": 1790430000000,
  "data": { "frames": 1440, "seconds": 12.1, "refreshHz": 120, "p50UpToMs": 9, "p95UpToMs": 17,
            "maxMs": 41, "hitchMsPerS": 3.2, "buckets": [1398, 30, 8, 3, 1, 0, 0] } }
```

The perf log and the export:

```ts
// packages/shell/src/app/perf/perf-log.ts
import type { SqlDriver } from '@e07/shell/services/save/sql-driver.ts';

export type PerfEntry = {
  readonly kind: 'frames' | 'cold-start' | 'save-benchmark';
  readonly label: string;
  readonly atEpochMs: number;
  readonly data: Readonly<Record<string, number | null | readonly number[]>>;
};
export type PerfLog = {
  append(entry: PerfEntry): void;
  entries(): readonly PerfEntry[];
};

const MAX_ENTRIES = 200;

/** Test builds only. One JSON row in the save database (ring buffer of the last 200 entries). */
export function createPerfLog(driver: SqlDriver): PerfLog {
  driver.exec(
    'CREATE TABLE IF NOT EXISTS perf_log (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)',
  );
  const entries = (): readonly PerfEntry[] => {
    const payload = driver.get('SELECT payload FROM perf_log WHERE id = 1', [])?.['payload'];
    return typeof payload === 'string' ? (JSON.parse(payload) as PerfEntry[]) : [];
  };
  return {
    entries,
    append: (entry) => {
      const next = [...entries(), entry].slice(-MAX_ENTRIES);
      driver.run('INSERT OR REPLACE INTO perf_log (id, payload) VALUES (1, ?)', [
        JSON.stringify(next),
      ]);
    },
  };
}
```

```ts
// packages/shell/src/app/perf/share-perf-report.ts
import { Share } from 'react-native';

import type { PerfLog } from './perf-log.ts';

export type PerfReportHeader = {
  readonly appId: string;
  readonly appVersion: string;
  readonly buildNumber: string;
  readonly deviceModel: string;
};

/**
 * Debug menu (S15, test builds) > Performance > "Share performance report". Opens the iOS share
 * sheet with JSON; the owner AirDrops or pastes it to Claude. Nothing is sent by our code (N3).
 */
export async function sharePerfReport(log: PerfLog, header: PerfReportHeader): Promise<void> {
  const message = JSON.stringify({ ...header, entries: log.entries() }, null, 1);
  await Share.share({ message });
}
```

`perf_log` exists only in test builds. It lives in `save.db` next to docs/06's tables but outside `save_slots` and outside the save migrations (docs/06 section 6.3).

### 3.3 Cold-start log

**Why a native module.** React Native's own startup marks (`performance.rnStartupTiming`) begin when the JS bundle starts loading, not when the process starts. In RN 0.86 bridgeless mode, `APP_STARTUP_START` is logged inside `ReactInstance::loadScript` (source read), and `performance.now()` counts from system boot. Measured on the simulator for a small probe app (66 cold launches), process start → first frame had a median of 539 ms, and 484 ms of that (median) passed before the app's JS module ran. JS then took a median of 30 ms to the first frame. So the Shell reads the process start time from the kernel with a ~15-line Swift function.

The module lives in the Shell package, which becomes an Expo module package. On 2026-09-26, `npx expo-modules-autolinking resolve --platform apple` in the monorepo probe found the pod `E07Shell` in `packages/shell/ios`, and the same Swift code compiled and ran in a Release simulator build.

(In the next three blocks the first comment line is the path; the JSON file itself starts with `{`.)

```jsonc
// packages/shell/expo-module.config.json
{ "platforms": ["apple"], "apple": { "modules": ["ProcessStartModule"] } }
```

```ruby
# packages/shell/ios/E07Shell.podspec
Pod::Spec.new do |s|
  s.name           = 'E07Shell'
  s.version        = '1.0.0'
  s.summary        = 'Native helpers of the E07 Shell'
  s.author         = 'e07'
  s.homepage       = 'https://example.invalid'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
```

```swift
// packages/shell/ios/ProcessStartModule.swift
import Darwin
import ExpoModulesCore

public class ProcessStartModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ProcessStart")
    // Wall-clock start time of this process in epoch milliseconds (sysctl KERN_PROC_PID).
    Function("getProcessStartEpochMs") { () -> Double in
      var info = kinfo_proc()
      var size = MemoryLayout<kinfo_proc>.stride
      var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
      guard sysctl(&mib, u_int(mib.count), &info, &size, nil, 0) == 0 else { return -1 }
      let start = info.kp_proc.p_starttime
      return Double(start.tv_sec) * 1000 + Double(start.tv_usec) / 1000
    }
  }
}
```

The JS side:

```ts
// packages/shell/src/app/perf/process-start.ts
import { requireOptionalNativeModule } from 'expo';

type ProcessStartModule = { getProcessStartEpochMs(): number };

// Native side: packages/shell/ios/ProcessStartModule.swift (sysctl KERN_PROC_PID p_starttime).
const nativeModule = requireOptionalNativeModule<ProcessStartModule>('ProcessStart');

/** Wall-clock start of this process, or null (Jest, Android until ported, sysctl failure). */
export function readProcessStartEpochMs(): number | null {
  const value = nativeModule?.getProcessStartEpochMs();
  return value === undefined || value < 0 ? null : value;
}
```

```ts
// packages/shell/src/app/perf/cold-start.ts
export type ColdStartReport = {
  /** Process start -> the JS entry mark in start-shell.ts (dyld, RN init, bundle load). */
  readonly nativeMs: number | null;
  /** JS entry mark -> Home's first frame with real data. */
  readonly jsMs: number;
  /** Process start -> Home interactive. The number the < 1 s budget applies to. */
  readonly totalMs: number | null;
};

let jsEntryEpochMs: number | null = null;
let isReported = false;

/** Called once at module scope of start-shell.ts (docs/10), right after its imports. */
export function markJsEntry(nowEpochMs: number = Date.now()): void {
  jsEntryEpochMs ??= nowEpochMs;
}

/** Returns the report once per process; later calls (warm navigation to Home) return null. */
export function markHomeInteractive(
  nowEpochMs: number,
  processStartEpochMs: number | null,
): ColdStartReport | null {
  if (isReported || jsEntryEpochMs === null) return null;
  isReported = true;
  const nativeMs = processStartEpochMs === null ? null : jsEntryEpochMs - processStartEpochMs;
  return {
    nativeMs,
    jsMs: nowEpochMs - jsEntryEpochMs,
    totalMs: processStartEpochMs === null ? null : nowEpochMs - processStartEpochMs,
  };
}
```

```ts
// packages/shell/src/app/perf/use-cold-start-mark.ts
import { useEffect } from 'react';

import { markHomeInteractive } from './cold-start.ts';
import { readProcessStartEpochMs } from './process-start.ts';

import type { PerfLog } from './perf-log.ts';

/**
 * Home calls this once its data is on screen. Allowed effect: it measures, it never sets
 * state. The mark lands one frame after the commit, i.e. when Home is actually drawn.
 */
export function useColdStartMark(perfLog: PerfLog | null): void {
  useEffect(() => {
    if (perfLog === null) return undefined;
    const frame = requestAnimationFrame(() => {
      const now = Date.now();
      const report = markHomeInteractive(now, readProcessStartEpochMs());
      if (report !== null)
        perfLog.append({ kind: 'cold-start', label: 'home', atEpochMs: now, data: report });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [perfLog]);
}
```

```ts
// packages/shell/src/app/perf/cold-start.test.ts
import { markHomeInteractive, markJsEntry } from './cold-start.ts';

describe('cold-start marks', () => {
  it('reports native, JS and total time once per process', () => {
    markJsEntry(10_500);

    expect(markHomeInteractive(10_900, 10_000)).toStrictEqual({
      nativeMs: 500,
      jsMs: 400,
      totalMs: 900,
    });
    expect(markHomeInteractive(20_000, 10_000)).toBeNull();
  });
});
```

**Call sites.**

- `markJsEntry()` runs once at module scope of `start-shell.ts` (docs/10 section 3.10), the first Shell module that `apps/<game>/index.ts` imports, right after its imports and before `startShell()` runs the direction check. It is a pure in-memory mark, which docs/02 rule 16 and docs/10 allow at import time; after a direction reload the new JS runtime marks again.
- Home calls `useColdStartMark(perfLog)` after its data is on screen. `perfLog` comes from `TEST_ONLY` (for example `TEST_ONLY?.createPerfLog(driver) ?? null`), so it is `null` in store builds and the perf log is not in the store bundle (rule 9).
- A launch that flips direction and calls `reloadAppAsync` is slower by design. Label those runs and leave them out of the budget.

**Simulator run** (inside `npm run e2e:ios`, after the smoke flows). A tooling script does, 6 times: `xcrun simctl terminate`, then `xcrun simctl launch`, then waits for `perf_log` to gain a `cold-start` entry. It drops the first run, takes the median, and compares it with the committed baseline × 1.2. Reference from the benchmark probe (66 runs): host `simctl launch` → first frame had a median of 648 ms, and process start → first frame a median of 539 ms.

### 3.4 Save-write performance

The Jest guard runs docs/06's real SQL through the `SqlDriver` on Node's built-in `node:sqlite` (FINAL A.6). It uses WAL with `synchronous = FULL` and the largest realistic document, validated by docs/06's schema: 90 levels, 60 daily results (docs/06 prunes older ones) and a 200-move run. Each write is the per-move write, `current` only (docs/06 section 6.9).

```ts
// test/integration/save/save-write.perf.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// The RN Jest preset replaces global performance.now with a 1 ms Date.now mock.
import { performance } from 'node:perf_hooks';

import { addDays } from '@e07/game-kit/dates/date-key.ts';
import { encodeSaveDoc, validateSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import { createNodeSqliteSqlDriver } from './node-sqlite-sql-driver.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const WRITES = 300;
const WARMUP = 20;
const P95_BUDGET_MS = 5; // FINAL-DECISIONS D.47
const META = { appVersion: '1.0.0', writtenAtMs: 1_790_000_000_000, writeCount: 1 };
const TODAY = '2026-09-26';

/** Worst realistic document (docs/06): 90 levels, 60 daily results, a 200-move run. */
function makeLargeSaveDoc(): SaveDoc {
  const base = createDefaultSaveDoc('line-siege');
  const levels = Object.fromEntries(
    Array.from({ length: 90 }, (_, i) => [
      String(i + 1),
      { stars: 3, bestScore: 1000 + i, bestMoves: 7, completions: 2, firstCompletedOn: TODAY },
    ]),
  );
  const results = Object.fromEntries(
    Array.from({ length: 60 }, (_, i) => [
      addDays(TODAY, -i),
      { won: i % 3 !== 0, score: i * 7, moves: 11, playMs: 120_000 },
    ]),
  );
  const log = Array.from({ length: 200 }, (_, i) => ({
    kind: 'move' as const,
    move: { column: i % 7 },
  }));
  const candidate: unknown = {
    ...base,
    progress: { ...base.progress, levels },
    daily: { ...base.daily, results },
    run: {
      ref: { kind: 'level', level: 12 },
      seed: 42,
      difficulty: 12,
      stateVersion: 1,
      state: { columns: [3, 1, 4, 1, 5, 9, 2], score: 4210 },
      log,
      moveCount: 200,
      undoCount: 0,
      hintsUsed: 0,
      continuesUsed: 0,
      playMs: 900_000,
      resumeOnLaunch: true,
    },
  };
  const checked = validateSaveDoc(candidate);
  if ('error' in checked) throw new Error(`large save fixture is invalid: ${checked.error}`);
  return checked.doc;
}

function percentile(sortedMs: readonly number[], p: number): number {
  const index = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[index] ?? Number.NaN;
}

describe('SqliteSaveStore write performance', () => {
  it('writes the largest realistic save with p95 under 5 ms (WAL + synchronous FULL)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'save-perf-'));
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    const store = createSqliteSaveStore(driver);
    const record = encodeSaveDoc(makeLargeSaveDoc(), META);
    const samples: number[] = [];
    for (let i = 0; i < WARMUP + WRITES; i += 1) {
      const start = performance.now();
      store.write({ current: record }); // the per-move write: current only (docs/06 section 6.9)
      if (i >= WARMUP) samples.push(performance.now() - start);
    }
    driver.close();
    rmSync(dir, { recursive: true, force: true });
    samples.sort((a, b) => a - b);
    const p95 = percentile(samples, 95);
    console.warn(`save write p50=${percentile(samples, 50).toFixed(2)}ms p95=${p95.toFixed(2)}ms`);
    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });
});
```

It lives in the root `test/integration/save/` folder, next to its Node driver (doc 03's integration-test home, doc 04 open issue 1), because doc 04 bans `node:*` imports in `packages/shell/src/**` (tests included), and only the root tsconfig has Node types. Jest runs it in the `unit` project with everything else. Measured on the Mac: p50 0.09–0.12 ms and p95 0.14–0.17 ms in the lab (including inside a full parallel run), and p50 0.01 ms, p95 0.02 ms in the integration re-run against docs/06's real store on 2026-09-26. So the 5 ms budget, with more than 30× headroom, is a stable regression guard. It catches a missing transaction or a quadratic serializer, not device I/O. The driver (`createNodeSqliteSqlDriver` in `node-sqlite-sql-driver.ts`), `createSqliteSaveStore`, `encodeSaveDoc` and `validateSaveDoc` are docs/06's.

**On the device**, Debug menu → Performance → "Run save benchmark" (`packages/shell/src/app/perf/save-benchmark.ts`, test-only) writes the same document 300 times into a scratch database (`perf-bench.db`, never the real save) through the `expo-sqlite` driver. It times each write with `performance.now()`, which is high-resolution on device (the `PERF_CLOCK_FILES` exemption in doc 04's ESLint config), and appends `{ kind: 'save-benchmark', data: { p50, p95, max } }` to the perf log.

### 3.5 Draw-call budget

Doc 08 owns the test: each game's `draw-board.test.ts` feeds its busiest frame (a turn's timeline sampled mid-animation) to `drawBoard` through a recording canvas. It counts every canvas call and records every drawn text, then asserts the game's budget. It runs in the `unit` project, because `draw` receives its Skia objects through `kit` and imports no Skia. Skia's JSI module does not load in the `unit` project (verified error: "Native Skia Module failed to correctly install JSI Bindings!"), so this design is what makes the test cheap.

This doc adds only the ceiling. A game's budget constant must be ≤ `perf.drawCallsPerFrameMax` (1,000) in `quality-gates.json`. Raising a game above its current number needs a frame-recorder report from the owner's device showing a hitch rate ≤ 10 ms/s at the new count.

### 3.6 Re-renders and per-frame data

- The `<Profiler>` guard test is in doc 05 [3.5](05-components-hooks-styling.md#35-zustand-in-components). Use it for Home, the Game screen top bar, and any component that shows a live counter.
- HUD numbers (score, moves) change once per move. They come from the session store through a primitive selector, never from a shared value read on the JS thread every frame.
- A per-frame UI-thread value that must reach JS (a real-time score) is batched once per frame with `scheduleOnRN` and throttled to the display (FINAL B.13), then written to the session store.

### 3.7 Performance rules in practice

**Skia Picture cost.** Recording a picture costs roughly one command per draw call, and replaying it costs the GPU work. Reduce both:

| Do | Instead of |
|---|---|
| Create paints, colours and paths once at module scope (the pattern the Skia docs use) | `Skia.Paint()` / `Skia.Color('#…')` inside the per-frame worklet |
| Draw static backgrounds (grid, frame) as retained nodes or one cached picture | Re-recording the static layer every frame |
| Use `<Atlas>` for 100+ identical sprites | One `drawImage`/`drawCircle` each |
| Stop the frame callback when the timeline ends | Leaving it running on an idle board |

**Memory.**

| Item | Cost | Source |
|---|---|---|
| One Skia `<Canvas>` (48 × 15 pt, 3×) | ≈ 0.18 MB, ≈ 2.8 ms to mount | measured, doc 05 3.9 |
| One rasterized icon (24 pt at 3×) | 0.3–1.4 KB PNG | measured |
| A pre-rendered texture | w × h × 4 bytes (1024² = 4 MB) | arithmetic |
| One second of mono float audio at 48 kHz | 192 KB | arithmetic (doc 09) |
| Probe app baseline / + 90 Skia canvases | 42 MB / 66 MB | measured |

**Bundle and polyfill cost** (SDK 57, `npx expo export --platform ios`, measured):

| Build | Minified JS (`--no-bytecode`) | Hermes bytecode |
|---|---|---|
| Services spike without FormatJS polyfills | 1,136,696 B | 1,813,398 B |
| Services spike with the forced polyfills (en, de, fa, ckb) | 1,983,418 B | 2,404,414 B |
| Benchmark probe (Skia, Reanimated, RNGH, audio, FlashList) | 2,314,613 B | 3,155,700 B |

The polyfills cost 0.85 MB of JS and loaded in 11 ms on the simulator (services spike). That is accepted, because Hermes lacks `PluralRules`, `Locale` and numbering systems (FINAL C.29). Hermes memory-maps the bytecode, so size matters mostly through the module initialisation work it implies.

**Hermes.** Hermes V1 is the default engine in RN 0.86 (doc 01 ADR-01; its `hermes-engine` podspec falls back to the old Hermes only when `RCT_HERMES_V1_ENABLED=0`). Do not set that variable, and do not add a JS engine switch. Measure only Release builds, where the bundle is precompiled to bytecode.

### 3.8 Accessibility in the components

| Element | Role | Name | State / value |
|---|---|---|---|
| `PrimaryButton`, `IconButton`, `TileButton` | `button` | translated label | `disabled`, `busy` |
| Level tile | `button` | "Level 12: 2 stars" / "Level 41, locked" | hint on locked tiles: "Shows how to unlock this level." |
| Settings toggle row | `switch` (the row is one element) | row label | `checked` |
| Volume row | `adjustable` | row label | `accessibilityValue {min:0,max:100,now}` + increment/decrement |
| Tabs (pack tabs) | `tab` | pack name | `selected` |
| Section titles | `header` (via `AppText isHeader`) | the title | — |
| Board | `image` (doc 08 `BoardCanvas`) | `t()` of `board.describe(view)` | updated with every view |
| Pause and dialogs | container with `accessibilityViewIsModal` | title | — |

**Text scaling.** React Native's iOS `fontScale` for each content-size category (from `RCTAccessibilityManager.mm`, confirmed on the simulator for the three sizes marked ✓):

| `simctl ui … content_size` | `fontScale` | Body 17 pt becomes (capped at 2×) |
|---|---|---|
| `large` (default) | 1.0 ✓ | 17 |
| `extra-extra-extra-large` | 1.353 | 23 |
| `accessibility-medium` | 1.786 ✓ | 30.4 |
| `accessibility-large` | 2.143 | 34 (cap) |
| `accessibility-extra-extra-extra-large` | 3.571 ✓ | 34 (cap) |

**Contrast.** Pure WCAG 2.2 maths (sRGB linearisation threshold 0.04045):

```ts
// packages/shell/src/theme/contrast.ts
export type Rgb = { readonly r: number; readonly g: number; readonly b: number };

/** '#RRGGBB' -> channels 0..1. Palettes use 6-digit hex only (no alpha: contrast needs opaque). */
export function parseHex(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const [, r = '0', g = '0', b = '0'] = match;
  return { r: parseInt(r, 16) / 255, g: parseInt(g, 16) / 255, b: parseInt(b, 16) / 255 };
}

/** sRGB transfer function, WCAG 2.2 definition (threshold 0.04045). */
export function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
```

**Colour-blind separation.** This uses the Machado–Oliveira–Fernandes (2009) matrices at severity 1.0, applied to linear sRGB, and measures distance in OKLab (Ottosson), where one just-noticeable difference is about 0.02 (CSS Color 4).

```ts
// packages/shell/src/theme/cvd.ts
import { parseHex, toLinear } from './contrast.ts';

type Matrix = readonly [number, number, number, number, number, number, number, number, number];
type Vector = readonly [number, number, number];
export type Deficiency = 'protanopia' | 'deuteranopia' | 'tritanopia';

/** Machado, Oliveira & Fernandes (2009), severity 1.0. */
const MACHADO: Readonly<Record<Deficiency, Matrix>> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
};
const LINEAR_TO_LMS: Matrix = [
  0.4122214708, 0.5363325363, 0.0514459929, 0.2119034982, 0.6806995451, 0.1073969566, 0.0883024619,
  0.2817188376, 0.6299787005,
];
const LMS_TO_OKLAB: Matrix = [
  0.2104542553, 0.793617785, -0.0040720468, 1.9779984951, -2.428592205, 0.4505937099, 0.0259040371,
  0.7827717662, -0.808675766,
];

function multiply(m: Matrix, [x, y, z]: Vector): Vector {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z,
  ];
}

function clamp01(v: Vector): Vector {
  return [
    Math.min(1, Math.max(0, v[0])),
    Math.min(1, Math.max(0, v[1])),
    Math.min(1, Math.max(0, v[2])),
  ];
}

/** Linear sRGB -> OKLab (Ottosson 2020). */
function toOklab(linear: Vector): Vector {
  const [l, m, s] = multiply(LINEAR_TO_LMS, linear);
  return multiply(LMS_TO_OKLAB, [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)]);
}

export function simulatedOklab(hex: string, deficiency: Deficiency | 'none'): Vector {
  const { r, g, b } = parseHex(hex);
  const linear: Vector = [toLinear(r), toLinear(g), toLinear(b)];
  return toOklab(deficiency === 'none' ? linear : clamp01(multiply(MACHADO[deficiency], linear)));
}

/** Smallest OKLab distance between any two colours as seen with the deficiency. 0.02 = 1 JND. */
export function minPairwiseDistance(
  colors: readonly string[],
  deficiency: Deficiency | 'none',
): number {
  const points = colors.map((hex) => simulatedOklab(hex, deficiency));
  let min = Number.POSITIVE_INFINITY;
  for (const [i, a] of points.entries()) {
    for (const b of points.slice(i + 1)) {
      min = Math.min(min, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    }
  }
  return min;
}
```

Calibration (smallest pairwise OKLab distance, measured):

| Set | Normal | Protanopia | Deuteranopia | Tritanopia | Verdict at 0.07 |
|---|---|---|---|---|---|
| Okabe-Ito, 8 colours | 0.156 | 0.096 | 0.076 | 0.085 | pass |
| Okabe-Ito, 5 colours | 0.156 | 0.114 | 0.110 | 0.086 | pass |
| Red / green / blue / orange | 0.186 | **0.007** | **0.039** | 0.068 | fail |
| Tableau subset (6) | 0.139 | 0.038 | **0.007** | 0.089 | fail |

```ts
// packages/shell/src/testing/palette-checks.ts
import { contrastRatio } from '@e07/shell/theme/contrast.ts';
import { minPairwiseDistance } from '@e07/shell/theme/cvd.ts';

import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

type Pair = readonly [keyof ColorTokens, keyof ColorTokens, number];

/** WCAG 2.2 AA: 4.5:1 for text (1.4.3), 3:1 for icons and control shapes (1.4.11). */
const PAIRS: readonly Pair[] = [
  ['text', 'background', 4.5],
  ['text', 'surface', 4.5],
  ['textMuted', 'background', 4.5],
  ['textMuted', 'surface', 4.5],
  ['onPrimary', 'primary', 4.5],
  ['danger', 'background', 4.5],
  ['icon', 'background', 3],
  ['icon', 'surface', 3],
  ['primary', 'background', 3],
  ['starOn', 'surface', 3],
  ['starOff', 'surface', 3],
];
/** 3.5 JND in OKLab. Okabe-Ito passes (0.076); red/green sets fail (0.007). */
export const MIN_CVD_DISTANCE = 0.07;

function checkTokens(where: string, tokens: ColorTokens): readonly string[] {
  return PAIRS.filter(([fg, bg, min]) => contrastRatio(tokens[fg], tokens[bg]) < min).map(
    ([fg, bg, min]) =>
      `${where}: ${fg} on ${bg} is ${contrastRatio(tokens[fg], tokens[bg]).toFixed(2)}:1 < ${String(min)}:1`,
  );
}

/** Returns human-readable failures; an accessible palette returns []. */
export function checkPaletteContrast(palette: Palette): readonly string[] {
  return Object.entries(palette).flatMap(([mode, schemes]) =>
    Object.entries(schemes).flatMap(([scheme, tokens]) => checkTokens(`${mode}.${scheme}`, tokens)),
  );
}

/** Colours that tell game pieces apart must stay apart for protan, deutan and tritan eyes. */
export function checkCategoricalColors(colors: readonly string[]): readonly string[] {
  const deficiencies = ['protanopia', 'deuteranopia', 'tritanopia'] as const;
  return deficiencies
    .map((deficiency) => [deficiency, minPairwiseDistance(colors, deficiency)] as const)
    .filter(([, distance]) => distance < MIN_CVD_DISTANCE)
    .map(
      ([deficiency, distance]) =>
        `${deficiency}: closest pair ${distance.toFixed(3)} < ${String(MIN_CVD_DISTANCE)}`,
    );
}
```

```ts
// packages/shell/src/testing/palette-checks.test.ts
import { checkCategoricalColors, checkPaletteContrast } from './palette-checks.ts';
import { TEST_PALETTE } from './test-palette.ts';

describe('palette checks', () => {
  it('accepts the fixture palette in every mode and scheme', () => {
    expect(checkPaletteContrast(TEST_PALETTE)).toStrictEqual([]);
  });

  it('flags grey text that is too light', () => {
    const light = { ...TEST_PALETTE.standard.light, textMuted: '#9A9A9A' };
    const palette = { ...TEST_PALETTE, standard: { ...TEST_PALETTE.standard, light } };
    expect(checkPaletteContrast(palette)).toHaveLength(2);
  });

  it('accepts Okabe-Ito and rejects a red/green piece set', () => {
    expect(
      checkCategoricalColors(['#E69F00', '#56B4E9', '#009E73', '#0072B2', '#D55E00']),
    ).toStrictEqual([]);
    expect(checkCategoricalColors(['#D62728', '#2CA02C', '#1F77B4', '#FF7F0E'])).not.toStrictEqual(
      [],
    );
  });
});
```

Each game adds a two-line test that feeds its palette and its categorical piece colours to these checks. A failing message names the pair and the ratio, for example `standard.light: textMuted on background is 2.81:1 < 4.5:1` (verified with `#9A9A9A` on white).

Increase Contrast: palettes meet AA by default, so no separate high-contrast palette is required (HIG: provide one only if the default does not meet the minimum).

**VoiceOver on boards.** Doc 08's `BoardCanvas` is the single accessible element of the board (`accessible`, `accessibilityRole="image"`, `accessibilityLabel` = `t()` of `board.describe(view)`). Results and important events are announced as well, but only while VoiceOver runs:

```ts
// packages/shell/src/app/use-announce.ts
import { AccessibilityInfo } from 'react-native';
import { useStore } from 'zustand';

import { systemA11yStore } from './system-a11y-store.ts';

/** Returns announce(text): speaks through VoiceOver only when VoiceOver is running. */
export function useAnnounce(): (text: string) => void {
  const isScreenReaderOn = useStore(systemA11yStore, (state) => state.isScreenReaderOn);
  return (text) => {
    if (isScreenReaderOn) AccessibilityInfo.announceForAccessibility(text);
  };
}
```

Games that can be played by tapping can later add `accessibilityActions`. That is out of scope for v1, because spec 8.11 asks for a summary "where practical".

### 3.9 Testing accessibility

**RNTL helper.** It walks the rendered host tree, finds every element with a press handler, and returns one message per missing role or accessible name (a label, or visible text inside). It returns a list instead of calling `expect` because doc 04 bans test globals outside `*.test.ts(x)` files. Verified: it returns `[]` for the Shell buttons and reports a `Pressable` without a label and one without a role.

```ts
// packages/shell/src/testing/find-inaccessible-pressables.ts
import type { TestInstance, TestNode } from 'test-renderer';

function isPressable(node: TestInstance): boolean {
  return typeof node.props['onClick'] === 'function' || typeof node.props['onPress'] === 'function';
}

function hasText(node: TestNode): boolean {
  if (typeof node === 'string') return node.trim() !== '';
  return node.children.some(hasText);
}

function describeNode(node: TestInstance): string {
  const testId: unknown = node.props['testID'];
  return typeof testId === 'string' ? testId : `<${node.type}>`;
}

/**
 * Every pressable host element needs a role and a name (label or visible text).
 * Use at the end of every screen test:
 *   expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
 */
export function findInaccessiblePressables(root: TestInstance): readonly string[] {
  return root.queryAll(isPressable).flatMap((node) => {
    const role: unknown = node.props['accessibilityRole'] ?? node.props['role'];
    const label: unknown = node.props['accessibilityLabel'];
    const problems: string[] = [];
    if (typeof role !== 'string') problems.push(`${describeNode(node)}: no role`);
    if (!(typeof label === 'string' && label !== '') && !hasText(node)) {
      problems.push(`${describeNode(node)}: no accessible name`);
    }
    return problems;
  });
}
```

Examples in use: `primary-button.test.tsx` (doc 05 3.2) and `level-grid.test.tsx`. Names are the real English catalog text, because doc 07's `renderWithShell` renders with the English catalog (entries in doc 05 3.9):

```tsx
// packages/shell/src/screens/levels/level-grid.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { LevelGrid } from './level-grid.tsx';

import type { PackView } from './level-grid.tsx';

const PACKS: readonly PackView[] = [
  {
    id: 'pack-1',
    title: 'Pack 1',
    progressLabel: '4 / 90',
    tiles: [
      { level: 1, numberText: '1', stars: 3, isLocked: false },
      { level: 2, numberText: '2', stars: 1, isLocked: false },
      { level: 3, numberText: '3', stars: 0, isLocked: true },
    ],
  },
];

describe('LevelGrid', () => {
  it('names every tile for screen readers and opens the tapped level', async () => {
    const onSelectLevel = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(<LevelGrid packs={PACKS} onSelectLevel={onSelectLevel} />);

    await user.press(screen.getByRole('button', { name: 'Level 2: 1 star' }));

    expect(onSelectLevel).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: 'Level 3, locked' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Pack 1' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
```

**Maestro at the largest text size.** The flows are tagged `a11y`. Doc 07's `e2e:ios` runner resets the size to `large`, so this pass sets the size itself, runs only the `a11y` flows with the same `-e` values and environment as doc 07's runner, and resets the size after:

```sh
# Java 17 the way doc 07's runner finds it: java_home, else Android Studio's bundled JBR.
export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || echo '/Applications/Android Studio.app/Contents/jbr/Contents/Home')"
export MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true MAESTRO_DISABLE_UPDATE_CHECK=true
xcrun simctl ui "$UDID" content_size accessibility-extra-extra-extra-large
tools/maestro/bin/maestro test packages/shell/e2e/flows/a11y --udid "$UDID" --include-tags a11y \
  -e APP_ID="$BUNDLE_ID" -e APP_SCHEME="$APP_SCHEME" -e LANG=fa \
  --format JUNIT --output reports/e2e/a11y-fa.xml --test-output-dir reports/e2e/a11y-fa
xcrun simctl ui "$UDID" content_size large
```

```yaml
# packages/shell/e2e/flows/a11y/01-large-text-core-screens.yaml
appId: ${APP_ID}
name: Core screens stay usable at 200% text
tags: [a11y]
---
- launchApp:
    clearState: true
- runFlow:
    file: ../../subflows/debug-setup.yaml
    env:
      QUERY: 'lang=${LANG}&theme=light&seed=42&date=2026-09-26&ads=off&firstRun=0&reduceMotion=1'
      WAIT_FOR: 'home.screen'
- assertVisible: { id: 'home.play-button' }
- scrollUntilVisible: { element: { id: 'home.levels-button' } }
- takeScreenshot: 'a11y/${LANG}-home'
- tapOn: { id: 'home.levels-button' }
- assertVisible: { id: 'levels.level-tile.1' }
- takeScreenshot: 'a11y/${LANG}-levels'
- tapOn: { id: 'levels.top-bar.back-button' }
- tapOn: { id: 'home.settings-button' }
- scrollUntilVisible: { element: { id: 'settings.reset-progress-row' } }
- takeScreenshot: 'a11y/${LANG}-settings'
```

The debug deep link, its parameters and the `debug-setup.yaml` subflow (which also taps iOS's "Open" confirmation) belong to doc 07. testIDs follow doc 03 (`<screen>.<element>`, and a top bar's parts as `<screen>.top-bar.<part>`). No step depends on the text size, so the normal `e2e:ios` pass may run the flow too. Maestro 2.10.0 was verified on this simulator with a probe flow: `launchApp` with arguments, `assertVisible` and `tapOn` by `id`, and `takeScreenshot`, all at `accessibility-extra-extra-extra-large`. The flow above passes `maestro check-syntax`; it has not run against a real Shell build yet. Claude inspects the screenshots with the Read tool for clipped or overlapping text. The owner reviews the gallery.

### 3.10 Owner VoiceOver checklist

Run it once per release candidate, on a TestFlight build, in **English and in Persian**. It takes about 15 minutes.

**Setup, once:** Settings → Accessibility → Accessibility Shortcut → VoiceOver. After that, a triple-click of the side button switches VoiceOver on and off. Gestures: swipe right = next item, swipe left = previous, double-tap = activate, two-finger swipe up = read everything, two-finger scrub ("Z") = back.

1. **Launch.** The first thing read is the screen's title. No element is read as just "button".
2. **Language screen (first launch):** each language name is spoken in its own language (Persian and Sorani are not read with an English voice).
3. **Home:** swiping visits elements in visual order (in Persian, starting at the top right). The Play button reads like "Continue, level 12, button".
4. **Levels:** a tile reads its number and stars ("Level 3: 2 stars, button"). A locked tile says it is locked, and double-tapping it tells how to unlock it.
5. **Game:** the board reads its summary. After a move a short announcement is heard. Pause is reachable, and the two-finger scrub opens Pause instead of leaving the game.
6. **Pause and dialogs:** while open, VoiceOver cannot reach anything behind them.
7. **Settings:** switches say "on"/"off". Volume changes with a one-finger swipe up/down. "Reset all progress" can be confirmed without holding the button.
8. **Premium:** the price is read in the local currency, and "busy" is announced while a purchase is in progress.
9. **Result screen:** the result and the stars are read before the Next button.

Report each problem as: screen, language, what was expected, what was heard. Claude turns each report into a failing RNTL or Maestro test first (FINAL D.41).

---

## 4. Checklist

Before calling performance- or accessibility-relevant work done:

- [ ] `npm run verify` is green. That includes the save perf test, the draw-call budget (`draw-board.test.ts`, `unit` project), the contrast and colour-blind checks, and the accessibility helpers.
- [ ] No per-frame React state, no Skia allocation in a per-frame worklet, and every new frame callback stops when idle (doc 08 lifecycle).
- [ ] New screens: every test ends with `expect(findInaccessiblePressables(screen.container)).toStrictEqual([])`, every interactive element is at least 44 pt, every board canvas is one `image` element labelled from `board.describe(view)` (doc 08), and overlays set `accessibilityViewIsModal`.
- [ ] New palette or categorical colours: `checkPaletteContrast` and `checkCategoricalColors` return `[]`.
- [ ] The a11y Maestro flows pass at `accessibility-extra-extra-extra-large` in en and fa, and the screenshots show nothing clipped.
- [ ] Bundle size is within `perf.bundleJsBytesMax` and at most 10% over the baseline, otherwise a `Gate-Change:` trailer explains why.
- [ ] Before a release: the owner's performance report (cold start, frame times, save benchmark) is within budget, and the owner's VoiceOver checklist has no open items.

---

## 5. Sources

- Apple: [Understanding hitches in your app](https://developer.apple.com/documentation/xcode/understanding-hitches-in-your-app) (hitch-rate thresholds 10 / 25 / 50 ms/s; 120 Hz = 8.3 ms per frame) · [HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) (44 × 44 pt; contrast 4.5:1 / 3:1; Reduce Motion guidance)
- W3C: [WCAG 2.2](https://www.w3.org/TR/WCAG22/) (relative luminance with 0.04045; contrast minimum; non-text contrast) · [CSS Color 4](https://www.w3.org/TR/css-color-4/) (one OKLab JND = 0.02)
- Colour science: [Machado, Oliveira, Fernandes 2009 CVD matrices](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html) · [OKLab (Ottosson)](https://bottosson.github.io/posts/oklab/)
- React Native: [Performance](https://reactnative.dev/docs/performance) · [Hermes](https://reactnative.dev/docs/hermes) · [Accessibility](https://reactnative.dev/docs/accessibility) · [AccessibilityInfo](https://reactnative.dev/docs/accessibilityinfo) · [Text (maxFontSizeMultiplier)](https://reactnative.dev/docs/text)
- React: [Profiler](https://react.dev/reference/react/Profiler)
- Reanimated: [useFrameCallback](https://docs.swmansion.com/react-native-reanimated/docs/advanced/useFrameCallback/) · [ReducedMotionConfig](https://docs.swmansion.com/react-native-reanimated/docs/device/ReducedMotionConfig/)
- Skia: [Canvas](https://shopify.github.io/react-native-skia/docs/canvas/overview)
- Expo: [Expo Modules API: get started](https://docs.expo.dev/modules/get-started/) · [Module API reference](https://docs.expo.dev/modules/module-api/)
- Testing: [React Native Testing Library](https://callstack.github.io/react-native-testing-library/) · [Maestro docs](https://docs.maestro.dev/)
- Local source read on 2026-09-26: `react-native@0.86.3` `ReactCommon/react/nativemodule/webperformance/NativePerformance.cpp` (`now()` = time since boot; startup timing), `ReactCommon/react/runtime/ReactInstance.cpp` (`APP_STARTUP_START` at `loadScript`), `React/CoreModules/RCTAccessibilityManager.mm` (font-scale table); `@testing-library/react-native@14.0.1` `docs/api/screen.md`, `docs/api/accessibility.md`; `test-renderer@1.2.0` `TestInstance.queryAll`.

---

## Verified

On **2026-09-26** with Expo SDK 57.0.25, React Native 0.86.3 (Hermes, New Architecture), React 19.2.3, Reanimated 4.5.1, Worklets 0.10.1, Skia 2.6.2, Zustand 5.0.15, TypeScript 6.0.3, ESLint 9.39.5, Jest 29.7.0 + jest-expo 57.0.5, RNTL 14.0.1 + test-renderer 1.2.0, Node 26.4.0 (`node:sqlite`), Xcode 26.6, the iOS 26.5 simulator (iPhone 17 Pro), and Maestro CLI 2.10.0 with Java 17.0.11.

- **Code.** All TypeScript in this doc passed in `scratchpad/rn/writer-comp-perf/lab2` (an npm-workspaces copy shaped like FINAL A.8). The checks were doc 04's `eslint.config.mjs` verbatim plus doc 05 3.12 (which adds the `PERF_CLOCK_FILES` exemption), doc 04's tsconfig projects, Prettier, and Jest (42 tests in the `unit` and `golden` projects). After review, the code was re-run in `scratchpad/rn/verify-ui-perf-a11y` against the then-current doc 04 config, doc 10's typed `t()` and `I18nProvider` with the English catalog (the doc 07-style `renderWithShell` from doc 05 open issue 7), and `maestro check-syntax` on the a11y flow.
- **Native module.** The `ProcessStart` Swift module compiled in a Release simulator build and returned plausible process start times (process start → first frame, median 539 ms over 66 launches). Autolinking resolved the `E07Shell` pod from `packages/shell/ios` in a monorepo copy. **Not verified:** a physical iPhone and a TestFlight build.
- **Measured.** Save write on the Mac (p50 about 0.1 ms, p95 about 0.15 ms). Bundle sizes (3.7). Simulator footprints and grid timings (doc 05 3.9). Text scale factors 1.0 / 1.786 / 3.571 with the 2× cap. Maestro `id` selectors at the largest text size. The CVD calibration table. `#767676` on white = 4.54:1 and black on white = 21:1 as sanity checks of `contrastRatio`.
- **Negative tests.** `findInaccessiblePressables` returns `['zz.no-name: no accessible name', 'zz.no-role: no role']` for a nameless and a roleless `Pressable`, and accepts one whose name comes from its visible text. The `<Profiler>` guard fails on an extra store subscription. The Jest-preset `performance.now` mock gives 1 ms resolution.
- **Not measured, and why:** 120 Hz frame times (the simulator caps at 60 fps), device cold start, and device save time. These are the owner's steps in 3.2–3.4.

- **Integration pass (2026-09-26, `scratchpad/integ/ws`, a copy of docs/02 and docs/06's verified workspace).** `save-write.perf.test.ts` was rewritten against docs/06's real `SaveStore` and passed `tsc`, docs/04's ESLint (with docs/02's app zones), Prettier and Jest (p50 0.01 ms, p95 0.02 ms). `markJsEntry()` was wired into docs/10's `start-shell.ts` and both files passed `tsc`, ESLint and Prettier.
- **Final fixes (2026-09-26, `scratchpad/fix-final`).** `level-grid.test.tsx` and `palette-checks.test.ts` pass with docs/07's new `renderWithShell` and docs/05's `TEST_PALETTE` (jest-expo 57.0.5, RNTL 14.0.1). Every `app/perf/` file of this doc lints clean under docs/04's merged config, where `cold-start.ts` and `use-cold-start-mark.ts` read the clock through `PERF_CLOCK_FILES`.

**Re-verify when versions move.** Run `npx expo install --check`. After an SDK bump, re-run the bundle export table, the cold-start simulator run and the doc 05 list benchmark. Check that `useFrameCallback`'s `FrameInfo` still has `timeSincePreviousFrame` (`react-native-reanimated/lib/typescript/frameCallback/FrameCallbackRegistryUI.d.ts`). Check that `performance.rnStartupTiming` still starts at bundle load, and that `RCTAccessibilityManager.mm` still has the same multipliers.

---

## Open issues

1. **Resolved: where the Node `SqlDriver` lives.** docs/06 names it `createNodeSqliteSqlDriver` in `test/integration/save/node-sqlite-sql-driver.ts`, the save perf test sits next to it, and docs/07's `jest.config.js` keeps root `test/**` in the `unit` project.
2. **Resolved: native code in `packages/shell`.** docs/02's tree and file-placement table now include `packages/shell/ios/` and `packages/shell/expo-module.config.json` for the `ProcessStart` module (pod `E07Shell`); JS-only timing would miss about 90% of the launch on the simulator.
3. **Where the simulator cold-start and memory checks run.** No canonical script exists for them (FINAL F). This doc puts them inside `npm run e2e:ios`, and the bundle-size check inside `npm run audit:network`, which already exports the bundle. docs/07's `run-e2e-ios.ts` (owner of `e2e:ios`) does not do either yet, and it fixes the text size at `large`. It should add the cold-start/footprint step and a `--text-size` option, so the `a11y` pass in 3.9 needs no hand-run commands (`screenshots:ios` already has `--text-size`).
4. **Budgets without device data yet.** The 6 MB bundle cap, the 150 MB memory cap and the 1,000 draw-call ceiling are first estimates from probes. Tighten them after the pilot game's first owner report, with a `Gate-Change:` trailer. The `perf` and `a11y` keys in `quality-gates.json` (docs/16) are read by tests, not compared by `check-quality-gates.ts`; the file is a gated path, so changing a budget needs the `Gate-Change:` trailer.
5. **Hooks docs/08 still has to add.** (a) Resolved: docs/08 section 2.5 puts `sampleFrame(...)` first inside the `try` of `runBoardFrame` and `runLoopFrame`. (b) Rule 24 needs the smallest board hit region, cell size plus 2 × docs/08's `HIT_SLOP` (8 pt), exposed from `BoardLayout`, so each game can assert ≥ 44 pt at 402 × 874 pt. (c) Suggested: `accessibilityIgnoresInvertColors` on `BoardCanvas`, so Smart Invert does not change a palette that already has a dark variant.
6. **Reduce-motion navigation transitions.** Rule 28 needs fade transitions on the native stack when `useReduceMotion()` is true; docs/06 open issue 10 tracks it.
7. **Resolved: docs/07 and docs/14 follow-ups.** docs/07 rule 26 names the 44 × 44 pt touch-box assertion as an allowed style assertion, and docs/14's `test-only-entry.ts` list includes this doc's perf exports (`createPerfLog`, `sharePerfReport`, the save benchmark, the debug menu's Performance section).
