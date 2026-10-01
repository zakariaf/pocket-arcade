# S5 Game screen

S5 is the game itself: the Shell draws the frame, the top bar and the Pause and Result overlays; the game module draws the board and handles its input. The skill ships the assembled screen: copy the set below and the Game route plays a level from its first move to its Result.

## Contents

- What the product requires
- Layout, top to bottom
- States and variants
- How the screen is assembled
- A loss nobody can rescue (L11)
- Data the model supplies
- Shell texts the copy deck lacks
- Templates
- testIDs
- Copy keys
- Reference images
- Pitfalls

## What the product requires

- Top bar (the Shell's), mirrored in RTL: Pause at the start; mode and level label ("Level 12", "Daily – 26 Sep", "Endless"); the goal or progress line (the game decides the text, the Shell draws it); score; Undo if the game supports it; Hint if it supports hints (free for Premium, otherwise the game's small daily allowance, then a rewarded ad). A game without solver hints (Line Siege) has no hint key at all (the lead's decision L8).
- Board area (the game's) and an optional bottom area (the game's).
- **No banner ad on this screen. Ever.**
- Every move is saved at once; killing the app mid-level and reopening lands back here in the same state.
- Going to the background pauses the game; coming back shows Pause, not a running game.
- Touch targets at least 44 x 44 pt; screen shake and particles respect Reduce motion; sounds and vibration respect their settings.

## Layout, top to bottom

Not drawn on its own: its parts come from the S6 frame, where they sit under the Pause scrim. Game-board frames have no board reference (each game brings its own board): parity compares the Shell chrome and the overlays and masks the board rectangle the game reports.

- `GameLayout` (`screens/game/game-layout.tsx`) is a plain full-screen View holding two siblings: the safe-area `ScreenFrame` (`game.screen`) with the top bar and the board, and then the overlay. The overlay sits **outside** `game.screen`, so Pause's scrim and Result's own frame cover the whole screen (status bar and home indicator too) and are inset once, never twice. Inside the frame the Result sat 59 pt low with its bottom row clipped, and the Pause scrim left the status bar undimmed (seen on the device; `game-layout.test.tsx` pins it).
- Game top bar (padding 4 / 14 / 8, gap 10): pause icon button 48 → column with the mode line (`gameTopBarLevel` 16 Bold) and the progress line (`gameTopBarProgress` 13, muted, the game's `progress` message) → score (`gameTopBarScore` 24 display) → undo and hint icon buttons (44).
- Board area under it (margin 4 top, 14 inline in the design): `game.board`; the game's board host fills it and carries `game.board-canvas` (a `notDrawn` id: the design draws only a placeholder board). No stickers over the board.
- `game.moves-label`: test builds only, and only while the debug link set `boardLayout=1`: the run's move count as one small caption at the board slot's bottom end (`GameMovesProbe`), so an E2E flow can prove a tap made a move and that the move survived a kill. The design draws the progress line instead (the map lists the id as not drawn).
- Overlays (Pause, Result) are drawn over the board inside the same route, so the board stays mounted and paused.

## States and variants

Playing, paused (S6 over it), finished (S7 over it), and `missing` (no run to open: the screen pops to Home at once). Tools the game lacks are left out (undo, hint); the hint key follows one game fact, `useGameHost().hasHints` (game-host-integration's `hasHintsOf(module)`: true exactly when the rules' hint policy is a solver, `rules.hints.kind === 'solver'`, the rule behind the session view's `isHintSupported`). When it is false the top bar draws no hint key, whatever the perk offer says: `useGameScreenModel` passes `hint: null` and `hasHints: false`, and `GameTopBar` (`game-host/game-top-bar.tsx`) drops a hint it is still handed. The game's facts file for parity (`parity/game-facts.json`, `hasHints`) says the same, so a capture of such a game picks the design-derived no-hints reference. A tool that is temporarily unavailable is disabled (`isAvailable: false`), never hidden. A hint the player cannot pay for right now (the day's free hints used, offline or no ad loaded, not Premium) is `hidden` by the ads layer: the key is left out rather than shown broken. The score is always drawn (a game without a score passes its own progress figure).

## How the screen is assembled

The route file `screens/game/game-screen.tsx` (one shared copy, synced from the library: navigation-and-routing ships the same bytes, and game-host-integration shows it as its Game screen example) is the one place that joins the pieces:

| Piece | File | What it does |
|---|---|---|
| Session | game-host-integration's `useGameSessionControls(route.params)` | opens the run (new or resumed), gives `status`, `view`, `BoardHost`, `send`, `pause`, `resume`, `startRun`, `leaveToHome`; its hook also opens the parity frames `pause-open`, `result-win` and `result-lose` |
| Back | `usePreventRemove` + `usePauseOnBackground` | Back while playing opens Pause, Back in Pause resumes; only Pause's Home leaves (`isLeavingRef` + `popTo('Home')`); the app going to the background pauses |
| Model | `use-game-screen-model.ts` | the top bar from `topBarPropsOf` (labels from the two Shell keys below) and S7's model from `resultModelOf` once the run end is saved; a lost run nobody can rescue is finished at once (`useFinishStrandedLoss`, below) |
| Words | `use-run-text.ts` | the same `RunText` Pause uses: `t()`, numbers in the chosen digits, the game's messages through `gameMessageText` |
| Paying | `use-perk-payment.ts` | `perkOffer` for the hint and the continue (free, watch an ad, loading, hidden) from the rewarded status (`useSyncExternalStore(ads.subscribeRewardedStatus, ads.rewardedStatus)`; only a continue can be `loading`); a free hint for a non-Premium player spends the game's allowance (`game.config.ts` `hints.freePerDay`, read with `useGameExtra()`: 1 with solver hints, 0 without), a watched ad counts only when the reward was earned; the host is sent `hint` or `continue` only after the payment resolved true |
| Result keys | `use-result-actions.ts` | Next level, Replay and Try again start the next run in the same screen after `showInterstitialIfDue` (never before the player saw the result), saving the returned ad history; Levels and Home record a declined loss (`finish`) and `popTo`; Continue pays first; the Premium nudge opens S12 |
| Result extras | `use-result-extras.ts` | the daily streak after this run (`currentDailyStreak`), the endless best, and the once-a-day Premium nudge price (`premiumNudgePrice`); the day is recorded (`record-upsell-shown`) when the player leaves a result that showed it |
| Probe | `game-moves-probe.tsx` | `game.moves-label` (above) |
| Frame | `game-layout.tsx` | the layout above |

Every file has its own test (`use-game-screen-model.test.tsx` drives the tally test game through the real host: top bar, hint paid and sent, win shown only after its stars are saved, Next level in the same screen, the Premium continue, a declined loss recorded, and the L11 cases below). `game-screen-back.test.tsx` runs the route in a real static native stack with the session, the model and the layout stubbed, and proves the four Back rules.

check-screens treats `game-screen.tsx` as S5's route (`route-model-hook`: it calls `useGameScreenModel`, whose file needs its test), and its `game-screen-wiring` rule fails an S5 folder that never calls `topBarPropsOf`, `resultModelOf`, `perkOffer` or `showInterstitialIfDue`: a screen that only renders the board host passes every other rule and plays a level with no top bar, no paid hints and no ads.

## A loss nobody can rescue (L11)

Lead decision L11, never strand a finished run. When a run is lost and no continue can be offered (ads off, offline, no consent, no rewarded ad that can come, no Premium), the continue offer is `'hidden'` and nobody can rescue the run, so it must not wait for a decision the player cannot make. `useFinishStrandedLoss` in `use-game-screen-model.ts` sends `{ type: 'finish' }` once per eventSeq while game-host-integration's `isLossStranded(view, perks.continueOffer)` (`game-host/run-end-policy.ts`) is true: a lost run whose `continueState` is `'offered'`, whose `summary` is null and whose offer is `'hidden'`. The session records the run end (statistics, streak, endless best, ad history) and the view gets its summary, so `resultModelOf` builds the recorded Result: the endless result with the score and New best, the daily result, or the lose result without the offer. The same happens when a shown offer turns hidden (offline, a load error) and when a pending lost run is reopened from Home (`start: 'resume'`).

- It runs in a layout effect, so the recorded Result replaces the pending one before the frame is drawn; the guard is the view the finish was sent for (a new run or a new eventSeq is always a new view), so a re-render or a status change never records the run twice.
- `'loading'` keeps the offer (S7 draws the ad key busy) and sends nothing; `'watch-ad'` and `'free'` wait for the player.
- Never send `finish` during render, and never hide S7 while the finish is on its way.

Tests (`use-game-screen-model.test.tsx`, with the tally host and the fake ads port, whose `setRewardedStatus` moves the status): an ads-off build without Premium sends one finish and shows the endless result with New best at once; loading then ready sends nothing; loading then unavailable sends one finish and shows the lose result without the offer, counted once; Premium sends nothing. The host wrapper writes each run end through `updateAndPublish`, as the composition root does, so the endless best on S7 is the saved one. `check-screens` rule `loss-finished` fails an S5 folder that never calls `isLossStranded` or never sends the finish from an effect. On a device, e2e-maestro's flow `13-endless` proves it (ads off, Premium off: the endless result at once).

## Data the model supplies

`GameScreenModel` (`use-game-screen-model.ts`): `topBar` (`GameTopBarViewProps` = `GameTopBarProps` plus `hasHints`, or null while there is no run) and `result` (`ResultModel` or null while the run is live and for the tutorial). `GameTopBarProps` (`game-host/game-top-bar.tsx`): `modeText`, `progressText`, `scoreText` (formatted in the chosen digits), `undo` and `hint` (`GameTool` or null: `label`, `isAvailable`, `onPress`; null = the game has no such tool or the hint is not payable), `onPause`, `isReducedMotion`. game-host-integration's `topBarPropsOf` builds them from the session view; `GameTopBar` draws them with the Toybox `GameTopBar` (`testIDBase="game"`, `pauseLabel` = `t('common.pause')`, an unavailable tool = `isDisabled`). The Game frames of the parity harness show the design's numbers (level 12, score 1,840, Monsters 3 / 10): the host's `debugControls().applyFixtureHud(fixture)` puts them in the top bar, never the screen.

## Shell texts the copy deck lacks

The design has no copy key for the undo and hint keys' VoiceOver labels. They are Shell texts written by hand into the four Shell catalogs (`packages/shell/src/i18n/catalogs/<lang>.json`, keys sorted); the fa and ckb drafts go on the owner's own review list (an owner step in the report, not blocking). check-screens accepts them as copy keys and fails a screen that uses one while a catalog lacks it (`extra-key-catalog`).

| Key | en | de | fa (review) | ckb (review) |
|---|---|---|---|---|
| `game-screen.undo-button.a11y-label` | Undo | Rückgängig | واگرد | گەڕانەوە |
| `game-screen.hint-button.a11y-label` | Hint | Tipp | راهنمایی | ئاماژە |

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/game/` and `packages/shell/src/game-host/game-top-bar.tsx`.

- `packages/shell/src/screens/game/game-screen.tsx` and `game-screen-back.test.tsx` (the route: session, Back, Pause, Result)
- `packages/shell/src/screens/game/use-game-screen-model.ts` and its test
- `packages/shell/src/screens/game/use-run-text.ts`, `use-perk-payment.ts`, `use-result-actions.ts`, `use-result-extras.ts`, each with its test
- `packages/shell/src/screens/game/game-moves-probe.tsx` and its test
- `packages/shell/src/screens/game/game-layout.tsx` and its test
- `packages/shell/src/game-host/game-top-bar.tsx` and its test
- `packages/shell/src/testing/create-host-wrapper.tsx`: the hook tests' wrapper; `TALLY_TEXTS` holds a text for every message id the tally test game names (its test reads them from the module), so a hook test that reaches S7 never throws `MISSING_TRANSLATION`

The route also needs S6 (`screens/pause/`) and S7 (`screens/result/`), game-host-integration's session controls, top-bar model and `resultModelOf`, and admob-ads' `perkOffer`, `earnRewardedPerk` and `showInterstitialIfDue`.

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S5` prints every element with its English text.

Map note: Not drawn on its own: the S6 frame shows the Game screen under the Pause scrim, so every pixel here is dimmed by pause.scrim in both design and app.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `game.screen` | ScreenFrame | none |  |  |  |
| `game.top-bar` | GameTopBar | none |  |  | (drawn by GameTopBar from its `testIDBase`) |
| `game.pause-button` | IconButton (pause, 48) | button | a11y `common.pause` |  | (drawn by GameTopBar from `testIDBase="game"`) |
| `game.mode-label` | AppText | text | `game-screen.mode.level` |  | (drawn by GameTopBar from `testIDBase="game"`) |
| `game.progress-label` | AppText | text | `games.<id>.progress` |  | (drawn by GameTopBar from `testIDBase="game"`) |
| `game.score` | AppText | text |  |  | (drawn by GameTopBar from `testIDBase="game"`) |
| `game.undo-button` | IconButton (undo, 44 (sm)) | button | a11y `game-screen.undo-button.a11y-label` |  | (drawn by GameTopBar from `testIDBase="game"`) |
| `game.hint-button` | IconButton (hint, 44 (sm)) | button | a11y `game-screen.hint-button.a11y-label` | only when `hasHints` | (drawn by GameTopBar from `testIDBase="game"`) |
| `game.board` | GameBoardHost | none |  |  |  |

Chosen states the design does not draw may also set: `game.board-canvas` (the board host's canvas) and `game.moves-label` (the E2E move count above). The board host's own layout probe (`game.board-layout`, drawn while the debug switch or a parity board probe is on) belongs to game-host-integration, not to this map.

## Copy keys

| Key | English |
|---|---|
| `common.pause` | Pause |
| `game-screen.mode.level` | Level {level, number} |
| `games.<id>.progress` | (the game's own text) |
| `game-screen.undo-button.a11y-label` | Undo (Shell text, table above) |
| `game-screen.hint-button.a11y-label` | Hint (Shell text, table above) |

## Reference images

- `assets/reference/s6-pause.png` (paused; phone)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- A banner, a sticker or a toast over the board.
- The overlay inside `game.screen`: it is inset a second time (Result 59 pt low, its bottom keys clipped; the Pause scrim stops under the status bar).
- Sending `hint` or `continue` before the payment resolved, or showing an interstitial before the player has seen the result.
- A free hint from a constant: the allowance is the game's `hints.freePerDay` (Line Siege: 0).
- A hint key decided by view state or by the perk offer alone: only `hasHints` decides whether the key exists (check-screens `hint-key-fact`); the offer only decides whether it is free, paid or hidden for now.
- Hard-coding "Level 12": the host formats the mode line with `game-screen.mode.*` and the chosen digits.
- Hiding a tool when it is only unavailable for a moment: disable it.
- A lost run left waiting while its continue offer is hidden (ads off, offline, no ad, no Premium): the player saw neither the offer nor the endless result. The model finishes it (`useFinishStrandedLoss`, L11; check-screens `loss-finished`).
- Rewriting the screen's pieces in another folder: check-screens reads `screens/game/` and `game-host/game-top-bar.tsx`, and its `game-screen-wiring` rule looks for the four calls there.
