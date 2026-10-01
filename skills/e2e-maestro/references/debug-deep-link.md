# The debug deep link, its handler and S15's model

Test builds (`APP_VARIANT=test`, `EXPO_PUBLIC_APP_VARIANT=test`) listen for one URL that puts the app into any state a flow needs, and the S15 debug menu changes the app through the same code. This page is the contract between the flows, the handler this skill ships and the Shell.

## Contents

- Where it lives and why store builds are safe
- The URL and its parameters
- What the handler does, in order
- Timing: links before the navigator is ready, and group switches
- Kept across the direction reload and a kill
- Services for the debug module
- Wiring
- S15's model hook
- The perf log for Home
- game.board-layout
- debug.network-attempts
- Launch arguments as the alternative

## Where it lives and why store builds are safe

| File (template here) | What it does |
|---|---|
| `packages/shell/src/screens/debug/debug-link.ts` | Pure parser: `parseDebugLink(url)` returns `not-debug`, an `error` (unknown, repeated or bad parameter) or a typed request |
| `packages/shell/src/screens/debug/debug-save-recipe.ts` | Pure: the one save write a request makes (settings, first run, level and star fixtures) |
| `packages/shell/src/app/debug-link-routes.ts` | Pure: `screen=` to a route; the next level for `screen=game` |
| `packages/shell/src/app/debug-link-handler.ts` | `createDebugLinkHandler(deps)`: `handleUrl(url)`, `apply(request)` and `importSave(text)` (S15), `listen(Linking)` (at creation), `start(Linking)` (navigator ready) |
| `packages/shell/src/app/debug-link-intake.ts` | The handler's inbox: links queued until the navigator is ready, then applied in order; the launch link a reload was for is never applied twice |
| `packages/shell/src/screens/debug/debug-save-import.ts` | Pure: `decodeSaveText(text, gameId)`, S15's import through the save codec (`decodeSlot`: migrations, the valibot schema, the game id) with a readable error |
| `packages/shell/src/screens/debug/debug-overrides.ts`, `services/save/sqlite-kv-debug-store-adapter.ts` | The debug flags outside the save, kept in the test-only key-value store |
| `packages/shell/src/app/create-debug-parts.ts` | The composition root's one call for the test-only parts (below) |

The handler, the parser and the store adapter are reached only through `packages/shell/src/app/test-only.ts` (`TEST_ONLY.createDebugLinkHandler`, `TEST_ONLY.createSqliteKvDebugStoreAdapter`), and the navigator has no `linking` config, so store builds contain none of it; the release audit greps the store bundle for the sentinel `SHELL_TEST_BUILD_ONLY`. `create-debug-parts.ts` and `debug-services-context.tsx` are in every build but import the debug module only as types; in a store build they return and provide `null`.

## The URL and its parameters

`<scheme>://debug/setup?<param>=<value>&...` (all optional):

| Parameter | Values | Effect |
|---|---|---|
| `lang` | `en`, `de`, `fa`, `ckb` | forced app language (direction follows; fa and ckb are right-to-left) |
| `digits` | `auto`, `latin`, `local` | digit setting |
| `theme` | `system`, `light`, `dark` | theme setting (`system` for the matrix: the simulator appearance decides) |
| `seed` | integer 0..4294967295 | `debugServices.setSeed`: the level seed override S15 shows under "Show state" |
| `level` | integer 1..last level | makes this the next level: every earlier level is won (1 star unless already won), this one and later ones are cleared, the saved run is dropped |
| `date` | `YYYY-MM-DD` | `debugServices.setDate`: the `SimulatedClock` the whole app was built with answers this day from `today()` (daily challenges, streaks, S15 "set date"); `nowMs()` and `msUntilNextLocalDay()` stay the real clock's, so timers and the next-day countdown never jump |
| `ads` | `off`, `test` | `debugServices.setAdsOverride('never' / 'always-test')`, S15 "never ads / always test ads"; matters only in an `ADS_MODE=test` build (E2E and screenshots use `ADS_MODE=off` builds, which never start the SDK) |
| `premium` | `0`, `1` | Premium on or off without a purchase (S15): `debugServices.setPremium`, save first, then `debug-premium-set` |
| `offline` | `0`, `1` | "Simulate offline" (S15): `debugServices.setOffline`; the ConnectivityPort answers offline and tells every subscriber, so ads and the store follow |
| `firstRun` | `0`, `1` | `1` = first-launch state (S2 next); `0` = language chosen, tutorial done. A value that switches the navigator's group opens `screen=` on the next navigation state |
| `reduceMotion` | `0`, `1` | reduce motion setting |
| `stars` | `demo` or `<level>:<stars>,...` (stars 0-3) | progress fixtures: `demo` = levels 1-11 won with 28 stars (the screenshot fixture); `0` clears a level |
| `screen` | `home`, `levels`, `daily`, `stats`, `settings`, `premium`, `how-to-play`, `debug`, `game`, or `game-start`, `game-middle`, `result-win`, `result-lose` | opens a route (kebab-case) or one of the game's example states (spec 10 TESTING) |
| `action` | `win-level`, `lose-level` | ends the active run with that outcome, whatever its kind (a level, today's daily or an endless run): the game host (`GameHost.debugControls().playTo`) swaps the run's state for `testing.examples.win()` or `lose()` and runs its one run-end path (stars, the daily result and streak, the endless best, statistics, ad history saved before Result shows; a loss that still has its continue shows the offer first). A link of its own, once the run is on screen; without an active run it is an error |
| `boardLayout` | `0`, `1` | `debugServices.setBoardLayout`: `1` renders `game.board-layout`; off by default, so screenshots never show it |

A new parameter is added to `debug-link.ts` (its `READERS`), `assets/debug-link-params.json` and this table in the same change: `check-e2e-setup.mjs` (rule `debug-link`) fails when the parser and the JSON differ, and `check-flows.mjs` reads the JSON.

## What the handler does, in order

1. Parse. A link that is not `<scheme>://debug/setup` is ignored. An unknown, repeated or bad parameter is an error: nothing is applied, the error is recorded in the error log (source `boot`) and S15 opens, so a typo fails fast (its Error log row counts it).
2. Refuse what this build cannot do: a `level` or a `stars` level past the game's last level; `action=` or a game example screen while the game host passed no debug controls (`DebugGameControls`: `playTo`, `openExample`); `action=` together with a `lang` that flips the direction, or with a `firstRun` that switches the navigator's group (send it in a second link); `firstRun=1` with a `screen=` other than `debug` (those screens are not in the first-run group).
3. The debug services: `date`, `offline`, `premium`, `boardLayout`, `ads`, `seed`.
4. One validated save write through `updateAndPublish` (every section store re-reads): `lang`, `digits`, `theme`, `reduceMotion`, `firstRun` (a `lang` also marks the language as chosen), `level`, `stars`.
5. Either the direction reload (`lang` of the other direction: audio stopped, then `restartForDirection`), or the requested `screen` (at once, or on the next navigation state when step 4 switched the navigator's group), then `action`: `game.playTo('won' | 'lost')` returns whether a run was on screen; `false` makes the link an error (logged, S15 opens). A game example screen (`game-start`, `game-middle`, `result-win`, `result-lose`) calls `game.openExample(example)`, which pushes a new Game screen on a fresh level-1 run whose state is the game's example (`result-win` and `result-lose` end it at once through the same run-end path as a real move), so the stars, statistics and ad history are saved before Result shows.

Flows wait for an id after the link (`WAIT_FOR`), so the reload is invisible to them. S15's tools send typed requests through `apply(request)`, the same steps without the URL.

## Timing: links before the navigator is ready, and group switches

React Native's `Linking` delivers a link once: as the launch URL, or as a `url` event to the listeners attached at that moment. A flow sends its first link right after `launchApp: { clearState: true }`, while the app is still starting, and it is not launched by that link. Round 2 lost every such link: the handler listened only from the navigator's `onReady`. So:

- `createDebugParts` calls `links.listen(Linking)` as soon as the handler exists (before the first render). The intake (`debug-link-intake.ts`) queues every link, the launch URL included, until the navigator is ready.
- The navigator's `onReady` calls `links.start(Linking)`: it opens the screen a direction reload was for, then applies the queued links in order, and from then on applies each link as it comes. The returned stop (the navigator unmounted) queues links again. `start` also listens itself when nothing called `listen`, so an older composition root still works, only later.
- A save write that switches the navigator's group (a first-run save and `firstRun=0`, or the reverse) re-renders the static navigator into the other group: the Main group's routes (Home, Game, ...) exist only after that render. The handler therefore opens `screen=` from `deps.onNextNavigationState(callback)`, which `createDebugParts` implements as a one-shot `navigationRef.addListener('state', ...)`. One link `firstRun=0&level=1&screen=game` on a fresh install opens Game.
- The flows' `debug-setup.yaml` also waits for a screen root before it opens the link, so the app's JavaScript is running when the link arrives.

Tests: `debug-link-intake.test.ts` (queued in order, the reload's launch link dropped, stop queues again), `debug-link-handler.test.ts` ("applies a link sent before the navigator is ready once it is", "opens screen= after the group switch when one link ends the first run", `action=win-level` with and without a run on screen, the refused two-part links, `importSave`) and `create-debug-parts.test.ts` (the early listener and the one-shot state listener over the real parts).

## Kept across the direction reload and a kill

A reload or a killed app restarts the JS runtime. Everything a link sets in the save survives on its own; the rest is kept in the test-only key-value store (expo-sqlite/kv-store's own database, never the save document), with synchronous calls so it is back before the first render:

| Key | Holds | Written | Read |
|---|---|---|---|
| `debug.overrides` | `{ date, isOffline, isBoardLayoutOn, ads, seed }` | by every debug-services setter, at once | when the composition root creates the services (`restoreOverrides`): a stored date and a stored offline flag are applied again. A date set before the services exist (a parity frame's date) is kept |
| `debug.pending-screen` | `{ screen, url }` of a link that caused a direction reload | by the handler, before it restarts | once, by `start()` after the reloaded navigator is ready: it opens the screen; a cold start by that same URL is not applied twice |

`launchApp: { clearState: true }` wipes the app's data, this store included, so every flow starts clean. Nothing in rtl-and-direction changes: its own direction guard key stays separate.

## Services for the debug module

The S15 switches and the debug link change the app's state through the same code, and three of them reach real services (a fourth, `boardLayout`, is a flag the board host reads). They go only through `packages/shell/src/screens/debug/debug-services.ts` (template, with its test), which `check-e2e-setup.mjs` (rule `debug-services`) enforces:

| Parameter or switch | Call | What must happen |
|---|---|---|
| `offline=0\|1`, "Simulate offline" | `debugServices.setOffline(isOffline)` | `SimulatedConnectivity.setSimulatedOffline` changes what the app's one ConnectivityPort answers **and notifies every subscriber**: the ad policy, the connectivity-gated store (`withConnectivity`) and the S12 reload (`shouldReloadStore`). Premium Tier 2 flow 07 (`premium=0&offline=1&screen=premium`) shows "store unavailable" only because of that notification. |
| `premium=0\|1`, "Premium on (no purchase)" | `debugServices.setPremium(isPremium)` | The save's premium section is written first (`persistPremium({ isPremium: true })`, or `{ isPremium: false, revokedAtMs: clock.nowMs() }` so the save guard accepts the revoke), then the store gets `{ type: 'debug-premium-set', isPremium }`. Never StoreKit, never `premium-granted`, never a direct store write. |
| `ads=off\|test`, S15 ad switches | `debugServices.setAdsOverride('never' \| 'always-test' \| null)` | The ad policy reads it (admob-ads' `useAdPolicyConfig` through `useOptionalDebugServices()`: `never` switches ads off, `always-test` drops the pacing); S15's two switches show it |
| `seed=<n>` | `debugServices.setSeed(seed)` | The game host starts an endless run from it (`GameHostDeps.seedOverride`, wired by game-host-integration's `create-shell-parts.ts`); S15 "Show state" shows it |
| `boardLayout=0\|1` | `debugServices.setBoardLayout(isOn)` | The board host factory reads `isBoardLayoutOn()` when it draws (the composition root passes it as `createGameBoardHost({ ..., isLayoutProbeOn })`), so `game.board-layout` appears only in a test build and only after the link asked for it. |
| The consent geography picker (EEA, regulated US state, other) | `debugServices.createConsent(geography)` | Built with `createConsentPort(adsMode, { debugGeography, onError })`, never `createAdmobConsentAdapter`: an `ADS_MODE=off` build (every E2E and screenshot build) must not call Google's UMP. |

## Wiring

Once, in test builds, by three owners (the templates here are the pieces; game-host-integration owns the composition root and the app root, navigation-and-routing the navigator root):

1. **The composition root** (game-host-integration's `create-shell-parts.ts`, called by `createShellApp`) builds the clock and the connectivity port through `TEST_ONLY?.createSimulatedClock(real)` and `TEST_ONLY?.createSimulatedConnectivity(real)` (every service gets the wrapper). It receives `createDebugParts` through the device adapters (`ShellAdapters.createDebugParts`, which `device-adapters.ts` sets to this template's function and tests replace with a fake), and calls it after the save, the stores and `premiumDeps` exist and before `startPremium` and the ad services start:

   ```ts
   const debug = adapters.createDebugParts({
     ...{ network, clocks, premiumDeps, stores, audio, errorLog, save },
     saveDriver: adapters.saveDriver, // the one save.db connection: the perf log's table
     haptics: core.haptics,           // with audio: wrapped by the feedback recorders
     game: host.debugControls(),      // action= and the example screens
     extra: config.game,
   });
   // the board host factory: isLayoutProbeOn: () => debug?.services?.isBoardLayoutOn() === true
   // the game host's Shell feedback: ports that play through debug?.feedback ?? { audio, haptics }
   //   at call time (the host exists before the debug parts, which need its debug controls)
   // the app root's parts: debug
   ```

   `createDebugParts` (template) installs the JS network guard first, creates the perf log in the save database (`TEST_ONLY.createPerfLog(saveDriver)`; Home's cold-start mark, the frame recorder and the feedback recorders write it, `npm run e2e:ios` reads it back), S15's Performance actions over it (`TEST_ONLY.createDebugPerfActions({ perfLog, nowMs })`: record frame times, share the report, run the save benchmark; `services.perf`), the debug services over the test-only key-value store (the flags come back here; `services.perfLog` is the log), `feedback`: the audio and haptics ports wrapped by `TEST_ONLY.recordAudioFeedback` / `recordHapticsFeedback`, so every sound and pulse also appends `{ kind: 'feedback', label }` to the perf log (the E2E feedback evidence; `null` in a store build), the link handler (save writes through `updateAndPublish`, `restart` = `audio.dispose()` then `restartForDirection`, routes through the navigator ref, the group-switch wait through `navigationRef.addListener('state', ...)`, bad links to the error log) and `navigationRef = createNavigationContainerRef()`, then starts listening to `Linking` (`links.listen`). It takes `game?: DebugGameControls` (`GameHost.debugControls()`, only test builds reach it) for `action=` and the example screens; without it those parameters are refused with a clear error.
2. **The app root** (`shell-app.tsx`, `shell-features.tsx`) passes `debug` down, and `shell-navigator.tsx` provides `<DebugServicesProvider services={debug.services} links={debug.links}>` around the navigator.
3. **The navigator root** (`NavigationRoot`, navigation-and-routing) takes `navigationRef={debug.navigationRef}` (passed on as the container's `ref`) and `onReady`, which `shell-navigator.tsx` sets to start `debug.links?.start(Linking)` (stopping an earlier handler first): the pending screen of a reload, the launch URL, then every link.

`check-e2e-setup.mjs` (rules `debug-link`, `debug-persistence`, `perf-layer`) fails when nothing calls `start(Linking)`, `createDebugParts` does not `listen` at once, the handler opens `screen=` before a group switch, the test-only entry does not export the handler, the store, `createPerfLog`, `createDebugPerfActions` or the two feedback recorders, `createDebugParts` does not make them, the flags are not kept, or the perf layer is missing (its JS half is due with `start-shell.ts` at Shell step 7, its native half with `shell-plugins.ts` at step 8). These three edits keep `createShellApp` within the 80-line function limit (the `...{ }` spread keeps the call on four lines).

## S15's model hook

`packages/shell/src/screens/debug/use-debug-model.ts` (template, with a `renderHook` test through the Shell wrapper) is the `useDebugModel()` that toybox-screens' `debug-screen.tsx` renders. It reads only `useDebugServices()`, `useDebugLinks()`, `useServices()` (clock, error log, save), the progress, premium and settings stores, `useGameExtra()` and navigation. It returns `DebugModel` plus `networkAttempts` (the view renders it as `debug.network-attempts`), `importField` (the paste field the Import save row opens: `isOpen`, `text`, `error`, `onChangeText`, `onSubmit`, `onCancel`; the view draws it with `debug.import-save-field`, `debug.import-save-button` and `debug.import-save-error`), `importSave(text)`, `openFontTest()` and `perf`, the Performance section built from `services.perf` over `services.perfLog`:

| `perf` member | The view draws | What it does |
|---|---|---|
| `isRecording`, `onToggleRecording()` | `debug.perf-record-switch` | "Record frame times": `perf.setRecording(!isRecording)`; the board hosts' frame sampler reads the switch, and turning it off appends the frames entry |
| `onShare()` | `debug.perf-share-row` | "Share performance report": the iOS share sheet with the perf log as JSON (nothing is sent); a failed share goes to the error log |
| `onRunBenchmark()` | `debug.perf-benchmark-row` | "Run save benchmark": 300 writes into a scratch `perf-bench.db`, then one `save-benchmark` entry in the perf log |
| `summary` | `debug.perf-summary` | `cold 3 · 1049 ms · save p95 0.41 ms` (`perfSummaryText(perfSummaryOf(entries))` in `debug-perf.ts`: the cold starts, the newest one and the newest save p95) |

The contract types live in `debug-perf.ts` (`DebugPerfDeps`, `DebugPerfActions`); performance-budgets implements the actions behind the test-only entry (`app/perf/debug-perf-actions.ts`) and game-audio-and-haptics the feedback recorders (`services/audio/recording-feedback.ts`), and `fake-debug-perf.ts` is the Jest stand-in. The S15 rows:

| Row | Value or switch | Tool (`debug-actions.ts`) |
|---|---|---|
| Jump to level | the next level | a pack sheet, then a level sheet, then `apply({ level, screen: 'game' })` |
| Unlock all levels | | `apply({ stars })`: every level without a result is won with 1 star |
| Give stars | | `apply({ stars })`: every won level gets 3 stars |
| Set date | today (simulated) | a sheet: real calendar, yesterday, tomorrow, in 7 days, 2026-09-26; `setDate` |
| Show level seed and game state | | a sheet with the seed override and the saved run as JSON |
| Always show test ads / Never show ads | `adsOverride()` | `setAdsOverride` (the two are exclusive) |
| Premium on (no purchase) | the premium store | `setPremium` (save, then `debug-premium-set`) |
| Force language, direction and digits | `en · ltr · 123` (kept left-to-right) | a sheet: four languages (`apply({ lang, screen: 'debug' })`, a direction flip reloads back to S15) and three digit styles |
| Simulate offline | `isOffline()` | `setOffline` |
| Export save as text | | the share sheet with the save JSON (Copy, Files, AirDrop: all on the device) |
| Import save from text | | opens `importField`; its submit calls `links.importSave(text)`: the text Export save wrote, read through the save codec and schema (older formats migrated, another game's save refused), then one validated write that refreshes the backup and re-reads every store. A failure changes nothing, shows one readable sentence and is logged |
| Error log | the entry count | a sheet with the newest 10 entries |
| Font test page | | `navigation.navigate('FontTest')`: the Debug group's font test route (every letter and digit in every font; toybox-screens builds the page) |

The sheets are `ActionSheetIOS` and `Share` (`debug-sheets.ts`): ESLint bans `Alert` in favour of the S14 dialogs, which are for players; the debug menu is English-only and never ships. The import goes through the link handler like every other S15 change, never a save write of its own.

## The perf log for Home

`debugServices.perfLog` is the test build's perf log (performance-budgets' `perf-log.ts`, made in `createDebugParts`). Home's model hook marks the cold start with it:

```ts
useColdStartMark(useOptionalDebugServices()?.perfLog ?? null); // null in store builds
```

The perf layer lands in two halves: its JS half (`app/perf/*.ts`, `markJsEntry()` in `start-shell.ts`, the perf log, the Performance actions and the feedback recorders `createDebugParts` makes) at Shell step 7 with the composition root, its native half (the shell-native `ProcessStart` module) at Shell step 8 with the native plugin list and the rebuild. The evidence run's cold-start step and its feedback evidence read the log back from the simulator's `save.db`.

## game.board-layout

Rendered only in test builds and only with `boardLayout=1`: one small `AppText` the board host renders next to the canvas, whose text is `JSON.stringify({ x, y, layout })`:

- `x`, `y`: the canvas's top-left corner in window points (`measureInWindow` on `game.board`);
- `layout`: the game's `BoardLayout` for the current canvas size: `regions` (each with `id`, `x`, `y`, `cell` in canvas points, unmirrored), `width`, `height` and `isMirrored`.

A cell's centre on screen is `x + region.x + (col + 0.5) * region.cell` and `y + region.y + (row + 0.5) * region.cell`; when `isMirrored` is true, the horizontal centre is `x + layout.width - region.x - (col + 0.5) * region.cell`. The board work renders it: `packages/shell/src/game-host/board-layout-probe.tsx` wraps the canvas when `GameBoardHost` gets `isLayoutProbeOn`, which the Shell's board host factory (`createGameBoardHost({ audio, haptics, errorLog, isLayoutProbeOn: () => debugParts.services?.isBoardLayoutOn() === true })`) passes only while `boardLayout=1` is set; store builds have no debug services, so it is always false there.

`game.moves-label` is the same switch's second probe: the Game screen's moves probe (`screens/game/game-moves-probe.tsx`, shipped with the S5 Game screen) shows the run's move count as one small Text (`1` after the first move), so a flow proves a tap made a move and that it survived a kill.

## debug.network-attempts

The debug screen shows the JS network guard's counter as `debug.network-attempts`. The guard (`templates/packages/shell/src/screens/debug/network-guard.ts`, test-only, synced from the library and identical to privacy-and-network-audit's copy) replaces `fetch`, `XMLHttpRequest#open` and `WebSocket` with throwing stubs. `createDebugParts` installs it as its first action, before `startPremium` and the ad services start, and records each attempt in the error log with source `'network'`; S15's model counts those entries, so an attempt before a reload still counts (the error log keeps them until the app's data is cleared). Every smoke flow ends with `assert-no-network.yaml`, which scrolls down to it (it is drawn under S15's fourteen rows, below the fold on a phone) and asserts the text is `0`. The guard cannot see native SDK traffic; the socket sampler covers that.

## Launch arguments as the alternative

Language and digits can also be set through launch arguments read with `Settings.get` (the i18n work documents them). Flows use the deep link, because it also covers every other parameter and waits for the target screen.
