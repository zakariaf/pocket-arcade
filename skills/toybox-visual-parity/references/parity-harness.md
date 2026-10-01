# The app side: parity harness and testIDs

What the app must provide so a capture shows exactly the state a design frame draws, and so every element can be measured. The harness ships as templates (copy them, do not rewrite them); it is test-build code, and store builds never contain it.

## Contents

- The contract: one launch argument
- The harness templates
- What a parity launch does, in order
- One frozen-motion switch
- The fixture: the design's player as a save document
- Three traps: Premium that will not turn off, debug flags that carry over, a scroll that stops short
- Rules that hold for every frame
- Frame states and who opens them
- The Game frames: the design's numbers and the board probe
- The S3 consent moment
- The launch nonce: proof of a dump's source
- Game facts: which reference a frame with variants uses
- testIDs the screens must carry
- Wiring it in (and keeping it out of store builds)

## The contract: one launch argument

`capture-app.mjs` launches the Release test build with:

```
-AppleLanguages "(<lang>)" -AppleLocale <locale> -parity "frame=<key>&theme=<light|dark>&lang=<en|de|fa|ckb>&game=<id>&date=2026-09-27&animations=off[&scrollY=<pt>][&probe=board]&nonce=<hex>"
```

`nonce` is a fresh hex word per launch (6 to 32 lower-case letters and digits): the parity root renders the marker `parity.launch.<nonce>`, and `capture-app.mjs` refuses a hierarchy dump without it (see "The launch nonce").

`probe=board` appears only in the extra launch `capture-app.mjs` makes once before a Game-route frame (s6-pause, s7-result-win, s7-result-lose; see "The Game frames" below). It opens no frame state and turns the board-layout probe on.

- iOS puts `-parity` into NSUserDefaults; `readParityRequest()` reads it with React Native's `Settings.get('parity')`, parses it with `parseParityRequest()` and checks the date against the fixture's day. A valid request carries its frame's plan (`request.plan`), so startup code never imports `parity-plans.ts` (that would be a `harness-leak`).
- No `-parity` means a normal start: the harness does nothing.
- An unknown parameter, an unknown frame key, a malformed date, a date other than the fixture's 2026-09-27 or a second `theme=` is an error, never ignored. The Shell then shows only the error view (root testID `parity.error`, the error as its label). A silent fallback to Home would be compared with the wrong reference.

## The harness templates

Copy `templates/packages/shell/src/app/parity/` and `templates/packages/shell/src/app/parity-startup.tsx` (each with its test) to the same paths. Every file compiles, lints and passes its tests against the Shell templates of the other skills; do not rewrite them.

| File | What it does |
|---|---|
| `parity/parity-plans.ts` | One plan per design frame: root testID, start route, `progress` (demo, new-player, first-run), `premium`, `consent` (given, or required for S3), `state`, `tall` |
| `parity/parity-request.ts` | Parses the `-parity` query (`probe=board` into `request.probe`); an invalid one says exactly what is wrong |
| `parity/read-parity-request.ts` | Reads `-parity` through `Settings`, checks the date against the fixture |
| `parity/parity-fixture-save.json` | The design's player in save-document terms, plus `gameFrame` (the numbers the Game frames draw): a copy of `fixtureSave` in `assets/frames.json` (check-harness compares them) |
| `parity/parity-fixture.ts` | Validates that JSON with the save's own valibot sections at load (a wrong volume scale or an unknown field fails in Jest, not on the simulator) |
| `parity/parity-doc.ts` | `parityDoc({ base, game, request, fixture? })`: the `SaveDoc` of a frame (player per `progress`, Premium per `premium`, ad consent per `consent`, Language per render language) |
| `parity/parity-session.ts` | The request of this launch for model hooks and hosts: `parityBuildNumber()`, `parityFrameState()`, `isParityMotionFrozen()`, `isParityBoardProbeOn()`, `parityGameFixture()` (type `ParityGameFixture`) |
| `parity/parity-ads.tsx` | `createParityAds()`: the whole `AdsPort` with no SDK, a 320 x 50 stand-in banner that reports itself loaded, `rewardedStatus()` always `'ready'` (its `subscribeRewardedStatus` never fires), so S7's lose frame draws the ready offer, never its loading state; `parityForcedPlacements(plan)` |
| `parity/parity-purchase.ts` | `createParityPurchase({ productId, plan })`: the fixture's price and currency (never a typed price), an owned transaction on Premium frames, the store behaviour of each S12 state card |
| `parity/parity-start.ts` | `parityInitialState(plan)`: the navigator state (the start route on top of Home, Settings pages above Settings); `isHeldParityStart(plan)` for S1 and S3 |
| `parity/parity-error-view.tsx` | `createParityErrorRoot(message)`: the `parity.error` root |
| `parity/parity-root.tsx` | `ParityFrameRoot`: wraps the Shell's root in `ParityLaunchContext` (the launch nonce), `ForcedAdPlacementsContext` (from `app/use-ad-context.ts`) and `ScreenScrollTargetContext` (from `ui/screen-body.tsx`), and draws a `ParityLaunchMarker` |
| `parity-launch-marker.tsx` | Outside `parity/`, reached in every build: `ParityLaunchContext` and `ParityLaunchMarker`, the invisible 1 x 1 pt accessible element `parity.launch.<nonce>`; it draws nothing unless the parity root provides a nonce, so store builds never show it |
| `parity-startup.tsx` | The Shell's side, reached in every build: `readParityLaunch`, `parityLaunchFor` (the `ShellLaunch` start-shell passes to `createShellApp`, typed `ParityShellLaunch`), `isHeldParitySplash`, `isHeldParityConsent`, and the six members the launch bundles (`applyParityData`, `parityStorePort`, `parityAdsPort`, `initialStateFor`, `withParityRoot`, `isConsentMomentHeld`); each does nothing when `TEST_ONLY` is null or there is no request |

Two files outside the Shell come with them: `templates/parity/game-facts.json` (to `parity/game-facts.json` at the repo root, next to `waivers.json` and `signoff.json`) and `templates/apps/__GAME_ID__/src/parity-game-facts.test.ts` (one per game app; see "Game facts").

The tests prove each piece on its own and together: `parity-doc.test.ts` applies every plan to one strict save service (an invalid document throws) and runs a Premium frame followed by normal frames on the same save; `parity-startup.test.tsx` runs the startup functions with and without a request.

## What a parity launch does, in order

1. **`start-shell.ts`**: `const parity = readParityLaunch();` before anything else. `error`: register `parity.root` (the error view) and stop. `frame`: the session starts, the language is `parity.request.lang` (the launch language; the Shell's usual direction check reloads once for fa and ckb, which `capture-app.mjs` waits out), the S1 frame keeps the splash up (`isHeldParitySplash`), registered wrapped in the parity root (`withParityRoot(parity.request, splash)`, so its hierarchy carries the launch marker), and every other frame passes `launch: parityLaunchFor({ request, game })` to `createShellApp`. Steps 2 to 5 are that launch's members, which the composition root calls; it never imports the harness.
2. **Composition root, right after `hydrateSave`**: `applyParityData({ parity, game, save, simulatedClock })` writes `parityDoc(...)` through `save.update`, sets the simulated clock's today to the request date, and clears the saved debug flags (`TEST_ONLY.createSqliteKvDebugStoreAdapter().set('debug.overrides', null)`). This happens before the game host, the stores and the debug services exist, so they hydrate from the frame's player and the debug services start with no flag (see the traps below).
3. **Ports**: `store: parityStorePort(parity, productId) ?? <the real store port>`, `ads: parityAdsPort(parity) ?? createAdsPort(...)`. No ad SDK call and no StoreKit request happens in a parity launch.
4. **First route**: `initialStateFor(parity, resumeState(save.doc()))` for the navigator's initial state (the normal resume state when there is no request).
5. **Root**: `return withParityRoot(parity, ShellRoot)`. The contexts do two jobs the screens already support: the banner slots on Home, Levels and Statistics and the Result placement are forced open (online, consent handled, tutorial done; still hidden for Premium) although the test build runs with `ADS_MODE=off`, so S7's lose frame shows the Continue-with-ad offer (`perkOffer` reads the `'result'` placement), and a tall frame's `ScreenBody` scrolls to `request.scrollY`.
6. **Held startup states**: `TEST_ONLY?.isHeldParityStart(plan)` is true for S1 (splash) and S3 (consent moment). start-shell holds the splash for the S1 frame (the splash's restart never runs), wrapped with `withParityRoot`. The S3 consent moment is held by the consent moment host, not by the startup: the launch hands it `isConsentMomentHeld` (see "The S3 consent moment").
7. **Model hooks and hosts**: the version text uses `TEST_ONLY?.parityBuildNumber() ?? <the build's own number>` (S11 and S11b show "1.0.0 (8)"); a screen whose frame opens in a state reads `TEST_ONLY?.parityFrameState()` once on mount (table below); `useReduceMotion()` honours `TEST_ONLY?.isParityMotionFrozen()`; the Game frames take their numbers from `TEST_ONLY?.parityGameFixture()`; the board host's `isLayoutProbeOn` closure honours `TEST_ONLY?.isParityBoardProbeOn()`.

## One frozen-motion switch

The design draws every animation at rest, and a capture must hold still (`capture-app.mjs` waits for two identical screenshots 300 ms apart). A parity launch always asks for `animations=off`, so `isParityMotionFrozen()` is true for every capture, and the Shell's one `app/use-reduce-motion.ts` returns true while it is (`TEST_ONLY?.isParityMotionFrozen() === true`). Every consumer that already honours Reduce motion therefore holds still at rest:

- the current level tile's flag bob (S8, `use-levels-model` keeps `isReducedMotion: useReduceMotion()`, and its parity test expects `isReducedMotion` true in a parity session);
- the busy blocks of S1 and of the S12 purchasing card;
- sticker slaps, star pops and confetti (S7, S9), which end in their final pose;
- screen transitions (the navigator's reduce-motion fade).

The saved setting is not touched: `save.doc().settings.reduceMotion` stays as the fixture has it, and the S11 Reduce motion row still reads off, because the row reads the saved preference and not the hook. A loop or entrance that does not read `useReduceMotion()` never settles and fails `unstable`: route it through the hook (never add a parity-only branch to a component).

## The fixture: the design's player as a save document

`assets/frames.json` holds the player twice: `fixture` as the design draws it (level 12, 1,840 points, streak 5, "2 h 14 min") and `fixtureSave` as `SaveDocV1` sections, so no session has to guess the mapping. The app's `parity-fixture-save.json` is a copy (`check-harness.mjs` rule `harness-fixture`).

| On screen (fixture) | In the save (fixtureSave) |
|---|---|
| "Continue – Level 12", 11 levels won, 28 stars, 7 three-star levels | `progress.levels["1".."11"]` (stars 3,3,2,3,1,3,3,2,3,2,3; level 9 best 2,310), `run.ref { kind: level, level: 12 }` with `resumeOnLaunch: false` (the game builds the run itself) |
| best endless 4,210 | `progress.endlessBest` and `stats.bestScore.endless` |
| streak 5 (best 12), week strip missed, 5 done, today | `daily.results` for 22 to 26 Sep, `daily.streak { lastDate: "2026-09-26", length: 5 }`, `bestStreak 12`, `completed 19` |
| 58 games, 36 wins (62 %), 2 h 14 min, the 7-day chart | `stats.gamesPlayed/wins/losses/playMs`, `stats.days` for 21 to 27 Sep |
| the game's own three stats | `counters.<design game id>` by CounterSpec id (Line Siege: monsters-defeated 1,284, beams-fired 3,907, biggest-combo 6) |
| Sound 70 %, Music on at 40 %, Vibration on | `settings.soundVolume 70`, `musicEnabled true`, `musicVolume 40` (integer percent, as the save stores them) |
| Ad privacy row, banner allowed | `ads.consent { canRequestAds: true, isPrivacyOptionsRequired: true }` |
| €1.99 (`1,99 €`, `€۱٫۹۹`) | `store { price: 1.99, currency: "EUR" }`, formatted by the Shell like a StoreKit price |
| Version 1.0.0 (8) | `buildNumber "8"` |

`progress: new-player` writes empty progress, daily and statistics (S10 empty); `first-run` also leaves `firstRun` false (S2, S3). The Language setting is System in en renders and the render language otherwise.

## Three traps: Premium that will not turn off, debug flags that carry over, a scroll that stops short

- **Premium carries over.** `run-parity.mjs --screen S4` captures `s4-home-premium` right before other frames. The save service keeps Premium unless a revocation carries a date (`keepPremiumUnlessRevoked`, a correct product rule), so a harness that writes `premium.owned = false` leaves every later frame Premium: `missing home.premium-button`, `missing home.banner-ad`, the remove-ads row gone on S11. It shows only on a whole-screen run. `parityDoc` turns Premium off the way a refund does (`revokedAtMs` from the fixture) and the template test runs Premium, then normal frames, on one save service.
- **Debug flags carry over.** A test build saves its debug flags (offline, the ads override, a seed, a consent geography) in its own key-value store and the debug services restore them when they are made, so they survive a kill and a reinstall over the old app. Without a reset, every capture after the S15 frame would run with "Always show test ads" on (the frame's opener saved it), and a debug link that switched offline on the parity simulator would show every S12 card offline. Worse, it hides bugs: in round 5 the S15 opener's switch was drawn off on the first capture after an install (the React Compiler had cached the model's switches, so the opener's re-render showed the old value) and on every later capture on, only because the flag had been saved. `applyParityData` therefore clears `debug.overrides` before the debug services read it (the composition root calls `prepareSave` before `createDebugParts`), and `check-harness.mjs` fails a startup that does not (rule `harness-debug-flags`). An opener whose state lives outside React, like S15's switches in the debug services, has to re-render through a model the React Compiler does not cache (`'use no memo'` in that hook, or a subscription): the Jest tests run without the compiler and cannot show it, the first capture after an install does.
- **The scroll stops short.** Scrolling from `onContentSizeChange` alone leaves S11 at 1104.7 when 1170 was asked: the scroll view's first layout happens before the safe-area insets arrive, its frame is 96 pt too tall and iOS clamps the offset; when the insets arrive the content size does not change, so nothing scrolls again. `ScreenBody` scrolls from both `onContentSizeChange` and `onLayout` (toybox-screens template); the harness only passes `scrollY` through `ScreenScrollTargetContext` and never scrolls anything itself.

## Rules that hold for every frame

- The Language setting is **System** in en renders and the render language in every other language (that is what S11 and S11a draw).
- The Theme setting stays **System**; the simulator appearance, which `capture-app.mjs` sets to `theme`, decides the colours.
- Digits follow the language (Persian digits in fa and ckb), as the design draws them.
- The status bar is the OS's; do not hide it and do not draw one.
- No timer may change the screen after it settled: blinking carets, rotating tips, countdowns and polling all stop in parity mode. `capture-app.mjs` fails with `changed-during-capture` otherwise.
- Keyboard focus rings appear only where the frame draws one (S8 draws one on tile 13).
- The harness never draws something the real screen would not: it sets data, clock, store, ads, route and state, and the real screens draw.

## Frame states and who opens them

`parityFrameState()` returns the plan's `state` (null in the probe=board launch); the model hook of the screen that owns the state applies it once on mount, through the same handlers a player's tap would use, reading the frame state (`TEST_ONLY?.parityFrameState()`, or the Shell's `useParityOpener('<state>', open)` helper from `app/use-parity-opener.ts`) and naming the state's literal in that hook file or a `use-*.ts` helper next to it, when the hook is split: `check-harness.mjs` (rule `harness-opener`) finds every opener that way, and skips a state whose screen is outside `shell-slice.json`. The Premium states are half done by the store port already (`createParityPurchase` answers like the store in that state).

| State | Frame | Opened by | What it does |
|---|---|---|---|
| `pause-open` | `s6-pause` | `packages/shell/src/game-host/use-game-session-controls.ts` (game-host-integration) | `host.debugControls().applyFixtureHud(fixture)`, then `pause()`, where `fixture = parityGameFixture({ isScoreRated: host.isScoreRated })`: Pause over the resumed level-12 run with the design's top bar; Sound on, Music off, Vibration on |
| `result-win`, `result-lose` | `s7-result-*` | `use-game-session-controls.ts` | `host.debugControls().showFixtureResult(fixture, 'won' | 'lost')`: the Result for level 12 from the fixture, through `resultModelOf`, writing no save (win: 3 stars, New best, the win line of the game's facts; lose: the game's first lose reason with the Continue-with-ad offer, which the parity ads port makes available) |
| `levels-locked-tile-tapped` | `s8-levels` | `packages/shell/src/screens/levels/use-levels-model.ts` (toybox-screens) | taps tile 13 once: focus ring and the toast "Unlock this one by finishing level 12." |
| `how-to-play-step-2` | `s13-how-to-play` | `packages/shell/src/screens/how-to-play/use-how-to-play-model.ts` | Next once: step 2 of 4 |
| `premium-loading-price`, `premium-store-unavailable` | S12 cards | the store port alone | the price never arrives; the store is unavailable |
| `premium-purchasing`, `premium-pending-approval`, `premium-success`, `premium-error` | S12 cards | `packages/shell/src/screens/premium/use-premium-model.ts` | presses Buy once; the port keeps the sheet up, or answers pending, purchased or failed |
| `premium-already-owned` | S12 card | the store port alone (plan `premium: true`) | owned |
| `premium-restore-toasts` | S12 card | `use-premium-model.ts` | shows the four restore outcomes stacked, as drawn |
| `reset-progress-dialog-held` | `s14-reset-all-progress` | `packages/shell/src/screens/settings/use-settings-model.ts` | opens the reset dialog with `useHoldToConfirm` frozenProgress 0.46 (the hold drawn 46 % full) |
| `restart-dialog` | `s14-restart-to-apply` | `packages/shell/src/screens/settings/language/use-settings-language-model.ts` | opens the restart dialog |
| `save-restored-dialog` | `s14-progress-restored` | `packages/shell/src/screens/home/use-home-model.ts` | opens the progress-restored dialog |
| `debug-ads-always-test` | `s15-debug-menu` | `packages/shell/src/screens/debug/use-debug-model.ts` (e2e-maestro) | `parityFrameState() === 'debug-ads-always-test'`, read from `app/parity/parity-session.ts` (S15 is reached through the test-only entry, so never `useParityOpener`, which reads the gate and would close an import loop), turns the "Always show test ads" switch on through that switch's own handler (debug ads override `'always-test'`), once on mount |

Every opener has a test with a parity session (start one with `startParitySession`, end it with `endParitySession`). Shipped in the other skills' templates: all of the openers above (game-host-integration's session controls; toybox-screens' Levels, How to play, Premium, Settings, Settings language and Home model hooks; e2e-maestro's debug menu model), the version text of S11 and S11b (`parityBuildNumber()`, `app/read-version-text.ts`), the frozen-motion switch (`app/use-reduce-motion.ts`), the board probe (`isLayoutProbeOn` in `create-shell-parts.ts`) and the consent moment host (S3). A frame whose state no hook opens fails at once (`screen-not-reached`: its root testID is the dialog or card) and `check-harness.mjs` names the missing opener before any capture. Each plan's `state` must be the one in this table (rule `harness-frame-state`): a plan without it can never match its reference, however complete the openers are.

**S15 keeps design parity like every other screen (L12).** The debug menu ships only in test builds, but it is a design frame: it is captured and signed off in light and dark x en and fa at its planned scroll offsets. Its labels stay English in every language (debug texts are test-only), while its numbers and dates follow the language's digits as the design draws them (`۱۲`, `۰`, `fa · rtl · ۱۲۳`): the model formats them with the language's formatters, never `String(n)`. The rest of its frame state comes from the fixture save and the debug services' defaults, and each value was checked on a capture: jump to level 12 (the fixture's next level), set date Sunday 27 Sep (the request date on the simulated clock), "Never show ads" off, "Premium on (no purchase)" off (no Premium in the fixture), force locale `<lang> · <dir> · 123` in the language's digits, "Simulate offline" off, error log 0. Only "Always show test ads" needs an opener; a value that ever differs gets an opener or a fixture value the same way. Every capture starts from no saved debug flag ("Three traps" above), so the opener has to show the switch on in that very launch: a capture that passes only after an earlier launch saved the flag proves nothing.

## The Game frames: the design's numbers and the board probe

S5, S6 and S7 show the design's numbers, not a played state. `parityGameFixture({ isScoreRated })` (null off the Game route) returns them from the fixture's `gameFrame` block for the design game of the launch, in the shape of the host's `GameFixture` (`game-host/game-fixture.ts`); `isScoreRated` is the host's `GameHost.isScoreRated`, which makes `par` null:

| Field | Line Siege | Where it shows |
|---|---|---|
| `level`, `score`, `stars`, `isNewBest`, `bestScore` | 12, 1840, 3, true, 1840 | top bar and Pause mode label (S5, S6); win card (S7) |
| `progress.mid` | `{ defeated: 3, total: 10 }` ("Monsters 3 / 10") | the top bar's progress line (S5, S6) |
| `progress.full` | `{ defeated: 10, total: 10 }` | the win card's progress line (S7) |
| `movesCount`, `par` | 7, and 7 for a moves-rated game or null for a score-rated one (Line Siege) | the win line: "7 moves – par 7", or the score line with `score` and `bestScore` |
| `loseReasonKey` | `line-siege.lose.broke-through` (Flock Tilt `flock-tilt.lose.wolf-got-sheep`, Scrap Shove `scrap-shove.lose.caught`) | the lose card (S7) |
| `isContinueOffered` | true | the Continue-with-ad offer (S7 lose) |
| `outcome` | `won` (s7-result-win), `lost` (s7-result-lose), null (s6-pause) | which Result |

The session controls pass it to `host.debugControls().applyFixtureHud(fixture)` (the top bar shows the fixture's level, score and progress) and `showFixtureResult(fixture, outcome)` (a RunSummary built from the fixture, shown through `resultModelOf`, never saved). A score-rated game's win card shows `result.win.score-line` with `score` and `bestScore` ("Score 1,840 – best 1,840"), a moves-rated one `result.win.moves` ("7 moves – par 7"); the facts pick the matching reference.

Each game brings its own board, so the design has none to compare (it draws a dashed placeholder). Before a Game-route frame's capture, `capture-app.mjs` launches the frame once more with `probe=board`: `isParityBoardProbeOn()` is true, `parityFrameState()` is null (no Pause, no Result), and the host's `isLayoutProbeOn` closure is true while the probe is on, so the board host renders `game.board-layout` (the canvas origin and `BoardLayout` in window points, a small text kept inside the board frame). The script reads that rectangle from the hierarchy (once per device, theme and language in a run) and records it in `run.json` as `board`. `check-parity.mjs` then fills the union of that rectangle and the reference's `game.board` rectangle with one grey in both images before any pixel gate, except where the frame's `board.above` elements paint (the Pause dialog, placed in the app by pixel alignment); elements wholly inside the mask are skipped with a `masked` note, and everything else, the top bar and the overlays included, is gated as usual. A Result covers the whole screen (`above: result.screen`), so nothing of S7 is masked.

The probe launch opens a fresh run of the frame's level (`parityStartState` in `parity-startup.tsx`, level from `parityGameFixture()`): a resumed run opens on Pause, and the Pause dialog is modal for VoiceOver, so the probe text behind it would not be in the hierarchy.

**The Pause layer is modal.** While Pause is up, VoiceOver can reach only the modal root, the Scrim (`accessibilityViewIsModal` sits on the Scrim, so its own testID stays listed), so Maestro lists only `pause.scrim`, `pause.dialog` and their parts: the paused Game screen (`game.screen`) and its top bar are not in the hierarchy. `assets/frames.json` gives `s6-pause` a `modal` block: the frame is reached when `pause.dialog` is on screen (`reachedBy`), the root sits at its known full-screen position, and the `hidden` elements (the top bar and its keys, the score and progress lines, the board) are compared as crop-only parts of the root, inside its crop (never `missing`; a difference names the smallest part it sits in, for example "inside its crop-only part game.pause-button"). Never make the dialog non-modal to get the top bar listed.

## The S3 consent moment

The plan of `s3-consent-moment` has `consent: 'required'` and the demo player, so the frame's save has ad consent still to be asked (`ads.consent.canRequestAds` false), the tutorial done and no Premium; the simulator is online. `isHeldParityStart(plan)` is true for it. The startup does not hold the navigator: `parityLaunchFor` hands the composition root `isConsentMomentHeld` (true only for this frame, `isHeldParityConsent(request)`), which it passes to the consent moment host. The host shows `ConsentIntroScreen` (root `consent.screen`) and keeps it up while `isConsentMomentHeld()` is true. The held frame asks nobody: it never requests Google's form (UMP) and never asks Apple's tracking prompt (App Tracking Transparency, which the real consent moment asks only after the form closes, when the status is not determined and ads may be requested). The intro is the screen right before Google's form, and only then: when only Apple's prompt is due (Google's consent not required or given before), the real app shows the system prompt on its own with the app's usage text and no intro, so the frame's save keeps Google's consent required. `capture-app.mjs` checks every dump for a system alert (the tracking prompt, any permission prompt, an "Open in ...?" alert): one on screen fails the capture (`system-alert`), and `run.json` records `systemAlert: null` when none was up, which is the S3 proof. `s3-google-s-form` stays mock-only: Google draws that sheet, so it is looked at, never captured.

## The launch nonce: proof of a dump's source

In round 3 a `maestro hierarchy` call was answered by another session's simulator (its Persian Settings screen), even with a separate driver port, so a capture could have judged the wrong screen. Three things now prevent that:

1. Every Maestro call names the simulator and this run's own driver port before the command: `maestro --device <udid> --driver-host-port <port> hierarchy` (the scripts' `maestroArgs()`; the repo's E2E tooling builds the same with `maestroGlobalArgs()` in `packages/tooling/src/e2e/maestro-args.ts`). The port is `--driver-port` when a session passes one, else a free port picked for the run.
2. Every launch passes `nonce=<hex>`; the parity root provides it through `ParityLaunchContext` and draws `<ParityLaunchMarker />`, whose testID is `parity.launch.<nonce>`.
3. `capture-app.mjs` looks for that testID in every dump (the board probe's and the capture's). A dump without it is read again after 2 s (XCUITest sometimes answers once with only the status bar, before the app's tree is attached); three dumps in a row without it stop the capture with exit 2, "hierarchy from another simulator", and the last is kept as `rejected.hier.json`. `run.json` records the UDID, the driver port and both nonces.

A modal layer (`accessibilityViewIsModal`) hides everything outside it from the accessibility tree, the parity root's marker included. So each modal root draws its own `<ParityLaunchMarker />` as its first child: the Scrim (`ui/scrim.tsx`: the Pause dialog and the S14 dialogs), the Result overlay (`screens/result/result-overlay.tsx`) and the consent cover (`app/consent-moment.tsx`). The held S1 splash is not under the Shell root at all: start-shell registers it on its own for frame `s1-splash`, so start-shell must register it wrapped, `registerRootComponent(withParityRoot(parity.request, createStartupSplash({ game, language, restart: holdSplash })))`. `check-harness.mjs` (rule `harness-launch-marker`) checks the parity root, each modal root that exists and that wrap (when the slice has S1).

## Game facts: which reference a frame with variants uses

Four frames depend on what the game has, and have design-derived reference variants next to their base (`assets/frames.json`, `variants`); the variants a game's facts match compose, in `frames.json` order:

| Frame | Variant | When | What differs from the base |
|---|---|---|---|
| `s11-settings` | `s11-settings--no-music` | `hasMusic: false` | no Music switch row and no Music volume row; the rows below close up |
| `s6-pause` | `s6-pause--no-music` | `hasMusic: false` | no Music key; Sound and Vibration share the row in two columns (the app's `usePairLayout`) |
| `s6-pause` | `s6-pause--no-hints` | `hasHints: false` | the top bar under the scrim has no hint key; the row ends with the undo key |
| `s6-pause` | `s6-pause--no-music--no-hints` | both | both changes (Line Siege) |
| `s7-result-win` | `s7-result-win--score` | `winLine: "score"` | the moves line becomes the score line `result.win.score-line` |
| `s14-reset-all-progress` | `s14-reset-all-progress--no-music` | `hasMusic: false` | Settings under the dialog has no Music rows (a background variant) |

The facts live in `parity/game-facts.json` at the repo root: `{ "version": 1, "games": { "<app id>": { "designGame": "lineSiege", "hasMusic": false, "winLine": "score", "hasHints": false } } }`. `hasMusic` is true when the game's sound bank has a sound in category music (the rule of `GameHost.hasMusic`); `winLine` is `"moves"` when levels are rated by moves against par and `"score"` when the stars rule is score-based (so `resultModelOf` passes par null); `hasHints` is true exactly when the rules' hint policy is a solver (`rules.hints.kind === 'solver'`, the rule behind `isHintSupported` and `GameHost.hasHints`; the S5 top bar has a hint key only then). Line Siege: `hasMusic: false`, `winLine: "score"`, `hasHints: false`. `templates/apps/__GAME_ID__/src/parity-game-facts.test.ts` pins the facts to the module through the Shell's helpers `hasMusicOf(game)`, `isScoreRatedOf(game)` and `hasHintsOf(game)` (`packages/shell/src/game-host/game-facts.ts`, game-host-integration); its `PARITY_GAME_FACTS` constant must equal the JSON entry, which `check-harness.mjs` compares (rule `harness-game-facts`, which also catches a plain contradiction such as a music sound with `hasMusic: false`, or a solver hint policy with `hasHints: false`). A fact left out of the file is exit 2 in every script: a reference is never guessed. `capture-app.mjs`, `run-parity.mjs`, `check-parity.mjs` and `check-signoff.mjs` read the file, print the reference they use, and stop with exit 2 when it is missing, malformed, names another design game, or cannot pick the app (`--app <id>` when it lists several). `parity/game-facts.json` and `parity/waivers.json` are gated paths: a commit that changes either carries a `Gate-Change:` trailer.

## testIDs the screens must carry

- The contract is the shared map `assets/screen-testids.json`: every element of every frame, its testID, role, component, text key and checks. `node ${CLAUDE_SKILL_DIR}/scripts/check-testids.mjs --list S4` prints one screen's list; build the screen with exactly those testIDs.
- Names follow `<scope>.<element>[.<part>]` in kebab case; repeated items append a stable key (`levels.level-tile.12`), never a list index.
- Put the testID on the **accessible element** (the Pressable, the switch, the image), never only on its inner Text: Maestro does not list the children of accessible elements, so an inner testID is reported `missing`. Where the design measures a row (S11's `settings.autosave-note`: check icon plus text), the testID goes on the row View, which hugs its content.
- **Reach policy (one rule for VoiceOver and parity).** Bounds are checked only for elements Maestro lists: the frame root, containers, texts and accessible elements. Parts inside an accessible element (`parent`) and decorative parts the components hide from VoiceOver (`a11yHidden: true`: logo, icon and art tiles, the calendar tile and its parts, pager dots, Premium art, the hazard strip, the empty-stats picture, decorative stars) are crop-only: `checks` is `["crop"]` and `coveredBy` names the nearest reachable ancestor whose aligned crop is compared. The gates never pair them with the hierarchy and never call them `missing`; their pixels, text ink included, are judged inside the cover's crop. Bounds are layout frames: a transform (a pushed-in key sunk by `translateY`, a scale) is invisible to them, so anything that stays moved must move by layout.
- The root testID of each frame (`home.screen`, `premium.state.error`, `reset-progress-dialog.scrim` ...) goes on the outer View of that screen, state or dialog; `capture-app.mjs` and `check-parity.mjs` use it to prove the right frame is on screen.
- The accessibility label is how the text gate reads a text: a Text's label is its text; an icon button's label is its copy-deck key's string. Do not add labels that differ from the visible text of a text element.

## Wiring it in (and keeping it out of store builds)

1. Copy the templates (table above) to the same paths, `templates/parity/` to `parity/` (waivers with the pre-listed entries, an empty sign-off ledger, the game facts with each app's facts), and the facts test into every game app. The Scrim, the Result overlay and the consent cover render `<ParityLaunchMarker />` (from `app/parity-launch-marker.tsx`) as the first child of their modal View; their templates in toybox-components, toybox-screens and admob-ads do.
2. `packages/shell/src/app/test-only-entry.ts` and `test-only-api.ts` are one shared pair (this skill's `templates/packages/shell/src/app/` copies; ios-simulator-build ships the same bytes). They already export the harness members, each tagged `/** @public */`, with the `TestOnlyApi` members of the same names; a repo whose copy dropped them while the harness did not exist yet gets them back by copying the pair again. Test-only code is reached only through `TEST_ONLY`; the literal variant check in `test-only.ts` is what strips it from store bundles. A direct import anywhere but a test is a `harness-leak`.
3. start-shell (rtl-and-direction's template) already calls `readParityLaunch()` and passes `parityLaunchFor({ request, game })` to `createShellApp({ ..., launch })`; the composition root (game-host-integration) runs the launch's members at the steps above: `prepareSave` (`applyParityData`), `purchasePort` and `adsPort` (`parityStorePort`, `parityAdsPort`), `initialState` (`initialStateFor`), `wrapRoot` (`withParityRoot`) and `isConsentMomentHeld` (to the consent moment host). For frame `s1-splash` start-shell registers the held splash instead of the Shell, and it must register it wrapped with `withParityRoot(parity.request, ...)` so the capture carries the launch marker (see "The launch nonce"). A repo whose start-shell predates the harness adds those three calls; nothing else changes.
4. Add `.parity/` to `.gitignore` (captures, reports and sheets, about 3 MB per run). `parity/waivers.json`, `parity/signoff.json` and `parity/game-facts.json` are committed (templates in `templates/parity/`); the waivers and the facts are gated paths.
5. `node ${CLAUDE_SKILL_DIR}/scripts/check-harness.mjs .` must print `RESULT: PASS`: every template file, one plan per frame, the fixture copy unchanged, no typed price, every member exported (the session's too), every startup step called, the frozen-motion switch and the board probe wired, the launch marker in the parity root and every modal root, the saved debug flags cleared at a parity launch, an opener for every frame state, the game facts (all three) present and pinned, and the component specs drawing the edge widths the references draw. In a partial Shell, a rule for a screen outside `shell-slice.json` prints a SKIP line instead.
