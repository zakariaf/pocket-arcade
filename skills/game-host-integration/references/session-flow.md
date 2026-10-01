# The session flow: from opening a run to recording its end

What the host does with one run, rule by rule, with the product requirement behind each: opening, resuming, saving, undo, hints, continue, the run end with stars and statistics, counters, the top bar, play time, pause and background, and real-time save points. Read it before changing anything in `session-controller.ts`, `open-session.ts`, `run-summary.ts` or the Game screen's commands.

## Contents

- Run kinds and how a run opens
- Resuming a saved run
- When the run is written
- Undo
- Hints
- Continue after losing (with "Never strand a finished run (L11)")
- The run end: one update before S7
- Stars, par, best and the next level
- Statistics counters
- The top bar and the result model
- Play time
- Pause, background, focus and full-screen ads
- Starting the next run in the same screen
- Test builds: the debug controls and the parity frames
- The tutorial run
- Real-time games and save points
- What the host's tests prove

## Run kinds and how a run opens

A run is identified by its `RunRef` (the save document's type): `{ kind: 'level', level }`, `{ kind: 'daily', date }`, `{ kind: 'endless' }` or `{ kind: 'tutorial' }`. The Game route's params are `{ start: 'resume' }` or `{ start: 'new', ref }`, and `useGameSessionControls(params)` passes them to `host.openSession`.

| Kind | Seed and difficulty (`startFor`) | No run when |
|---|---|---|
| level | the level's table entry (`levels.table`, generated and solver-checked) | the level is not in the table |
| daily | `dailyStart(levels, date)`: seed from the local date and the game's salt, the game's daily difficulty (spec 8.3: same level on every phone, offline) | `levels.daily.kind === 'none'` |
| endless | a fresh uint32 seed from the clock (`nowMs % 2^32`), `levels.endless.difficulty`; the seed is saved with the run | `levels.endless.kind === 'none'` |
| tutorial | the scripted `teaching.tutorial.start` state (the reducer's `create` returns it), seed 0 | never |

`newSession` starts the session with `startGameSession(sessionRulesFor(game, ref), { ref, seed, difficulty })`: status `playing`, empty undo history and log. The host writes it at once (`resumeOnLaunch: true`), so Home offers Continue immediately.

## Resuming a saved run

`{ start: 'resume' }` reads `save.doc().run` and calls `resumeSession`, which uses the state-stores skill's `restoreRun`:

- The saved state is validated by the game's own `persistence.parseState` (or migrated with `migrateState` when `stateVersion` is older). `null` means the run is **dropped alone**: the run section is cleared, progress and statistics are kept (spec 8.6, S14), and `errorLog.record('save', ...)` notes why (`state-invalid` or `state-not-migratable`).
- The move log is replayed from `create(seed, difficulty)` to rebuild the undo history. If the replay does not reproduce the saved snapshot exactly (a determinism bug, or a rules change without a `stateVersion` bump), the snapshot wins, the undo history is dropped, and the error log says so. The player keeps their position.
- A resumed run that is still playing starts **paused** (spec S5: coming back shows Pause, never a running game). A run saved while lost with the continue offered reopens on the lose screen with the offer.

At boot, `createGameHost` runs the same validation once and clears an unreadable run before the stores and the resume state are created, so a relaunch never tries to resume a run that cannot be read.

## When the run is written

| Moment | Written | Backup refreshed |
|---|---|---|
| New run opened | `run` (`resumeOnLaunch: true`) | no |
| `apply-move`, `undo`, `use-continue`, `use-hint` (turn-based games) | `run` | no |
| Pause (also on background and blur) | `run` with the current play time | no |
| Pause → Home (`leave`) | `run` with `resumeOnLaunch: false`: Continue on Home resumes it, a relaunch lands on Home | no |
| Lost with the continue offered | `run` (the loss is pending) | no |
| Run ends (won, or lost with no continue left, or the continue declined) | ONE update: `run: null` plus the level result, daily result, statistics and any `extendRunEnd` section | **yes** |
| Restart level / Replay / Next level | `run` for the new session | no |
| Play time alone | never (it rides along with the next write) | no |

The writes happen inside the session store's `persist` step, which runs **before** the store publishes the new session: nothing is ever animated or shown that is not already saved.

## Undo

The game's `rules.undo` is `none`, `unlimited` or `{ kind: 'limited', perLevel }` (spec 8.5: unlimited in puzzle games unless the game limits it). The reducer keeps full states in memory (`past`) and only the move log in the save; a relaunch rebuilds `past` by replaying the log. `canUndo` is true only while playing, only right after a move (never across a continue), and within the limit. The view carries `isUndoSupported` (the top bar leaves the button out when false) and `canUndo` (disabled when false).

## Hints

Only games with `rules.hints.kind === 'solver'` have hints (`isHintSupported`). `send({ type: 'hint' })` asks `hints.suggest(state)` for the current position; `null` shows nothing. A hint is remembered with the `eventSeq` it was made for, so the next move clears it (`isHintShown`, `controller.hintedMove()`), and `use-hint` counts it in the run (`hintsUsed`, saved).

Paying (spec 8.5 and 8.8, decision D2): 1 free hint per day, then a rewarded ad per hint, unlimited with Premium. The ads layer's `perkOffer({ kind: 'hint', freeHintsLeft }, { config, context, rewardedStatus })` decides `'free'`, `'watch-ad'` or `'hidden'` (a hint never waits for a loading ad: `'loading'` is only ever a continue's offer); the progress store's `freeHintsLeft(hints, today)` gives the allowance and `use-free-hint` spends it. The host is sent `hint` only after payment succeeded. A hint during play suspends the board around the rewarded ad (`runFullscreenAd(host.lifecycle, ...)`) and returns to the same state; the run stays `playing`.

## Continue after losing

Spec 8.10: a game may allow ONE continue per level or run (`rules.continueRun: { kind: 'once', descriptionId, apply }`), only after a loss, paid with a rewarded ad or free with Premium; offline and not Premium means no continue. `game.config.ts` `isContinueAllowed` can switch it off per app.

`continueStateOf(policy, isContinueAllowed, session)` gives:

- `'none'`: the game or the app has no continue, or the run is not lost;
- `'offered'`: lost, and the one continue is still available;
- `'used'`: the continue was used in this run.

When a move loses and the state is `'offered'`, the host does **not** record the loss yet: it saves the run (the loss is pending) and the lose screen shows the offer. Then:

- The player pays and continues: `send({ type: 'continue' })` applies `continueRun.apply(lost)`, clears the undo history (undo cannot cross a continue), and play resumes.
- The player declines (Try again, Levels, Home on the lose screen): `send({ type: 'finish' })` (or `leave`) records the loss (the run-end update below). `startRun` sends `finish` for you.
- The app is killed, or the screen is left another way: the pending loss stays saved; Home offers Continue and the lose screen reopens with the offer, as long as someone can still give the continue (below).

### Never strand a finished run (L11)

The continue offer is the ads layer's `perkOffer({ kind: 'continue', ... }, { config, context, rewardedStatus })`: `'free'` for Premium, `'watch-ad'` while ads can be served and the rewarded ad is ready, `'loading'` while ads can be served and it is still loading, and `'hidden'` otherwise (ads off, offline, no consent, no rewarded ad that can come, the continue used or not allowed). `resultModelOf` maps it to `LoseResult.continueOffer`: `'premium'`, `'ad'`, `'ad-loading'` (S7 draws the same offer with the ad key busy: label kept, the three hopping blocks for the icon, not pressable, `result.continue-ad-button`) or `null`. So a hidden offer always means that nobody can continue the run, never that an ad is still on its way.

A lost run whose continue is hidden is never left pending. `isLossStranded(view, continueOffer)` (`game-host/run-end-policy.ts`) is true for a lost run whose `continueState` is `'offered'`, whose `summary` is `null` and whose offer is `'hidden'`; toybox-screens' Game screen model then sends `{ type: 'finish' }` once per `eventSeq`. The finish is the same run-end update as a declined continue: statistics, the daily streak, the endless best and the ad history are saved first, and the recorded Result shows at once: the endless result with its score and "New best!", or the lose result without the offer. The same happens when a shown offer becomes hidden (the phone goes offline, the rewarded ad fails to load) and when a pending lost run is reopened from Home in that state. Without it an endless run in an ads-off build without Premium never showed its result or its new best, a lost level was never counted, and a reopened run stayed stranded (round 4).

Proof: `run-end-policy.test.ts` (offered, hidden and no summary is stranded; loading, watch-ad, free, used, won, playing and the tutorial are not), `result-model-of.test.ts` (the loading offer is `'ad-loading'`), `stranded-loss.test.ts` on the tally game and `test/integration/game-host/<game-id>-debug-controls.test.ts` on the pilot (after the finish the Game screen model sends, an endless loss saves the endless best and yields the endless result with `isNewBest`; a level loss is counted once in the statistics; the daily streak and the ad history are saved before the Result), toybox-screens' `use-game-screen-model.test.tsx` (one finish per `eventSeq`), and e2e-maestro's `13-endless` flow (`ads=off&premium=0`: the endless result at once). `check-game-host.mjs` rule `loss-not-stranded` fails a repo without `run-end-policy.ts`, without the loading mapping, or whose Game screen model never sends the finish.

**How the continue is proven.** Jest proves the reducer and the controller (`session-controller.test.ts`, `game-host.test.ts`: pending, continued once, recorded on finish). On the simulator two paths cover it, because E2E builds run with `ADS_MODE=off`, where the rewarded offer is hidden and the run ends at once (above):

- **The free (Premium) continue in E2E:** e2e-maestro's continue flow (`12-continue-premium`): `premium=1`, a level run, `action=lose-level`, tap `result.continue-premium-button`, and the run plays again on the Game screen (no Result).
- **The rewarded continue in admob-ads' ads smoke test** (`packages/shell/e2e/ads-smoke/04-rewarded-continue.yaml`, by hand on an `ADS_MODE=test` build, consent given): lose level 1 (`action=lose-level`), tap "Continue - watch an ad" (`result.continue-ad-button`), watch Google's test rewarded ad to its reward and close it; the run resumes and the flow waits for the board probe `game.board-frame` to read `{"seq":<the run's seq + 2>,"settled":true}`.

The order around the ad: `runFullscreenAd(host.lifecycle, show)` suspends the board while the ad covers the app (the app stays active and S7 is an overlay inside S5, so focus does not change), resumes it in its `finally`, and only then does the Result's handler send `continue`, so the board's clock gets `resume()` and then the continue scene's `push()` a few milliseconds apart. In round 4 the board then stayed on the continue animation's first frame (Line Siege: the hearts drawn as outlines, the three tray slots empty) until the next move, while the Premium continue on the same seed animated in full; the saved state was right. Cause class A, traced on the simulator on 2026-10-01: the resume's frame for the old scene reported done after the push, and the clock compared that with a JS read of the scene shared value that still returned the old seq, so it stopped the continue scene before its first frame. board-rendering-skia fixed it with `board-clock-state.ts` (a done message names its run; a scene pushed while the board may not run is held until it may; every resume records a frame) and replays both device traces in Jest; the troubleshooting playbook's entry is `engine-board-freeze-rewarded-continue`. The order around the ad stays as it is.

## The run end: one update before S7

`recordEnd` builds two things from the finished session:

- `summarizeRun(session, context, save.doc())` → `RunSummary`: `ref`, `isWon`, `loseReasonKey`, `score`, `moves`, `playMs`, `stars`, `par`, `isNewBest`, `levelBestScore`, `nextLevel`. It reads the save **before** the update, so "New best!" compares with the old best; `levelBestScore` is what `progress.levels[n].bestScore` holds **after** this run's save (a won level keeps the higher score, the first win sets it, a lost level records nothing; `null` for daily, endless and tutorial runs).
- `runEndOf(session, summary, context)` → the daily-and-statistics skill's `RunEnd` record: mode (`level` with its stars, `daily` with the date the run started on, `endless`, `tutorial`), win, score, moves, play time and the measured counters.

Then ONE write through the host's `writeRunEnd` dependency, `{ recipe: (doc) => extendRunEnd(applyRunEnd(doc, end, today), summary), refreshBackup: true }`, which the composition root turns into `updateAndPublish(save, stores, write)` (one validated save, then every section store re-reads it): the run is cleared, a won level's result is kept at its best (stars, score, fewest moves), a daily result is recorded once per date (a replay changes nothing), the endless best is raised, statistics are folded in (the tutorial is not a game and changes no statistics), and the backup slot is refreshed. Only after that does the summary reach the view, so S7 can never show a result that is not saved (spec S7). A finished run is recorded exactly once, even if `finish` or `leave` arrive again.

The result step also sounds: for the `apply-move` that ends the run, after the run is written (recorded, or kept pending for the continue), the persist step calls `playUiFeedback(deps.feedback, session.status === 'won' ? 'win' : 'lose')` from the audio skill's `ui-feedback.ts`: `ui.win` with a `success` pulse, or `ui.lose` with an `error` pulse, through the ports, so the Sound effects and Vibration settings and the 40 ms haptics throttle apply. Declining a pending continue (`finish`) records silently, because the loss already sounded; a continued run that is lost again sounds again. `session-controller.test.ts` proves the order (write, then sound) and the once-only rule.

## Stars, par, best and the next level

- Stars (spec 8.1) come only from the level's table entry: `starsFor(entry.stars, { isWon, moves, score })`. Puzzle levels (`{ kind: 'par', par }`): 3 stars at or under par, 2 up to par + 2, 1 for finishing. Score levels (`{ kind: 'score', thresholds }`): 3 / 2 / 1 at the thresholds. Losses, daily, endless and tutorial runs have 0 stars.
- `par` is the entry's par for par-rated levels, else `null`: a score-rated level (a game whose future is drawn from the RNG, proven by the witness solver, such as Line Siege) has no par to show. The one rule is `isScoreRule(rule)` in `game-facts.ts` (the same rule `isScoreRatedOf(module)` and `GameHost.isScoreRated` use for the whole game), so `resultModelOf` passes `par: null`, and the S7 win line prints the score line `result.win.score-line` ("Score 1,840 – best 1,840") with `score` and `bestScore` instead of the moves line. `bestScore` is the level's best after this run (`summary.levelBestScore`): after a win that did not beat the saved best it shows the old, higher best. A moves-rated level keeps `result.win.moves` ("7 moves – par 7").
- `isNewBest`: level score above the saved best for that level; daily score above `stats.bestScore.daily`; endless score above `progress.endlessBest`, **won or not** (an endless run has no goal and only ever ends lost, so its "New best!" cannot wait for a win); never for the tutorial; never for a lost level or daily run.
- `nextLevel`: after a won level, the next level in the table (`nextLevel(table, level)`), `null` after the last one. Unlocking by stars (spec S8) is the Levels screen's business; "Next level" is offered right after a win.

## Statistics counters

Each game declares 2 to 4 counters (`stats.counters`: kebab-case `id`, `labelId`, `aggregate: 'sum' | 'max'`, `measure(events)`). At the run end `measureCounters` replays the kept move line (the saved log, continues included) from `create(seed, difficulty)` and folds each counter over every move's events. Undone moves never count, and a run resumed after a kill measures exactly what the player kept. The daily-and-statistics skill folds the numbers into the totals.

## The top bar and the result model

`hudView` turns the game's `rules.hud(state)` and the level entry into data: the mode (`RunRef`), the goal line and the score. Par-rated levels show the Shell's "Moves 5 / Par 7" (`game-screen.progress.moves-par`); every other run shows the game's own goal message. Mode labels: `game-screen.mode.level` ("Level 12"), `game-screen.mode.daily` ("Daily – 26 Sep", the date through `formatDayMonth`), `common.mode.endless`; the tutorial has none.

`topBarPropsOf` builds Toybox's `GameTopBarProps` from the view: texts through `RunText` (`t`, `formatNumber`, `gameText`), the undo tool (left out without undo support, disabled while nothing can be undone), the hint tool (left out without solver hints or when `perkOffer` says hidden, disabled while not playing or while a hint shows).

`resultModelOf` builds Toybox's `ResultModel` once the run is over: `null` while playing or paused and for the tutorial; `lose` with the offer (`'ad'` for `'watch-ad'`, `'premium'` for `'free'`, none when hidden) while a loss is pending; after the record, `daily` (with the streak), `endless` (with the best), `win` (stars, win title, goal line, moves, par, `bestScore`) or `lose` without an offer. The win view prints `result.win.moves` when `par` is a number and `result.win.score-line` with `scoreText` and `bestScore` when it is `null` (toybox-screens draws both lines; the texts live in the Shell catalogs). The game's own parts come from `game: useGameHost()` (`ResultGame`: the win title through `text.gameText({ id: host.winTitleId })`, the lose picture's `host.logo`); values other layers own come in `ResultExtras` (streak, endless best, Premium nudge price).

## Play time

Play time counts only while playing (spec S10 statistics). `createPlayClock(clock.nowMs)` measures the time between two commands; because status changes only through commands, the status seen at a command held for the whole interval. The controller adds that interval (`add-play-time`) before handling each command, clamped to 0 .. 5 minutes per step, so a clock change or a sleeping phone never adds hours. Pause, the result screen and the background stop the count; the final move of a run is counted before the run is recorded.

## Pause, background, focus and full-screen ads

- `usePauseOnBackground(status, pause)`: at the moment the app leaves the foreground (AppState not `active`) or the Game screen loses focus, a playing run is paused; the pause is saved with its play time, and coming back shows the Pause menu (spec S5). Only the change counts: a run is never paused by the state it opened in.
- The board's own lifecycle stops its frame clock and audio while the app is inactive, the screen unfocused, or a full-screen ad is showing (`useIsFullscreenAdShowing(host.lifecycle)`). iOS keeps the app `active` during a Google full-screen ad, so the ads layer suspends the game with `runFullscreenAd(host.lifecycle, show)`.
- Back while playing opens Pause and Back inside Pause resumes (the navigation skill's `usePreventRemove` rule); only Pause → Home leaves a live run.

## Starting the next run in the same screen

Next level, Replay, Try again and Restart level do not navigate: `controls.startRun(ref)` records a pending loss if there is one (`finish`), opens a new run with `host.openSession({ start: 'new', ref })` and swaps it in; the Game screen re-renders with the new view and board. A restarted level is not recorded as a loss (spec S6 asks for a confirmation only when progress beyond a few moves would be lost; that dialog is Toybox's). The interstitial, when due, runs after the tap and before `startRun`.

## Test builds: the debug controls and the parity frames

`GameHost.debugControls()` (`game-debug-controls.ts`) is the host's test-build entry point. Only `createDebugParts` receives it (`game: host.debugControls()` in the composition root), and a store build's debug parts are `null`, so no player can reach it. It acts on the **active run**: the last run `openSession` opened, until it is left for Home (`leave`); a tutorial run is never active.

| Member | What it does | Who calls it |
|---|---|---|
| `playTo(outcome)` | The active run (a level, today's daily or an endless run) jumps to the game's `testing.examples.win()` or `lose()` (same ref) and ends through the same persist step as a deciding move (`endWith` in the controller): stars, statistics and the ad history (`extendRunEnd`) in the one run-end update, the result feedback, then the view. A loss with a continue stays pending, as a real one does. Returns `false` and changes nothing when no run is active or it is already recorded | the debug link's `action=win-level` / `lose-level` (e2e-maestro), so the per-game E2E flow ends level 1 exactly like a real win |
| `openExample(example)` | Stages the game's `start()` or `middle()` example for the next new level-1 run and pushes the Game route (`openGame`, the debug navigator's `StackActions.push`); `result-win` / `result-lose` stage `start()` and end that run at once through `playTo` | the debug link's `screen=game-start`, `game-middle`, `result-win`, `result-lose` (the screenshot matrix) |
| `applyFixtureHud(fixture)` | Shows the design's numbers over the played run: level 12, score 1,840 and the game's progress message at mid ("Monsters 3 / 10"; "Moves 7 / Par 7" for a moves-rated game). Nothing is saved; every command still acts on the run | `useGameSessionControls` in a parity capture of a game frame |
| `showFixtureResult(fixture, result)` | Shows the S7 Result for the fixture: a win with 3 stars, New best, the full progress and the score line (or "7 moves – par 7"), or a loss with the game's first lose reason and the continue on offer, built from the fixture's `RunSummary` through `resultModelOf`, without writing the save | `useGameSessionControls` for `result-win` and `result-lose` |

The fixture (`GameFixture` in `game-fixture.ts`; the parity harness's `ParityGameFixture` from `TEST_ONLY.parityGameFixture()` fits it) carries `level`, `score`, `progress.mid` and `progress.full` (the game's progress message values), `stars`, `isNewBest`, `movesCount`, `par` (`null` for a score-rated game), `bestScore`, `loseReasonKey` and `isContinueOffered`.

**Frame openers (D31).** A parity capture applies its frame state once, when the Game screen opens its run (`useGameSessionControls`' `useState` initializer), through the handler a player's tap would use: every game frame gets `applyFixtureHud(fixture)`; `pause-open` sends `pause` (the S6 frame); `result-win` and `result-lose` call `showFixtureResult` (the S7 frames). A normal launch (`TEST_ONLY.parityGameFixture()` is `null`) and the board-layout probe launch (`isParityBoardProbeOn()`, which only reports the board rectangle for the board mask) open nothing. `use-game-session-controls.test.tsx` proves each opener with a parity session against the tally game; `game-debug-controls.test.ts` proves the save and the view; `test/integration/game-host/<game-id>-debug-controls.test.ts` runs `playTo` and `openExample` on the real game module.

## The tutorial run

`{ kind: 'tutorial' }` starts from `teaching.tutorial.start` (seed 0, difficulty 0) and is saved like any run. Its controller gets `isMoveAccepted` from `tutorial-script.ts`: at step `moveCount` only that step's expected move is played (`'any-move'` accepts every legal move), so a tap the script does not expect does nothing; after the last step the run plays freely. `finish` on a live tutorial run records its `tutorial` run end, which clears the run and counts nothing; the Tutorial route sends it for Skip and for the last continue, then dispatches `finish-tutorial`. The tutorial has no stars, no par, no mode label and no result screen (`resultModelOf` returns `null` for it).

## Real-time games and save points

Turn-based games (about 24 of 26) save after every move: `persistence.savePolicy` is `{ kind: 'after-every-move' }` and `realtime` is `null`. A real-time game (Halo Drift) declares `{ kind: 'save-points', points }` and `realtime.savePoints`: the run writer skips per-move writes, and the real-time host (realtime-game-loop skill) stops the loop at a save point (wave end, pause, background), reads the sim copy with `sim.get()`, calls `realtime.snapshot`, and writes the run with the recorded `(tick, command)` log through `toSavedRun`. Never per frame. A real-time game stays paused after a full-screen ad, as after backgrounding.

## What the host's tests prove

| Test file | Proves |
|---|---|
| `game-host.test.ts` | the host's plain data (name, win title, logo, credits, `counters` with their aggregate, `hasMusic`, `isScoreRated`, `hasHints`, the S13 picture aspect, the tutorial coach steps); the tutorial plays by its script and a skipped tutorial is cleared by `finish`; new runs are written before the first move; endless seeds from the clock; unknown levels and missing runs open nothing; a move is saved before it shows; a relaunch resumes paused; an unreadable run is dropped at boot and logged; a win is recorded in one update with backup, stars and counters; `extendRunEnd` joins that update; a pending loss is kept, continued once, or recorded on finish or leave; the app can switch the continue off; Pause → Home keeps the run but not for a relaunch; paid hints are counted and cleared by the next move; a finished run is recorded once; play time counts only while playing, clamped; the board factory receives the typed game and the ad gate; the host hands screens the name and win title keys, the logo and the credits; a win sounds once |
| `session-controller.test.ts` | the deciding move plays `ui.win` + `success` or `ui.lose` + `error` once, after the run is written; declining a pending loss records it silently; ordinary moves, undo, pause and resume stay silent; the hint highlight clears on the next move; `endWith` ends a run like a deciding move (written, then the feedback) and refuses a playing state or a recorded run; a fixture shows over the run without being saved |
| `game-debug-controls.test.ts`, `run-tracker.test.ts`, `game-fixture.test.ts`, `session-view-of.test.ts` | `playTo` saves stars, statistics and the ad history before the view changes, ends today's daily run (the daily result and the streak saved first) and an endless run (the endless best, "New best!" when beaten) like a level, keeps a loss with its continue pending, and does nothing without an active run, after the end, after leaving and for the tutorial; `openExample` pushes the Game route and opens level 1 at the example (a result example ends at once); a staged example is dropped by another run; the fixture numbers show without a save write |
| `game-facts.test.ts` | `hasMusicOf` (a sound in category music) and `isScoreRatedOf` / `isScoreRule` (every level rated by score) |
| `board-host-model.test.ts` | one board result object per `eventSeq`, the Reduce motion mapping, intents sent as commands, a frame failure pauses and is logged, audio errors are logged; `routeIntent` selects, toggles, carries the selection to the next tap and lets a drag clear it; the hinted and coached cells |
| `use-board-selection.test.tsx` | tap-then-tap through the real session: select and toggle (announced), place with the next tap, clear on undo and on a restarted run, the bought hint outlined |
| `tutorial-script.test.ts` | a scripted step accepts only its move, `'any-move'` steps and the free play after the script accept any, moves compare by value, the coach steps drop the typed moves |
| `open-session.test.ts` | seeds and difficulties per kind; the tutorial start; resume paused; dropped and replay-mismatch runs logged |
| `run-summary.test.ts` | stars at and above par, no next level after the last, lose reasons, new bests per mode (an endless loss above the best is a new best), the level best after the save (a win below the saved best keeps the old best), run-end records per mode |
| `measure-counters.test.ts` | counters over the kept line, undone moves ignored, the continue replayed |
| `run-end-policy.test.ts`, `stranded-loss.test.ts` | L11: which lost runs are stranded; on the tally game an endless loss with a hidden offer is finished once, its endless best saved and its result shown with "New best!", a level loss counted once, the streak and the ad history saved before the Result |
| `hud-model.test.ts`, `top-bar-model.test.ts`, `result-model-of.test.ts` | the top bar and S7 models in every variant (the continue offer `'loading'` as `'ad-loading'`); the free hint only while game.config leaves one (`hints.freePerDay`); no par and the level best (`bestScore`) for a score-rated level, the par next to the best for a moves-rated one |
| `play-clock.test.ts`, `fullscreen-gate.test.ts`, `use-is-fullscreen-ad-showing.test.ts`, `use-pause-on-background.test.tsx`, `use-game-session-controls.test.tsx` | play time, the ad gate and the board's view of it, pausing on background and blur, opening, commanding and replacing runs from the Game screen; the parity frame openers (s6-pause, s7-result-win, s7-result-lose) and no opener on a normal or probe launch |
