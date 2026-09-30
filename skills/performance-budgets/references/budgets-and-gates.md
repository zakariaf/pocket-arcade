# Budgets and quality-gates.json

The numbers every game must stay within, where each is measured, and how a budget may change.

## Contents

- Three places, three jobs
- The budget table
- quality-gates.json
- Changing a budget
- Budgets that are first estimates

## Three places, three jobs

| Where | What it proves | Who runs it |
|---|---|---|
| **The owner's iPhone** (TestFlight test build) | The truth: cold start, frame times and save time on real hardware at 120 Hz | The owner, from the debug menu; Claude reads the exported JSON |
| **The iOS simulator** (Release, test variant) | Regressions: launch time, memory footprint, layouts at 200 % text | Claude, with the tooling scripts and Maestro |
| **Jest** | Fast guards that fail a commit: save write time, draw calls per frame, re-render boundaries | Claude, through `npm run verify` |

The simulator is not a device: it runs on the Mac's CPU and caps at 60 fps, so its numbers are only compared with earlier simulator numbers. Measure only **Release** builds of the test variant ("JavaScript thread performance suffers greatly when running in dev mode").

## The budget table

| Budget | Value | Measured by | Runs in |
|---|---|---|---|
| Cold start, process start -> Home interactive | < 1,000 ms (median of 5, device) | cold-start log | owner, each release |
| Cold start on the simulator | ≤ 1.2 × committed baseline | cold-start log read from the simulator | the e2e run |
| Hitch rate while animating | ≤ 10 ms/s | frame-time recorder | owner play test |
| p95 frame time while animating | ≤ 17 ms (the recorder reports 17 as an upper bound) | frame-time recorder | owner play test |
| Save write p95 | < 5 ms | Jest perf test + on-device benchmark | `npm run test`, release |
| Draw calls per frame, busiest frame | per game (Line Siege 200), never > 1,000 | the game's `draw-board.test.ts` recording canvas | `npm run test` |
| Minified JS, store build | ≤ 6,000,000 bytes, ≤ +10 % vs baseline | `expo export --no-bytecode` | the network audit / release |
| Memory after the smoke flow | ≤ 150 MB `phys_footprint` | `footprint <pid>` on the simulator | the e2e run |
| Level-grid tiles mounted | ≤ 150 | one `ScrollView`, pack tabs above 150 | review |
| Skia canvases per screen outside the board | ≤ 8 | code review, `check-perf-code.mjs` | review |
| Touch target / text scale / contrast / colour-blind | 44 pt / 2.0 / 4.5 and 3 / 0.07 | accessibility checks | `npm run test` |

Apple rates a hitch rate at or below 10 ms/s as good, 25 ms/s as a warning and 50 ms/s as critical; at 120 Hz a frame is 8.3 ms.

## quality-gates.json

Tests and scripts read the budgets from one checked-in file (`templates/quality-gates.budgets.json` holds the two sections this work owns):

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

`check-budgets.mjs` fails when a key is missing, not a positive number, unknown, or looser than the value above.

## Changing a budget

- Tightening is always allowed (after a device report shows headroom).
- Loosening needs, in this order: a device report that justifies it, the owner's approval, a commit with a `Gate-Change:` trailer (the file is a gated path), and `check-budgets.mjs --allow <key>` for that one key. Stop and ask before loosening.
- Raising one game's draw-call budget above its current number needs a frame-recorder report from the owner's device showing a hitch rate ≤ 10 ms/s at the new count, and it may never pass 1,000.

## Budgets that are first estimates

The 6 MB bundle cap, the 150 MB memory cap and the 1,000 draw-call ceiling are first estimates from probes. Tighten them after the pilot game's first owner report, with a `Gate-Change:` trailer. Reference points measured on SDK 57: a probe app's footprint was 42 MB (66 MB with 90 Skia canvases); a scene of about 265 draw calls re-recorded every frame held 60 fps on the simulator.
