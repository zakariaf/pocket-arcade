# S13 How to play

S13 How to play shows the game in 3–5 short illustrated steps drawn in code.

## Contents

- What the product requires
- Layout, top to bottom
- States and variants
- Data the model supplies
- Templates
- testIDs
- Copy keys
- Reference images
- Pitfalls

## What the product requires

- First launch: the game's scripted tutorial level (the Tutorial route, the Game screen in tutorial mode; not drawn in Toybox): one short sentence at a time, no text walls, no Skip until the second step.
- How to play (from Home or Pause): 3–5 short illustrated steps drawn in code by the game module, swipeable, mirrored in RTL; a "Play the tutorial again" button.
- No banner.

## Layout, top to bottom

Top bar "How to play" with Back. The body runs under the home indicator (`ScreenFrame edges={UNDER_HOME_INDICATOR_EDGES}`, `ScreenBody isUnderHomeIndicator`), so the quiet nudge at the bottom sits where the design has it. Body (gap 14):

1. Goal (muted): the game's `goal` text.
2. The stage (3 pt edge, radius 16, surface, padding 12) holding the game's picture of the step: the picture View (`how-to-play.picture`) is `alignSelf: 'stretch'` with `aspectRatio: model.pictureAspect`, so it is full width and exactly as tall as the aspect says. Without a size the example canvas (flex 1) measured 0 and drew nothing: the stage was 30 pt tall instead of 244. The aspect is the game host's example aspect (`GameHost.howToPlayPictureAspect`, width / height; the Toybox default is 320 / 206, the mockup's illustration), and `how-to-play-view.test.tsx` proves the picture gets a non-zero size.
3. Row (centred, space-between, gap 12): the step chip "Step 2 / 4" and the pager dots (12 pt squares, the current one 30 wide and accent).
4. The step sentence (heading 21 display).
5. grow.
6. Two buttons (gap 12): Previous (secondary, `back` icon) and Next (primary, `forward` at the end).
7. Quiet nudge with `restore`, centred: "Play the tutorial again".

## States and variants

Previous is disabled on the first step. On the last step Next reads "Got it" and returns (Chosen). Swipes move between steps and mirror in RTL.

## Data the model supplies

`HowToPlayModel` (in `how-to-play-view.tsx`): `goal`, `steps`, `stepIndex` (0-based), `renderPicture(stepIndex)` from the game module, `pictureAspect` (the host's `howToPlayPictureAspect`), `isReducedMotion`, `onBack`, `onPrevious`, `onNext`, `onDone`, `onReplayTutorial` (`navigate('Game', { start: 'new', ref: { kind: 'tutorial' } })`).

The template `use-how-to-play-model.ts` (with its test) builds it from the game host: `howToPlayPages` (each page's `titleId`, the goal line, and `bodyId`, the step sentence, through `gameMessageText`) and `renderHowToPlayPicture(pageIndex)` (the page's example state drawn by the game's own board). The page shown is local state, clamped to the pages; Done and Back go back to where the player came from (Home, or Pause with the run still paused). A parity capture of `s13-how-to-play` (test builds) opens on step 2, the page one Next shows from step 1: the state's initializer applies `parityFrameState()` once through the same `nextStepOf` rule `onNext` uses, so no effect runs and the first frame is already step 2. The pager and page slides then hold still (`useReduceMotion()` is true during a capture).

Line Siege's goal line is "Stop every monster before it reaches your wall." and its four steps are "Pick a block and place it on the grid.", "Fill a column to fire a beam up its lane.", "Fill a row to hit every monster at once." and "The monsters march closer every few blocks." (de "Alle paar Blöcke rücken die Monster näher.", fa and ckb in the copy deck). Step 4 was reworded in all four languages to match the tuned march cadence (the monsters march every few placements, never after every block); the frame draws step 2, so its pixels did not change.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/how-to-play/`.

- `packages/shell/src/screens/how-to-play/how-to-play-view.tsx`
- `packages/shell/src/screens/how-to-play/how-to-play-screen.tsx`
- `packages/shell/src/screens/how-to-play/how-to-play-view.test.tsx`
- `packages/shell/src/screens/how-to-play/use-how-to-play-model.ts` and its test

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S13` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `how-to-play.screen` | ScreenFrame | none |  |  |  |
| `how-to-play.top-bar` | TopBar | none |  |  | .back-button .title |
| `how-to-play.goal` | AppText | text | `games.<id>.goal` |  |  |
| `how-to-play.stage` | HowToStage | none |  |  |  |
| `how-to-play.picture` | Picture | image |  |  |  |
| `how-to-play.pager` | View | none |  |  |  |
| `how-to-play.step-chip` | Chip | text | `how-to-play.step-counter` |  |  |
| `how-to-play.pager-dots` | PagerDots | none |  |  |  |
| `how-to-play.step-text` | AppText | header | `games.<id>.howToPlay.1` |  |  |
| `how-to-play.previous-button` | Button (secondary, back icon) | button | `common.previous` |  |  |
| `how-to-play.next-button` | Button (primary, forward icon at the end) | button | `common.next` |  |  |
| `how-to-play.replay-tutorial-button` | Button (quiet, restore icon, centred) | button | `how-to-play.replay-tutorial` |  |  |

Chosen states the design does not draw may also set: `tutorial.screen`, `tutorial.skip-button`.

## Copy keys

| Key | English |
|---|---|
| `common.back` | Back |
| `common.how-to-play` | How to play |
| `games.<id>.goal` | (the game's own text) |
| `how-to-play.step-counter` | Step {step, number} / {total, number} |
| `games.<id>.howToPlay.1` | (the game's own text) |
| `common.previous` | Previous |
| `common.next` | Next |
| `how-to-play.replay-tutorial` | Play the tutorial again |

## Reference images

- `assets/reference/s13-how-to-play.png` (normal; phone)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Pictures as PNG files: the game draws them in code.
- A picture View without a size (the canvas measures 0 and the stage collapses), or a body that ends at the safe area.
- Comparing the picture's pixels with the mockup: the design draws a stylised 6 x 5 board, the app the game's own board. Visual parity masks the union of the app's picture rectangle and the design's picture rectangle in both images, as it masks the S5 to S7 boards; only the picture's frame and position are compared.
- Relying on the pager dots for VoiceOver: `PagerDots` is decorative (hidden from accessibility); the step chip ("Step 2 / 4") says where the player is. Tests find the dots with `{ includeHiddenElements: true }`.
