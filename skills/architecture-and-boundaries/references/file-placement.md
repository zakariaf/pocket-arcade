# File placement and the three recipes

Where every kind of file goes, and the step-by-step recipes for adding a Shell screen, a service or port, and a game. Read this before creating any file whose home is not obvious, and before starting one of the three recipes. A new kind of file gets a row here in the same change (the owner decides new rows).

## Contents

- The placement table
- Recipe: add a Shell screen
- Recipe: add a service or port
- Recipe: add a game

## The placement table

| Kind of file | Location | Example |
|---|---|---|
| Game contract type | `packages/game-kit/src/contract/` | `game-module.ts` |
| Pure shared algorithm (RNG, geometry, timeline, dates, level helpers) | `packages/game-kit/src/<area>/` (`contract`, `rng`, `geom`, `timeline`, `dates`, `levels`, `testing`, `solver`) | `dates/date-key.ts`, `levels/star-rating.ts` |
| Shell screen | `packages/shell/src/screens/<screen>/<screen>-screen.tsx` | `screens/home/home-screen.tsx` |
| Screen model hook | next to the screen: `use-<screen>-model.ts` | `screens/home/use-home-model.ts` |
| Overlay inside a screen (S6, S7) | `packages/shell/src/screens/<overlay>/` | `screens/pause/pause-overlay.tsx` |
| Presentational component | `packages/shell/src/ui/` | `ui/button.tsx` |
| Navigation | `packages/shell/src/navigation/` | `root-stack.tsx` |
| Store, reducer, selectors | `packages/shell/src/stores/<domain>-{store,reducer,selectors}.ts`; a domain with more files gets `stores/<domain>/` | `stores/settings-store.ts`, `stores/premium/premium-store.ts` |
| Pure domain model used by a store | `packages/shell/src/stores/<domain>-model.ts` | `stores/daily-model.ts` |
| OS mirror store (accessibility switches) | `packages/shell/src/app/` | `app/system-a11y-store.ts` |
| Port type | `packages/shell/src/services/<port>/<port>-port.ts` | `services/clock/clock-port.ts` |
| Adapter | `packages/shell/src/services/<port>/<vendor>-<port>-adapter.ts` | `admob-ads-adapter.ts` |
| Fake | `packages/shell/src/services/<port>/fake-<port>.ts` | `fake-clock.ts` |
| Service (logic over ports) | `packages/shell/src/services/<port>/<name>.ts` | `services/ads/ad-policy.ts` |
| Save schema, codec, migrations, fixtures | `packages/shell/src/services/save/{schema,migrations,fixtures}/` | `schema/save-doc-v1.ts` |
| Game host (session, board host, gestures, loop) | `packages/shell/src/game-host/` | `game-session-reducer.ts` |
| Composition root, providers, boot | `packages/shell/src/app/` | `create-shell-app.tsx` |
| Error-boundary recovery screen (not a route) | `packages/shell/src/app/crash-screen.tsx` | `CrashScreen` |
| Partial-Shell stand-in for routes outside `shell-slice.json` (navigation-and-routing) | `packages/shell/src/navigation/not-built-screen.tsx` | `NotBuiltScreen` |
| The composition root (game-host-integration) | `packages/shell/src/app/` | `create-shell-app.tsx`, `create-shell-parts.ts`, `device-adapters.ts`, `shell-app.tsx`, `shell-features.tsx`, `shell-navigator.tsx` |
| The Tutorial route (FirstRun, S13) | `packages/shell/src/screens/first-run/` | `tutorial-screen.tsx`, `use-tutorial-model.ts` |
| Test-only code (debug menu, harness hooks) | exported by `packages/shell/src/app/test-only-entry.ts`, reached only through `TEST_ONLY` | `app/test-only.ts` |
| Config composer (Node world) | `packages/shell/src/config/` | `with-shell.ts` |
| Local Expo config plugin | `packages/shell/plugins/with-<capability>.ts` | `with-storekit-test.ts` |
| Native code (Expo module) | `packages/shell/ios/`, `packages/shell/expo-module.config.json` | `ProcessStartModule.swift` |
| Fonts | `apps/<id>/assets/fonts/` | `Vazirmatn-Regular.ttf` |
| Shell catalogs | `packages/shell/src/i18n/catalogs/<lang>.json` | `catalogs/fa.json` |
| Game rules (pure) | `apps/<id>/src/rules/` | `apply-move.ts` |
| Level table and generator inputs | `apps/<id>/src/levels/` | `pack-1.json` |
| Board (Skia, worklets) | `apps/<id>/src/board/` | `draw-board.ts` |
| Real-time simulation | `apps/<id>/src/sim/` | `halo-sim.ts` |
| Art, sounds | `apps/<id>/src/art/`, `apps/<id>/src/sounds/` | `logo-art.ts` (`LOGO_ART`), `game-art.ts` (`GAME_ART` = palettes, logo, credits), `sound-bank.ts` |
| Game UI palette (the game's Toybox paint for Shell screens) | `apps/<id>/src/theme/palette.ts` | `palette.ts` (board colours stay in `board/`) |
| Game credits for the licences screen | `apps/<id>/src/art/game-art.ts` | `GAME_ART.credits` (`CreditEntry[]`, `[]` for most games; the licences screen appends `creditRowsOf(host.credits)`) |
| Tutorial and how-to-play | `apps/<id>/src/tutorial/` | `line-siege-teaching.ts` |
| Bot and example states | `apps/<id>/src/testing/` | `line-siege-testing.ts` |
| Game catalogs | `apps/<id>/src/i18n/<lang>.json` | `src/i18n/ckb.json` |
| Game module and type bag | `apps/<id>/src/index.ts`, `apps/<id>/src/<id>-types.ts` | `line-siege-types.ts` |
| Unit test | next to the unit: `<unit>.test.ts(x)` | `daily-model.test.ts` |
| Data or pixel golden | next to the unit: `<unit>.golden.test.ts`; board pixel goldens in `test/goldens/boards/` | `draw-board.golden.test.ts` |
| Bot simulation | `<unit>.sim.test.ts` or `test/sims/<game-id>/` | `balance.sim.test.ts` |
| Test needing Node APIs | root `test/integration/<area>/` | `test/integration/save/sqlite-save-store.test.ts` |
| Shell E2E journeys and sub-flows | `packages/shell/e2e/flows/<area>/<nn>-<name>.yaml` (`01`-`09`), `packages/shell/e2e/subflows/` | `flows/smoke/01-first-launch.yaml`, `subflows/debug-setup.yaml` |
| A game's own E2E flows, screenshot baselines | `apps/<id>/e2e/flows/<area>/` (`10` and up), `apps/<id>/e2e/baselines/` | `flows/smoke/10-level-1.yaml` |
| Generated images | `apps/<id>/assets/generated/` | `icon-light.png` |
| Node script, CLI or module (never directly in `src/`) | `packages/tooling/src/<area>/<verb>-<noun>.ts` | `save/inspect-save.ts`, `art/render-art.ts` |
| Vendor SDK mock for Jest | root `__mocks__/<package>.ts` | `__mocks__/expo-iap.ts` |

`check-layout.mjs` (`placement`, `folders`, `port-triple`) checks the rows that can be checked by path: screens only under `screens/` (plus `app/crash-screen.tsx` and `navigation/not-built-screen.tsx`); the test-only debug module `screens/debug/` (S15, reached only through `TEST_ONLY`) may keep its own debug-store port and fake beside each other, outside `services/` and `stores/`, ports, adapters and fakes only under `services/<port>/`, domain stores under `stores/`, reducers under `stores/` or `game-host/`, config-plugin code under `plugins/` or `config/`, Node-API tests under the root `test/`, the canonical top-level folders, and a port file plus a fake next to every adapter.

## Recipe: add a Shell screen

1. Decide whether it is a route. Routes are S2–S15 except the Pause and Result overlays and the S14 dialogs. A new route needs a spec change (stop and ask); overlays and dialogs do not.
2. Write the failing RNTL test first (`screens/<screen>/<screen>-screen.test.tsx`), rendered through `renderWithShell`, querying by role.
3. Create `screens/<screen>/<screen>-screen.tsx` exporting `<Name>Screen`, and `use-<screen>-model.ts` that reads stores with selectors and calls `t()`.
4. Register the route in `navigation/root-stack.tsx` in the right group; add params to `navigation/route-params.ts` if it takes any.
5. Add every string to the four Shell catalogs (`npm run i18n:verify`); give every tappable element a `<screen>.<element>` testID.
6. Add a Maestro step to the Shell smoke flow and the screen to the screenshot matrix, and make the built screen match its Toybox design screenshot (toybox-visual-parity).
7. `npm run check:fast`, this skill's checkers, commit.

## Recipe: add a service or port

1. Name the port (`<Name>Port`) and write the type in `services/<port>/<port>-port.ts` with only vendor-neutral types (`templates/port.ts`). If it is one of the nine, use that exact name.
2. Write `fake-<port>.ts` first (`templates/fake-port.ts` + `templates/fake-port.test.ts`), then the service logic test-first against the fake.
3. Write `<vendor>-<port>-adapter.ts` (`templates/vendor-port-adapter.ts`): the only file importing the SDK. Add its SDK to the ESLint vendor list and this skill's `assets/architecture-rules.json` (`Gate-Change:`; an architecture change, so confirm with the owner); add a root `__mocks__/<sdk>.ts` if importing it in Jest crashes.
4. Install the SDK in every app and add it to the Shell's `peerDependencies`; if it has a config plugin, add the entry to `shell-plugins.ts`.
5. Add the port to `Services`, create the adapter once in the composition root (a `ShellAdapters` member made in `device-adapters.ts`, its fake in `testing/create-test-adapters.ts`, both game-host-integration templates) and pass it on in `create-shell-parts.ts`; add the fake to `renderWithShell`.
6. Run `npm run audit:network` and `npm run audit:privacy` (a new native module is a new network surface).

## Recipe: add a game

1. `npm run new-game -- --app <game-id>` scaffolds `apps/<game-id>/` (the new-game-scaffold skill owns the script): `package.json` (`@e07/<game-id>`, the shared dependency set), `tsconfig.json`, `metro.config.js`, `app.config.ts`, `index.ts`, a `game.config.ts` with placeholders, `assets/fonts/` (the five Toybox fonts `LilitaOne.ttf`, `Rubik-Regular.ttf`, `Rubik-Bold.ttf`, `Vazirmatn-Regular.ttf`, `Vazirmatn-Bold.ttf` and their three `*-OFL.txt` licences) and empty `src/` folders. The bundle id matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`. Without the script, copy this skill's templates (`package.app.json`, `app.config.ts`, `index.ts`, `game.config.ts`, `metro.config.js`, `game-types.ts`), then make the app's `dependencies` exactly those of the existing apps (same packages, same specifiers).
2. Fill `game.config.ts`; `npx expo config --json` passes.
3. Write the game test-first in this order: rules (examples + properties), level generator (goldens + solver properties), persistence (`parseState`, `parseMove`, round trip), board (view, layout, draw goldens), timeline, tutorial, stats counters, texts.
4. Declare the `ShellGameTypes` bag and assemble `src/index.ts`; the contract tests pass.
5. Generate the level table and art (tooling), run the bot sims (`npm run test:sim`).
6. Nothing is added to `quality-gates.json` or the ESLint config: their `apps/*` globs and the app zones cover every app. Run `npm run verify`, the Release simulator build, E2E and the screenshot matrix.
7. Human steps (the App Store Connect record, the AdMob app and units) belong to the release and ads skills; tell the owner plainly what they must do.
