# Jest, Babel and the test files of the repo

How the one Jest setup of the Pocket Arcade monorepo is built, why each part exists, and what breaks without it. Every file named here is a template in `templates/`; copy it verbatim unless this page says otherwise.

## Contents

- Versions (verified 2026-09-26) and how to re-verify them
- Files, folders and where tests write
- babel.config.js
- jest.config.js, part by part
- jest.setup.ts
- jest.sim.config.js
- npm scripts and everyday commands
- Adding a dependency that Jest must transpile
- Known failures and their fixes
- Flaky Jest tests

## Versions (verified 2026-09-26) and how to re-verify them

All pins are exact in the root `package.json` (`save-exact=true`). Test tools are root devDependencies; native libraries stay in the apps and are installed with `npx expo install`. `templates/package.test-deps.json` holds the lines to merge. Install the React Native Testing Library with its companion in one command, so npm never picks test-renderer on its own:

```sh
npm install -D --save-exact @testing-library/react-native@14.0.1 test-renderer@1.2.0
```

| Package | Version | Note |
|---|---|---|
| `jest` | 29.7.0 | Expo SDK 57 and 58 pin `~29.7.0`; do not move to Jest 30 by hand |
| `jest-expo` | 57.0.5 | from `expo/bundledNativeModules.json` (`~57.0.5`) |
| `@react-native/jest-preset` | 0.86.3 | jest-expo peer; must equal the React Native version |
| `babel-jest` | 29.7.0 | used directly by `jest.sim.config.js` (knip needs it listed) |
| `@types/jest` | 29.5.14 | Expo pin |
| `@testing-library/react-native` | 14.0.1 | async API (render, fireEvent, renderHook, act return promises); install it together with `test-renderer` 1.2.0, never alone |
| `test-renderer` | 1.2.0 | RNTL 14.0.1's companion: the line for React 19.2. npm's automatic peer pick is 1.3.0, which targets React 19.3 and SDK 58, so pin 1.2.0 in the same install command (verified: installing RNTL alone put 1.3.0 in the tree) |
| `react` / `react-native` (root `overrides`) | 19.2.3 / 0.86.3 | one copy of each in the whole repo |
| `fast-check` | 4.10.2 | property tests |
| `@stryker-mutator/core`, `jest-runner`, `typescript-checker` | 10.0.0 | mutation testing |
| In the apps (via `npx expo install`) | Skia 2.6.2, Reanimated 4.5.1, Worklets 0.10.1, Gesture Handler 2.32.0, react-intl 12.1.3, GMA 17.2.0, expo-iap 5.8.0 | their Jest mocks follow the native versions |

**One React.** Without the root `overrides`, npm hoisted React 19.3.0 for the root test tools while the app used 19.2.3, so Jest tested a different React than the app ships (verified). `npm ls react react-native` must show exactly one version of each. RNTL 14 needs React 19+, React Native 0.78+ and Node `^22.13.0 || >=24`; the `test-renderer` minor must match the React minor (19.2 needs 1.2.x). Add both in one command, `npm install --save-dev --save-exact @testing-library/react-native@14.0.1 test-renderer@1.2.0`; `check-test-setup.mjs` names the companion in its `test-dep-missing` message.

Re-verify before every SDK upgrade and at least monthly:

```sh
# Expo's own pins (jest, @types/jest, typescript) for the installed SDK:
curl -s https://api.expo.dev/v2/versions/latest | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')).data.sdkVersions['57.0.0'].relatedPackages;console.log(d.jest,d['@types/jest'],d.typescript)"
# jest-expo lives in bundledNativeModules.json; `npx expo install --check` does not look at root devDependencies:
node -p "require('expo/bundledNativeModules.json')['jest-expo']"
# Everything else:
npm view @testing-library/react-native version; npm view test-renderer versions --json | tail -5
npm view fast-check version; npm view @stryker-mutator/core version
# Inside every app (native test mocks follow the native versions):
(cd apps/<game-id> && npx expo install --check)
npm ls react react-native   # exactly one version of each
```

SDK 58 (preview on 2026-09-26) moves to React 19.3 (so `test-renderer` 1.3), Reanimated 4.7, Worklets 0.13, Skia 2.11 and Gesture Handler 3; Jest stays 29.7. When that happens, re-read those libraries' versioned testing docs and rerun every check of this skill.

## Files, folders and where tests write

```
<repo>/
  babel.config.js  jest.config.js  jest.sim.config.js  jest.setup.ts  stryker.config.json  tsconfig.stryker.json
  __mocks__/react-native-google-mobile-ads.ts  __mocks__/expo-iap.ts     # root manual mocks (vendor SDKs only)
  __mocks__/react-native-audio-api.ts                                   # owned by the audio work
  test/
    integration/<area>/<name>.test.ts       # cross-module and Node-API tests (save/: the node:sqlite tests)
    goldens/boards/skia-golden.ts            # the pixel-golden matcher
    goldens/boards/<game-id>-board.golden.test.ts
    sims/<game-id>/<name>.sim.test.ts        # bot simulations that write reports/sim/*.json
  packages/*/src/**/<unit>.test.ts(x)        # colocated unit and component tests
  packages/*/src/**/<unit>.golden.test.ts    # colocated data goldens (no Node APIs)
  packages/shell/src/testing/                # render-with-shell.tsx (+ test), flush-microtasks.ts, test-palette.ts
  packages/game-kit/src/testing/             # play-choices.ts, render-cells.ts, play-bot.ts
  packages/shell/src/services/<port>/fake-<port>.ts
```

**Node APIs only under the root `test/`.** The app-world programs (`packages/game-kit`, `packages/shell`, `apps/*`) have only `jest` types and lint bans `node:*` imports there; only the root `tsconfig.json` and `packages/tooling` have `node` types. So a test or helper that needs `node:sqlite`, `node:fs`, `Buffer` or `process.cwd()` lives in `test/integration/<area>/`, `test/goldens/<area>/` or `test/sims/<game-id>/`.

| Artefact | Location | In git? |
|---|---|---|
| Data golden snapshots | `<test>.golden.test.ts.snap.ios` next to the test (jest-expo/ios uses a platform snapshot resolver) | yes, gated |
| Pixel golden baselines | `__image_snapshots__/<id>.png` next to the test | yes, gated |
| Coverage | `reports/coverage/` (`coverage-summary.json`, `lcov-report/index.html`) | no |
| Mutation | `reports/stryker/mutation.{json,html}`, `reports/stryker/incremental.json` | no (keep the incremental file between local runs) |
| Sims | `reports/sim/<game-id>.json` | no |

The root `.gitignore` covers `reports/`, `/tools/`, `.stryker-tmp/` and `**/__image_snapshots__/__diff_output__/`.

## babel.config.js

Generated by `npx expo customize babel.config.js` and kept at the repo root, because Jest runs from there and jest-expo resolves Babel options from `process.cwd()`. Without a root Babel config every suite fails on Flow syntax in React Native (verified). Metro in `apps/<game-id>` keeps using `babel-preset-expo` by default.

The Stryker branch is required. Stryker injects helper functions into every mutated file; with the Worklets plugin active, every file with the file-level `'worklet';` directive failed Stryker's initial run with `"stryNS_9fa48" is read-only` (verified). Both options must be `false`: `worklets: false` alone makes the preset add Reanimated's plugin instead (verified). Worklet transforms change no behaviour when code runs as plain JS in Jest, so mutation results stay valid.

## jest.config.js, part by part

Exactly two projects: `unit` (preset `jest-expo/ios`, everything except goldens and sims) and `golden` (Skia's CanvasKit environment, `*.golden.test.ts` only). Skia's environment replaces React Native's export conditions, so it must never be the global environment. Bot sims run only through `jest.sim.config.js`.

- **`process.env.TZ = 'UTC'`** at the top: every worker inherits it, so date code never depends on the Mac's time zone.
- **`transformIgnorePatterns`**: React Native, Expo, Skia and FormatJS ship untranspiled Flow or ESM (react-intl 12 is `"type": "module"`). The pattern is a prefix match, so `react-native` also covers every `react-native-*` library and `expo` every `expo-*` module. Overriding a preset key replaces the preset's array, so the two jest-expo exclusions (`react-native-reanimated/plugin/`, `@react-native/babel-preset/`) are copied in.
- **`moduleNameMapper`** maps `@e07/<package>/<path>` straight to `<rootDir>/packages/<package>/src/<path>` (and `@e07/<game-id>/…` to `apps/<game-id>/src/…`). Without it, Stryker's sandbox imports the original files through the `node_modules` workspace symlinks and reports "NoCoverage" or false survivors (verified on `daily-seed.ts`). It also keeps Jest independent of how npm links workspaces. So tests import workspace code by package name, never by a relative path that leaves their workspace.
- **`modulePathIgnorePatterns` / `testPathIgnorePatterns`**: generated native projects (`apps/*/ios|android|build|dist`), `coverage`, `reports`, `tools`, `skills`, `.claude` and `.stryker-tmp` are invisible to Jest. The skills folder lives in the repo, and its templates and fixtures hold `package.json` files named `@e07/shell` and copies of `__mocks__/expo-iap.ts`; without the ignore, jest-haste-map prints "Haste module naming collision" and "duplicate manual mock found: expo-iap" and may apply a fixture's mock instead of the root one (verified). `jest.sim.config.js` ignores the same three folders.
- **`clearMocks` + `restoreMocks`**: call counts reset before each test; implementations given to `jest.fn(impl)` in root `__mocks__` survive (verified with Jest 29.7).
- **`setupFiles`** (both projects): the Shell's FormatJS polyfill module (`packages/shell/src/i18n/intl-polyfills.ts`) runs before the framework, exactly like the first import of the app entry, so Jest (V8 ICU) and Hermes format identically, in pixel goldens too.
- **`TEST_ROOTS`**: colocated tests in `{apps,packages}/*/src/**` and the root `test/**`.
- **`IS_MUTATION_RUN`**: the one test that checks the Worklets plugin's output (`packages/tooling/src/quality/worklet-transform.test.ts`) is skipped inside Stryker workers, which compile without that plugin.
- **`coverageThreshold`**: see `coverage-and-mutation.md`. Keys join the config only when `fs.globSync` finds a non-test source file, so an empty repo never fails with "Coverage data for ./packages/... was not found".
- **`collectCoverageFrom`** counts `apps/*/src` and `packages/*/src`, except tests, `*.d.ts`, `fixtures/`, `testing/` and `packages/tooling` (tooling scripts drive `xcodebuild` and `simctl` and are verified by running them; their pure helpers still get tests).

## jest.setup.ts

Runs after the framework is installed, in the `unit` project only: Gesture Handler's `jestSetup`, the Worklets mock (`jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'))`) and `require('react-native-reanimated').setUpTests()`. `react-native-reanimated/jest/resolver` does not exist in 4.5.1 (newer docs describe it); use the docs for the installed version.

It also holds the one central Skia mock. Skia's native module does not load in the `unit` project (`Native Skia Module failed to correctly install JSI Bindings!`), and the Shell draws with Skia in the logo tile, the empty-stats picture, the hazard strip (which the debug screen and every screen with one pulls in), the board canvas and the real-time host. So `jest.mock('@shopify/react-native-skia', ...)` in `jest.setup.ts` makes every Skia component (`Canvas`, `Group`, `Path`, `Picture`, `DashPathEffect`, any other capitalised export) render as an inert host element named `Skia<Component>` that keeps its props, so `testID`, `accessibilityRole` and `accessibilityLabel` stay queryable. Every `Skia.*` factory and lower-case helper (`vec`, `rect`, `matchFont`) returns an inert object that accepts any call, and the loading hooks (`useFont`, `useImage`, any `use*`) return `null`, which is what the real hooks return while loading. Rules for it:

- Component and screen tests need no Skia mock of their own. They assert text, roles and names; pixels are proven in the `golden` project (real CanvasKit) and by draw-call tests.
- A test that must inspect Skia calls (for example the real-time host test counting `beginRecording`) writes its own `jest.mock('@shopify/react-native-skia', factory)`; a test file's mock replaces the setup file's for that file.
- The `golden` project never loads `jest.setup.ts`: the inert mock would replace CanvasKit and blank every pixel golden.
- `render-with-shell.test.tsx` has a case that renders a `Canvas` with a `Path`; it fails at import if the mock is gone. `check-test-setup.mjs` rules `skia-unit-mock` and `jest-golden-project` catch a missing mock and a golden project that loads the setup.

Once the Shell's `packages/shell/src/ui/icons/icon-raster.ts` exists, add its `jest.mock` (the template shows it commented out). A `jest.mock` of a module that does not exist yet fails the setup file, and with it every suite; a missing mock once the file exists makes every test that renders an `Icon` load Skia's native module and fail. `check-test-setup.mjs` (rule `icon-raster-mock`) catches both.

The `golden` project adds no setup file of ours beyond the polyfills: `@shopify/react-native-skia/jestEnv.js` loads CanvasKit into `global.CanvasKit` and `jestSetup.js` mocks the module with a CanvasKit-backed `Skia`.

`.ts` imports with explicit extensions, the file-level `'worklet';` directive and `import type` all work in both environments (a worklet module carries `__workletHash` and runs as a plain function in Jest).

## jest.sim.config.js

Bot simulations only (`npm run test:sim`), never pre-commit or `npm test`. Plain Node environment: a sim that needs a React Native mock is a bug, because rules must be pure TypeScript. It transforms `.ts` with `babel-jest` using Metro's caller (`platform: 'ios'`), maps the workspace names like the main config, pins `TZ=UTC` and allows 300 s per test. Keep one sim file under about 60 s; split by difficulty or pack otherwise.

## npm scripts and everyday commands

```json
{
  "test": "jest --ci",
  "test:golden": "jest --ci --selectProjects golden",
  "test:sim": "jest --ci --config jest.sim.config.js",
  "test:coverage": "jest --ci --coverage --randomize",
  "test:mutation": "stryker run"
}
```

`--ci` never writes snapshots, so a missing golden fails instead of being created silently. `test:coverage` runs in random order and prints the seed.

| Need | Command |
|---|---|
| One file | `npx jest --ci apps/<game-id>/src/rules/apply-move.test.ts` |
| One title | `npx jest --ci -t 'clears the column'` |
| Tests related to staged files | `npx jest --ci --findRelatedTests <files>` |
| Only the unit project | `npx jest --ci --selectProjects unit` (a path goes before the flag: `npx jest --ci <file> --selectProjects unit`) |
| Coverage with the gate | `npm run test:coverage` |
| Replay an order-dependent failure | `npx jest --ci --randomize --seed=<printed seed> -i` |
| Sims | `npm run test:sim` |
| Mutants of one file | `npx stryker run --mutate packages/shell/src/services/ads/ad-policy.ts` |

Run Jest from the repo root only. `--selectProjects` takes several names, so a path written right after it is read as a project name and Jest silently runs the whole project (verified with `--listTests`). Put paths first, or let another flag follow the project name.

## Adding a dependency that Jest must transpile

A new runtime dependency that ships only ESM (or Flow, or untranspiled TypeScript) fails with `SyntaxError: Cannot use import statement outside a module`. Add its package-name prefix to `TRANSPILE_PACKAGES` in `jest.config.js` (a gated file: owner agreement and a `Gate-Change:` trailer). A package with a `require` export condition (valibot 1.5.0, for example) needs no entry (verified).

## Known failures and their fixes

| Symptom | Cause | Fix |
|---|---|---|
| Every suite fails on Flow syntax (`import typeof`) | no `babel.config.js` at the repo root, or Jest started from an app folder | copy the template to the root; run Jest from the root |
| `TurboModuleRegistry.getEnforcing(...): 'RNGoogleMobileAdsModule' could not be found` | a test (or a module it imports) loads the real AdMob SDK | the root `__mocks__/react-native-google-mobile-ads.ts` must exist; only adapters import the SDK |
| `Cannot find native module 'ExpoIap'` | same for expo-iap | the root `__mocks__/expo-iap.ts` must exist |
| `Coverage data for ./packages/... was not found` | a threshold key for a folder without source files | keep the `hasSourceFiles` filter from the template |
| Stryker initial run: `"stryNS_…" is read-only` | Worklets plugin active in mutation workers | the Stryker branch in `babel.config.js` (both options `false`) |
| Stryker: "NoCoverage" on a file whose tests pass | workspace imports resolved through `node_modules` symlinks | the `moduleNameMapper` from the template; import by `@e07/...` name |
| `requireMock` returns an object whose `jest.fn()`s have zero calls | the test called `jest.requireMock` without `jest.mock` | add `jest.mock('<sdk>')` at the top of the test file |
| Two Reacts (`Invalid hook call`, or a React version other than the app's) | root test tools hoisted another React | root `overrides` for `react` and `react-native`; `npm ls react react-native` |
| `act(...)` warnings | an un-awaited `render`, press or state change | await every RNTL call (see `component-tests.md`) |
| `jest-haste-map: duplicate manual mock found: expo-iap` or `Haste module naming collision: @e07/shell` | Jest indexes `skills/` or `.claude/` (skill fixtures hold copies) | the `skills` and `\\.claude` entries of the ignore lists in both Jest configs (`check-test-setup.mjs` rule `jest-ignored-paths`) |
| `npx jest --selectProjects unit <file>` runs every suite | `--selectProjects` swallowed the path as a second project name | `npx jest --ci <file> --selectProjects unit` |
| `Native Skia Module failed to correctly install JSI Bindings!` | the `unit` project loaded the real Skia: `jest.setup.ts` lacks the central Skia mock, or a test called `jest.requireActual('@shopify/react-native-skia')` | copy the Skia block of `templates/jest.setup.ts` (`check-test-setup.mjs` rule `skia-unit-mock`); draw modules import Skia types only and get objects through `kit`; pixel tests go to the `golden` project |
| A pixel golden is fully transparent or empty | the `golden` project loads `jest.setup.ts`, whose inert Skia mock replaced CanvasKit | only `@shopify/react-native-skia/jestSetup.js` in the golden `setupFilesAfterEnv` |

## Flaky Jest tests

A flaky test passed and failed on the same commit: a bug in the test or the product. No `jest.retryTimes`, no skips. Rerun with the printed seed: `npx jest --ci --randomize --seed=<n> -i <file>`. Typical causes: shared mutable module state (use factories), real timers, time zone, unawaited promises, order dependence. fast-check is never flaky by definition: a new failure is a new counterexample. CanvasKit renders are byte-identical run to run, so a varying pixel golden means the draw path reads time or randomness.
