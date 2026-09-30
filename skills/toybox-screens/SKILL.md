---
name: toybox-screens
description: "Builds Pocket Arcade screens S1-S15 to their Toybox specs: layout, spacing, the exact screen-map testIDs, copy keys, every state, banner slots, reference images. Use when building or changing a screen, overlay or dialog. Not for components (toybox-components) or pixel compare (toybox-visual-parity)."
---

# Toybox screens

Every Shell screen (S1–S15, with S11a–d, the Pause and Result overlays and the S14 dialogs) is built from its spec here: the same blocks in the same order with the same spacing, exactly the testIDs of the shared screen map, the copy-deck keys the design shows, and every state, so it matches its Toybox design screenshot; a script proves the code side.

## Rules that must hold

1. **Use exactly the testIDs of `assets/screen-testids.json`: none missing, none invented, none borrowed from another screen.** E2E flows and the visual-parity harness find elements only by these ids; a new id is a map change the library owns, never a local choice.
2. **Build each screen as its reference says: blocks in that order, that spacing, those components, and match its reference image.** The owner's rule is that every built screen matches its Toybox design screenshot; the reference and the image are that screenshot in words and pixels.
3. **Every text comes from `t()` with the copy-deck key the reference lists** (numbers and dates through the model, game texts from the game module). Keys name the place; a wrong key shows the wrong words in four languages.
4. **Build every state and variant, including the Chosen ones the design does not draw** (Premium owner, daily done, daily and endless results, all S12 states, the empty Statistics page, the extra dialogs). A state without a layout is a blank screen in front of a player.
5. **One hero key per screen; the banner only at the bottom of Home, Levels and Statistics and never for Premium owners.** Spec N8 and 8.8: no ads on Game, Pause, Result, dialogs or Premium, and one obvious "go".
6. **Views are pure: a typed model in, Toybox components out.** The route component calls `use<Name>Model()`; the view calls `useT()`, sets the testIDs and draws; stores, navigation and services stay in the model hook. That keeps screens testable and the layout in one place.
7. **Only Toybox components and tokens: no raw `Pressable` or `Text`, no colour literals, no raw sizes.** The look lives in the components and the theme; a screen that paints itself drifts from the design.
8. **Code lives in the screen's folder** (table in [references/screen-frame-and-rules.md](references/screen-frame-and-rules.md)); the checker looks there and nowhere else.
9. **Every screen has a view test** that renders it through `renderWithShell`, finds its testIDs (decorative parts with `{ includeHiddenElements: true }`), and ends **every** test that renders (each state and variant) with `expect(findInaccessiblePressables(screen.container)).toStrictEqual([])`. Each state is its own screen for VoiceOver; the checker fails a view-test block without the audit.
10. **Overlays over the board keep VoiceOver inside them.** Result sets `accessibilityViewIsModal` on its full-screen View; Pause and the dialogs get it from `DialogCard`. Otherwise VoiceOver wanders onto the paused or finished board.

## Workflow

1. Open the screen's reference (Files table below) and its image in `assets/reference/`. Read [references/screen-frame-and-rules.md](references/screen-frame-and-rules.md) once per session: the common frame, the testID contract, texts, the model/view pattern, RTL, dark and large text.
2. Print the exact contract: `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S4` (every testID with component, role, copy key and English text, which parts a component draws, variants, the code folder and the image).
3. Copy the screen's templates from `templates/packages/shell/src/…` to the same paths in the app repo (the reference lists them). They call the Toybox components exactly as toybox-components ships them (checked with `tsc`, ESLint and Jest against those components). Read [references/component-contract.md](references/component-contract.md) before changing a component call: base props (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) must be spelled as the map says, because the component builds every child testID from them.
4. Copy the screen's model hook with its test: every route file is `const model = use<Screen>Model(); return <<Screen>View model={model} />`, and the hook is the only code that reads stores, services, the game host and navigation. The templates ship them all: `use-language-choice-model` (S2), `use-home-model` with `use-home-actions` and `use-level-play` (S4), `use-pause-model` (S6; `PauseOverlay` takes the Game screen's controls as `session`), `use-levels-model` with the pure `levels-model-of` (S8), `use-daily-model` (S9), `use-stats-model` with `stats-snapshot-of` (S10), `use-settings-extras` from `use-settings-routes` and `use-settings-links` (S11, next to settings-and-preferences' `useSettingsModel(useSettingsContext())`), `use-settings-language-model`, `use-about-model`, `use-privacy-policy-model`, `use-licences-model` (S11a-d), `use-premium-model` (S12, with `premium-model-of.ts`, `premium-toasts.ts` and `app/premium-screen-deps-context.tsx`, which ShellApp provides), `use-how-to-play-model` (S13), and S5's assembled Game screen: `game-screen.tsx` with `use-game-screen-model` (top bar from `topBarPropsOf`, S7 from `resultModelOf`), `use-perk-payment` (`perkOffer`; the free hint allowance is `useGameExtra().hints.freePerDay`), `use-result-actions` (`showInterstitialIfDue` after Next, Replay, Try again), `use-result-extras`, `use-run-text` and `game-moves-probe`, each with its test; S15's `use-debug-model` comes from e2e-maestro, S5's session controls and S7's `resultModelOf` from game-host-integration. They read: the game's look and words from `useGameHost()` (`logo`, `nameId`, `taglineId` through `gameMessageText`, `counters`, `packs`, `hasMusic`, `credits`, `howToPlayPages`), the build's config from `app/use-game-extra.ts` (level count, modes, links), connectivity from `app/use-is-online.ts`, the banner from admob-ads' `useBannerSlot('<screen>')` (`app/use-ad-context.ts`), the version from `app/read-version-text.ts`, a direction flip through `app/use-direction-restart.ts`, and `isReducedMotion` from `useReduceMotion()` (also true during a parity capture, so every loop holds still for the screenshot). A frame that shows a state is opened by the hook that owns it, once on mount, through the handler a player's tap uses (`app/use-parity-opener.ts`; the table in references/screen-frame-and-rules.md). Hook tests render through `testing/create-host-wrapper.tsx` (the Shell providers plus a real game host). Model hooks navigate normally; in a partial Shell a route outside `shell-slice.json` shows `NotBuiltScreen` (navigation-and-routing), never a no-op handler.
5. Test first: adapt the template's view test and hook test to the change, watch them fail, then change the code. The unit project's `jest.setup.ts` mocks Skia centrally (unit-and-component-tests), so a view that draws `LogoTile`, `EmptyStatsPicture` or `HazardStrip` needs no mock of its own. Run `npx jest packages/shell/src/screens/<folder> --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/screens/<folder>/**/*.ts' --coverageThreshold='{}'` (paths first: `--selectProjects` swallows every word after it; only `npm run test:coverage` judges the thresholds), `tsc` and ESLint as the quality gates require.
6. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-screens.mjs . --screen S4` from the repo root. Fix every `FAIL` line (each names the file, the rule and the fix) and rerun until it prints `RESULT: PASS`. A partial Shell (`shell-slice.json`) prints `SKIP` lines for the screens it leaves out and checks its own screens strictly (they must be built). At the end of Shell work run `node ${CLAUDE_SKILL_DIR}/scripts/check-screens.mjs . --all`.
7. Compare the running screen with its reference image (light, then dark and RTL), then hand the screen to toybox-visual-parity for the measured comparison. Report to the owner which screens pass and anything still open.

## Definition of done

- [ ] The screen's blocks, order, spacing, components and states match its reference; every Chosen state has its layout.
- [ ] Every text comes from `t()` with the reference's keys; numbers and dates use the chosen digits and the Shell formatters.
- [ ] The view test finds every testID of the screen, covers each variant, fires each handler, and every block that renders ends with the `findInaccessiblePressables` audit; `tsc`, ESLint (canonical config, `--max-warnings 0`) and Jest pass.
- [ ] The screen was compared with `assets/reference/<frame>.png` in light, dark and right to left, and handed to toybox-visual-parity.
- [ ] Open questions (a missing copy key, a testID the design needs but the map lacks) are reported to the owner, not solved by inventing.
- [ ] The route file calls its model hook, and the hook (copied from the templates) has its test.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-screens.mjs . --screen <id>` (and `node ${CLAUDE_SKILL_DIR}/scripts/check-screens.mjs . --all` when the Shell or the slice is complete) prints `RESULT: PASS`

## Anti-patterns

- **Inventing or renaming a testID to fit the code.** Change the code to the map; ask for a map change when the design truly needs one.
- **Putting a testID on a child of the accessible element, adding `accessibilityElementsHidden` in a screen, or un-hiding a decorative part to make it measurable.** Maestro lists only accessible elements and never their children or hidden parts. The shared map says which elements are bounds-checked and which are crop-only (`parent`, `a11yHidden`, `coveredBy`; `list-screen.mjs` prints it as the parity column); keep the ids exactly where the map puts them. View tests find hidden parts with `{ includeHiddenElements: true }`.
- **Index-based keys** (`levels.level-tile.0`). Use the data key: level number, language code, stat id, kebab component name. Only WeekStrip and WeekBars number their seven columns (1 = oldest, 7 = today), themselves.
- **Re-drawing a Toybox component in the screen folder** (a local calendar tile, week strip, score panel, level tile, top bar). Use the one in `ui/`; the look and the derived testIDs live there once.
- **Store reads or `navigate` inside a view.** They belong in the model hook; the view stays pure and testable.
- **A no-op handler for a screen that is not built yet, or a provider only a screen needs (a "sounds context" for Music).** Navigate normally (`NotBuiltScreen` stands in) and read game facts from `useGameHost()`: a provider the composition root never mounts throws at runtime while every test passes.
- **A literal string, a raw `Text`, a colour literal or a raw font size in a screen.** Use `t()`, `AppText` roles, the theme and tokens.
- **Greying out something the spec says to hide** (Music without game music, the Premium key for owners, the banner offline). Leave it out.
- **Centring a menu screen, tilting body text, or shadows on panels.** Start-align; only stickers, flags, art and logos tilt; only pressable things are raised.
- **Declaring a screen done from tests alone.** Open the reference image and compare; the owner judges screens by the design.
- **An overlay inside the Game screen's safe-area frame, a centred Chip or Sticker by `alignItems`, a body that ends at the safe area.** Each looked right in Jest and was wrong on the device (Result 59 pt low, left-aligned chips, clipped key shadows); follow the templates.
- **A parity-only branch in a view, or a `isParityCapture` flag in one model.** Freeze motion through `useReduceMotion()` and open a frame's state through the owning hook's handler, once.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/screen-frame-and-rules.md](references/screen-frame-and-rules.md) | Where each screen lives, the common frame, layout numbers, screen rules, testID contract, texts, model/view pattern, RTL, dark, large text, reference images | Workflow step 1, once per session |
| [references/component-contract.md](references/component-contract.md) | Every Toybox component and prop the templates call, the parts each draws, measurements | Workflow step 3 |
| [references/s01-splash.md](references/s01-splash.md) | S1 Splash spec | Building S1 |
| [references/s02-language-choice.md](references/s02-language-choice.md) | S2 First-run language choice spec | Building S2 |
| [references/s03-consent.md](references/s03-consent.md) | S3 Consent moment spec | Building S3 |
| [references/s04-home.md](references/s04-home.md) | S4 Home spec | Building S4 |
| [references/s05-game.md](references/s05-game.md) | S5 Game screen (Shell parts) spec | Building S5 |
| [references/s06-pause.md](references/s06-pause.md) | S6 Pause spec | Building S6 |
| [references/s07-result.md](references/s07-result.md) | S7 Result spec (win, lose, daily, endless) | Building S7 |
| [references/s08-levels.md](references/s08-levels.md) | S8 Levels spec | Building S8 |
| [references/s09-daily.md](references/s09-daily.md) | S9 Daily challenge spec | Building S9 |
| [references/s10-statistics.md](references/s10-statistics.md) | S10 Statistics spec (and empty) | Building S10 |
| [references/s11-settings.md](references/s11-settings.md) | S11 Settings spec | Building S11 |
| [references/s11a-language.md](references/s11a-language.md) | S11a Language spec | Building S11a |
| [references/s11b-about.md](references/s11b-about.md) | S11b About and credits spec | Building S11b |
| [references/s11c-privacy-policy.md](references/s11c-privacy-policy.md) | S11c Privacy policy spec | Building S11c |
| [references/s11d-licences.md](references/s11d-licences.md) | S11d Licences spec | Building S11d |
| [references/s12-premium.md](references/s12-premium.md) | S12 Premium spec (every purchase state) | Building S12 |
| [references/s13-how-to-play.md](references/s13-how-to-play.md) | S13 How to play spec | Building S13 |
| [references/s14-dialogs.md](references/s14-dialogs.md) | S14 dialogs spec (and the crash screen) | Building a dialog |
| [references/s15-debug.md](references/s15-debug.md) | S15 Debug menu spec | Building S15 |
| `templates/packages/shell/src/ui/` | `ScreenBody` (the common body: `isUnderHomeIndicator`, `hasTopOverhang`, `scrollToY`, with its test) and `usePairLayout` (side-by-side blocks that stack at 200 % text) | Workflow step 3, first screen |
| `templates/packages/shell/src/testing/` | `create-host-wrapper.tsx` (hook tests: Shell providers plus a real game host and a text for every message id of the tally game) and `test-game-extra.ts` (the pilot's `expo.extra` and version for the `expo-constants` mock, and `testExpoConstantsWith` for a game whose config differs), each with a test | Workflow step 5 |
| `templates/packages/shell/src/i18n/` | `create-language-t.ts` (S2's "Continue" in the language being chosen) and its test | Building S2 |
| `templates/packages/shell/src/app/` | The model hooks' helpers, each with a test: `use-game-extra.ts` (the build's game config, `levelCountOf`), `use-is-online.ts` (ConnectivityPort as a value), `read-version-text.ts` ("1.0.0 (8)" from expo-constants), `use-direction-restart.ts` (audio dispose, then the direction reload), `use-parity-opener.ts` (a parity frame's state opened once through a player's handler); and S1 `StartupSplash`, `createStartupSplash` (the restart root startShell registers while the direction flips; its test) and `GameStartupSplash` (S1 from the module's `nameId`/`taglineId`), the Toybox `CrashScreen` (and their tests), `premium-screen-deps-context.tsx` (the S12 provider ShellApp fills) and `dialog-context.tsx` (`DialogProvider` around the navigator, `useOpenDialog()` for models) | Building S1, the crash screen, S12 or S14 |
| `templates/packages/shell/src/screens/first-run/` | S2 view, route component, `use-language-choice-model.ts`, tests | Building S2 |
| `templates/packages/shell/src/screens/consent/` | S3 screen and test | Building S3 |
| `templates/packages/shell/src/screens/home/` | S4 model type, `use-home-model.ts`, `use-home-actions.ts`, `use-level-play.ts` (Play/Continue, shared with S10), view, top bar (brand lock + gear), daily card, keys, route, tests | Building S4 |
| `templates/packages/shell/src/screens/game/` | S5, assembled: `game-screen.tsx` and `game-screen-back.test.tsx` (shared copies, synced from the library), `use-game-screen-model.ts`, `use-run-text.ts`, `use-perk-payment.ts`, `use-result-actions.ts`, `use-result-extras.ts`, `game-moves-probe.tsx`, and `GameLayout` (the overlay beside the safe-area frame), each with its test | Building S5 |
| `templates/packages/shell/src/game-host/` | S5 `GameTopBar`: the game host's top-bar props drawn with the Toybox `GameTopBar` (`testIDBase="game"`), and its test | Building S5 |
| `templates/packages/shell/src/screens/pause/` | S6 model and `PauseSession` types, `use-pause-model.ts`, view, toggle keys, overlay, tests | Building S6 |
| `templates/packages/shell/src/screens/result/` | S7 model (`WinResult.par` is null on score-rated levels, which print the score line with `score` and `bestScore`), overlay, win/lose/daily/endless views (centred rows for Chip and Sticker, the body under the home indicator), win actions, continue offer, test | Building S7 |
| `templates/packages/shell/src/screens/levels/` | S8 model type, `levels-model-of.ts` (pure pack and tile rules), `use-levels-model.ts`, `tile-width.ts` (six columns on the pixel grid), view (banner as the body's last item, toast at 352 pt), pack section (Toybox `LevelTile` grid), locked pack (the Locked sticker on its own line), route, tests | Building S8 |
| `templates/packages/shell/src/screens/daily/` | S9 model, `use-daily-model.ts` (the summary, the next-day countdown, the date texts, the daily Game route; with its test), view, today card, streak card, week card (Toybox `WeekStrip` + `WeekLegend`), route, test | Building S9 |
| `templates/packages/shell/src/screens/stats/` | S10 model type, `stats-snapshot-of.ts` (summary to snapshot), `use-stats-model.ts`, cells, view, panels, stat panel, local note, empty state, route, tests | Building S10 |
| `templates/packages/shell/src/screens/settings/` | S11 view, row, row specs, bindings, choice and volume rows, footer, extras type, `use-settings-extras.ts` (with `use-settings-routes.ts` and `use-settings-links.ts`), route, tests; S11a–d in their subfolders, each with its `use-<screen>-model.ts` and test | Building S11 or S11a–d |
| `templates/packages/shell/src/screens/premium/` | S12 model type, `use-premium-model.ts` (store, service, notices), `premium-model-of.ts` (pure builder), `premium-toasts.ts`, page, offer, states, success, hero, restore, toast, route, tests | Building S12 |
| `templates/packages/shell/src/screens/how-to-play/` | S13 view, `use-how-to-play-model.ts`, route, tests | Building S13 |
| `templates/packages/shell/src/screens/dialogs/` | S14 dialog frame, six dialogs, `DialogRequest`, `DialogHost` (at most one dialog above the navigator), tests | Building a dialog |
| `templates/packages/shell/src/screens/debug/` | S15 rows, view with the Import save panel (`debug-import-save.tsx`), route, test; the font test page (`font-test-samples.ts`, `use-font-test-model.ts`, `font-test-view.tsx`, each tested, and `font-test-screen.tsx`) | Building S15 |
| `assets/reference/` | Every design frame at 1x (light, English, Line Siege), plus Home in dark and in Persian | Workflow steps 1 and 7 |
| `assets/screen-testids.json` | The shared screen testID map, synced from the library (do not edit here) | Read by the scripts; `list-screen.mjs` prints it |
| `assets/copy-deck.json` | The copy deck, synced from the library (do not edit here) | Read by the scripts |
| `assets/toybox-tokens.json` | The Toybox tokens (layout, sizes, components), synced from the library | When a spacing or size is in doubt |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `scripts/check-screens.mjs` | Checker: testIDs exact (including the ones components derive from the id props the screen passes), copy keys used and known (and the Shell texts the deck lacks present in all four catalogs; retired keys fail), banner placement, one hero key, a view test per screen whose every rendering block audits accessibility, modal overlays, each route's model hook with its test, the assembled Game screen (`game-screen-wiring`), `shell-slice.json` SKIPs | Workflow step 6, and at the end |
| `scripts/list-screen.mjs` | Prints one screen's contract (with the parity reach of each id: bounds, or crop-only in its cover); `--all` validates the map, deck and images | Workflow step 2 |
| `scripts/lib/screen-map.mjs` | Helper: the map, the screen folders, which parts each component derives from which prop | Never by hand |
| `scripts/lib/source-scan.mjs` | Helper: strings, patterns, t() keys and component id props in TypeScript sources | Never by hand |
| `scripts/selftest.mjs` | Proves both scripts pass good input, catch each planted bug, and pass the templates and assets | After changing a script or template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `tests/fixtures/` | Good and planted-bad apps, maps and decks for the self-test; `check-screens-slice/` holds the shell-slice.json cases | When adding a rule to a checker |

## Related skills

- `toybox-components` - the components the screens are made of.
- `toybox-design-system` - tokens, `AppText`, `RaisedSurface`, colours, fonts, motion.
- `toybox-visual-parity` - the screenshot comparison each finished screen goes through.
- `navigation-and-routing` - routes, Back, and every screen's navigation calls.
- `react-components-and-hooks` - `ScreenFrame`, model hooks, effects, reduce motion.
- `settings-and-preferences` - the S11 model, rows and effects.
- `state-stores`, `daily-and-statistics`, `premium-purchase`, `admob-ads`, `game-host-integration` - the data behind the models.
- `i18n-strings-and-catalogs`, `rtl-and-direction`, `accessibility` - texts, mirroring and VoiceOver.
