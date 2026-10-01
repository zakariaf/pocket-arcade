---
name: navigation-and-routing
description: Builds and checks the one React Navigation 7 static native stack for S2-S15, FirstRun/Main/Debug groups, typed params, direction, reduce-motion fade, Back opening Pause, popTo. Use when adding a route, navigating between screens or wiring the navigator. Not for screen layout (use toybox-screens).
---

# Navigation and routing

The Shell has exactly one navigator, a React Navigation 7 static native stack, whose routes, groups, params, direction and Back behaviour follow the product's screen map; a script proves it.

## Rules that must hold

1. **One navigator: the static native stack in `packages/shell/src/navigation/root-stack.tsx`.** No Expo Router, tabs, drawers, JS stack, nested or second navigator. About 15 screens at most two levels deep fit one stack, and the Shell must own navigation.
2. **Only S2, S5, S8–S13 (with S11a–d and the S13 tutorial level) and S15 (with its test-only font test page) are routes.** S1 is the native splash, S3 is Google's consent form, S6 Pause and S7 Result are overlays inside Game, S14 dialogs render above the navigator. An overlay must keep the board mounted and paused; a route change would unmount it.
3. **Groups switch by their `if` hooks, never by `navigate`:** `FirstRun` (`useIsFirstRun`), `Main` (`useIsMainApp`, Home first), `Debug` (`useIsTestBuild`: `Debug` and `FontTest`, each rendering its page through `TEST_ONLY`). Conditional groups are how the static API expresses flows, and the debug pages' code must stay out of store bundles.
4. **Type every route through the static config.** Params come from `StaticScreenProps<…>`; `react-navigation.d.ts` registers `StaticParamList<typeof rootStack>`; params are small serialisable data. A wrong route name or param then fails `tsc`.
5. **Back never leaves a live run.** `Game` and `Tutorial` set `gestureEnabled: false`; `GameScreen` uses `usePreventRemove` while playing or paused: Back while playing opens Pause, Back in Pause resumes, and only the Pause Home button leaves (ref + `popTo('Home')`). A stray swipe must never lose a run.
6. **Go back with `popTo` or `goBack`, never `navigate`.** In React Navigation 7 `navigate` pushes; `navigate('Home')` stacks a second Home.
7. **The container gets `direction={readLayoutDirection()}`**, the layout's own `I18nManager` source, never the language setting. The two disagree during the one launch before a direction reload.
8. **With Reduce motion on, pushes cross-fade.** The stack is wrapped with `.with()` so its options read `useReduceMotion()`; the setting follows the phone by default.
9. **Navigation lives in screens and their model hooks, never in `ui/` components**, and never in a store. Navigation state is rebuilt at launch; a run in progress is reopened from the save.
10. **A partial Shell keeps the whole route table.** With `shell-slice.json` at the repo root, routes whose screen is outside the slice point at `NotBuiltScreen`; model hooks still navigate normally (never a no-op handler), and a slice never ships. `Tutorial` is the exception: it always points at `TutorialScreen` (part of every Shell app), while `Debug` and `FontTest` follow S15's membership. Every later screen then lands in a navigator that already type-checks its routes.

## Workflow

1. Read [references/routes-and-flows.md](references/routes-and-flows.md): the route table, what is not a route, the groups, the flows and which call each screen makes.
2. Setting up the navigator: copy the templates to their app paths (the table in [references/navigator-code.md](references/navigator-code.md) lists each one, with the Shell step each lands at). Only `route-params.ts` lands at **Shell step 6** (plain types, no test). Everything else lands at **Shell step 7** with the composition root, each file with its test, because the tests render through `renderWithShell` (the Toybox theme of step 7): `route-guards.ts` with `route-guards.test.tsx` (copied at step 6 the test breaks `tsc`, and held back it leaves the coverage gate red; `check-navigation` rule `route-guards-files` prints `SKIP packages/shell/src/navigation/route-guards.ts [route-guards-files] due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created` until `start-shell.ts` exists), `root-stack.tsx`, `react-navigation.d.ts`, `navigation-root.tsx`, `navigation-theme.ts`, `debug-route.tsx`, `font-test-route.tsx`, `screens/game/game-screen.tsx` (the assembled S5 route; it needs toybox-screens' S5 set: `use-game-screen-model.ts`, `game-layout.tsx`, `game-moves-probe.tsx` and their helpers), and their test files. Building only some screens (a `shell-slice.json` exists or is about to): also copy `not-built-screen.tsx` and its test, and follow "Partial Shell" in [references/navigator-code.md](references/navigator-code.md): keep every route, point the unbuilt ones at `NotBuiltScreen` (never `Tutorial`), skip `debug-route.tsx`, `font-test-route.tsx` and `game-screen.tsx` while S15 and S5 are outside the slice.
3. Wiring a screen's buttons: take the call from the "Where each screen navigates to" table; put it in the screen's `use-<screen>-model.ts` hook as a `handleX` function and pass it down as `onX`. Use `popTo` to reach a screen that may already be in the stack. Home's daily card has two controls (the lead's decision L7): its body opens S9 (`navigate('Daily')`, also when today is done), its Play key starts today's run in Game; `check-navigation` rule `home-daily-edge` fails a Home without either edge.
4. Changing the route table (rare, a product decision): update the table in the reference first, then `root-stack.tsx`, then the `GROUPS` list in `scripts/check-navigation.mjs`; say so in the report to the owner.
5. Before editing `game-screen.tsx`, read "Back on the Game screen" in [references/navigator-code.md](references/navigator-code.md); keep `game-screen-back.test.tsx` green.
6. Run the tests: `npx jest packages/shell/src/navigation packages/shell/src/screens/game --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/navigation/**/*.ts' --coverageThreshold='{}'` (paths first: `--selectProjects` takes every following word as a project name and would run the whole suite; only `npm run test:coverage` judges the thresholds), then `tsc` and ESLint as the quality gates require.
7. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-navigation.mjs .` from the repo root. Fix every `FAIL` line (each names the file, the rule and the fix) and rerun until it prints `RESULT: PASS`. `SKIP` lines name the rules a `shell-slice.json` puts out of reach; they are not problems. When the last Shell screen is built, delete `shell-slice.json` and `not-built-screen.tsx` (and its test) and run it with `--complete`.

## Definition of done

- [ ] `root-stack.tsx` holds exactly the route table: FirstRun (LanguageChoice with its own `if`, Tutorial), Main (Home first, then Game, Levels, Daily, Stats, Settings, SettingsLanguage, About, PrivacyPolicy, Licences, Premium, HowToPlay), Debug (Debug, FontTest); in a partial Shell, exactly the routes outside `shell-slice.json` point at `NotBuiltScreen`, and Tutorial never does.
- [ ] `navigate` calls type-check through `react-navigation.d.ts`; no screen passes a function or object from a store as a param.
- [ ] Home reaches S9: the daily card body navigates to `Daily` and its Play key to today's daily run (`home-daily-edge`).
- [ ] `game-screen-back.test.tsx` passes: Back opens Pause, Back in Pause resumes, Home leaves, a finished run leaves normally.
- [ ] `route-guards.test.tsx` passes: first launch → language choice → tutorial → Home.
- [ ] `navigation-root.test.tsx` passes: the container passes the layout direction and the navigation theme, resumes a killed run, and pushes fade with Reduce motion on.
- [ ] Before a release: `node ${CLAUDE_SKILL_DIR}/scripts/check-navigation.mjs . --complete` prints `RESULT: PASS` (no slice file, no `NotBuiltScreen`).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-navigation.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **A modal route for Pause, Result or a dialog.** It unmounts or covers the board wrongly; render overlays inside Game and dialogs in the dialog host.
- **`navigate('Home')` from Pause or Result.** It pushes a second Home; use `popTo('Home')` and let the prevent-remove callback see the leaving ref.
- **Switching first-run screens with `navigate` or `reset`.** Dispatch `set-language` / `finish-tutorial` and let the groups' hooks decide.
- **Reading `I18nManager` or the language setting in navigation code.** Use `readLayoutDirection()` only.
- **Putting `useNavigation` in a `ui/` component.** Pass `onPress` from the screen.
- **Relying on `usePreventRemove` to protect progress.** It cannot see app kills; the save after every move does that.
- **A `linking` config "for later".** The store app has no deep links, and every URL handler is extra attack surface.
- **Trimming the route table (or writing no-op handlers) for screens that are not built yet.** Other screens' `navigate()` calls stop type-checking and the missing routes are forgotten; declare the slice in `shell-slice.json` and point those routes at `NotBuiltScreen`.
- **A Tutorial stand-in, or a back-only Game screen.** The first launch plays the tutorial in every Shell app, and a Game route without its screen model has no top bar, no paid hints and no Result keys; copy `TutorialScreen` and the assembled `game-screen.tsx`.
- **Importing a debug page into the route table directly.** `DebugRoute` and `FontTestRoute` render `TEST_ONLY.DebugScreen` / `TEST_ONLY.FontTestScreen`, so store bundles never carry them (`debug-gated`).

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/routes-and-flows.md](references/routes-and-flows.md) | Screen map, route table, groups, flows, per-screen navigation calls, direction, Back rule | Workflow step 1, and before any navigation change |
| [references/navigator-code.md](references/navigator-code.md) | Template-by-template guide, typed routes, container, testing recipes, verified versions, pitfalls | Workflow steps 2 and 5 |
| [templates/root-stack.tsx](templates/root-stack.tsx) | The one static native stack with its groups | Workflow step 2 |
| [templates/route-guards.ts](templates/route-guards.ts) | The groups' `if` hooks | Workflow step 2 |
| [templates/route-params.ts](templates/route-params.ts) | `GameParams` | Workflow step 2 |
| [templates/react-navigation.d.ts](templates/react-navigation.d.ts) | Global route typing | Workflow step 2 |
| [templates/navigation-root.tsx](templates/navigation-root.tsx) | Container: direction, theme, initial state, reduce-motion fade | Workflow step 2 |
| [templates/navigation-root.test.tsx](templates/navigation-root.test.tsx) | Its test: probe stack, layout direction, theme, resume state, fade | Workflow steps 2 and 6 |
| [templates/not-built-screen.tsx](templates/not-built-screen.tsx) | Partial Shell stand-in for routes outside `shell-slice.json` (FirstRun ones finish the step) | Workflow step 2, only while a slice exists |
| [templates/not-built-screen.test.tsx](templates/not-built-screen.test.tsx) | Its test: first launch reaches Home, Back leaves a stand-in | Workflow step 2, with the stand-in |
| [templates/navigation-theme.ts](templates/navigation-theme.ts) | Shell theme → React Navigation theme | Workflow step 2 |
| [templates/navigation-theme.test.ts](templates/navigation-theme.test.ts) | Its unit test | Workflow step 2 |
| [templates/debug-route.tsx](templates/debug-route.tsx) | S15 behind `TEST_ONLY` | Workflow step 2 |
| [templates/font-test-route.tsx](templates/font-test-route.tsx) | S15's font test page behind `TEST_ONLY` (`FontTest` route) | Workflow step 2 |
| [templates/font-test-route.test.tsx](templates/font-test-route.test.tsx) | Its test: the page renders through `TEST_ONLY` in a test build | Workflow steps 2 and 6 |
| [templates/game-screen.tsx](templates/game-screen.tsx) | S5, the assembled Game route (shared copy, synced from the library; the same bytes as toybox-screens'): session, Back opens Pause, overlays, screen model | Workflow steps 2 and 5 |
| [templates/game-screen-back.test.tsx](templates/game-screen-back.test.tsx) | Back behaviour in a real static stack (shared copy; stubs the session, the model and the layout) | Workflow steps 2 and 6 |
| [templates/route-guards.test.tsx](templates/route-guards.test.tsx) | First-run flow test | Workflow steps 2 and 6 |
| `scripts/check-navigation.mjs` | Checker for every rule above | Workflow step 7, and at the end |
| `scripts/lib/object-literal.mjs` | Helper that reads the stack's config object | Never by hand |
| `scripts/selftest.mjs` | Proves the checker passes the good fixture and catches each planted bug | After changing the checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in (`check-lib.mjs`, `game-screen.tsx`, `game-screen-back.test.tsx`) | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad Shell source trees for the self-test: the full Shell (top level), a partial Shell (`slice/`) and a game-first repo (`game-first/`) | When adding a rule to the checker |

## Related skills

- `toybox-screens` - the layout, testIDs and states of each screen the routes show.
- `game-host-integration` - the session controls, board, top bar and Result overlay inside Game.
- `rtl-and-direction` - `readLayoutDirection`, the direction switch and the restart.
- `react-components-and-hooks` - `useReduceMotion` and how screens and model hooks are written.
- `state-stores` - the settings store the route guards read.
- `e2e-maestro` - flows that press the real back gesture on the simulator.
