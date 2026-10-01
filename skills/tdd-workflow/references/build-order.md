# Build order: which layer is tested first

Each layer is tested before anything depends on it. Follow these orders for the Shell with the pilot game, and for every later game. The skill named after each step owns the details of that step; this page owns the order.

## Contents

- The layer order
- The Shell with the pilot game (Line Siege)
- Every game
- Per-layer: what the first failing test usually is

## The layer order

```text
rules (examples + properties)
  -> level generator (goldens + solver properties)
    -> save format and migrations
      -> services with fake ports
        -> hooks
          -> screens (component tests)
            -> end-to-end flows
              -> screenshot matrix
```

Why: a screen test that fails because a rule is wrong wastes the slice; a rule that is proven by properties never needs debugging through the UI.

## The Shell with the pilot game (Line Siege)

The same twelve steps as the Shell build order of `pocket-arcade-index`, which also holds each step's exact "done when" commands, the partial Shell core, the order for adding the pilot's play screens to an existing slice, and each step's manifest: the exact templates it copies (tests included), the packages it installs and the files a tool generates. A template and its test land in the same step; when the test needs a file of a later step (renderWithShell, the theme, `start-shell.ts`), both wait for that step, so every step ends with `tsc`, `check:fast` and `test:coverage` green. The index proves every step import-closed (`check-index.mjs`, rule `step-import-closure`).

1. **Bootstrap** the empty repo with its gates; `shell-slice.json` says `"screens": []` (`monorepo-bootstrap`, `quality-gates`, `dependency-management`, `typescript-and-lint-rules`, `new-game-scaffold`).
2. **game-kit and the contract:** install fast-check first (the kit's property tests import it), then `GameModule` types, `Result`, the seeded random-number generator, dates and the daily seed, geometry, timeline, the witness solver (`game-rules-engine`, `daily-and-statistics`, `level-generation-and-solvers`). The date and seed goldens are unit tests; `npm run test:golden` is due from step 3.
3. **Line Siege rules** with examples and properties, copied from the canonical example, then its bot and simulations, then its levels and data goldens; the level code is copied without its `pack-*.json` files, and the packs are generated (`generate-levels.ts --app line-siege`) only after the sims pass (`game-rules-engine`, `game-balance-and-bots`, `level-generation-and-solvers`, `golden-tests`).
4. **Save format and migrations:** only the save service and what it imports (the save document, SQL on `node:sqlite`, the load plan, the save service, fixtures, the clock and error-log ports); the two boot files wait for step 7, where the boot that calls them lands (`save-persistence-and-migrations`).
5. **Services behind ports with fakes:** clock, error log, connectivity, then audio and haptics, ads and consent, purchase, after their prerequisites (zustand, the stores and the store test helpers, the Testing Library pair); rules that wait for a later step print not-yet-due `SKIP` lines (`architecture-and-boundaries`, `game-audio-and-haptics`, `admob-ads`, `premium-purchase`).
6. **Boot pieces whose tests compile alone:** Intl polyfills and the catalogs, the language and direction functions, the GameSession store, the route params, and the test-only gate holding only its sentinel; nothing that needs the theme, a component, renderWithShell or the boot file. The i18n providers and contexts, `t.tsx`, `use-localized-text-style.ts`, the direction context, `board-direction-view.tsx` and the route guards wait for step 7 with their tests, which render through renderWithShell (`i18n-strings-and-catalogs`, `rtl-and-direction`, `state-stores`, `navigation-and-routing`, `architecture-and-boundaries`).
7. **The composition root and the boot:** theme, the text component, buttons, icons, error boundaries; the composition root with the partial Shell core it imports; together with it the files that import it or that it imports: the boot `start-shell.ts`, the save's two boot files, the startup splash (S1), the JS half of the perf layer, the navigator with every route (screens not built yet on a stand-in); the game host, board canvas, gestures and lifecycle; the files the root imports from settings, daily and statistics, the screens' app helpers, the debug kit and the parity harness, and renderWithShell with the step-6 files whose tests need it (`toybox-design-system`, `toybox-components`, `react-components-and-hooks`, `game-host-integration`, `board-rendering-skia`, `board-gestures-and-input`, `accessibility`, `settings-and-preferences`, `daily-and-statistics`, `unit-and-component-tests`, `toybox-screens`, `e2e-maestro`, `toybox-visual-parity`, `admob-ads`, and the rest of the step's skills in the index).
8. **Before the first simulator build:** the final plugin list (the swap of the phase-0 `with-shell.ts` and its test, committed with `Spec-Change: with-shell final composer (phase 0 placeholder replaced)`), the native half of the performance cold-start layer (it needs this native rebuild), the app icon and splash, the audit tooling, then the first Release simulator build (`architecture-and-boundaries`, `performance-budgets`, `code-drawn-art-and-icons`, `privacy-and-network-audit`, `ios-simulator-build`).
9. **Screens S1 to S15** with their model hooks and component tests, in spec order, each matched to its Toybox design screenshot in light and dark, English and Persian, against the reference variant the game's facts pick (`toybox-screens`, `toybox-visual-parity`).
10. **End-to-end flows, the debug deep link, the network guard, the screenshot matrix**, with cold start and memory measured (`e2e-maestro`, `ios-simulator-build`, `privacy-and-network-audit`).
11. **Audits and the release pipeline:** the StoreKit harness on its own throwaway simulator, then that simulator deleted and a clean prebuild, then the network, privacy and licence audits, the performance budgets, the store-artifact gate and a test build to TestFlight (`premium-purchase`, `privacy-and-network-audit`, `performance-budgets`, `ios-release-testflight`).
12. **The pilot passes the new-game completeness check**, so game 2 starts from `npm run new-game`, not from memory (`new-game-scaffold`).

Spec section 15 (definition of done for the Shell and pilot, items 15.1-15.8) is the exit test: every item there needs its evidence in the release report.

## Every game

1. **Classify the game** (turn-based, simulate-then-replay or real-time), its input mode and input policy.
2. **State, moves and events** in `apps/<game-id>/src/rules/<game-id>-types.ts`; then `create`, `listMoves`, `applyMove`, `outcome`, `intentToMove`, test-first with properties.
3. **Bot and simulations:** winnability, difficulty curve, termination.
4. **Level generator, solver and par, pack layout, daily difficulty**, with data goldens.
5. **Persistence:** parse state and moves, the JSON round trip, the save policy (and save points for real-time games).
6. **Board:** view, timeline, palette tokens, paths, layout, draw, draw-call budget, pixel goldens at three sizes; real-time games also the simulation.
7. **Teaching, statistics and texts:** tutorial script, 3-5 how-to-play pages, 2-4 counters, all four catalogs with game-id-prefixed keys.
8. **Art and sounds:** the icon drawing, the art render, the sound bank and its recipe tests, the credits.
9. **Assemble** `src/index.ts` as the game's module; the contract tests pass.
10. **The game's own end-to-end flows** (including one real board tap) and the screenshot baselines.
11. **Release:** once the owner's store steps are done (the App Store Connect record, the real AdMob ids), the StoreKit harness, a clean prebuild, a test build, then the store build. The owner's play-test, review of the fa and ckb texts and listening to the sound previews are listed in the report as owner steps and never waited for.

## Per-layer: what the first failing test usually is

| Layer | First test |
|---|---|
| Rules | an example for the simplest legal move and its event list, then the determinism property |
| Level generator | a data golden for one seed, then "every generated level is solvable" as a property |
| Save and migrations | a migration test from the frozen previous-version fixture |
| Services | the port's behaviour against its fake, one test per spec rule (every limit at exactly its value) |
| Hooks | the hook's returned value for one store state |
| Screens | the screen shows its main element by role and name, then one interaction |
| End-to-end | a smoke flow that reaches the screen by testID and ends with the no-network check |
| Screenshot matrix | the screen captured still (fixed seed, date, status bar) in en and fa, light and dark |
