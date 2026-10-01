# The game host: architecture and wiring

How a game module reaches the Shell: the typed binding, the one generic seam, the files of `packages/shell/src/game-host/`, the path of one move, the composition root in `packages/shell/src/app/`, the board host with its tap-then-tap selection, the Tutorial route and the Game screen. Read it before installing the host, before wiring the composition root, the Tutorial route or the Game screen, and whenever Shell code seems to need a game's own types.

## Contents

- What the game host is
- The Shell binding: ShellGameModule and the types bag
- Why createGameHost is the only generic seam
- The files and who builds them
- One move, end to end
- The GameHost handle
- The session controller and the session view
- The composition root
- The board host factory and tap-then-tap
- Test builds: debug controls, parity frames and the board probe
- The Tutorial route
- The Game screen: S5, S6 and S7
- Never strand a finished run (L11)
- Texts the host adds
- Settled points

## What the game host is

A game is a plain object of data and pure functions (`GameModule`, spec section 10). The Shell is one app frame for all 26 games. The game host is the Shell code that joins them: it opens runs, turns taps into moves, saves every change before it shows, records the end of a run with its stars and statistics, and hands screens a plain-data view that names no game type. It lives in `packages/shell/src/game-host/`; the composition root that builds it lives in `packages/shell/src/app/`; each game contributes only `apps/<game-id>/src/index.ts` (the assembled module) and the 3-line `apps/<game-id>/index.ts`.

## The Shell binding: ShellGameModule and the types bag

`game-kit` (pure TypeScript) may not name Skia, React Native or any Shell type, but a board draws on a Skia canvas, art uses Skia, sounds use the Shell's `SoundBank` and the UI palette is the Shell's `Palette`. So `GameModule` is generic over a presentation slot, and the Shell binds it once:

```ts
// packages/shell/src/game-host/shell-game-module.ts (template, copy verbatim)
export type ShellGameTypes = {
  readonly state: unknown;
  readonly move: unknown;
  readonly event: unknown;
  readonly view: unknown;
  readonly token: string; // board palette token names
  readonly sim: unknown;  // real-time games: the typed-array sim; turn-based: never
};
export type GamePresentation<T extends ShellGameTypes> = {
  readonly board: GameBoard<T['state'], T['view'], T['token']>;
  readonly art: GameArt<T['token']>;
  readonly sounds: SoundBank;
  readonly palette: Palette;
};
export type ShellGameModule<T extends ShellGameTypes> =
  GameModule<T['state'], T['move'], T['event'], GamePresentation<T>, T['sim']>;
```

Each game names its types once, in `apps/<game-id>/src/<game-id>-types.ts` (the "types bag"), and exports `export const <gameCamel>Game: ShellGameModule<<GamePascal>Types> = { ... }`. The type check of that one constant proves every member of the contract.

`GameArt` (`packages/shell/src/art/game-art.ts`, owned by the code-drawn-art-and-icons skill) is `{ palettes: PaletteSet<TToken>; logo: LogoArt; credits: readonly CreditEntry[] }`: the four board palettes (light, dark, colour-blind light and dark), the game's `LOGO_ART`, and its own S11d licence rows. Every member is read at runtime: `palettes` by the board host factory, `logo` and `credits` by screens through the type-erased host (`host.logo`, `host.credits`). There is no icon painter: the app icon, the splash and every in-app logo tile draw the same `LOGO_ART`.

The module's texts that name the game are in `identity`: `nameId` (`'<id>.name'`), `winTitleId` (`'<id>.win-title'`, the S7 heading above the stars) and `taglineId` (`'<id>.tagline'`, under the name on S1, S4 and S11b). The board's pan gesture is `engine.panMode` (`'none'`, `'swipe'`, `'drag'` or `'aim'`), next to `intentToMove`, so the engine's contract test proves the two agree.

## Why createGameHost is the only generic seam

Screens, stores and navigation must not know a game's state type, yet TypeScript has no existential types: a `ShellGameModule<LineSiegeTypes>` is not assignable to `ShellGameModule<ShellGameTypes>` because function parameters are contravariant under `strictFunctionTypes`. Casting (`as unknown as`) would silence exactly the errors the owner relies on the compiler to catch. Instead, `createGameHost<T>(game, deps)` is called once with the typed module and closes over it; everything that touches `T['state']`, `T['move']` or `T['event']` lives inside that closure (the session store, the controller, the board factory's input). What leaves the closure is type-erased: strings, numbers, plain-data views, callbacks and components. `check-game-host.mjs` fails on casts inside `game-host/` (`unsafe-cast`) and on screens, UI, stores or navigation that import an app or name `ShellGameModule` (`screens-type-erased`).

## The files and who builds them

This skill's files, each with a test unless marked device-only:

| File | What it does |
|---|---|
| `game-host/shell-game-module.ts` | The Shell binding above |
| `game-host/game-host.ts` | `createGameHost(game, deps)`: validates the saved run at boot, opens runs, builds controllers, owns the full-screen ad gate, tracks the active run and hands out `debugControls()` |
| `game-host/game-facts.ts` | `hasMusicOf(module)` (a sound in category `music`), `isScoreRatedOf(module)` (every level rated by score), `hasHintsOf(module)` (the rules' hint policy is a solver) and `isScoreRule(rule)`: the one rule behind `GameHost.hasMusic`, `GameHost.isScoreRated`, the null par and the parity reference variants |
| `game-host/game-debug-controls.ts` | `createGameDebugControls`: `GameDebugControls` (`playTo`, `openExample`, `applyFixtureHud`, `showFixtureResult`), `EXAMPLE_RUN`, `endStateOf` |
| `game-host/game-fixture.ts` | Pure: the parity game frames' numbers (`GameFixture`) as a top bar, a `RunSummary` and a view fixture |
| `game-host/run-tracker.ts` | `createRunTracker`: the active run for the debug controls and the example staged for the next level-1 run |
| `game-host/session-view-of.ts` | `sessionViewOf`: the plain-data `SessionView` of one run, with a test build's `ViewFixture` over it |
| `game-host/game-host-context.tsx` | `GameHostProvider` and `useGameHost()` (dependency injection only) |
| `game-host/open-session.ts` | Seed and difficulty of a new run per mode; the tutorial start; resuming and validating a saved run |
| `game-host/session-controller.ts` | One run: reduce, save, publish; hints; the pending loss and the continue; leaving; the run-end record; the tutorial's accepted moves |
| `game-host/session-view.ts` | `SessionView`, `SessionCommand`, `SessionHandle`, `continueStateOf` |
| `game-host/play-clock.ts` | Play time between commands, only while playing, clamped per step |
| `game-host/run-summary.ts` | `summarizeRun` (what S7 shows) and `runEndOf` (what the run-end write records) |
| `game-host/run-end-policy.ts` | `isLossStranded(view, continueOffer)`: a lost run that waits for a continue nobody can give (L11), which the Game screen model finishes at once; `stranded-loss.test.ts` proves the run end on the tally game |
| `game-host/measure-counters.ts` | The game's statistics counters, measured by replaying the kept move line |
| `game-host/hud-model.ts` | The top bar as data: mode, goal line ("Moves / Par" or the game's line), score |
| `game-host/top-bar-model.ts` | `GameTopBarProps` for the Toybox top bar; mode and goal texts (S5) |
| `game-host/result-model-of.ts` | The Toybox `ResultModel` for S7 (win title and logo from the host, par `null` for score-rated levels) |
| `game-host/tutorial-script.ts` | The game's teaching for the Shell: `isTutorialMoveAccepted`, `coachStepsOf`, `howToPlayPagesOf` (steps and pages without their typed moves and states), `pointerTargets`, `exampleHighlightOf` |
| `game-host/board-host-model.ts` | The board host's pure parts: one `MoveResult` per `eventSeq`, the motion, intent and failure handlers, `routeIntent` (tap-then-tap), `hintedTargetsOf`, `highlightOf` |
| `game-host/use-board-selection.ts` | `useBoardSelection`: the selection as board-host state, its VoiceOver news, the highlight |
| `game-host/create-game-board-host.tsx` | `createGameBoardHost({ audio, haptics, errorLog, isLayoutProbeOn })`: the `BoardHostFactory` (device-only: needs Skia; its logic is in the two files above) |
| `game-host/create-example-picture.tsx` | `createExamplePicture()`: the S13 pictures, each how-to-play example drawn by the game's board at the picture's aspect ratio (device-only; its pure parts, `exampleHighlightOf` in `tutorial-script.ts` and `examplePictureAspectOf` in `example-picture-aspect.ts`, are tested) |
| `game-host/example-picture-aspect.ts` | `EXAMPLE_PICTURE_ASPECT` (320 / 206, the Toybox mockup's illustration viewBox) and `examplePictureAspectOf(board)` (the board's own `exampleAspect` when it is positive, else 320 / 206): the S13 picture's size contract, also `GameHost.howToPlayPictureAspect` |
| `game-host/host-counter.ts` | `HostCounter`: `{ id, labelId, aggregate? }` (`'sum'` or `'max'`; S10 shows a max counter, a best such as Biggest combo, as ×N) |
| `game-host/fullscreen-gate.ts`, `use-is-fullscreen-ad-showing.ts` | The ads layer's `GameLifecycle`: suspends the board while a full-screen ad shows |
| `game-host/use-game-session-controls.ts` | The Game and Tutorial screens' hook: opens the run, follows its view, sends commands, starts the next run; in a parity capture it opens the game frame's state once (D31) |
| `game-host/use-pause-on-background.ts` | Pauses a playing run when the app leaves the foreground or the screen loses focus |
| `app/create-shell-app.tsx` | `createShellApp(input)`: the device adapters once, the parts once, the root component |
| `app/create-shell-parts.ts` | `createShellParts(input, adapters)`: the boot order (below), testable with in-memory adapters; `ShellAdapters`, `ShellLaunch`; `recordAdLevelEnd` (the ads layer's part of the run-end update) |
| `app/debug-switches.ts` | `debugSwitchesOf(parts)`: the host's test-build switches read through the debug parts (`isLayoutProbeOn`, also on in a parity `probe=board` launch; `seedOverride`; `openGame`, a pushed Game route); `debugFeedbackOf(parts, ports)`: the host's feedback ports, the debug parts' recorders once they exist (test builds), else the real ports |
| `app/device-adapters.ts` | `createDeviceAdapters()`: every native adapter, once per launch (device-only) |
| `app/create-premium-deps.ts` | premium-purchase's service dependencies: the gated port, the one save write per Premium change, the price formatter |
| `app/connect-premium-reloads.ts` | Reloads the store on a connectivity change (`shouldReloadStore`), re-checks Premium once online after it, and re-checks on foreground |
| `app/shell-app.tsx` | `ShellApp`: services, stores, i18n, direction, `ShellProviders` (crash fallback) around `ShellFeatures`; the audio lifecycle and the save checkpoint |
| `app/shell-features.tsx` | `ShellFeatures`: `GameHostProvider`, `PremiumScreenDepsProvider`, `PressFeedbackProvider` (the tap sound) and admob-ads' `ConsentMoment` (S3 over the app) around the navigator |
| `app/shell-navigator.tsx` | `ShellNavigator`: `DebugServicesProvider`, `DialogProvider` (with `LoadOutcomeOpener`) and the themed `NavigationRoot` (split out for `jsx-max-depth` and `no-multi-comp`) |
| `app/load-outcome-opener.tsx` | `LoadOutcomeOpener`: the S14 dialog the save's load outcome asks for, opened once over the first screen: "Progress restored" after `restored-from-backup`, "please update" (Update opens `storePageUrl(appStoreId)`) after `newer-version`, which plays read-only and so asks at every launch; nothing after `fresh`, `loaded`, `migrated` or `reset-after-damage`. `ShellApp` passes `hydrated.outcome`, or `null` after the crash screen's Back to Home |
| `screens/first-run/` | The Tutorial route: `tutorial-screen.tsx`, `tutorial-view.tsx`, `use-tutorial-model.ts`, `tutorial-coach.ts` |
| `testing/tally-game.ts`, `testing/create-test-adapters.ts` | The tiny complete game the tests run against; the in-memory `ShellAdapters` |
| `test/integration/game-host/<game-id>-debug-controls.test.ts` | Per game (template `__GAME_ID__`): `playTo` and `openExample` on the real module (its own win, lose, start and middle examples) |

Files the host needs from other skills (`prerequisite-missing` names the skill; in a partial Shell a missing S5 or S7 file is a SKIP line):

| File | Skill |
|---|---|
| `packages/game-kit/src/contract/*`, `testing/engine-contract.ts` | game-rules-engine |
| `packages/game-kit/src/levels/star-rating.ts`, `pack-progress.ts`, `daily-start.ts`, `levels-contract.ts` | level-generation-and-solvers |
| `game-host/game-session-types.ts`, `game-session-reducer.ts`, `game-session-store.ts`, `run-writer.ts`, `saved-run.ts`, `testing/create-test-save.ts`, `testing/counter-game.ts`, `stores/update-and-publish.ts`, `stores/settings-store.ts`, `stores/settings-selectors.ts` | state-stores |
| `stores/run-end.ts` (`applyRunEnd`) | daily-and-statistics |
| `services/save/save-service.ts`, `services/save/schema/save-doc.ts` | save-persistence-and-migrations |
| `game-host/board-types.ts` (`BoardHighlight`), `game-host/board-kit.ts`, `app/use-is-app-active.ts`, `game-host/game-board-host.tsx` | board-rendering-skia |
| `game-host/pan-intent.ts` | board-gestures-and-input |
| `game-host/board-direction-view.tsx`, `i18n/direction-context.tsx`, `i18n/create-number-formatter.ts`, `app/start-shell.ts` | rtl-and-direction |
| `i18n/digits.ts`, `i18n/t-context.ts`, `i18n/language-context.tsx`, `i18n/format-date.ts`, `i18n/create-t.ts`, `i18n/game-message-text.ts` | i18n-strings-and-catalogs |
| `theme/use-theme.ts`, `theme/theme-types.ts`, `testing/test-palette.ts` | toybox-design-system |
| `app/use-reduce-motion.ts` | settings-and-preferences |
| `art/game-art.ts`, `art/credit-entry.ts`, `art/logo-art.ts` | code-drawn-art-and-icons |
| `navigation/route-params.ts` | navigation-and-routing |
| `game-host/game-top-bar.tsx` (S5), `screens/result/result-model.ts` (S7) | toybox-screens |
| `services/ads/perk-offer.ts`, `services/ads/fullscreen-ad.ts` | admob-ads |
| `app/debug-link-routes.ts` (`DebugGameControls`, `DebugGameExample`) | e2e-maestro |
| `services/audio/audio-port.ts`, `ui-feedback.ts`, `fake-audio.ts`, `services/haptics/haptics-port.ts`, `fake-haptics.ts` | game-audio-and-haptics |
| `services/clock/clock-port.ts`, `services/error-log/error-log-port.ts` | architecture-and-boundaries |

## One move, end to end

```
finger ──► useBoardGestures (UI thread) ──► InputIntent ──► BoardHost onIntent
  ──► useBoardSelection.routeIntent: a tap in engine.selectRegions only (de)selects;
      any other tap gets { ...intent, selected }; a drag-end clears the selection
  ──► handle.send({ type: 'intent', intent })                        session-controller
        1. play clock: add the time since the last command if playing
        2. move = engine.intentToMove(state, intent); null = nothing happens
           (a tutorial run also drops a move its current step does not expect)
        3. store.dispatch({ type: 'apply-move', move })              game-session-store
              reducer: applyMove -> new session (ignored while paused or finished)
              persist(next, action)   ◄── BEFORE the store publishes
                 live run      -> run writer: save.update(run)      (turn-based: every move)
                 lost + continue offered -> save the run, keep the loss pending
                 won / lost    -> recordEnd: ONE save.update(applyRunEnd(...), { refreshBackup: true })
              the deciding move -> playUiFeedback(feedback, 'win' | 'lose')   (once, after the save)
              set({ session })  ──► subscribers (the new eventSeq also clears the selection)
  ──► getView() -> SessionView (plain data)  ──► top bar, Result overlay
  ──► board host reads { seq: eventSeq, state, events: lastEvents } ──► buildTimeline ──► animation
```

The order is the product guarantee: a move is on disk before its animation starts (spec 8.6, S5: killing the app mid-level reopens the same state), and stars and statistics are saved before S7 appears (spec S7).

## The GameHost handle

```ts
export type GameHost = {
  readonly id: string;                         // the game id
  readonly nameId: string;                     // '<id>.name': S1, S4, S11b (gameMessageText)
  readonly winTitleId: string;                 // '<id>.win-title': the S7 win heading
  readonly taglineId: string;                  // '<id>.tagline': under the name on S1, S4, S11b
  readonly logo: LogoArt;                      // GAME_ART.logo: LogoTile on S1, S4, S7 lose, S10, S11b
  readonly credits: readonly CreditEntry[];    // GAME_ART.credits: creditRowsOf(host.credits) on S11d
  readonly counters: readonly HostCounter[];   // S10 cards and Home: { id, labelId, aggregate }, in game order
  readonly counterIds: readonly string[];      // counters' ids: the keys in the save's stats.counters
  readonly hasMusic: boolean;                  // hasMusicOf(game): the S6 and S11 Music rows
  readonly isScoreRated: boolean;              // isScoreRatedOf(game): the S7 win prints the score line
  readonly hasHints: boolean;                  // hasHintsOf(game): the S5 top bar has a hint key only then
  readonly tutorialSteps: readonly TutorialCoachStep[]; // the Tutorial route's coach: { messageId, pointer }
  readonly packs: readonly LevelPack[];        // S8: name key, first level, level count, stars to unlock
  readonly howToPlayPages: readonly HowToPlayPage[]; // S13: { titleId, bodyId } per page
  readonly renderHowToPlayPicture: (pageIndex: number) => ReactNode; // S13: the page's example, drawn by the board
  readonly howToPlayPictureAspect: number;     // S13: width / height of the picture (320 / 206 unless the board says)
  readonly hasSavedRun: () => boolean;         // Home: Continue or Play
  readonly openSession: (open: SessionOpen) => OpenedSession | null;
  readonly lifecycle: FullscreenGate;          // runFullscreenAd(host.lifecycle, show)
  readonly debugControls: () => GameDebugControls; // test builds, through createDebugParts only
};
export type HostCounter = {                    // game-host/host-counter.ts
  readonly id: string;
  readonly labelId: MessageId;
  readonly aggregate?: 'sum' | 'max';          // 'max': a best (Biggest combo), shown as ×6 on S10
};
export type OpenedSession = { readonly handle: SessionHandle; readonly BoardHost: ComponentType<BoardHostProps> };
export type BoardHostProps = { readonly testID: string; readonly coachTargets?: readonly BoardTarget[] };
export type GameHostDeps = {
  readonly save: SaveService;
  readonly clock: ClockPort;                   // nowMs for play time and endless seeds, today for records
  readonly errorLog: ErrorLogPort;
  readonly isContinueAllowed: boolean;         // game.config isContinueAllowed, from readGameExtra()
  readonly createBoardHost: BoardHostFactory;  // createGameBoardHost({ audio, haptics, errorLog, isLayoutProbeOn })
  readonly createExamplePicture?: ExamplePictureFactory; // createExamplePicture(): the S13 pictures (Skia)
  readonly feedback: FeedbackPorts;            // { audio, haptics }: the win and lose feedback
  readonly extendRunEnd?: (doc: SaveDoc, summary: RunSummary) => SaveDoc; // e.g. the ads history
  readonly seedOverride?: () => number | null; // test builds: the debug link's seed= for endless runs
  readonly openGame?: (params: GameParams) => void; // test builds: openExample pushes the Game route
  readonly writeRunEnd: (write: SectionWrite) => void; // updateAndPublish(save, stores, write)
};
```

`packs`, `howToPlayPages` and `renderHowToPlayPicture` feed S8 and S13 (toybox-screens' `use-levels-model.ts` and `use-how-to-play-model.ts`): the pages lose their typed example states at the seam, and `renderHowToPlayPicture(pageIndex)` renders the component the injected `createExamplePicture` factory built once for the game (`game-host/create-example-picture.tsx`, device-only: the page's example state drawn once by the game's own `draw()` on a static canvas, the page's pointer cells outlined like a hinted move, labelled for VoiceOver with `board.describe`); without the factory (Jest) it returns `null`. The picture has a size contract: its root view is `alignSelf: 'stretch'` with `aspectRatio: examplePictureAspectOf(board)` (`EXAMPLE_PICTURE_ASPECT`, 320 / 206, unless the board module gives `exampleAspect`), and the S13 view gives its picture slot the same `useGameHost().howToPlayPictureAspect`. Without it the canvas measured 0 and drew nothing (the stage was 30 pt tall instead of 244).

`hasMusic` is `hasMusicOf(game)`: true when the game's sound bank has a sound in category `music` (spec 8.7: most games have none); the S6 and S11 hooks read it with `useGameHost().hasMusic`, so no separate sounds context exists. `isScoreRated` is `isScoreRatedOf(game)`: every level's star rule is a score rule (`isScoreRule`, the same rule that makes `RunSummary.par` null). Both live in `game-host/game-facts.ts` as pure helpers because the parity harness needs the same facts: a game without music is compared with the no-music reference variants of S6 and S11, and a score-rated game with the score-line variant of the S7 win. Its pin test (`apps/<id>/src/parity-game-facts.test.ts`, a toybox-visual-parity template) checks the app repo's `parity/game-facts.json` (`{ "version": 1, "games": { "<app id>": { "designGame": "lineSiege", "hasMusic": false, "winLine": "score" } } }`) against `hasMusicOf(module)` and `isScoreRatedOf(module)`, so a capture never picks a reference from a stale file. `hasHints` is `hasHintsOf(game)`: the rules' hint policy is `{ kind: 'solver' }`, the same rule that makes the session view's `isHintSupported` true, so the S5 top bar has a hint key exactly then; parity picks the `--no-hints` variants of S6 from `parity/game-facts.json`'s `hasHints` (checked against `hasHintsOf(module)` by the same pin test). Line Siege: no music, score-rated, no hints. `counters` keeps the game's order, catalog labels and aggregate for S10 (`statsSnapshotOf(summary, host.counters, ...)`; a `'max'` counter shows as ×N); `counterIds` stays for code that only needs the save keys. The saved level for Home's "Continue – Level N" is `save.doc().run?.ref` when `ref.kind` is `'level'`.

`openSession` returns `null` when there is nothing to open: `{ start: 'resume' }` with no saved run, a level outside the table, a daily or endless run the game does not have. A new run is written to the save at once, so Home can offer Continue even before the first move.

`writeRunEnd` performs the one run-end update. The composition root passes `(write) => { updateAndPublish(save, stores(), write); }` (the state-stores skill's `update-and-publish.ts`): one validated save with the backup refreshed, then the progress and stats stores re-read the document, so Home and S10 never show stale numbers. The host is created before the stores (it may drop an unreadable run), which is fine: a run can only end after the first render, when the stores exist. `check-game-host.mjs` fails `run-end-publish` when the composition root passes anything else.

`feedback` is the audio and haptics pair (`FeedbackPorts` from the audio skill's `ui-feedback.ts`). The session controller calls `playUiFeedback(deps.feedback, session.status === 'won' ? 'win' : 'lose')` in its persist step for the `apply-move` that ends the run, after the run is saved or recorded and before the store publishes. A loss that waits for its continue plays `lose` at once; declining later (`finish`) records it silently; a continued run that is lost again plays `lose` again. `check-game-host.mjs` fails `result-feedback` when the call is missing.

`extendRunEnd` lets another layer add its own section to the one run-end update. It must stay pure: `(doc, summary) => doc`. The composition root passes `extendRunEnd: recordAdLevelEnd` (in `create-shell-parts.ts`): for level runs only, it replaces `doc.ads.history` with admob-ads' `recordLevelEnd(doc.ads.history, summary.isWon ? 'win' : 'lose')`, so every finished level counts toward the interstitial caps in the same save that records the stars (spec 8.8). Without it `levelsCompletedSinceInterstitial` never rises and after the first interstitial no second one is ever due; `create-shell-parts.test.ts` ("counts a won level in the ad history in the same run-end save") proves it, and admob-ads' `check-ads.mjs` fails `level-end-recorded` without it.

## The session controller and the session view

`createSessionController(deps, session)` returns `{ handle, store, hintedMove }`. The `handle` is all a screen gets:

```ts
export type SessionHandle = {
  readonly getView: () => SessionView;                     // stable object until something changes
  readonly subscribe: (listener: () => void) => () => void; // fits useSyncExternalStore
  readonly send: (command: SessionCommand) => void;
};
export type SessionCommand =
  | { type: 'intent'; intent: InputIntent } | { type: 'undo' } | { type: 'hint' } | { type: 'continue' }
  | { type: 'pause' } | { type: 'resume' }
  | { type: 'finish' }   // decline the continue: record the pending loss; end a tutorial run
  | { type: 'leave' };   // Pause -> Home: keep the run, resumeOnLaunch false
export type SessionView = {
  status: 'playing' | 'paused' | 'won' | 'lost'; ref: RunRef; hud: HudView; moveCount: number;
  isUndoSupported: boolean; canUndo: boolean; isHintSupported: boolean; isHintShown: boolean;
  continueState: 'none' | 'offered' | 'used'; loseReasonKey: string | null;
  summary: RunSummary | null;  // set once the run is recorded
  eventSeq: number;            // changes with every applied, undone or continued move
};
```

`store` (the typed per-run session store) and `hintedMove()` (the move to highlight, or `null`) are for the board layer only, which receives them inside the seam.

`finish` also ends a tutorial run the player skipped or played through: the run is recorded with the `tutorial` run end, which clears it from the save and counts nothing, so Home never offers to continue a tutorial.

## The composition root

The composition root is a template set in `templates/packages/shell/src/app/` (copy verbatim). It is split so every part is testable without a phone:

- `create-shell-app.tsx`: `createShellApp(input)` builds `createDeviceAdapters()` once and `createShellParts(input, adapters)` once, and returns the root component that renders `<ShellApp parts={parts} />`. The rtl-and-direction skill's `start-shell.ts` calls it after the direction check: `registerRootComponent(createShellApp({ game, language, directionPlan }))`.
- `device-adapters.ts`: every native module lives here (the SQLite driver shared by the save store and the error log, the system clock, expo-network, the audio engine, the Shell haptics, the gated expo-iap port, the device locales and `expo.extra`). Device-only: the simulator kill test and the smoke flow cover it.
- `create-shell-parts.ts`: everything else, over `ShellAdapters`, so `createTestAdapters()` (in-memory fakes) runs the real boot in Jest.

Boot order (all synchronous, under the native splash), as `createShellParts` runs it:

1. Test builds wrap the clock once (`TEST_ONLY?.createSimulatedClock(real)`: the debug date moves `today()` for every reader, never `nowMs()`).
2. `hydrateSave({ store, clock, errorLog, gameId, appVersion })` (save-persistence-and-migrations); the launch's `prepareSave`, if any; a failed direction restart is logged now (the `error_log` table exists only after the DDL).
3. The audio engine loads `composeSoundBank(game.presentation.sounds)`.
4. **`createGameHost(game, { save, clock, errorLog, isContinueAllowed, seedOverride, openGame, createBoardHost: createGameBoardHost({ audio, haptics, errorLog, isLayoutProbeOn }), feedback: input.feedback, extendRunEnd: recordAdLevelEnd, writeRunEnd })`** in `hostFor`: the host validates the saved run with the game's own parsers and drops an unreadable run. `isLayoutProbeOn`, `seedOverride` and `openGame` come from `debugSwitchesOf(() => debug)` (`app/debug-switches.ts`), closures over the debug parts that step 8 creates. The feedback ports are `debugFeedbackOf(() => debug, { audio: adapters.audio, haptics })` (same file): each call asks for `parts.feedback` at that moment, the debug parts' recording ports in a test build (every sound and pulse also lands in the perf log as `{ kind: 'feedback', label }`, the E2E evidence of the win sound and the success haptic), else the real ports (store builds, and the moment before step 8 ran).
5. `createShellStores(save)` from the document as the host left it; `connectAudioSettings(stores.settings, audio)`.
6. Test builds wrap connectivity once (`TEST_ONLY?.createSimulatedConnectivity(real)`: "Simulate offline" reaches every subscriber).
7. Premium's dependencies: `createPremiumDeps(...)` with the store port gated where it is created (`withConnectivity(createExpoIapPurchaseAdapter(), isOnline)`, the wrapped port's `isOnline`).
8. The test-only debug parts, before anything reaches the network: `adapters.createDebugParts({ network, clocks, premiumDeps, stores, audio, haptics, errorLog, save, saveDriver, extra, game: host.debugControls() })` is e2e-maestro's `createDebugParts` on a device (it installs the JS network guard first, then the perf log with S15's Performance actions, the feedback recorders around the app's `audio` and `haptics` ports (`parts.feedback`), the debug services over the test-only key-value store, the debug link handler and the navigator ref; services, links and feedback are `null` in store builds). The in-memory adapters return a store build's parts (`storeBuildDebugParts()`); a test that needs the real ones passes `createTestAdapters({ createDebugParts })` and mocks the two key-value adapters, as `shell-navigator.test.tsx` does. The game host reads three debug switches through closures over these parts (`debug-switches.ts`), all off in store builds: `isLayoutProbeOn` (the board's `game.board-layout` probe after the debug link's `boardLayout=1`, and in a parity capture's `probe=board` launch: `TEST_ONLY?.isParityBoardProbeOn()`, so the capture can mask the board rectangle the game reports), `seedOverride` (an endless run starts from the debug link's `seed=`) and `openGame` (the debug controls push the Game route: `navigationRef.dispatch(StackActions.push('Game', params))`, a new Game screen even when one is open). `game: host.debugControls()` gives the debug link its `playTo` (`action=win-level|lose-level`) and `openExample` (`screen=game-start|game-middle|result-win|result-lose`); see "Test builds: debug controls, parity frames and the board probe".
9. Premium starts: `startPremium(deps)` (never awaited), then **`connectPremiumReloads(connectivity, stores, deps)`**: `startPremium` runs before expo-network reports its first state, so a connectivity change calls `shouldReloadStore(flow, isOnline)` and then `loadStore`, followed by `recheckPremium` when the change is to online (the launch re-check ran offline, where absence is not evidence, so a refund would wait for the next foreground), and AppState `'active'` while online calls `recheckPremium`. Without it Settings never shows a price after an offline start.
10. `Services`: the ads and consent ports (`createAdsPort(config.ads, recordAdError)`, `createConsentPort(adsMode, { onError })`; the consent port carries Apple's tracking prompt, `requestTracking()`, which the consent moment asks after Google's form (or on its own when only Apple's prompt is due, L10) and which an `ADS_MODE=off` build never asks; a test build passes it through `debug.services?.consentFor(consent) ?? consent`, so the debug link's `geo=eea|other` makes Google's UMP answer as in the EEA or elsewhere from the next consent moment on, while a store build only ever passes `{ onError }`), audio, clock, connectivity, error log, haptics, the gated purchase port, the save.
11. **The resume state after the host:** `initialStateFor(launch, save)` is the launch's own route or `resumeState(save.doc())`, so a run the host dropped is never resumed.

`ShellLaunch` is how a test build changes a launch without the composition root importing test code, so the root compiles and is tested before any harness exists. A normal launch passes nothing. The parity harness (toybox-visual-parity) plugs in through it: its startup reads the request (`readParityLaunch()`, through `TEST_ONLY`) and passes `createShellApp({ game, language, directionPlan, launch })` with its functions as the members:

| `ShellLaunch` member | When the root calls it | The parity harness's function |
|---|---|---|
| `prepareSave(save, simulatedClock)` | right after `hydrateSave`, before the host and the stores | `applyParityData({ parity, game, save, simulatedClock })` |
| `purchasePort(productId)` | building the Premium dependencies (the port is gated like the device's) | `parityStorePort(parity, productId)` |
| `adsPort()` | building the services | `parityAdsPort(parity)` |
| `initialState()` | instead of `resumeState(save.doc())` | `initialStateFor(parity, undefined)` (the frame's route) |
| `wrapRoot(root)` | around the root component `createShellApp` returns | `withParityRoot(parity, root)` |
| `isConsentMomentHeld()` | once, into `ShellParts.isConsentMomentHeld` for `ShellFeatures` | `request.plan.start === 'Consent' && api.isHeldParityStart(request.plan)`: the S3 frame shows the consent moment at once and never asks Google |

`create-shell-parts.test.ts` and `create-shell-app.test.tsx` prove each member is used where the table says.

The provider order in `ShellApp` matters: `ServicesProvider` → `StoresProvider` → `LocalizedRoot` (i18n, reads the settings store) → `DirectionProvider` → `ShellProviders` (gesture root, safe area, theme, motion config, the error boundary whose fallback is the S14 `CrashScreen`) → `ShellFeatures` (`GameHostProvider` → `PremiumScreenDepsProvider` → `PressFeedbackProvider` → admob-ads' `ConsentMoment`, which provides the ad hooks their consent moment and draws S3 over the app while it asks) → `ShellNavigator` (`DebugServicesProvider` with the debug services and links → `DialogProvider` → the themed `NavigationRoot` with `navigationRef={debug.navigationRef}` and `onReady`, which starts the debug link handler: `links.start(Linking)`, stopped again if the navigator unmounts). `ShellApp` mounts `useCheckpointOnBackground(save)` and `useAudioLifecycle(...)` exactly once. The crash screen's "Back to Home" resets the boundary and restarts the navigator at Home, never inside the run. `shell-app.test.tsx` renders Settings, the tutorial and the crash path through these real providers, which is what catches a provider the root forgets (a screen test through `renderWithShell` cannot).

Where each import of the root comes from. Every `@e07/` file that a template in `templates/packages/shell/src/app/` (the root files and their tests) imports, with the skill that owns it and the Shell step at which pocket-arcade-index's step manifest copies it. All of them are in the repo by the end of Shell step 7, when the root lands, so the root type-checks the moment it is copied (a missing row is how a builder ends up chasing `TS2307` errors). `node ${CLAUDE_SKILL_DIR}/scripts/check-root-imports.mjs` proves the table lists every import (this skill's self-test runs it):

| Shell step | Owner skill | Files (under `packages/shell/src/`) |
|---|---|---|
| 1 | monorepo-bootstrap | `config/game-extra.ts` |
| 4 | save-persistence-and-migrations | `services/clock/clock-port.ts`, `services/clock/system-clock-adapter.ts`, `services/error-log/error-log-port.ts`, `services/error-log/fake-error-log.ts`, `services/error-log/sqlite-error-log-adapter.ts`, `services/save/expo-sqlite-sql-driver.ts`, `services/save/load-plan.ts`, `services/save/save-db-schema.ts`, `services/save/save-service.ts`, `services/save/save-store.ts`, `services/save/schema/save-doc.ts`, `services/save/sql-driver.ts`, `services/save/sqlite-save-store.ts` |
| 5 | admob-ads | `services/ads/ad-history.ts`, `services/ads/ads-factory.ts`, `services/ads/ads-port.ts`, `services/ads/fake-ads.ts`, `services/ads/read-ads-extra.ts`, `services/connectivity/connectivity-port.ts`, `services/connectivity/expo-network-connectivity-adapter.ts`, `services/connectivity/fake-connectivity.ts`, `services/consent/consent-factory.ts` |
| 5 | game-audio-and-haptics | `services/audio/audio-api-audio-adapter.ts`, `services/audio/audio-port.ts`, `services/audio/compose-sound-bank.ts`, `services/audio/fake-audio.ts`, `services/audio/ui-feedback.ts`, `services/audio/use-audio-lifecycle.ts`, `services/haptics/fake-haptics.ts`, `services/haptics/haptics-port.ts` |
| 5 | premium-purchase | `services/purchase/connectivity-gated-purchase.ts`, `services/purchase/expo-iap-purchase-adapter.ts`, `services/purchase/fake-purchase.ts`, `services/purchase/format-store-price.ts`, `services/purchase/premium-service.ts`, `services/purchase/premium-store-flow.ts`, `services/purchase/purchase-port.ts`, `stores/premium/premium-state.ts` |
| 5 | state-stores | `app/stores-context.tsx`, `stores/create-shell-stores.ts`, `stores/settings-selectors.ts`, `stores/update-and-publish.ts`, `testing/create-test-save.ts` |
| 5 | unit-and-component-tests | `testing/flush-microtasks.ts` |
| 6 | architecture-and-boundaries | `app/test-only.ts` |
| 6 | i18n-strings-and-catalogs | `i18n/digits.ts`, `i18n/game-message-text.ts`, `i18n/languages.ts`, `i18n/messages.ts`, `i18n/resolve-language.ts` |
| 6 | navigation-and-routing | `navigation/route-params.ts` |
| 6 | rtl-and-direction | `i18n/direction-plan.ts`, `i18n/direction.ts` |
| 7 | admob-ads | `app/consent-moment.tsx` |
| 7 | architecture-and-boundaries | `app/read-game-extra.ts`, `app/services-context.tsx` |
| 7 | board-rendering-skia | `game-host/game-board-host.tsx` |
| 7 | e2e-maestro | `app/create-debug-parts.ts`, `app/debug-services-context.tsx`, `screens/debug/debug-services.ts`, `screens/debug/fake-debug-store.ts`, `screens/debug/simulated-clock.ts`, `screens/debug/simulated-connectivity.ts` |
| 7 | game-host-integration | `app/connect-premium-reloads.ts`, `app/create-premium-deps.ts`, `app/create-shell-parts.ts`, `app/debug-switches.ts`, `app/device-adapters.ts`, `app/load-outcome-opener.tsx`, `app/shell-app.tsx`, `app/shell-features.tsx`, `app/shell-navigator.tsx`, `game-host/create-example-picture.tsx`, `game-host/create-game-board-host.tsx`, `game-host/game-host-context.tsx`, `game-host/game-host.ts`, `game-host/run-summary.ts`, `game-host/shell-game-module.ts`, `game-host/use-is-fullscreen-ad-showing.ts`, `testing/create-test-adapters.ts`, `testing/tally-game.ts` |
| 7 | i18n-strings-and-catalogs | `i18n/t-context.ts` |
| 7 | navigation-and-routing | `navigation/navigation-root.tsx`, `navigation/navigation-theme.ts` |
| 7 | performance-budgets | `app/perf/frame-histogram.ts`, `app/perf/perf-log.ts`, `app/perf/use-frame-recorder.ts` |
| 7 | react-components-and-hooks | `app/shell-providers.tsx` |
| 7 | rtl-and-direction | `i18n/direction-context.tsx` |
| 7 | save-persistence-and-migrations | `app/hydrate-save.ts`, `app/use-checkpoint-on-background.ts` |
| 7 | settings-and-preferences | `app/connect-audio-settings.ts`, `app/create-shell-haptics.ts`, `app/localized-root.tsx`, `config/external-links.ts` |
| 7 | toybox-components | `ui/button.tsx` |
| 7 | toybox-design-system | `app/press-feedback-context.tsx`, `theme/theme-set.ts`, `theme/use-theme.ts`, `ui/app-text.tsx` |
| 7 | toybox-screens | `app/crash-screen.tsx`, `app/dialog-context.tsx`, `app/premium-screen-deps-context.tsx`, `screens/dialogs/dialog-request.ts` |
| 7 | unit-and-component-tests | `testing/render-with-shell.tsx` |

In a partial Shell (`shell-slice.json`) the root is the same, and so is the **Shell core** it imports, whatever the slice: screens outside the slice have no route or view files, but these files are always there, because the composition root and startup import them (D36):

| Shell core | Files | Owner |
|---|---|---|
| The S14 dialogs | `screens/dialogs/dialog-host.tsx`, `dialog-request.ts`, `app/dialog-context.tsx` | toybox-screens |
| The S5 top bar and layout | `game-host/game-top-bar.tsx`, `screens/game/game-layout.tsx` | toybox-screens |
| The S7 result model | `screens/result/result-model.ts` (the host's `result-model-of.ts` builds it) | toybox-screens |
| The S3 consent intro | `screens/consent/consent-intro-screen.tsx` (the consent moment in `ShellFeatures` draws it) | toybox-screens (view), admob-ads (`app/consent-moment.tsx`) |
| The e2e debug kit without `use-debug-model` and the S15 view | `app/create-debug-parts.ts`, `debug-services-context.tsx`, `debug-link-handler.ts`, `debug-link-routes.ts`, the `screens/debug` services, and `debug-rows.ts` for `debug-actions` | e2e-maestro, toybox-screens |
| The parity harness | `app/parity/`, `app/parity-startup.tsx` | toybox-visual-parity |
| The perf layer | `app/perf/` (and the shell-native module from Shell step 8) | performance-budgets |
| The Tutorial route | `screens/first-run/tutorial-screen.tsx`, `tutorial-view.tsx`, `use-tutorial-model.ts`, `tutorial-coach.ts`, always routed to `TutorialScreen` | this skill |

The navigator's other routes outside the slice use `NotBuiltScreen` (navigation-and-routing); the test-only pair drops `DebugScreen` while S15 is outside the slice. The Tutorial route is never on `NotBuiltScreen`: `shell-app.test.tsx` ("opens the tutorial level on a first launch") waits for `tutorial.screen` and passes in any slice, and `check-game-host.mjs` checks the Tutorial files in every slice (`tutorial-screen`). With `"screens": []` (a game-first repo) there is no Shell app yet and `check-game-host.mjs` prints SKIP lines for the root and the Tutorial route.

`check-game-host.mjs` reads the root file that calls `createGameHost` and follows the calls of its own top-level helpers in order (`openSave` → `hydrateSave`, `hostFor` → `createGameHost`, `initialStateFor` → `resumeState`): `host-order` (hydrate, host, then the stores and the resume state), `run-end-publish`, `host-deps`, `continue-from-config`, `host-not-provided`, `debug-controls` (the debug parts get `game: host.debugControls()`), `parity-board-probe` (`debug-switches.ts` also reads `isParityBoardProbeOn`), `feedback-recorded` (the host gets `feedback: debugFeedbackOf(...)`, `createDebugParts` gets `haptics`, and `debugFeedbackOf` plays through `parts()?.feedback ?? ports`), and `root-file-missing` for any template file or test that is gone. premium-purchase's `check-premium-behaviour.mjs` fails `store-reloads` without the two reload call sites.

## The board host factory and tap-then-tap

`createBoardHost` is injected so `game-host.ts` needs no Skia. It is called once per opened run with the typed parts:

```ts
export type BoardHostInput<T extends ShellGameTypes> = {
  readonly game: ShellGameModule<T>;
  readonly controller: SessionController<T['state'], T['move'], T['event']>;
  readonly lifecycle: FullscreenGate;
};
export type BoardHostFactory = <T extends ShellGameTypes>(input: BoardHostInput<T>) => ComponentType<BoardHostProps>;
```

`createGameBoardHost({ audio, haptics, errorLog, isLayoutProbeOn? })` returns the factory (`isLayoutProbeOn`, test builds only, turns on board-rendering-skia's `game.board-layout` probe after the debug link's `boardLayout=1` and in a parity `probe=board` launch). For each opened run it builds the render kit once and returns a `BoardHost` that puts its `testID` on rtl-and-direction's `BoardDirectionView` and renders board-rendering-skia's `GameBoardHost` inside it. The component needs Skia, so it is device-only (its first line says so); its logic lives in `board-host-model.ts` and `use-board-selection.ts`, both tested.

| GameBoardHost prop | Source |
|---|---|
| `board`, `buildTimeline` | `game.presentation.board`, `game.engine.buildTimeline` |
| `result` | one `{ seq: eventSeq, state, events: lastEvents }` object per `eventSeq` (`createMoveResultSelector`) |
| `panMode` | `game.engine.panMode` |
| `highlight` | `useBoardSelection(...).highlight`: `{ selected, hinted }` (below) |
| `onIntent` | `useBoardSelection(...).onIntent`, which routes taps, then `boardHandlersFor(controller.handle, errorLog).onIntent` |
| `onFailure`, `reportError` | pause and `errorLog.record('frame-callback', ...)`; `errorLog.record('audio', ...)` |
| `onHover` | ignored: hover and drag ghosts are drawn on the UI thread from `frame.fx.pointer` |
| `isFullscreenAdShowing`, `isFocused` | `useIsFullscreenAdShowing(lifecycle)`, `useIsFocused()` |
| `colors`, `kit`, `format`, `accessibilityLabel`, `motion`, `isRtl` | the palettes for the theme, the render kit, the number formatter, `board.describe(...)`, `motionOf(useReduceMotion())`, `useDirection() === 'rtl'` |
| `audio`, `haptics` | the ports given to `createGameBoardHost` |

**Tap-then-tap.** The selection is UI state of this one board host: never game state and never a move, so bots, sims, the witness solver, par, undo and the move counters never see it. `routeIntent` decides for each intent:

- a tap in one of `game.engine.selectRegions` (Line Siege: `['tray']`) toggles the selection: a new target selects it, the same target again clears it; nothing is sent to the run, and VoiceOver hears `game-screen.board.selected.a11y-announcement` or `...unselected...` (through `useAnnounce`);
- any other tap is sent as `{ ...intent, selected }`; `intentToMove` builds the move from the selection and the tapped cell, or returns `null` (the selection stays, so the player can try another cell);
- a drag-end ignores the selection and clears it; every other intent passes unchanged.

The selection belongs to the `eventSeq` it was made at, so any applied, undone or continued move and the run's end clear it; a restarted run gets a new `BoardHost`, so it starts without one. A tap outside every region is no intent: the gesture layer reports it through `onMiss` (`useBoardGestures` → `BoardCanvas` → `GameBoardHost`), and `create-game-board-host.tsx` passes `onMiss={selection.clearSelection}`, so it drops the selection. The bought hint is drawn from `hinted`: `board.targetsOfMove?.(state, controller.hintedMove())`, or nothing when the board has no `targetsOfMove`; the Tutorial route adds its pointer cells (`coachTargets`). `use-board-selection.test.tsx` proves select, toggle, place, the VoiceOver news, clearing on undo and restart, and the hinted and coached cells.

## Test builds: debug controls, parity frames and the board probe

`host.debugControls()` returns `GameDebugControls` (`game-host/game-debug-controls.ts`): e2e-maestro's `DebugGameControls` (`playTo`, `openExample`, from `app/debug-link-routes.ts`) plus `applyFixtureHud` and `showFixtureResult` for the parity frames. Its `playTo` returns `boolean` (false: no active run, nothing changed), which is assignable to `DebugGameControls.playTo`. Only test builds reach it: the composition root passes it to `createDebugParts`, which returns `null` services and links in a store build. The host keeps the run it acts on in `run-tracker.ts`: the last run `openSession` opened, forgotten on `leave`, never the tutorial.

- **`playTo(outcome)`**: the active run's state is swapped for `testing.examples.win()` or `lose()` (same ref) by the controller's `endWith`, which runs the same persist step as a deciding move: the one run-end update (stars, statistics, `extendRunEnd`'s ad history, the cleared run, the backup) is written before the store publishes, then the result feedback plays. So `action=win-level` ends the current level exactly like a real win, and the save holds the stars before Result shows. `action=` ends any active run the same way, level, daily or endless: `playTo('won')` on today's daily run records the daily result, the day in the streak and the statistics before Result shows (flow 11-daily), and `playTo('lost')` on an endless run records the endless best when the player declines the continue, with "New best!" when it beats the old one (flow 13-endless). A lose example with a continue stays pending, as a real loss does. `game-debug-controls.test.ts`, `run-tracker.test.ts` and each game's `<game-id>-debug-controls.test.ts` prove the three kinds.
- **`openExample(example)`**: stages `testing.examples.start()` or `middle()` (`result-win` and `result-lose` stage `start()` and end it through `endWith` as soon as the run opens) for the next new level-1 run, then `openGame(EXAMPLE_RUN)` pushes the Game route; the Game screen's `openSession({ start: 'new', ref: { kind: 'level', level: 1 } })` takes the staged example (another run drops it). The run is written at once, like any new run.
- **`applyFixtureHud(fixture)` and `showFixtureResult(fixture, result)`**: the design's numbers (level 12, score 1,840, the game's progress at mid or full, 3 stars, New best, 7 moves, par 7 or the score line, the first lose reason, the continue offer) over the played run, through the controller's `showFixture` (a `ViewFixture` merged into the view). Nothing is written to the save; S7 builds its model from the fixture's `RunSummary` through `resultModelOf`.

**The parity frame openers (D31).** `useGameSessionControls` applies the parity frame state once, right after it opens the run: `applyFixtureHud(TEST_ONLY.parityGameFixture())` for every game frame, `pause` for `pause-open` (S6), `showFixtureResult(fixture, 'won' | 'lost')` for `result-win` and `result-lose` (S7). A normal launch has no fixture, and the `probe=board` launch opens no state. `check-game-host.mjs` fails `parity-frame-openers` when one of them is missing.

**The board probe (L6).** S5, S6 and S7 have no board reference (each game brings its own board), so their parity masks the board: the capture first launches the frame with `probe=board`, which turns the board-layout probe on (`isLayoutProbeOn` in `debug-switches.ts` reads `TEST_ONLY?.isParityBoardProbeOn()`) and opens no frame state, reads the board rectangle from `game.board-layout`, then launches the real capture. Store builds stay off (`TEST_ONLY` is `null`).

## The Tutorial route

The FirstRun route `Tutorial` (navigation-and-routing registers it with `gestureEnabled: false`; spec S13) is the game's scripted tutorial level, `templates/packages/shell/src/screens/first-run/`. It is part of the Shell core: installed and routed to the host's `TutorialScreen` in every Shell app, whatever `shell-slice.json` holds (S13 How to play is a separate screen that may be outside the slice):

- `use-tutorial-model.ts` opens `{ start: 'new', ref: { kind: 'tutorial' } }` with `useGameSessionControls`. The game host plays `teaching.tutorial` from its `start` state and accepts at each step only that step's expected move (`'any-move'` steps accept every legal move; after the last step the run plays freely).
- `tutorial-coach.ts` (pure) turns `host.tutorialSteps` and the view into the coach: the step (one per applied move), its sentence and pointer cells, `paused`, or `done` once the script is played or the run ended. Skip shows from the second step (spec S13: "no Skip until the second step").
- `tutorial-view.tsx` draws the board with the pointer cells outlined, one sentence under it (`tutorial.welcome` with the game name above the first), Skip (`tutorial.skip-button`) and, while paused or once done, a continue key (`tutorial.tap-to-continue`; the done sentence is `tutorial.done`). Root testID `tutorial.screen`.
- Skip and the final continue send `finish` (the tutorial run is cleared from the save, nothing counted) and dispatch `finish-tutorial`; the FirstRun group then ends and the navigator lands on Home. Back pauses or resumes, never leaves; going to the background pauses.
- Replaying from S13 How to play opens the same run on the Game route: `navigate('Game', { start: 'new', ref: { kind: 'tutorial' } })`.

## The Game screen: S5, S6 and S7

The Game screen's view side ships in toybox-screens: `screens/game/game-screen.tsx` is one shared file (the same bytes in toybox-screens, navigation-and-routing and this skill's `examples/game-screen/game-screen.tsx`), with its model hook `use-game-screen-model.ts` and helpers (perk payment, result actions and extras, run text, the moves probe), `GameLayout` (the overlays over the whole screen) and the Pause and Result overlays. This skill wires the host into it; the example shows exactly which host calls the screen makes. Everything comes from `useGameSessionControls(route.params)`:

| Element | Reads | Sends |
|---|---|---|
| Top bar | `topBarPropsOf({ view, hintOffer, text, labels, isReducedMotion, onUndo, onHint, onPause })` → `<GameTopBar {...props} />` | undo: `send({ type: 'undo' })`; hint: pay first (below), then `send({ type: 'hint' })`; pause: `controls.pause()` |
| Board area | `controls.BoardHost` inside `game.board` | intents (through the board) |
| Pause (S6) | `status === 'paused'` | Resume: `controls.resume()`; Restart level: `controls.startRun(view.ref)`; Home: `controls.leaveToHome()` then `popTo('Home')` |
| Result (S7) | `resultModelOf({ view, game: useGameHost(), text, actions, continueOffer, isReducedMotion, extras })`: the win title (`host.winTitleId` through `text.gameText`) and the lose picture's logo (`host.logo`) come from the module; `extras` holds only the streak, the endless best and the nudge price. `WinResult.par` is `null` for a score-rated level and `WinResult.bestScore` is the level's best after this run: its line prints `result.win.score-line` ("Score 1,840 – best 1,840"); a moves-rated level prints `result.win.moves` ("7 moves – par 7") | Next: `startRun({ kind: 'level', level: summary.nextLevel })`; Replay / Try again: `startRun(view.ref)`; Continue: pay, then `send({ type: 'continue' })`; Levels / Home: `send({ type: 'finish' })` then navigate |
| Background, blur | `usePauseOnBackground(controls.status, controls.pause)` | pause |
| No run to open | `status === 'missing'` | leave to Home |

Game texts: the module hands over plain message ids (hud goal, lose reason, counter labels, pack names), while the Shell's `t()` takes only branded keys. The one bridge is the i18n skill's `gameMessageText(t, message)` in `packages/shell/src/i18n/game-message-text.ts`; build `RunText` as `{ t, formatNumber, gameText: (message) => gameMessageText(t, message) }`. Never cast or call `asGameKey` in a screen.

Paying for perks: the ads layer's `perkOffer(useHintPerk(today), ...)` gives `'free' | 'watch-ad' | 'hidden'` for a hint (a continue can also be `'loading'`, next section) (`useHintPerk` counts the free hints left with `selectFreeHintsLeft(progress, today, extra.hints.freePerDay)`, so a game whose `game.config.ts` gives 0 free hints never offers one). Free for a non-Premium player means the daily allowance: dispatch the progress store's `use-free-hint`, then send the hint. `'watch-ad'`: `earnRewardedPerk(...)` and send the hint only when it returns true. Premium: send it. A hidden offer hides the button (spec 8.8: offline, no ad, not Premium).

The full-screen interstitial after Next / Replay / Try again runs inside `runFullscreenAd(host.lifecycle, show)` (admob-ads), never before the player has seen the result.

## Never strand a finished run (L11)

A run that has ended must show its result at once unless the player can still rescue it. The continue offer is `PerkOffer` from admob-ads' `perk-offer.ts`, read with the AdsPort's `rewardedStatus()` (`'loading' | 'ready' | 'unavailable'`, through `subscribeRewardedStatus`): `'free'` (Premium), `'watch-ad'` (ads servable, the rewarded ad ready), `'loading'` (ads servable, the ad still loading) or `'hidden'` (anything else). `resultModelOf` maps them to `LoseResult.continueOffer` `'premium' | 'ad' | 'ad-loading' | null` (`CONTINUE_OFFER`), and S7 draws `'ad-loading'` as the same offer with the ad key busy. So `'hidden'` always means unavailable.

`game-host/run-end-policy.ts`:

```ts
export function isLossStranded(view: SessionView, continueOffer: PerkOffer): boolean {
  return (
    view.ref.kind !== 'tutorial' &&
    view.status === 'lost' &&
    view.continueState === 'offered' &&
    view.summary === null &&
    continueOffer === 'hidden'
  );
}
```

toybox-screens' `use-game-screen-model.ts` sends `{ type: 'finish' }` once per `eventSeq` while it is true: the loss is recorded in the one run-end update (statistics, streak, endless best, ad history, through `extendRunEnd`) and the recorded Result shows: the endless result with its score and "New best!", or the lose result without an offer. This covers a run that ends with ads off, offline or without a rewarded ad, an offer that turns hidden while S7 shows (offline, a load error), and a pending lost run reopened from Home. `check-game-host.mjs` rule `loss-not-stranded` checks the three parts (the policy file, the `loading: 'ad-loading'` mapping, the screen model's finish; the last is a SKIP line while S5 is outside `shell-slice.json`); fixture `bad-loss-stranded` holds the round-4 files.

## Texts the host adds

Two Shell keys the copy deck lacks, for the tap-then-tap announcements (the canonical text is this table; add them to `packages/shell/src/i18n/catalogs/*.json`; fa and ckb go on the next native-speaker review list):

| Key | en | de | fa | ckb |
|---|---|---|---|---|
| `game-screen.board.selected.a11y-announcement` | Picked. Now tap where it goes. | Ausgewählt. Tippe jetzt, wohin es soll. | انتخاب شد. حالا روی جای آن ضربه بزنید. | هەڵبژێردرا. ئێستا دەست لە شوێنەکەی بدە. |
| `game-screen.board.unselected.a11y-announcement` | Selection cleared. | Auswahl aufgehoben. | انتخاب لغو شد. | هەڵبژاردن هەڵوەشایەوە. |

The Tutorial route's texts (`tutorial.welcome`, `tutorial.skip-button`, `tutorial.tap-to-continue`, `tutorial.done`) and the score-rated win line (`result.win.score-line`: en "Score {score, number} – best {bestScore, number}") come from the i18n and screens skills.

## Settled points

In the contract and the templates, checked by the scripts:

1. **Pan mode and select regions:** `engine.panMode` and `engine.selectRegions` in the GameModule contract (game-rules-engine); `engineContractProblems` proves taps in select regions return `null` and moves from selected taps are listed.
2. **Win title and logo:** `identity.winTitleId` (`'<id>.win-title'`, all four catalogs) and `presentation.art.logo` (`GAME_ART.logo`); `resultModelOf` takes `game: useGameHost()`.
3. **No `drawIcon`:** every picture of the game draws `LOGO_ART`.
4. **Licence rows:** `GameArt.credits` reaches screens as `host.credits`; the licences screen appends `creditRowsOf(host.credits)`.
5. **Game texts:** the i18n skill's `gameMessageText` in `packages/shell/src/i18n/game-message-text.ts`.
6. **Par and the score line on score-rated levels (was open point 1):** `WinResult.par` is `number | null`; `resultModelOf` passes the level's par, or `null` for a score-rated level (`isScoreRule`), with `bestScore` (the level's best after this run's save), and the win view then prints `result.win.score-line` ("Score 1,840 – best 1,840") instead of the moves line.
7. **The board highlight (was open point 2):** `GameBoardHost` takes `highlight: BoardHighlight` (`{ selected, hinted }`, board-rendering-skia); the host fills it from the selection and `board.targetsOfMove` of the hinted move, so a bought hint and a tap-then-tap selection are drawn on the board.
8. **Music rows and counters:** `host.hasMusic` and `host.counters`; no sounds context.
9. **Endless best:** an endless run can only end lost, so "New best!" compares its score with the best whether or not it was won; a lost level or daily run never shows it.
10. **Debug controls (was open work):** `GameHost.debugControls()` gives the debug link `playTo` and `openExample` and the parity frames `applyFixtureHud` and `showFixtureResult`; the composition root passes `game: host.debugControls()` to `createDebugParts`, so `action=win-level|lose-level` and the example screens work in test builds.
11. **Game facts:** `hasMusicOf`, `isScoreRatedOf` and `hasHintsOf` (`game-facts.ts`) decide `GameHost.hasMusic`, `GameHost.isScoreRated`, `GameHost.hasHints` and the parity reference variants from the same rules.
