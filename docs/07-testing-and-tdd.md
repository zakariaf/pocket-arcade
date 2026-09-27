# 07 — Testing and TDD

> **What this doc decides.** How Claude Code proves every behaviour of the Shell and of each game before calling it done: the red-green-refactor loop, the test pyramid, and the complete Jest (`unit` + `golden` projects, sims in their own config), Stryker and Maestro set-ups. It gives worked examples for every kind of test the spec needs (rules, goldens, pixels, bots, saves, ads, Premium, frame clock, screens, E2E, screenshot matrix), the flaky-test policy and the evidence report the owner reads. Every config and example below was run on 2026-09-26 in a copy of the canonical monorepo.
> **Related docs:** [04-code-style-and-limits.md](04-code-style-and-limits.md) (test lint and tsconfigs), [06-navigation-state-persistence.md](06-navigation-state-persistence.md) (save tests), [08-game-engine.md](08-game-engine.md) (engine, bots, pixel goldens), [10-i18n-and-rtl.md](10-i18n-and-rtl.md) (catalogs and polyfills in Jest), [11-ads-admob.md](11-ads-admob.md) (ads tests), [12-in-app-purchase.md](12-in-app-purchase.md) (Premium tests), [13-privacy-network-security.md](13-privacy-network-security.md) (runtime network audit), [14-ios-build-and-release.md](14-ios-build-and-release.md) (simulator builds), [15-performance-and-accessibility.md](15-performance-and-accessibility.md) (accessibility tests), [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md) (scripts and gated paths). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

## 1. Intro

The owner does not read code. The tests are the specification Claude Code builds against, and the evidence the owner signs off. Three facts shape this doc:

- **One agent writes both code and tests.** Coverage alone cannot show the tests would catch a bug, so mutation testing (Stryker) audits the logic tests, and pixel/screenshot goldens catch what assertions forget.
- **Determinism is a product feature** (spec 8.3, 8.13): seeded RNG, injected clock, no transcendental maths in rules (FINAL B.14). Tests enforce it; they never add randomness of their own.
- **The UI thread, the canvas and the stores are the hard parts to test.** So the architecture keeps logic in pure functions (FINAL A.5, B.12) and tests the thin UI layers with React Native Testing Library (RNTL) 14, Maestro and screenshots.

### 1.1 The test pyramid

| Level | What | Tool / file | Speed | Runs in |
|---|---|---|---|---|
| 0 | Types, lint | `tsc`, ESLint (docs/04) | seconds | editor hook, pre-commit, `check:fast` |
| 1 | Pure logic: rules, level generator, `game-kit`, reducers, policies, migrations | Jest `unit`, example tests + fast-check properties, `<unit>.test.ts` | ms per test | pre-commit (related), `test`, `verify` |
| 2 | Data goldens (levels, daily seeds, formats) and pixel goldens (boards) | Jest `golden`, `*.golden.test.ts` | < 3 s total | same as level 1 |
| 3 | Integration in Jest: services with fakes, real SQL on `node:sqlite`, screens with RNTL | Jest `unit`, `test/integration/**`, `*.test.tsx` | 0.1-2 s per file | same as level 1 |
| 4 | Bot simulations (balance, winnability, determinism) | `jest.sim.config.js`, `*.sim.test.ts` | 10 s - 10 min | `test:sim` inside `verify` (pre-push), never pre-commit |
| 5 | Mutation testing of logic folders | Stryker | 1-30 min | nightly, before a release, when a rules module is finished |
| 6 | End-to-end on a Release simulator build | Maestro flows | 10-60 s per flow | `e2e:ios`: nightly, before a release, after UI/navigation changes |
| 7 | Screenshot matrix (4 languages x light/dark x phone/tablet) | Maestro + `comparePng` | 5-20 min | `screenshots:ios`: before a release, after any UI change |
| 8 | Store sandbox (StoreKit harness, TestFlight) and owner play-test | docs/12 section 3.8 (FINAL C.26), owner | manual | per release |

Most tests live in levels 1-3. A typical game ships with a few hundred level-1/2 tests, 10-40 component tests, 3-6 sims, 3-8 own Maestro flows plus the Shell's shared flows, and about 180 matrix screenshots.

## 2. Rules

**Loop and discipline**

1. **Write one failing test first, run it, and read the failure before writing product code.** It must fail on an assertion (`Expected ... Received ...`), not on an import, type or syntax error. *Why:* a test that was never red proves nothing. *Source:* [Claude Code best practices: give Claude a way to verify its work](https://code.claude.com/docs/en/best-practices).
2. **Keep red and green in the same commit.** Never commit a failing test and never bypass hooks (`--no-verify`), `it.skip`, `it.only`, `it.failing`, `xit`. *Why:* pre-commit runs related tests (docs/16); skipped tests rot. ESLint `jest/no-disabled-tests` and `jest/no-focused-tests` are errors.
3. **Never edit an existing assertion to make it pass** unless the spec changed; then say which spec line changed, in a `Spec-Change:` commit trailer (docs/03 section 13). Never weaken a gate (threshold, tolerance, rule) to go green (FINAL D.41).
4. **Build each game in this order:** rules (examples + properties) → level generator (goldens + solver properties) → save format and migrations → services with fake ports → hooks → screens (RNTL) → Maestro flows → screenshot matrix. *Why:* each layer is tested before anything depends on it (FINAL D.41).
5. **Finish every behaviour slice with `npm run -s check:fast`**, then commit (Conventional Commits, docs/16).

**Where tests live and what they are called**

6. **Colocate unit tests** as `<unit>.test.ts(x)` next to the unit; data goldens `<unit>.golden.test.ts`; slow bot runs `*.sim.test.ts`; integration tests under the root `test/integration/<area>/` (docs/03 rule 14).
7. **Put every test or helper that needs a Node API** (`node:sqlite`, `node:fs`, `Buffer`, `process.cwd()`) **under the root `test/` folder**, next to its helper: `test/integration/<area>/`, `test/goldens/<area>/`, `test/sims/<game-id>/`. *Why:* the app-world programs (`packages/game-kit`, `packages/shell`, `apps/*`) carry `jest` types only and docs/04 bans `node:*` imports there; only the root `tsconfig.json` and `packages/tooling` have `node` types (docs/04 section 2.1 and its open issue 1).
8. **Title every test with a third-person verb:** `describe('<exported name>')` → optional `describe('when …')` → `it('clears …')`. *Why:* `jest/valid-title` enforces `^(can|[a-z]+s)\b`; titles read as the spec.
9. **Give every tappable or asserted element a testID `<screen>.<element>`** and every screen root `<screen>.screen` (docs/03 rule 12). *Why:* flows run unchanged in four languages.

**Jest**

10. **Use exactly two Jest projects in `jest.config.js`:** `unit` (preset `jest-expo/ios`) and `golden` (Skia's CanvasKit environment); bot sims run only through `jest.sim.config.js` (plain Node). *Why:* FINAL D.38; Skia's environment must not replace React Native's for every test.
11. **Run Jest from the repo root only**, with the root `babel.config.js`. *Why:* jest-expo resolves Babel options from `process.cwd()`; without a Babel config every suite fails on Flow syntax (verified in the probes).
12. **Import workspace code by package name** (`@e07/shell/…/x.ts`); `jest.config.js` maps those names to `<rootDir>` paths. *Why:* through the `node_modules` symlinks, Stryker's sandbox silently tests the original files (verified: "NoCoverage" on `daily-seed.ts` until the mapping was added).
13. **Keep one React and one React Native in the repo:** the root `package.json` `overrides` pin both to the SDK's versions (`react` 19.2.3, `react-native` 0.86.3 on SDK 57; docs/02 section 4.1 owns the line), and `npm ls react react-native` shows one version of each. *Why:* without it, npm hoisted React 19.3.0 for the root test tools while the app used 19.2.3, so Jest tested a different React than the app ships (verified). *Source:* [Expo monorepos: "Duplicate React versions in a single app will cause runtime errors"; force one version with a resolution](https://docs.expo.dev/guides/monorepos/), [npm overrides](https://docs.npmjs.com/cli/v11/configuring-npm/package-json).
14. **Never let tests read real time, real randomness or the machine's time zone.** Inject `ClockPort`/`FakeClock` and the seeded RNG; `jest.config.js` pins `TZ=UTC`. `jest.useFakeTimers()` is only for UI timers inside components, never for game or clock logic. `Math.random`, `Date.now`, `new Date()` and `performance.now()` stay banned in tests too.

**Logic, goldens and pixels**

15. **Test every pure module with examples AND fast-check properties**, and pin at least one golden example value next to the properties. *Why:* in the probes, determinism and range properties alone left 3 of 8 RNG mutants alive. *Source:* [fast-check](https://fast-check.dev/).
16. **When fast-check finds a counterexample, add it as an example test first**, then fix the code; reproduce with the printed `{ seed, path }`.
17. **Write no component-tree snapshots.** Snapshots exist only in `*.golden.test.ts` as readable data (ASCII boards, JSON). *Why:* agents rubber-stamp large UI snapshots with `-u` (FINAL D.38).
18. **Create or change a golden only on purpose:** `npx jest --selectProjects golden -u <file>`, never `-u` in scripts or hooks, and commit with a `Gate-Change: <reason>` trailer. `jest --ci` refuses to write new snapshots (verified for data and image snapshots). **Daily-challenge goldens never change for an existing date.**
19. **Render board pixels with the same draw function the device uses** (docs/08's `paintBoardPng`), at no fewer than three canvas sizes (phone portrait, tablet landscape, narrow split view), with fonts loaded explicitly, tolerance 0.1% of pixels. docs/08 owns each board's golden test; this doc owns the matcher (`skia-golden.ts`). *Why:* FINAL B.18 and D.38; Skia's `jestSetup` returns `null` for `useFont`/`matchFont`.

**Services, saves, fakes**

20. **Keep vendor SDKs out of tests.** Only the adapter files import `react-native-google-mobile-ads` or `expo-iap`; the root `__mocks__/` files keep those adapters importable in Jest; everything else is tested through the port with `fake-<port>.ts`. An adapter's own test reads the mock with `jest.mock('<sdk>')` plus `jest.requireMock('<sdk>')` (docs/04 bans the import in tests too; without the explicit `jest.mock`, `requireMock` returns a second instance, verified). *Why:* both SDKs crash on import in Jest (verified); fakes make ad and Premium rules millisecond tests.
21. **Test the real save SQL on Node's `node:sqlite` through `SqlDriver`** (docs/06 section 6.12 has the tests): fresh, round trip, backup restore with quarantine, every frozen fixture, newer version untouched, rollback, WAL checkpoint. The simulator kill test (docs/06 section 6.13) is the final check, not the only one (FINAL A.6).
22. **Every save-format change adds frozen fixtures `fixtures/save-vN.minimal.json` and `save-vN.full.json` and a migration test** (docs/06 section 6.11). Never edit a shipped fixture (gated path).
23. **Test Premium against docs/12's `createFakePurchase` for every S12 state**, including "persist Premium before `finishTransaction`", pending, cancel, error codes, empty product list, restore `sync-failed`, and "revoke only on an explicit revocation date" (FINAL C.25).
24. **Test the UI-thread scene clock with fake `FrameInfo` sequences** that include a stop and restart; the clock uses `frame.timestamp - startAt`, never `timeSinceFirstFrame` (FINAL B.12). *Source:* [Reanimated `useFrameCallback`](https://docs.swmansion.com/react-native-reanimated/docs/advanced/useFrameCallback/).

**Components**

25. **Read `node_modules/@testing-library/react-native/docs/guides/llm-guidelines.md` before writing RNTL tests.** Await every `render`, `user.press`, `act` and `fireEvent`; query `getByRole` first, `findBy*` for async, `queryBy*` only for absence; use `userEvent.setup()`. `t()` wraps `…Name`/`…Text` arguments in FSI/PDI (docs/10), so build expected names with `isolate()`. *Source:* [RNTL 14 release notes](https://github.com/callstack/react-native-testing-library/releases/tag/v14.0.0).
26. **Render every component through `renderWithShell`**: docs/10's `I18nProvider` with the real English catalog (a missing message throws), a `DirectionProvider`, docs/06's stores built from a seeded in-memory save, docs/05's `ThemeProvider` over the test palette, and only the ports the test passes (any other port throws on first use). Assert visible English text or accessible names, never styles. The two exceptions: docs/10's `t.test.tsx` (the i18n contract) and the 44 × 44 pt touch box (docs/15 rule 24).

**Coverage and mutation**

27. **Keep coverage at global 90/90/90/85 (statements/lines/functions/branches) and 95/95/95/90 for `packages/game-kit/src/`, `packages/shell/src/services/save/` and `apps/*/src/rules/**`.** A threshold key is only active once its folder has source files (Jest exits 1 on a key that matches nothing; `jest.config.js` does this automatically). The rules key is a glob, so Jest applies it to each rules file on its own. *Source:* [Jest `coverageThreshold`](https://jestjs.io/docs/configuration#coveragethreshold-object).
28. **Run `npm run test:mutation` nightly, before a release and when a rules module is finished;** break below 75%. Kill surviving mutants with boundary examples, never by relaxing thresholds. Stryker workers compile without the Worklets plugin (section 3.3). *Source:* [StrykerJS configuration](https://stryker-mutator.io/docs/stryker-js/configuration/).

**End-to-end and screenshots**

29. **Install Maestro only with `packages/tooling/scripts/install-maestro.sh`** (pinned GitHub zip, SHA-256 checked) and run it with `MAESTRO_CLI_NO_ANALYTICS=true`, `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true`, `MAESTRO_DISABLE_UPDATE_CHECK=true`, Java 17 (FINAL D.40).
30. **Run flows only against a Release simulator build of the `test` variant with `ADS_MODE=off`** (docs/14 section 3.5), on a dedicated simulator created by name (never another agent's simulator), and select elements by `id:` only. End every `smoke` flow with `subflows/assert-no-network.yaml`; the runner also fails on any non-loopback socket (docs/13 layer F).
31. **Set up state only through the debug deep link** (section 3.12), never by tapping through menus. *Why:* setup through the UI is slow and flaky, and couples every flow to every screen.
32. **Never give a flow an `env:` block for a variable the runner passes with `-e`.** *Why:* in Maestro 2.10.0 the flow's `env:` value wins over `-e` (verified).
33. **Keep sub-flows outside `flows/`** (`e2e/subflows/`). *Why:* Maestro runs only top-level files of a folder and the runner lists `flows/<area>/*.yaml` explicitly; a sub-flow in `flows/` would run on its own and fail.
34. **Never use Maestro's AI commands** (`assertWithAI`, `assertNoDefectsWithAI`, `extractTextWithAI`). *Why:* they upload screenshots to a third-party service.
35. **Capture screenshots only from a still, deterministic screen:** status bar 9:41, reduce motion on, ads off, fixed seed and date, one device and runtime per baseline set (iPhone 17 Pro Max and iPad Pro 13-inch (M5), iOS 26.5). *Why:* an animating probe screen differed by 1.08% between two captures one second apart (verified).
36. **Open every changed screenshot and diff PNG with the Read tool** and check direction, clipping and overlap before calling UI work done; the owner gets the gallery (FINAL D.40).

**Flakiness and evidence**

37. **Treat every flaky test as a bug:** no `jest.retryTimes`, no Maestro `retry` around app assertions, no raised tolerance. Follow section 3.16.
38. **End every slice and every release with the evidence report** in section 3.17.

## 3. Details

### 3.1 Versions (verified 2026-09-26) and how to re-verify them

All pins are exact in the root `package.json` (`save-exact=true`, docs/01). Test tools are root devDependencies; native libraries stay in the apps and are installed with `npx expo install` (docs/01).

| Package | Version | Note |
|---|---|---|
| `jest` | 29.7.0 | Expo SDK 57 and 58 pin `~29.7.0`; do not move to Jest 30 by hand |
| `jest-expo` | 57.0.5 | from `expo/bundledNativeModules.json` (`~57.0.5`) |
| `@react-native/jest-preset` | 0.86.3 | jest-expo peer; must equal the React Native version |
| `babel-jest` | 29.7.0 | used directly by `jest.sim.config.js` (knip needs it listed, docs/16) |
| `@types/jest` | 29.5.14 | Expo pin |
| `@testing-library/react-native` | 14.0.1 | async API |
| `test-renderer` | 1.2.0 | React 19.2 line; npm's automatic peer pick is 1.3.0 (React 19.3), so pin it |
| `react` / `react-native` (overrides) | 19.2.3 / 0.86.3 | rule 13, docs/02 section 4.1 |
| `fast-check` | 4.10.2 | |
| `jest-image-snapshot` / `@types/jest-image-snapshot` | 6.5.2 / 6.4.2 | uses pixelmatch 5 internally |
| `pixelmatch` / `pngjs` / `@types/pngjs` | 7.2.0 / 7.0.0 / 6.0.5 | Node scripts only; pixelmatch 7 is ESM-only |
| `@stryker-mutator/core`, `jest-runner`, `typescript-checker` | 10.0.0 | |
| Maestro CLI | 2.10.0 | zip SHA-256 `29b675e10cc12080e445e9bfb2e2b4e4dfb9c0f2e30d5884120d258b5e1cd991` |
| Java | 17 (17.0.11 on this Mac, Android Studio JBR) | for Maestro |
| In the app (via `npx expo install`) | Skia 2.6.2, Reanimated 4.5.1, Worklets 0.10.1, Gesture Handler 2.32.0, react-intl 12.1.3, GMA 17.2.0, expo-iap 5.8.0 | as verified with this setup |

Re-verify before every SDK upgrade and at least monthly:

```sh
# Expo's own pins (jest, @types/jest, typescript) for the installed SDK:
curl -s https://api.expo.dev/v2/versions/latest | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')).data.sdkVersions['57.0.0'].relatedPackages;console.log(d.jest,d['@types/jest'],d.typescript)"
# jest-expo lives in bundledNativeModules.json; `npx expo install --check` does not look at root devDependencies:
node -p "require('expo/bundledNativeModules.json')['jest-expo']"
# Everything else:
npm view @testing-library/react-native version; npm view test-renderer versions --json | tail -5
npm view fast-check version; npm view jest-image-snapshot version; npm view @stryker-mutator/core version
curl -sL https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.10.0/checksums_sha256.txt
# Inside every app (native test mocks follow the native versions):
(cd apps/line-siege && npx expo install --check)
npm ls react react-native   # exactly one version of each
```

When Expo moves to Jest 30 or a new Reanimated/Worklets line (SDK 58 is still a preview: `expo@58.0.0-preview.7` pins Reanimated 4.7.0, Worklets 0.13.0, Skia 2.11.2, Gesture Handler ~3.2.1, jest-expo ~58.0.3 and React 19.3, so test-renderer 1.3; Jest stays ~29.7.0), re-read the versioned testing docs of those libraries, rerun every section of this doc and update the "Verified" section.

### 3.2 Files and folders

```
<repo>/
  babel.config.js  jest.config.js  jest.sim.config.js  jest.setup.ts  stryker.config.json  tsconfig.stryker.json
  __mocks__/react-native-google-mobile-ads.ts  __mocks__/expo-iap.ts        # root manual mocks (vendor SDKs only)
  __mocks__/react-native-audio-api.ts                                      # owned by docs/09 section 4.6
  test/
    integration/<area>/<name>.test.ts       # cross-module and Node-API tests (save/: docs/06's node:sqlite tests)
    goldens/boards/skia-golden.ts            # the pixel-golden matcher (this doc)
    goldens/boards/<game-id>-board.golden.test.ts   # board pixel goldens (docs/08)
    sims/<game-id>/<name>.sim.test.ts        # bot simulations that write reports/sim/*.json
  packages/*/src/**/<unit>.test.ts(x)        # colocated unit and component tests
  packages/*/src/**/<unit>.golden.test.ts    # colocated data goldens (no Node APIs)
  packages/shell/src/testing/                # render-with-shell.tsx (+ test), flush-microtasks.ts; test-palette.ts (docs/05)
  packages/game-kit/src/testing/             # play-choices.ts, render-cells.ts (this doc), play-bot.ts (docs/08)
  packages/shell/src/services/<port>/fake-<port>.ts
  packages/shell/e2e/{flows/<area>/,subflows/,screenshots/}
  apps/<game-id>/e2e/{flows/<area>/,baselines/<device>/<lang>-<theme>/}
  packages/tooling/scripts/install-maestro.sh
  packages/tooling/src/{e2e,visual,quality}/  # quality/: docs/08's worklet boundary check, docs/16's guardrail
  reports/   tools/maestro/                  # gitignored
```

Where Jest and friends write:

| Artefact | Location | In git? |
|---|---|---|
| Data golden snapshots | **`<test>.golden.test.ts.snap.ios` next to the test** (jest-expo/ios uses a platform snapshot resolver; verified) | yes, gated |
| Pixel golden baselines | `__image_snapshots__/<id>.png` next to the test | yes, gated |
| Pixel golden diffs | `reports/visual/diff/<id>-diff.png` | no |
| Coverage | `reports/coverage/` (`coverage-summary.json`, `lcov-report/index.html`) | no |
| Mutation | `reports/stryker/mutation.{json,html}`, `reports/stryker/incremental.json` | no (keep the incremental file between local runs) |
| Sims | `reports/sim/<game-id>.json` | no |
| E2E | `reports/e2e/<game-id>/junit.xml`, `network.txt` (docs/13 layer F), per-flow logs and screenshots | no |
| Screenshot matrix | `reports/screenshots/{index.html,summary.json,raw/,diff/}`; baselines in `apps/<game-id>/e2e/baselines/` | baselines yes, gated |

The root `.gitignore` (docs/16 section 4 has the complete file) covers `reports/`, `tools/` (Maestro), `.stryker-tmp/` and `**/__image_snapshots__/__diff_output__/`.

### 3.3 `babel.config.js`

Generated by `npx expo customize babel.config.js`, kept at the repo root (Jest runs from there; Metro in `apps/<game-id>` keeps using `babel-preset-expo` by default). The Stryker branch is required: with the Worklets plugin active, every mutated file that uses the file-level `'worklet';` directive (FINAL B.15) failed Stryker's initial run with `"stryNS_9fa48" is read-only` (verified). Both options must be `false`; `worklets: false` alone makes the preset add Reanimated's plugin instead (verified).

```js
// babel.config.js — generated by `npx expo customize babel.config.js`, moved to the repo root
// so the root Jest run finds it (jest-expo resolves Babel options from process.cwd()).
// Stryker workers (STRYKER_MUTATOR_WORKER) compile WITHOUT the Worklets plugin: Stryker injects helper
// functions into every mutated file, and a file-level 'worklet' directive would workletize them too
// ("stryNS_… is read-only"). Worklet transforms change no behaviour when code runs as plain JS in Jest.
module.exports = function (api) {
  const isMutationRun = process.env.STRYKER_MUTATOR_WORKER !== undefined;
  api.cache.using(() => isMutationRun);
  return {
    presets: [['babel-preset-expo', isMutationRun ? { worklets: false, reanimated: false } : {}]],
  };
};
```

### 3.4 `jest.config.js` (complete)

```js
// jest.config.js — the ONE Jest config for the monorepo (run from the repo root).
// Projects: 'unit' (jest-expo iOS env, everything except goldens and sims)
//           'golden' (Skia CanvasKit env, *.golden.test.ts only).
// Bot simulations (*.sim.test.ts) are NOT here: they run via jest.sim.config.js (`npm run test:sim`).
const fs = require('node:fs');
const path = require('node:path');

// Every worker inherits this: date code under test never depends on the Mac's time zone.
process.env.TZ = 'UTC';

// Packages that ship untranspiled ESM/Flow/TS and must go through Babel. Prefix match:
// 'react-native' also covers react-native-reanimated, -worklets, -gesture-handler, -google-mobile-ads;
// 'expo' also covers expo-iap, expo-sqlite, expo-network, expo-localization, expo-haptics.
const TRANSPILE_PACKAGES = [
  'react-native',
  '@react-native',
  'expo',
  '@expo',
  '@react-navigation',
  '@shopify/react-native-skia',
  'react-intl',
  '@formatjs',
  'intl-messageformat',
];

const transformIgnorePatterns = [
  `/node_modules/(?!(${TRANSPILE_PACKAGES.join('|')}))`,
  // Kept from jest-expo: never transform the Reanimated Babel plugin or the RN Babel preset.
  '/node_modules/react-native-reanimated/plugin/',
  '/node_modules/@react-native/babel-preset/',
];

// Generated native projects, build output, Stryker sandboxes and tool downloads are invisible to Jest.
const IGNORED_PATHS = [
  '<rootDir>/apps/[^/]+/(ios|android|build|dist)/',
  '<rootDir>/(coverage|reports|tools|\\.stryker-tmp)/',
];

// Resolve workspace imports straight to <rootDir> instead of through the node_modules symlinks.
// Without this, Stryker's sandbox imports the ORIGINAL files and reports "NoCoverage"/false survivors.
const WORKSPACE_MODULES = {
  '^@e07/(game-kit|shell|tooling)/(.*)$': '<rootDir>/packages/$1/src/$2',
  '^@e07/([^/]+)/(.*)$': '<rootDir>/apps/$1/src/$2',
};

const SHARED = {
  rootDir: __dirname,
  preset: 'jest-expo/ios',
  transformIgnorePatterns,
  moduleNameMapper: WORKSPACE_MODULES,
  modulePathIgnorePatterns: IGNORED_PATHS,
  testPathIgnorePatterns: ['/node_modules/', ...IGNORED_PATHS],
  clearMocks: true,
  restoreMocks: true,
  // The Shell's FormatJS polyfills (docs/10) load before anything else, in every project.
  setupFiles: ['<rootDir>/packages/shell/src/i18n/intl-polyfills.ts'],
};

// Colocated tests in <workspace>/src/, integration tests in the root test/integration/ (docs/03).
const TEST_ROOTS = ['<rootDir>/{apps,packages}/*/src/**/', '<rootDir>/test/**/'];

// Stryker compiles without the Worklets plugin (see babel.config.js), so the one test that checks
// the plugin's output cannot pass inside a mutation run.
const IS_MUTATION_RUN = process.env.STRYKER_MUTATOR_WORKER !== undefined;

const unitProject = {
  ...SHARED,
  displayName: 'unit',
  testMatch: TEST_ROOTS.map((root) => `${root}*.test.{ts,tsx}`),
  testPathIgnorePatterns: [
    ...SHARED.testPathIgnorePatterns,
    '\\.golden\\.test\\.',
    '\\.sim\\.test\\.',
    ...(IS_MUTATION_RUN ? ['/quality/worklet-transform\\.test\\.'] : []),
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

const goldenProject = {
  ...SHARED,
  displayName: 'golden',
  testEnvironment: '@shopify/react-native-skia/jestEnv.js',
  testMatch: TEST_ROOTS.map((root) => `${root}*.golden.test.ts`),
  setupFilesAfterEnv: ['@shopify/react-native-skia/jestSetup.js'],
};

// Coverage thresholds. A path key that matches no file makes Jest exit 1
// ("Coverage data for ... was not found"), so a key is only added once its folder has code.
const LOGIC = { statements: 95, lines: 95, functions: 95, branches: 90 };
const LOGIC_THRESHOLDS = {
  './packages/game-kit/src/': 'packages/game-kit/src/**/*.ts',
  './packages/shell/src/services/save/': 'packages/shell/src/services/save/**/*.ts',
  './apps/*/src/rules/**/*.ts': 'apps/*/src/rules/**/*.ts',
};

function hasSourceFiles(glob) {
  return fs
    .globSync(glob, { cwd: __dirname })
    .some((file) => !/\.(test|golden\.test|sim\.test)\.ts$/.test(path.basename(file)));
}

const coverageThreshold = {
  global: { statements: 90, lines: 90, functions: 90, branches: 85 },
  ...Object.fromEntries(
    Object.entries(LOGIC_THRESHOLDS)
      .filter(([, glob]) => hasSourceFiles(glob))
      .map(([key]) => [key, LOGIC]),
  ),
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [unitProject, goldenProject],
  collectCoverageFrom: [
    '<rootDir>/{apps,packages}/*/src/**/*.{ts,tsx}',
    '!<rootDir>/packages/tooling/**',
    '!**/*.{test,golden.test,sim.test}.{ts,tsx}',
    '!**/*.d.ts',
    '!**/fixtures/**',
    '!**/testing/**',
  ],
  coverageDirectory: '<rootDir>/reports/coverage',
  coverageReporters: ['text-summary', 'json-summary', 'lcov'],
  coverageThreshold,
};
```

Why each part exists:

- **`transformIgnorePatterns`**: React Native, Expo, Skia and FormatJS ship untranspiled Flow or ESM (react-intl 12 is `"type": "module"`). The pattern is a prefix match, so `react-native` also covers every `react-native-*` library and `expo` every `expo-*` module. Overriding a preset key replaces the preset's array, so the two jest-expo exclusions are copied in. A new runtime dependency that ships only ESM must be added to `TRANSPILE_PACKAGES`; one with a `require` export (valibot 1.5.0, docs/06) needs no entry (verified).
- **`moduleNameMapper`**: rule 12. It also keeps Jest independent of how npm links workspaces (verified with docs/02's `"type": "module"` packages).
- **`restoreMocks` + `clearMocks`**: call counts reset before each test; implementations given to `jest.fn(impl)` in root `__mocks__` survive (verified with Jest 29.7).
- **`setupFiles`** (in both projects, docs/10): the Shell's FormatJS polyfill module runs before the framework, exactly like the first import of the app entry, so Jest (V8 ICU) and Hermes format identically, in pixel goldens too.
- **`IS_MUTATION_RUN`**: the one test that checks the Worklets plugin's output (section 3.8.8) is skipped inside Stryker workers, which compile without that plugin.
- **`coverageThreshold`**: rule 27. Keys join the config only when `fs.globSync` finds a non-test source file, so an empty repo never fails with "Coverage data for ./packages/... was not found". docs/16's guardrail compares the resolved keys with `quality-gates.json`.

### 3.5 `jest.setup.ts` and `jest.sim.config.js`

```ts
// jest.setup.ts — runs after the test framework is installed, in the 'unit' project only.
// Versions verified: react-native-gesture-handler 2.32, react-native-worklets 0.10.1, react-native-reanimated 4.5.1.
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
require('react-native-reanimated').setUpTests();
```

docs/05 section 3.10 adds one line to this file, `jest.mock('@e07/shell/ui/icons/icon-raster.ts', …)`, once `icon-raster.ts` exists (a `jest.mock` of a module that does not exist yet fails the setup). `react-native-reanimated/jest/resolver` does not exist in 4.5.1 (newer docs describe it); use the versioned docs. *Sources:* [Reanimated testing](https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/), [Worklets testing](https://docs.swmansion.com/react-native-worklets/docs/guides/testing/), [Gesture Handler testing](https://docs.swmansion.com/react-native-gesture-handler/docs/guides/testing).

```js
// jest.sim.config.js — bot simulations only (`npm run test:sim`). Never part of pre-commit or `npm test`.
// Plain Node environment: a sim that needs a React Native mock is a bug (rules must be pure TS).
process.env.TZ = 'UTC';

/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  displayName: 'sim',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/{apps,packages}/*/src/**/*.sim.test.ts',
    '<rootDir>/test/**/*.sim.test.ts',
  ],
  transform: {
    '\\.ts$': ['babel-jest', { caller: { name: 'metro', bundler: 'metro', platform: 'ios' } }],
  },
  moduleNameMapper: {
    '^@e07/(game-kit|shell|tooling)/(.*)$': '<rootDir>/packages/$1/src/$2',
    '^@e07/([^/]+)/(.*)$': '<rootDir>/apps/$1/src/$2',
  },
  modulePathIgnorePatterns: [
    '<rootDir>/apps/[^/]+/(ios|android|build)/',
    '<rootDir>/\\.stryker-tmp/',
  ],
  testTimeout: 300_000,
};
```

The `golden` project adds no setup file of ours beyond the shared polyfills: `@shopify/react-native-skia/jestEnv.js` loads CanvasKit into `global.CanvasKit` and `jestSetup.js` mocks the module with a CanvasKit-backed `Skia`. *Source:* [Skia installation: testing with Jest](https://shopify.github.io/react-native-skia/docs/getting-started/installation).

The `.ts` imports with explicit extensions, the file-level `'worklet';` directive and `import type` all work in both environments (verified: a worklet module carries `__workletHash` and runs as a plain function in Jest).

### 3.6 Root `__mocks__` and fakes

Jest applies a file in `<rootDir>/__mocks__/` automatically to the node module of the same name, in every project, without `jest.mock` (scoped packages: `__mocks__/@scope/name.ts`). *Source:* [Jest manual mocks: mocking node modules](https://jestjs.io/docs/manual-mocks). These two exist because the real modules crash on import in Jest (verified: `TurboModuleRegistry.getEnforcing(...): 'RNGoogleMobileAdsModule' could not be found` and `Cannot find native module 'ExpoIap'`). This doc owns them (docs/02); they cover every name docs/11's two AdMob adapters and docs/12's purchase adapter import. A third root mock, `__mocks__/react-native-audio-api.ts`, extends the library's own Jest mock for docs/09's audio adapter; docs/09 section 4.6 owns it. They mirror the libraries' public names, so they need the ESLint exemption for PascalCase names and the default export (docs/04 exempts `__mocks__` from `no-default-export`; see open issue 5 for naming).

```ts
// __mocks__/react-native-google-mobile-ads.ts — applied automatically to every Jest project (root
// manual mock for a node module). Only the two AdMob adapters import the library (docs/11); a test
// that asserts on it calls jest.mock() + jest.requireMock() (section 3.6). Mirrors 17.2.0's surface.
type ConsentInfo = {
  status: 'UNKNOWN' | 'REQUIRED' | 'NOT_REQUIRED' | 'OBTAINED';
  canRequestAds: boolean;
  privacyOptionsRequirementStatus: 'UNKNOWN' | 'REQUIRED' | 'NOT_REQUIRED';
  isConsentFormAvailable: boolean;
};

const CONSENT_OBTAINED: ConsentInfo = {
  status: 'OBTAINED',
  canRequestAds: true,
  privacyOptionsRequirementStatus: 'NOT_REQUIRED',
  isConsentFormAvailable: false,
};

function createMockAd() {
  return {
    loaded: false,
    load: jest.fn(),
    show: jest.fn(() => Promise.resolve()),
    addAdEventListener: jest.fn(() => jest.fn()),
    removeAllListeners: jest.fn(),
    destroy: jest.fn(),
  };
}

const mobileAdsInstance = {
  initialize: jest.fn(() => Promise.resolve([])),
  setRequestConfiguration: jest.fn(() => Promise.resolve()),
  openAdInspector: jest.fn(() => Promise.resolve()),
};

// The library exports mobileAds() both as default and as MobileAds; the default forces this export.
const mobileAds = jest.fn(() => mobileAdsInstance);
export default mobileAds;
export const MobileAds = mobileAds;

export const AdsConsent = {
  requestInfoUpdate: jest.fn(() => Promise.resolve(CONSENT_OBTAINED)),
  loadAndShowConsentFormIfRequired: jest.fn(() => Promise.resolve(CONSENT_OBTAINED)),
  showPrivacyOptionsForm: jest.fn(() => Promise.resolve(CONSENT_OBTAINED)),
  getConsentInfo: jest.fn(() => Promise.resolve(CONSENT_OBTAINED)),
  reset: jest.fn(),
};

export const AdsConsentStatus = {
  UNKNOWN: 'UNKNOWN',
  REQUIRED: 'REQUIRED',
  NOT_REQUIRED: 'NOT_REQUIRED',
  OBTAINED: 'OBTAINED',
} as const;
export const AdsConsentPrivacyOptionsRequirementStatus = {
  UNKNOWN: 'UNKNOWN',
  REQUIRED: 'REQUIRED',
  NOT_REQUIRED: 'NOT_REQUIRED',
} as const;
export const AdsConsentDebugGeography = {
  DISABLED: 0,
  EEA: 1,
  NOT_EEA: 2,
  REGULATED_US_STATE: 3,
  OTHER: 4,
} as const;
export const MaxAdContentRating = { G: 'G', PG: 'PG', T: 'T', MA: 'MA' } as const;
export const AdEventType = {
  LOADED: 'loaded',
  ERROR: 'error',
  OPENED: 'opened',
  PAID: 'paid',
  CLICKED: 'clicked',
  CLOSED: 'closed',
  IMPRESSION: 'impression',
} as const;
export const RewardedAdEventType = {
  LOADED: 'rewarded_loaded',
  EARNED_REWARD: 'rewarded_earned_reward',
} as const;
export const BannerAdSize = {
  ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
  LARGE_ANCHORED_ADAPTIVE_BANNER: 'LARGE_ANCHORED_ADAPTIVE_BANNER',
} as const;

// iOS values of the library's TestIds (jest-expo/ios); keep in sync on every GMA upgrade.
export const TestIds = {
  ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/2435281174',
  BANNER: 'ca-app-pub-3940256099942544/2934735716',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/4411468910',
  REWARDED: 'ca-app-pub-3940256099942544/1712485313',
  REWARDED_INTERSTITIAL: 'ca-app-pub-3940256099942544/6978759866',
} as const;

export const InterstitialAd = { createForAdRequest: jest.fn(createMockAd) };
export const RewardedAd = { createForAdRequest: jest.fn(createMockAd) };

export function BannerAd(): null {
  return null;
}
```

```ts
// __mocks__/expo-iap.ts — root manual mock (automatic in every Jest project). expo-iap 5.8.0 ships no
// Jest mock and its native module does not exist in Jest. Only expo-iap-purchase-adapter.ts imports it.
// Banned APIs (kitApi, verifyPurchaseWithProvider, ...) are deliberately NOT mocked: calling one throws.
// An adapter test reads these jest.fn()s via jest.mock('expo-iap') + jest.requireMock('expo-iap').
function subscription() {
  return { remove: jest.fn() };
}

export const initConnection = jest.fn(() => Promise.resolve(true));
export const endConnection = jest.fn(() => Promise.resolve(true));
export const fetchProducts = jest.fn(() => Promise.resolve([] as unknown[]));
export const requestPurchase = jest.fn(() => Promise.resolve(null));
export const finishTransaction = jest.fn(() => Promise.resolve());
export const restorePurchases = jest.fn(() => Promise.resolve());
export const getAvailablePurchases = jest.fn(() => Promise.resolve([] as unknown[]));
export const purchaseUpdatedListener = jest.fn(subscription);
export const purchaseErrorListener = jest.fn(subscription);

// The real enum: build/types.js is plain JS without native code, so the mock can never drift from it.
export { ErrorCode } from 'expo-iap/build/types.js';
```

An adapter's own test drives it against the mock. Here docs/11's consent adapter and FINAL C.23's rule "on update failure use last session's `canRequestAds`":

```ts
// packages/shell/src/services/consent/admob-consent-adapter.test.ts — drives docs/11's adapter against
// the root __mocks__. docs/04 bans importing the SDK outside the adapters, so the test reads the mock
// with jest.requireMock, typed with only what the assertions need. The explicit jest.mock() is required:
// without it, requireMock returns a second instance, not the one the adapter imported (verified).
import { createAdmobConsentAdapter } from './admob-consent-adapter.ts';

jest.mock('react-native-google-mobile-ads');

type MockedSdk = {
  readonly AdsConsent: {
    readonly requestInfoUpdate: jest.Mock<Promise<unknown>>;
    readonly getConsentInfo: jest.Mock<Promise<unknown>>;
  };
};

const { AdsConsent } = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');

const REQUIRED = {
  status: 'REQUIRED',
  canRequestAds: false,
  privacyOptionsRequirementStatus: 'REQUIRED',
  isConsentFormAvailable: true,
};

describe('createAdmobConsentAdapter', () => {
  it('shows the privacy-options row when UMP requires it', async () => {
    AdsConsent.requestInfoUpdate.mockResolvedValueOnce(REQUIRED);
    const consent = createAdmobConsentAdapter({ onError: jest.fn() });

    await expect(consent.refresh()).resolves.toStrictEqual({
      canRequestAds: false,
      isPrivacyOptionsRequired: true,
    });
  });

  it("falls back to the last session's answer when the update fails offline", async () => {
    const onError = jest.fn();
    const offline = new Error('offline');
    AdsConsent.requestInfoUpdate.mockRejectedValueOnce(offline);

    await expect(createAdmobConsentAdapter({ onError }).refresh()).resolves.toStrictEqual({
      canRequestAds: true,
      isPrivacyOptionsRequired: false,
    });
    expect(onError).toHaveBeenCalledWith(offline);
    expect(AdsConsent.getConsentInfo).toHaveBeenCalledTimes(1);
  });

  it('passes a debug geography only when the debug menu sets one', async () => {
    await createAdmobConsentAdapter({ onError: jest.fn() }).refresh();
    await createAdmobConsentAdapter({ debugGeography: 'eea', onError: jest.fn() }).refresh();

    expect(AdsConsent.requestInfoUpdate.mock.calls).toStrictEqual([[{}], [{ debugGeography: 1 }]]);
  });
});
```

Everything above the adapters uses a fake: `fake-<port>.ts` beside the port (docs/03). A fake is a real, small implementation with test controls, not a bag of `jest.fn()`: it records an ordered call log that other fakes can share, so a test can assert cross-service order ("persist, then finish"). The S15 debug menu reuses the same fakes (toggle Premium, simulate offline). The canonical ones are docs/11's `createFakeAds` and docs/12's `createFakePurchase` (section 3.8.6).

### 3.7 The TDD loop in practice

```
1. Pick the next behaviour from the spec (quote the spec line in the test name or a comment).
2. Write ONE failing test.                    npx jest <path> --ci
3. Read the failure. Right reason = an assertion diff. Wrong reason = import/type/syntax error: fix the test.
4. Write the minimum code.                    npx jest <path> --ci   -> green
5. Refactor by responsibility (limits in docs/04), tests stay green.
6. npm run -s check:fast                      (also the Stop hook)
7. Commit the slice (red and green together). Pre-commit reruns related tests.
```

A red run for the right reason looks like this (the first example test of section 3.8.1, before `applyMove` cleared full columns):

```
● applyMove › when a placement completes a column › clears the column and emits a column-cleared event
  expect(received).toStrictEqual(expected) // deep equality
  - Expected  - 4
  + Received  + 0
  -   Object {
  -     "col": 2,
  -     "kind": "column-cleared",
  -   },
```

Commands the agent uses all day:

| Need | Command |
|---|---|
| One file | `npx jest --ci apps/line-siege/src/rules/apply-move.test.ts` |
| One title | `npx jest --ci -t 'clears the column'` |
| Tests related to staged files | `npx jest --ci --findRelatedTests <files>` |
| Only goldens | `npm run test:golden` |
| Coverage with the gate | `npm run test:coverage` (prints the random seed) |
| Replay an order-dependent failure | `npx jest --ci --randomize --seed=<printed seed> -i` |
| Sims | `npm run test:sim` |
| Mutants of one file | `npx stryker run --mutate packages/shell/src/services/ads/ad-policy.ts` |

### 3.8 Worked examples

#### 3.8.1 Property tests for a game rule (fast-check)

`playChoices` turns a list of integers into a legal move sequence for any pure rules module, so fast-check can explore move sequences without knowing the game:

```ts
// packages/game-kit/src/testing/play-choices.ts — drives any pure rules module from a list of
// "choice" integers (fast-check generates them; choice % legalMoves.length picks the move).
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';

/** The engine subset property tests need; any GameModule's engine satisfies it (docs/08). */
export type PlayableRules<TState, TMove, TEvent> = Pick<
  GameEngine<TState, TMove, TEvent>,
  'listMoves' | 'applyMove'
>;

export type PlayLog<TState, TEvent> = {
  readonly states: readonly TState[];
  readonly events: readonly TEvent[];
};

export function playChoices<TState, TMove, TEvent>(
  rules: PlayableRules<TState, TMove, TEvent>,
  start: TState,
  choices: readonly number[],
): PlayLog<TState, TEvent> {
  const states: TState[] = [start];
  const events: TEvent[] = [];
  let state = start;
  for (const choice of choices) {
    const moves = rules.listMoves(state);
    const move = moves[choice % Math.max(moves.length, 1)];
    if (move === undefined) {
      break;
    }
    const result = rules.applyMove(state, move);
    state = result.state;
    states.push(state);
    events.push(...result.events);
  }
  return { states, events };
}
```

Examples plus properties for a (simplified) Line Siege `applyMove`: determinism, invariants after any legal sequence, JSON round trip. The invariant helper sits outside the `it` so callbacks stay within `max-nested-callbacks` 4.

```ts
// apps/line-siege/src/rules/apply-move.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove, POINTS_PER_COLUMN } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';

import type { LineSiegeState } from './line-siege-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 2 ** 31 - 1 });
const difficultyArb = fc.integer({ min: 0, max: 3 });
const choicesArb = fc.array(fc.nat(), { maxLength: 60 });

function withColumnAlmostFull(state: LineSiegeState, col: number): LineSiegeState {
  const cells = state.cells.map((cell, index) =>
    index % state.cols === col && index >= state.cols ? 1 : cell,
  );
  return { ...state, cells, tray: [[[0, 0]]] };
}

function expectInvariants(states: readonly LineSiegeState[]): void {
  states.forEach((state, index) => {
    const previous = states[index - 1] ?? state;
    expect(state.score).toBeGreaterThanOrEqual(previous.score);
    const openColumns = new Set(
      state.cells.flatMap((cell, cellIndex) => (cell === 0 ? [cellIndex % state.cols] : [])),
    );
    expect(openColumns.size).toBe(state.cols);
  });
}

describe('applyMove', () => {
  describe('when a placement completes a column', () => {
    it('clears the column and emits a column-cleared event', () => {
      const start = withColumnAlmostFull(create(7, 0), 2);

      const { state, events } = applyMove(start, {
        kind: 'place-block',
        trayIndex: 0,
        col: 2,
        row: 0,
      });

      expect(events).toStrictEqual([
        { kind: 'block-placed', cells: [2] },
        { kind: 'column-cleared', col: 2 },
      ]);
      expect(state.cells.filter((_, index) => index % state.cols === 2)).toStrictEqual([
        0, 0, 0, 0, 0,
      ]);
      expect(state.score).toBe(POINTS_PER_COLUMN);
    });
  });

  describe('when the move is illegal', () => {
    it('throws instead of returning a corrupted state', () => {
      const start = create(7, 0);

      expect(() =>
        applyMove(start, { kind: 'place-block', trayIndex: 0, col: 99, row: 0 }),
      ).toThrow(RangeError);
    });

    it('throws for a tray slot that does not exist', () => {
      expect(() =>
        applyMove(create(7, 0), { kind: 'place-block', trayIndex: 5, col: 0, row: 0 }),
      ).toThrow(RangeError);
    });
  });

  describe('properties', () => {
    it('replays identically for the same seed and move choices', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const first = playChoices(RULES, create(seed, difficulty), choices);
          const second = playChoices(RULES, create(seed, difficulty), choices);
          expect(second).toStrictEqual(first);
        }),
      );
    });

    it('keeps a free cell in every column and never lowers the score', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          expectInvariants(states);
        }),
        { numRuns: 200 },
      );
    });

    it('survives a JSON round trip unchanged (the save format stores it as JSON)', () => {
      fc.assert(
        fc.property(seedArb, choicesArb, (seed, choices) => {
          const { states } = playChoices(RULES, create(seed, 1), choices);
          const last = states[states.length - 1];
          expect(JSON.parse(JSON.stringify(last)) as unknown).toStrictEqual(last);
        }),
      );
    });
  });
});
```

Pure infrastructure gets pinned golden values next to its properties. The model is docs/08 section 2.11's `packages/game-kit/src/rng/sfc32.test.ts`: an independent transcription of PractRand's C code as the oracle, the pinned seed-1 sequence (a daily-challenge compatibility contract), and determinism and range properties with fixed fast-check seeds. That file is the only RNG test; extend it rather than writing a second one.

Property checklist for every game (FINAL D.38): determinism (same seed and moves → same states), invariants after any legal sequence, save round trip, migration of any valid old save, solver soundness (a level declared winnable has a replayable winning line; the line is checked with `applyMove`, not trusted).

#### 3.8.2 Data goldens (levels and daily challenges)

Readable ASCII, so a diff in review shows what players would see. The daily goldens are a compatibility contract: every app version must generate the same level for the same date (spec 8.3). The seed comes from docs/06's `dailySeed(dateKey, salt)` (`@e07/game-kit/dates/daily-seed.ts`, section 8.1), the same function the Shell calls.

```ts
// apps/line-siege/src/levels/generate-level.golden.test.ts
// DATA GOLDEN. A diff here means players get different levels. Update only with
// `npx jest --selectProjects golden -u <this file>` plus a `Gate-Change:` commit trailer.
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { renderCells } from '@e07/game-kit/testing/render-cells.ts';

import { generateLevel } from './generate-level.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

const LINE_SIEGE_DAILY_SALT = 0x4c53;
const DAILY_DIFFICULTY = 2;

function describeLevel(seed: number, difficulty: number): string {
  const level = generateLevel(seed, difficulty);
  const tray = level.start.tray.map((piece) => JSON.stringify(piece)).join(' ');
  return [
    `seed ${String(seed)} difficulty ${String(difficulty)} target ${String(level.targetScore)}`,
    renderCells(level.start.cells, level.start.cols),
    `tray ${tray}`,
  ].join('\n');
}

describe('generateLevel goldens', () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 3],
  ])('generates the frozen layout for seed %i at difficulty %i', (seed, difficulty) => {
    expect(describeLevel(seed, difficulty)).toMatchSnapshot();
  });
});

describe('daily challenge goldens (hard compatibility contract)', () => {
  const dates: readonly DateKey[] = ['2026-09-26', '2026-12-31', '2027-01-01'];

  it.each(dates)('generates the frozen daily level for %s', (date) => {
    expect(
      describeLevel(dailySeed(date, LINE_SIEGE_DAILY_SALT), DAILY_DIFFICULTY),
    ).toMatchSnapshot();
  });
});
```

The snapshot is written to `generate-level.golden.test.ts.snap.ios` next to the test:

```
exports[`daily challenge goldens (hard compatibility contract) generates the frozen daily level for 2026-09-26 1`] = `
"seed 3211492107 difficulty 2 target 70
......#
.......
.#.....
..#....
.......
.#...#.
.#.....
tray [[0,0],[1,0]] [[0,0],[1,0],[0,1]] [[0,0]]"
`;
```

#### 3.8.3 Board pixel goldens

Two paths use the same draw function (FINAL B.12, B.22):

1. **Jest `golden` project + jest-image-snapshot**: the gate for every board. docs/08 owns the test itself (`test/goldens/boards/<game-id>-board.golden.test.ts`, docs/08 section 3 step 9): it renders through `paintBoardPng(Skia, request)` at three sizes × three timeline moments, loads the font explicitly and asserts with the matcher below. Tolerance `failureThreshold: 0.001` with `'percent'` means 0.1% of pixels. A regression prints `Expected image to match or be a close match to snapshot but was 3.7083333333333335% different from snapshot (6408 differing pixels)` and writes the diff PNG to `reports/visual/diff/`.
2. **Headless Skia in plain Node + pixelmatch**: for code-drawn art and board previews outside Jest (icon, splash, store art, the owner's gallery). Draw modules import only Skia *types* and receive every Skia object in `kit` (docs/08 rule 4), so plain Node imports them without React Native, and `paintBoardPng` takes the Skia API as a parameter.

Board goldens read the font with `node:fs` and use `Buffer`, so they live in `test/goldens/boards/` (rule 7). Assert small text such as HP digits with docs/08's recording-canvas test: a two-digit label is below the 0.1% tolerance.

```ts
// test/goldens/boards/skia-golden.ts — the pixel-golden matcher for every board golden (Jest 'golden'
// project, CanvasKit). docs/08's <game-id>-board.golden.test.ts files import it.
import { join } from 'node:path';

import { configureToMatchImageSnapshot } from 'jest-image-snapshot';

/** 0.1% of pixels may differ (CanvasKit anti-aliasing noise); diffs land in reports/visual/diff. */
export const toMatchPixelGolden = configureToMatchImageSnapshot({
  failureThreshold: 0.001,
  failureThresholdType: 'percent',
  customDiffDir: join(process.cwd(), 'reports', 'visual', 'diff'),
});
```

Headless Node path (all three files verified against docs/08's real Line Siege board: a missing baseline fails, `--update` writes the baselines, and a rerun matches with a diff ratio of 0):

```ts
// packages/tooling/src/visual/load-headless-skia.ts — the Skia API for plain Node (CanvasKit, no simulator).
// Board draw modules import only Skia TYPES and get every Skia object through `kit` (docs/08), so Node's
// type stripping loads none of React Native. Skia has no `exports` map: deep imports need `.js`.
import headless from '@shopify/react-native-skia/lib/commonjs/headless/index.js';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb.js';

import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';

export async function loadHeadlessSkia(): Promise<SkiaApi> {
  await LoadSkiaWeb();
  // The CommonJS build declares its own copy of the Skia types; the runtime API is the same (docs/09).
  return headless.getSkiaExports().Skia as unknown as SkiaApi;
}
```

```ts
// packages/tooling/src/visual/compare-png.ts — one comparator for headless board renders and
// simulator screenshots. Writes a diff PNG the agent can open with its Read tool.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';

export type PngComparison =
  | { readonly kind: 'match'; readonly diffRatio: number }
  | { readonly kind: 'mismatch'; readonly diffRatio: number; readonly diffPath: string }
  | { readonly kind: 'size-changed'; readonly expected: string; readonly actual: string }
  | { readonly kind: 'missing-baseline'; readonly baselinePath: string };

export type CompareOptions = {
  readonly baselinePath: string;
  readonly diffPath: string;
  readonly maxDiffRatio: number;
};

export function comparePng(actual: Buffer, options: CompareOptions): PngComparison {
  if (!existsSync(options.baselinePath)) {
    return { kind: 'missing-baseline', baselinePath: options.baselinePath };
  }
  const expectedPng = pngjs.PNG.sync.read(readFileSync(options.baselinePath));
  const actualPng = pngjs.PNG.sync.read(actual);
  const { width, height } = expectedPng;
  if (actualPng.width !== width || actualPng.height !== height) {
    return {
      kind: 'size-changed',
      expected: `${String(width)}x${String(height)}`,
      actual: `${String(actualPng.width)}x${String(actualPng.height)}`,
    };
  }
  const diff = new pngjs.PNG({ width, height });
  const pixels = pixelmatch(expectedPng.data, actualPng.data, diff.data, width, height, {
    threshold: 0.1,
  });
  const diffRatio = pixels / (width * height);
  if (diffRatio <= options.maxDiffRatio) {
    return { kind: 'match', diffRatio };
  }
  mkdirSync(dirname(options.diffPath), { recursive: true });
  writeFileSync(options.diffPath, pngjs.PNG.sync.write(diff));
  return { kind: 'mismatch', diffRatio, diffPath: options.diffPath };
}
```

```ts
// packages/tooling/src/visual/render-board-previews.ts
// Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/visual/render-board-previews.ts [--update]
// Renders board previews headlessly through docs/08's paintBoardPng (the device's own draw()), compares
// them with committed baselines (pixelmatch) and writes diff PNGs to reports/visual/boards/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { BOARD_PALETTES } from '@e07/line-siege/board/board-palettes.ts';
import { buildTimeline } from '@e07/line-siege/board/build-timeline.ts';
import { drawBoard } from '@e07/line-siege/board/draw-board.ts';
import { layoutBoard } from '@e07/line-siege/board/layout-board.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';

import { comparePng } from './compare-png.ts';
import { loadHeadlessSkia } from './load-headless-skia.ts';

import type { LineSiegeView } from '@e07/line-siege/board/to-view.ts';

const OUT_DIR = join('reports', 'visual', 'boards');
const BASELINE_DIR = join('apps', 'line-siege', 'e2e', 'baselines', 'boards');
const IS_UPDATE = process.argv.includes('--update');
const SIZES = [
  ['phone', 390, 560],
  ['tablet', 1024, 700],
] as const;

const skia = await loadHeadlessSkia();
const kit = makeBoardKit(skia, { paths: {}, numberTypeface: null, numberSize: 16 });
const colors = makeBoardColors(skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
const view: LineSiegeView = {
  cols: 8,
  rows: 8,
  cells: Array.from({ length: 64 }, (_, i) => (i % 8 === 3 ? 1 : 0)),
  monsters: [],
};
const tracks = buildTimeline([{ kind: 'column-cleared', col: 3 }], 'full');

function render(width: number, height: number): Buffer {
  const png = paintBoardPng(skia, {
    draw: drawBoard,
    layout: layoutBoard,
    view,
    tracks,
    elapsedMs: timelineEndMs(tracks) / 2,
    colors,
    kit,
    width,
    height,
    isMirrored: false,
  });
  return Buffer.from(png);
}

let failures = 0;
mkdirSync(OUT_DIR, { recursive: true });
for (const [name, width, height] of SIZES) {
  const png = render(width, height);
  const baselinePath = join(BASELINE_DIR, `${name}.png`);
  writeFileSync(join(OUT_DIR, `${name}.png`), png);
  if (IS_UPDATE) {
    mkdirSync(BASELINE_DIR, { recursive: true });
    writeFileSync(baselinePath, png);
    console.warn(`baseline written: ${baselinePath}`);
    continue;
  }
  const diffPath = join(OUT_DIR, `${name}.diff.png`);
  const result = comparePng(png, { baselinePath, diffPath, maxDiffRatio: 0.001 });
  console.warn(`${name}: ${JSON.stringify(result)}`);
  failures += result.kind === 'match' ? 0 : 1;
}
process.exitCode = failures === 0 ? 0 : 1;
```

Run it with `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/visual/render-board-previews.ts` (the flag silences Node's notice that `apps/*` packages have no `"type"` field; do not add `"type": "module"` to Expo apps). docs/09's `render-art.ts` can use the same `loadHeadlessSkia`. *Sources:* [Skia headless](https://shopify.github.io/react-native-skia/docs/getting-started/headless), [Node type stripping](https://nodejs.org/api/typescript.html), [pixelmatch](https://github.com/mapbox/pixelmatch), [jest-image-snapshot](https://github.com/americanexpress/jest-image-snapshot).

#### 3.8.4 Bot simulations (`*.sim.test.ts`)

A bot is a pure policy `(state, legalMoves, rng) → { move, rng }`. docs/08 owns the harness (`packages/game-kit/src/testing/play-bot.ts`: `playBot(game, { seed, difficulty, policy, maxMoves })` returns `{ outcome, moves }`, and `randomPolicy()` is the baseline bot); any `GameModule` engine satisfies its `BotGame` type.

The sim asserts properties of many games, not single outcomes, and writes a report the owner can read. It runs in plain Node (`jest.sim.config.js`), which also proves the rules need no React Native mock:

```ts
// test/sims/line-siege/balance.sim.test.ts — BOT SIMULATION. Slow: `npm run test:sim` only.
// Root test/ folder: it writes reports/sim/*.json with node:fs (only the root tsconfig has Node types).
import { mkdirSync, writeFileSync } from 'node:fs';

import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { create } from '@e07/line-siege/rules/create.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';
import { outcome } from '@e07/line-siege/rules/outcome.ts';

import type { BotGame, BotPolicy, BotRun } from '@e07/game-kit/testing/play-bot.ts';
import type {
  LineSiegeEvent,
  LineSiegeMove,
  LineSiegeState,
} from '@e07/line-siege/rules/line-siege-types.ts';

const GAME: BotGame<LineSiegeState, LineSiegeMove, LineSiegeEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
};
const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);
const MAX_MOVES = 2_000;

/** Greedy: the move with the best immediate score. It needs no randomness, so rng passes through. */
const greedy: BotPolicy<LineSiegeState, LineSiegeMove> = (state, moves, rng) => {
  let best = moves[0];
  let bestScore = -1;
  for (const move of moves) {
    const score = applyMove(state, move).state.score;
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  if (best === undefined) {
    throw new Error('bot called without legal moves');
  }
  return { move: best, rng };
};

function playAll(difficulty: number): BotRun[] {
  return SEEDS.map((seed) =>
    playBot(GAME, { seed, difficulty, policy: greedy, maxMoves: MAX_MOVES }),
  );
}

function median(runs: readonly BotRun[]): number {
  const sorted = runs.map((run) => run.moves).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

describe('Line Siege bot simulations', () => {
  const byDifficulty = [0, 1, 2, 3].map((difficulty) => ({
    difficulty,
    runs: playAll(difficulty),
  }));

  afterAll(() => {
    mkdirSync('reports/sim', { recursive: true });
    const summary = byDifficulty.map(({ difficulty, runs }) => ({
      difficulty,
      medianMoves: median(runs),
    }));
    writeFileSync('reports/sim/line-siege.json', `${JSON.stringify(summary, null, 2)}\n`);
  });

  it('ends every game without an exception or a stuck state', () => {
    byDifficulty.forEach(({ runs }) => {
      expect(runs.every((run) => run.moves < MAX_MOVES)).toBe(true);
    });
  });

  it('produces identical results when replayed with the same seeds', () => {
    expect(playAll(2)).toStrictEqual(byDifficulty[2]?.runs);
  });

  it('keeps the greedy bot alive longer on bigger boards', () => {
    const medians = byDifficulty.map(({ runs }) => median(runs));

    expect(medians).toStrictEqual([...medians].sort((a, b) => a - b));
  });
});
```

What every game's sims check: no exception and no endless game within the cap; identical results on replay; a sensible difficulty curve (median moves, win rate or score per difficulty inside owner-approved bands, recorded in the game's design notes); every shipped level solvable by the solver bot (spec 15 item 7). Keep one sim file under about 60 s; split by difficulty or pack otherwise.

#### 3.8.5 Save and migration tests on `node:sqlite`

docs/06 owns the save stack and its tests; this doc only fixes where they run and what they must cover. The pieces (the three test files that exist today passed under this doc's `jest.config.js`, in the `unit` project on Node 26's built-in `node:sqlite`; migration-step tests start with v2):

| Piece | File (owner) |
|---|---|
| `SqlDriver`, `ClosableSqlDriver` | `packages/shell/src/services/save/sql-driver.ts` (docs/02 section 6.2) |
| Node driver for Jest and tooling | `test/integration/save/node-sqlite-sql-driver.ts`, `createNodeSqliteSqlDriver(path)` (docs/06 section 6.4) |
| Real SQL: WAL + `synchronous` FULL, reload, backup restore + quarantine, rollback, checkpoint | `test/integration/save/sqlite-save-store.test.ts` (docs/06 section 6.12) |
| Every branch of the load plan (fresh, loaded, restored, newer version never written, both damaged, other game's save) | `packages/shell/src/services/save/load-plan.test.ts` (docs/06) |
| Frozen fixtures: checksum pinned, decode, round trip | `packages/shell/src/services/save/fixtures/save-fixtures.test.ts` (docs/06 section 6.11) |
| Each migration step: fixture → exact next version, plus a fast-check property over valid old documents | `packages/shell/src/services/save/migrations/v<N>-to-v<N+1>.test.ts` (docs/06 section 6.11) |

`node:sqlite` rows have a null prototype, so the driver copies them before `toStrictEqual` (docs/06). The last line of defence is on the simulator: docs/06 section 6.13's kill test (`kill -9` during startup writes, `inspect-save` after each batch) plus this doc's Maestro `killApp` steps (section 3.11). *Source:* [Node `node:sqlite`](https://nodejs.org/api/sqlite.html).

#### 3.8.6 `adPolicy` and Premium with fakes

**Precedence.** docs/11 owns `ad-policy.ts`, `ad-history.ts`, `AdsPort`, `fake-ads.ts` (`createFakeAds`) and their tests (docs/11 section 3.14). docs/12 owns `PurchasePort`, `fake-purchase.ts` (`createFakePurchase(script)`), the Premium reducer and service, and their tests (`premium-reducer.test.ts`, `premium-service.test.ts`). This doc sets the patterns those tests follow:

- **Policies** (spec 8.8) get a table of "blocks when …" cases, every numeric limit as its own example at exactly the limit (3 levels, 180 000 ms, 2 levels since the last ad), and one property ("a Premium player never sees an ad").
- **Services over fakes** get one test per S12 state. The fake records an ordered call log shared with the persistence stub, so "persist Premium, then finish" is one `toStrictEqual` on the log.
- **Mutation:** run Stryker on the policy and the reducer when they change, and kill every survivor with a boundary example, never by relaxing thresholds.

Stryker on docs/11's `ad-policy.ts` (23 s) left two survivors that its table and property did not kill:

```
[Survived] EqualityOperator  packages/shell/src/services/ads/ad-policy.ts:56:27
-  return last === null || last > nowMs ? null : nowMs - last;
+  return last === null || last >= nowMs ? null : nowMs - last;
[Survived] EqualityOperator  packages/shell/src/services/ads/ad-policy.ts:67:7
-  if (context.levelsCompletedTotal < config.minLevelsCompletedBeforeFirst) return false;
+  if (context.levelsCompletedTotal <= config.minLevelsCompletedBeforeFirst) return false;
```

These two cases, added inside `describe('shouldShowInterstitial')` of docs/11's `ad-policy.test.ts` (they use its `request`, `at`, `READY`, `AFTER_TWO_WINS` and `T0`), kill both: 41 of 41 mutants. docs/11's `ad-policy.test.ts` now contains both cases (added in the integration pass and re-run there).

```ts
  it('allows the first interstitial at exactly 3 completed levels', () => {
    const exactly = { ...READY, levelsCompletedTotal: 3 };
    expect(shouldShowInterstitial(request({ context: exactly }))).toBe(true);
  });

  it('blocks an interstitial in the same millisecond as the last one', () => {
    expect(shouldShowInterstitial(at(AFTER_TWO_WINS, 'win', T0))).toBe(false);
  });
```

docs/12's service tests let promise callbacks settle with this doc's helper, without fake timers:

```ts
// packages/shell/src/testing/flush-microtasks.ts — lets queued promise callbacks run (no fake timers needed).
export function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
```

#### 3.8.7 Component tests with RNTL 14 (async)

Every component renders through one helper. It builds in memory what docs/06's `createShellApp` builds: a first-launch save over the fake `SaveStore`, the test's seed written through `SaveService.update`, and the stores created from that save by their real factories (`createSettingsStore`, docs/12's `createPremiumStore`) behind `StoresProvider`. Around them sit docs/10's `I18nProvider` (real Shell catalogs; a missing message throws) and `DirectionProvider`, docs/05's `ThemeProvider` over `TEST_PALETTE` (so `settings.theme` and `settings.colorBlind` pick the theme) and docs/02's `ServicesProvider`. A test passes only the ports it uses; any other port throws on first use and names itself. Options, all optional:

| Option | Default | Effect |
|---|---|---|
| `language` | `'en'` | the `I18nProvider` language |
| `direction` | the language's own (`fa`, `ckb`: `'rtl'`) | the `DirectionProvider` value |
| `palette` | `TEST_PALETTE` (docs/05) | the colours `ThemeProvider` picks from |
| `settings` | docs/06's `DEFAULT_SETTINGS` | a `Partial<SaveSettings>` written into the save before the stores exist |
| `isPremium` | `false` | the save's `premium` section says owned |
| `services` | none | the fakes; `save` defaults to the seeded in-memory save |

The result is RNTL's plus `stores`, so a test changes state the way the app does: `await act(() => { stores.premium.getState().dispatch({ type: 'premium-granted' }); })`. Every render gets fresh stores, so nothing leaks between tests.

```tsx
// packages/shell/src/testing/render-with-shell.tsx — every component test renders through this.
// It builds in memory what createShellApp builds (docs/06 section 7.2): a first-launch save over the
// fake SaveStore, the test's seed written through SaveService.update, the stores created from that
// save by their real factories, docs/05's ThemeProvider over the test palette, and docs/10's
// I18nProvider (real Shell catalogs; a missing message throws) and DirectionProvider. Only the ports
// the test passes exist: any other port throws on first use and names itself.
import { render } from '@testing-library/react-native';

import { ServicesProvider } from '@e07/shell/app/services-context.tsx';
import { StoresProvider } from '@e07/shell/app/stores-context.tsx';
import { DirectionProvider } from '@e07/shell/i18n/direction-context.tsx';
import { I18nProvider } from '@e07/shell/i18n/i18n-provider.tsx';
import { directionOf } from '@e07/shell/i18n/languages.ts';
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';
import { createPremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { createSettingsStore } from '@e07/shell/stores/settings-store.ts';
import { ThemeProvider } from '@e07/shell/theme/theme-provider.tsx';
import { createThemeSet } from '@e07/shell/theme/theme-set.ts';

import { TEST_PALETTE } from './test-palette.ts';

import type { Services } from '@e07/shell/app/services-context.tsx';
import type { ShellStores } from '@e07/shell/app/stores-context.tsx';
import type { Direction, Language } from '@e07/shell/i18n/languages.ts';
import type { Catalog } from '@e07/shell/i18n/messages.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';
import type { Palette } from '@e07/shell/theme/theme-types.ts';
import type { RenderResult } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

export type RenderWithShellOptions = {
  /** The UI language (what resolveLanguage picked at boot). Default 'en'. */
  readonly language?: Language;
  /** The layout direction. Default: the language's own (fa and ckb are 'rtl'). */
  readonly direction?: Direction;
  /** Theme colours. Scheme and mode follow settings.theme and settings.colorBlind. */
  readonly palette?: Palette;
  /** Saved settings, written before the stores exist, like a save loaded at boot. */
  readonly settings?: Partial<SaveSettings>;
  /** The save's premium section says owned, as after a purchase or a restore. */
  readonly isPremium?: boolean;
  /** The fakes the test uses. `save` defaults to the seeded in-memory save. */
  readonly services?: Partial<Services>;
};

export type ShellWrapper = {
  readonly wrapper: (props: { readonly children: ReactNode }) => ReactNode;
  /** The stores the tree reads; dispatch on them to change state from outside React. */
  readonly stores: ShellStores;
};

export type ShellRenderResult = RenderResult & { readonly stores: ShellStores };

const NO_GAME: Readonly<Record<Language, Catalog>> = { en: {}, de: {}, fa: {}, ckb: {} };
/** 2026-09-26 12:00 UTC. The save's clock unless the test passes services.clock. */
const TEST_CLOCK: ClockPort = { nowMs: () => 1_790_424_000_000, today: () => '2026-09-26' };
/** An invalid seed fails the test with the validation error itself. */
const THROWING_ERROR_LOG: ErrorLogPort = {
  record: (_source, error) => {
    throw error;
  },
  entries: () => [],
};

function failOnMissingMessage(error: Error): never {
  throw error;
}

/** A port the test did not pass: reading any member throws an error that names the port. */
function missingPort<TName extends keyof Services>(name: TName): Services[TName] {
  return new Proxy({} as Services[TName], {
    get: (_target, member) => {
      throw new Error(`renderWithShell: pass services.${name} (read .${String(member)})`);
    },
  });
}

/** Every port: the test's fake where it passed one, a throwing stand-in otherwise. */
export function createTestServices(services: Partial<Services> = {}): Services {
  const port = <TName extends keyof Services>(name: TName): Services[TName] =>
    services[name] ?? missingPort(name);
  return {
    ads: port('ads'),
    audio: port('audio'),
    clock: port('clock'),
    connectivity: port('connectivity'),
    consent: port('consent'),
    errorLog: port('errorLog'),
    haptics: port('haptics'),
    purchase: port('purchase'),
    save: port('save'),
  };
}

/** A first launch as docs/06's hydrateSave runs it: empty slots -> default document -> writes. */
function createFirstLaunchSave(services: Partial<Services>): SaveService {
  const plan = planLoad({ current: null, backup: null, gameId: 'shell-test' });
  const deps = {
    store: createFakeSaveStore(),
    clock: services.clock ?? TEST_CLOCK,
    errorLog: services.errorLog ?? THROWING_ERROR_LOG,
    appVersion: '1.0.0',
    isStrict: true,
  };
  const save = createSaveService(deps, plan, 0);
  save.applyLoadWrites();
  return save;
}

/** Writes the seed through the single writer (validated), before any store reads the save. */
function seedSave(save: SaveService, options: RenderWithShellOptions): void {
  const { settings, isPremium = false } = options;
  if (settings === undefined && !isPremium) return;
  save.update((doc) => ({
    ...doc,
    settings: { ...doc.settings, ...settings },
    premium: isPremium
      ? { ...doc.premium, owned: true, ownedSinceMs: TEST_CLOCK.nowMs(), revokedAtMs: null }
      : doc.premium,
  }));
}

/** The provider tree for render() and renderHook(), and the stores it provides. */
export function createShellWrapper(options: RenderWithShellOptions = {}): ShellWrapper {
  const language = options.language ?? 'en';
  const save = options.services?.save ?? createFirstLaunchSave(options.services ?? {});
  seedSave(save, options);
  // The same factories, from the same document, as createShellApp.
  const stores = { settings: createSettingsStore(save), premium: createPremiumStore(save) };
  const services = createTestServices({ ...options.services, save });
  const themes = createThemeSet(options.palette ?? TEST_PALETTE);
  const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
    <I18nProvider
      language={language}
      digits={save.doc().settings.digits}
      gameCatalogs={NO_GAME}
      onError={failOnMissingMessage}
    >
      <DirectionProvider direction={options.direction ?? directionOf(language)}>
        <StoresProvider stores={stores}>
          <ThemeProvider themes={themes}>
            <ServicesProvider services={services}>{children}</ServicesProvider>
          </ThemeProvider>
        </StoresProvider>
      </DirectionProvider>
    </I18nProvider>
  );
  return { wrapper, stores };
}

export async function renderWithShell(
  ui: ReactElement,
  options: RenderWithShellOptions = {},
): Promise<ShellRenderResult> {
  const { wrapper, stores } = createShellWrapper(options);
  const result = await render(ui, { wrapper });
  return Object.assign(result, { stores });
}
```

The helper's own test shows the RNTL 14 pattern on a probe that uses a port, the Premium store, the catalog and docs/05's `AppText` and `PrimaryButton` the way a screen does. The real component tests are docs/05's `primary-button.test.tsx`, `premium-entry.test.tsx` and `icon-button.test.tsx`, docs/10's `t.test.tsx` and docs/15's `level-grid.test.tsx`.

```tsx
// packages/shell/src/testing/render-with-shell.test.tsx — the RNTL 14 async pattern on a probe that
// uses a port, a store, the catalog and a docs/05 primitive the way a screen does. Real screens:
// docs/05, 12, 15.
import { act, screen, userEvent } from '@testing-library/react-native';
import { useEffect, useState } from 'react';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { isolate } from '@e07/shell/i18n/bidi.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { createFakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { PrimaryButton } from '@e07/shell/ui/primary-button.tsx';

import { renderWithShell } from './render-with-shell.tsx';

import type { FakePurchaseScript } from '@e07/shell/services/purchase/fake-purchase.ts';
import type { StoreProduct } from '@e07/shell/services/purchase/purchase-port.ts';
import type { ReactNode } from 'react';

const PRODUCT: StoreProduct = {
  productId: 'premium',
  displayPrice: '€1.99',
  price: 1.99,
  currency: 'EUR',
};
// t() wraps {priceText} in FSI/PDI (docs/10), so the accessible name contains the isolates too.
const BUY_NAME = `Buy – ${isolate('€1.99')}`;

function BuyProbe(): ReactNode {
  const t = useT();
  const { purchase } = useServices();
  const isPremium = usePremiumStore((state) => state.isPremium);
  const [price, setPrice] = useState<string | null>(null);
  useEffect(() => {
    purchase
      .fetchProduct(PRODUCT.productId)
      .then((product) => {
        setPrice(product?.displayPrice ?? null);
      })
      .catch(() => undefined);
  }, [purchase]);
  const handleBuy = (): void => {
    purchase.requestPurchase(PRODUCT.productId).catch(() => undefined);
  };
  if (isPremium) {
    return <AppText text={t('premium.active')} />;
  }
  return price === null ? null : (
    <PrimaryButton
      label={t('premium.buy-button', { priceText: price })}
      onPress={handleBuy}
      testID="premium.buy-button"
    />
  );
}

/** Shows what the seeded stores and the ThemeProvider resolved. */
function SeedProbe(): ReactNode {
  const theme = useTheme();
  const volume = useSettingsStore((state) => state.settings.soundVolume);
  return <AppText text={`${theme.key} ${String(volume)}`} testID="probe.seed" />;
}

function scriptWith(product: StoreProduct | null): FakePurchaseScript {
  return { isConnected: true, product, restoreResult: 'synced', transactions: [], calls: [] };
}

describe('renderWithShell', () => {
  it('shows what a port loads once its promise settles', async () => {
    const purchase = createFakePurchase(scriptWith(PRODUCT));
    await renderWithShell(<BuyProbe />, { services: { purchase } });

    expect(await screen.findByRole('button', { name: BUY_NAME })).toBeEnabled();
  });

  it('sends a press through the injected port', async () => {
    const user = userEvent.setup();
    const script = scriptWith(PRODUCT);
    await renderWithShell(<BuyProbe />, {
      services: { purchase: createFakePurchase(script) },
    });

    await user.press(await screen.findByRole('button', { name: BUY_NAME }));

    expect(script.calls).toStrictEqual(['fetchProduct', 'requestPurchase']);
  });

  it('updates when a store changes outside React', async () => {
    const purchase = createFakePurchase(scriptWith(PRODUCT));
    const { stores } = await renderWithShell(<BuyProbe />, { services: { purchase } });
    await screen.findByRole('button', { name: BUY_NAME });

    await act(() => {
      stores.premium.getState().dispatch({ type: 'premium-granted' });
    });

    expect(screen.getByText('Premium - active')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('starts from the seeded save', async () => {
    const purchase = createFakePurchase(scriptWith(PRODUCT));
    const { stores } = await renderWithShell(<BuyProbe />, {
      isPremium: true,
      services: { purchase },
    });

    expect(screen.getByText('Premium - active')).toBeOnTheScreen();
    expect(stores.premium.getState().isPremium).toBe(true);
  });

  it('derives the theme from the seeded settings', async () => {
    await renderWithShell(<SeedProbe />, {
      settings: { theme: 'dark', colorBlind: true, soundVolume: 35 },
    });

    expect(screen.getByTestId('probe.seed')).toHaveTextContent('colorBlind.dark 35');
  });

  it('names a port the test forgot to pass', async () => {
    await expect(renderWithShell(<BuyProbe />)).rejects.toThrow(
      'renderWithShell: pass services.purchase',
    );
  });
});
```

Notes that save time:

- A plain `View` with `role` needs `accessible` to be found by `getByRole`; `Pressable` is accessible by default. `toBeDisabled()` reads `aria-disabled`/`accessibilityState` (set by `Pressable`'s `disabled`).
- Names built by `t()` contain FSI/PDI around `…Name`/`…Text` arguments: compare with `isolate()` (as above) or strip them with `stripIsolates()` (docs/10 `bidi.ts`).
- Hooks: `await renderHook(() => useX(), { wrapper: createShellWrapper(options).wrapper })`; `createShellWrapper` also returns the `stores`. Gestures: give the gesture `.withTestId('pan')`, then `await act(() => { fireGestureHandler(getByGestureTestId('pan'), [...]) })` (verified in the probes).
- Jest has no Yoga layout and `@react-native/jest-preset` mocks `I18nManager.isRTL = false`: test direction logic as pure functions and `AppText` style props under an explicit `DirectionProvider`; judge mirroring only on screenshots (docs/10).
- Screens that host a Skia board: the board host is injected; in `unit` tests render the screen with a stub board component from the fake `GameModule`, and test the board in the `golden` project.
- Components that read a store (docs/06 section 4.2) need nothing extra: seed the state with `settings` or `isPremium` and change it by dispatching on the returned `stores`. Never mock a store module and never build a module-level store. When docs/06 adds the progress and stats stores to `ShellStores`, add their factories to `createShellWrapper` in the same commit.

#### 3.8.8 Frame-clock tests with a fake `FrameInfo` sequence (the `startAt` fix)

Reanimated resets `timeSinceFirstFrame` to 0 whenever a frame callback is re-activated, so a clock that stores `t0` from it freezes every animation after the first move (FINAL B.12). docs/08 section 2.5 owns the clock: `packages/shell/src/game-host/board-scene.ts` with `makeScene`, `NOT_STARTED` and `tickClock(scene, timestamp)`. The test below ran against docs/08's module and `Track` type verbatim; its fake `FrameInfo` sequences reproduce Reanimated's reset on every re-activation. docs/08 section 5 lists more cases for the same file (`sceneElapsedMs`, the exact end frame): `board-scene.test.ts` is one file holding both sets.

```ts
// packages/shell/src/game-host/board-scene.test.ts — drives docs/08's frame clock with fake FrameInfo
// sequences that behave like Reanimated 4.5: timeSinceFirstFrame restarts at 0 after every setActive(true).
import { makeScene, NOT_STARTED, tickClock, type BoardScene } from './board-scene.ts';

import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { FrameInfo } from 'react-native-reanimated';

const BEAM: Track = {
  channel: 'beam',
  entityId: 1,
  startMs: 0,
  durationMs: 32,
  easing: 'linear',
  from: [0],
  to: [1],
};

type Sample = { readonly elapsedMs: number; readonly isDone: boolean };

/** One activation of the frame callback: timestamps continue, timeSinceFirstFrame restarts. */
function activation(firstTimestamp: number, count: number): FrameInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: firstTimestamp + i * 16,
    timeSinceFirstFrame: i * 16,
    timeSincePreviousFrame: i === 0 ? null : 16,
  }));
}

/** Mirrors the frame callback: stamp startAt once, then measure from it. */
function play(scene: BoardScene<string>, frames: readonly FrameInfo[]): Sample[] {
  let current = scene;
  return frames.map((frame) => {
    const tick = tickClock(current, frame.timestamp);
    current = { ...current, startAt: tick.startAt };
    return { elapsedMs: tick.elapsedMs, isDone: tick.isDone };
  });
}

const EXPECTED: readonly Sample[] = [
  { elapsedMs: 0, isDone: false },
  { elapsedMs: 16, isDone: false },
  { elapsedMs: 32, isDone: true },
];

describe('tickClock', () => {
  it('starts a freshly pushed scene at elapsed 0 on its first frame', () => {
    expect(play(makeScene(1, 'first', [BEAM]), activation(1_000, 3))).toStrictEqual(EXPECTED);
  });

  it('animates the next move from 0 after the frame callback was stopped and restarted', () => {
    play(makeScene(1, 'first', [BEAM]), activation(1_000, 3));
    const restarted = activation(5_000, 3);

    expect(restarted[0]?.timeSinceFirstFrame).toBe(0);
    expect(play(makeScene(2, 'second', [BEAM]), restarted)).toStrictEqual(EXPECTED);
  });

  it('restarts timing when a new scene replaces one that is still animating', () => {
    const first = tickClock(makeScene(1, 'first', [BEAM]), 1_000);
    const replacement = tickClock(makeScene(2, 'second', [BEAM]), 1_016);

    expect(first.elapsedMs).toBe(0);
    expect(replacement).toStrictEqual({ startAt: 1_016, elapsedMs: 0, isDone: false });
  });

  it('keeps an already stamped scene on its own start time', () => {
    const stamped = { ...makeScene(1, 'first', [BEAM]), startAt: 1_000 };

    expect(tickClock(stamped, 1_040)).toStrictEqual({
      startAt: 1_000,
      elapsedMs: 40,
      isDone: true,
    });
    expect(stamped.startAt).not.toBe(NOT_STARTED);
  });
});
```

Two guardrail tests keep UI-thread modules honest (FINAL B.15). docs/08 owns the import check: `packages/tooling/src/quality/check-worklet-boundary.ts` and its test fail when a `'worklet'` module imports a value from a JS-only module, or when a file in `game-kit/src/{rng,geom,timeline}`, `apps/*/src/board/{draw,layout}*` or `apps/*/src/sim/` lacks the directive. This doc adds the proof that the Babel plugin really workletizes directive files (the test `jest.config.js` skips inside Stryker):

```ts
// packages/tooling/src/quality/worklet-transform.test.ts — proves the Worklets Babel plugin really
// workletizes files that use the file-level 'worklet' directive after a leading path comment.
import { tickClock } from '@e07/shell/game-host/board-scene.ts';

describe('file-level worklet directive', () => {
  it('compiles every top-level function of a directive file into a worklet', () => {
    expect(tickClock).toHaveProperty('__workletHash', expect.any(Number));
  });
});
```

### 3.9 Coverage

- `npm run test:coverage` runs both projects with `--randomize`; `verify` includes it (docs/16). Output: `reports/coverage/coverage-summary.json` (numbers for the evidence report) and `lcov-report/index.html`.
- `collectCoverageFrom` counts `apps/*/src` and `packages/*/src`, except tests, `*.d.ts`, `fixtures/`, `testing/` and `packages/tooling` (tooling scripts drive `xcodebuild` and `simctl` and are verified by running them; their pure helpers still get tests).
- Tests under `test/` count toward the source files they exercise (the save threshold is met by `test/integration/save/`).
- Put the `noUncheckedIndexedAccess` guard for "index out of range" in one tested helper (for example `pickAt(list, index)` in `packages/game-kit/src/rng/`, a `'worklet'` module like the rest of that folder, docs/08 rule 11) instead of repeating an unreachable `if (x === undefined) throw` in every rules file; unreachable branches otherwise cap branch coverage below 90%.
- Directory keys (`./packages/game-kit/src/`) are checked as one total; the glob key `./apps/*/src/rules/**/*.ts` is checked file by file, and files matched by any key are left out of the `global` numbers (Jest semantics).
- Coverage is necessary, not sufficient: in the verification repo, line coverage was 97.8% while the mutation score was 77.1%.

### 3.10 Mutation testing (Stryker)

```jsonc
// stryker.config.json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "packageManager": "npm",
  "testRunner": "jest",
  "jest": {
    "projectType": "custom",
    "configFile": "jest.config.js",
    "enableFindRelatedTests": true
  },
  "checkers": ["typescript"],
  "tsconfigFile": "tsconfig.stryker.json",
  "mutate": [
    "packages/game-kit/src/**/*.ts",
    "apps/*/src/rules/**/*.ts",
    "apps/*/src/levels/**/*.ts",
    "packages/shell/src/services/save/**/*.ts",
    "packages/shell/src/**/*-policy.ts",
    "packages/shell/src/**/*-reducer.ts",
    "!**/*.test.ts",
    "!**/testing/**",
    "!**/fixtures/**",
    "!test/**"
  ],
  "ignorePatterns": [
    "apps/*/ios",
    "apps/*/android",
    "apps/*/build",
    "reports",
    "coverage",
    "tools"
  ],
  "coverageAnalysis": "perTest",
  "incremental": true,
  "incrementalFile": "reports/stryker/incremental.json",
  "ignoreStatic": true,
  "thresholds": { "high": 90, "low": 80, "break": 75 },
  "reporters": ["clear-text", "progress", "json", "html"],
  "jsonReporter": { "fileName": "reports/stryker/mutation.json" },
  "htmlReporter": { "fileName": "reports/stryker/mutation.html" },
  "tempDirName": ".stryker-tmp",
  "concurrency": 4
}
```

```jsonc
// tsconfig.stryker.json — the app-world program for Stryker's TypeScript checker (see the bullets below)
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "types": ["jest"],
    "tsBuildInfoFile": "${configDir}/node_modules/.cache/tsc/stryker.tsbuildinfo"
  },
  "include": ["apps/*/src/**/*", "packages/game-kit/src/**/*", "packages/shell/src/**/*"],
  "exclude": ["packages/shell/src/config/**/*"]
}
```

(The first comment line in each block is the path for the reader; the files themselves start with `{`.)

- **Scope:** logic only: `game-kit`, `apps/*/src/{rules,levels}`, the save service, and every `*-policy.ts` and `*-reducer.ts` in the Shell. UI is covered by E2E and screenshots.
- **Time:** one file 20-30 s; the whole logic set of a verification repo 1.5-2 min. `incremental` reuses results for unchanged code.
- **Reading results:** `reports/stryker/mutation.html` lists each survivor with the mutated line and the tests that ran. For each survivor: add the missing example (usually a boundary) or delete dead code. An "equivalent mutant" (no observable change) is noted in the evidence report, never hidden with `// Stryker disable` (inline config is off repo-wide).
- The TypeScript checker needs `tsconfig.stryker.json` to type-check cleanly; mutants that do not compile count as errors, not kills. It is an app-world program (`jest` types, no `test/**`): docs/04's `app-env.d.ts` declares its own `process`, which clashes with `@types/node` in a combined program (verified: `Property 'cwd' does not exist`), and the tests under `test/` are type-checked by the root program anyway. Its own `tsBuildInfoFile` keeps it from overwriting the root program's build info.
- Stryker workers compile without the Worklets/Reanimated Babel plugins (`babel.config.js`, section 3.3). The logic is identical as plain JS, and the file-level-worklet modules (`game-kit` geom, timeline, sims) stay in scope.

### 3.11 End-to-end with Maestro

#### Install (no Homebrew)

```sh
#!/usr/bin/env bash
# packages/tooling/scripts/install-maestro.sh — Maestro CLI without Homebrew: pinned GitHub zip + SHA-256.
# Idempotent. Installs into <repo>/tools/maestro (gitignored). Re-verify the pin: see docs/07-testing-and-tdd.md.
set -euo pipefail

MAESTRO_VERSION="2.10.0"
MAESTRO_SHA256="29b675e10cc12080e445e9bfb2e2b4e4dfb9c0f2e30d5884120d258b5e1cd991"
URL="https://github.com/mobile-dev-inc/Maestro/releases/download/cli-${MAESTRO_VERSION}/maestro.zip"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DEST="${REPO_ROOT}/tools/maestro"
CACHE_DIR="${MAESTRO_CACHE_DIR:-${HOME}/Library/Caches/e07}"
ZIP="${CACHE_DIR}/maestro-${MAESTRO_VERSION}.zip"

if [[ -x "${DEST}/bin/maestro" && "$(cat "${DEST}/.version" 2>/dev/null)" == "${MAESTRO_VERSION}" ]]; then
  echo "maestro ${MAESTRO_VERSION} already installed in ${DEST}"
  exit 0
fi

mkdir -p "${CACHE_DIR}"
if [[ ! -f "${ZIP}" ]]; then
  curl -fsSL --retry 3 -o "${ZIP}.part" "${URL}"
  mv "${ZIP}.part" "${ZIP}"
fi
if ! echo "${MAESTRO_SHA256}  ${ZIP}" | shasum -a 256 -c - >/dev/null; then
  echo "SHA-256 mismatch for ${ZIP}; deleting it. Do NOT update the pin without re-verifying the release." >&2
  rm -f "${ZIP}"
  exit 1
fi

rm -rf "${DEST}"
mkdir -p "$(dirname "${DEST}")"
unzip -q "${ZIP}" -d "$(dirname "${DEST}")"
echo "${MAESTRO_VERSION}" > "${DEST}/.version"
"${DEST}/bin/maestro" --version
```

It keeps the 315 MB zip in `~/Library/Caches/e07/` so worktrees share it. Changing the pin: read the release page, compare `checksums_sha256.txt`, update both lines, commit with `Gate-Change:`. *Source:* [Maestro cli-2.10.0 release](https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.10.0).

#### Run (`npm run e2e:ios -- --app <game-id>`)

```ts
// packages/tooling/src/e2e/run-e2e-ios.ts — `npm run e2e:ios -- --app <game-id> [maestro test options]`
// Needs a Release simulator build of the test variant with ADS_MODE=off (docs/14). Runs the Shell's and
// the game's flows on a dedicated simulator while docs/13's layer-F sampler watches the app's sockets;
// writes reports/e2e/<game-id>/junit.xml, network.txt and per-flow artefacts.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  ensureSimulator,
  findSimulatorBuild,
  maestroEnv,
  prepareSimulator,
  readAppInfo,
  setAppearance,
  type AppInfo,
} from '@e07/tooling/e2e/simulator.ts';

const MAESTRO = join('tools', 'maestro', 'bin', 'maestro');
const SOCKET_SAMPLER = join('packages', 'tooling', 'src', 'audit', 'sample-sockets.ts');

type Cli = { readonly game: string; readonly appPath: string | undefined; readonly rest: string[] };
type E2eRun = {
  readonly cli: Cli;
  readonly udid: string;
  readonly app: AppInfo;
  readonly out: string;
};

function parseCli(argv: readonly string[]): Cli {
  const rest = [...argv];
  const take = (flag: string): string | undefined => {
    const index = rest.indexOf(flag);
    return index === -1 ? undefined : rest.splice(index, 2)[1];
  };
  const game = take('--app');
  if (game === undefined) {
    throw new Error('usage: npm run e2e:ios -- --app <game-id> [maestro test options]');
  }
  return { game, appPath: take('--app-path'), rest };
}

function maestroArgs({ cli, udid, app, out }: E2eRun): string[] {
  // Maestro does not recurse into sub-folders: list the <area>/<nn>-<name>.yaml files explicitly.
  const flows = [
    ...globSync('packages/shell/e2e/flows/*/*.yaml'),
    ...globSync(`apps/${cli.game}/e2e/flows/*/*.yaml`),
  ].sort();
  return [
    'test',
    ...flows,
    ...['--udid', udid, '--format', 'JUNIT', '--output', join(out, 'junit.xml')],
    ...['--test-output-dir', out, '--exclude-tags', 'quarantine'],
    ...['-e', `APP_ID=${app.id}`, '-e', `APP_SCHEME=${app.scheme}`],
    ...cli.rest,
  ];
}

/** Runs Maestro while docs/13's sampler records every non-loopback socket of the app. */
function runWithSocketSampler(args: readonly string[], app: AppInfo, report: string): number {
  const sampler = spawn(process.execPath, [SOCKET_SAMPLER, app.name, report], { stdio: 'inherit' });
  const status = spawnSync(MAESTRO, args, { stdio: 'inherit', env: maestroEnv() }).status ?? 1;
  sampler.kill();
  const sockets = existsSync(report) ? readFileSync(report, 'utf8').trim() : '';
  if (sockets !== '') {
    console.error(`e2e:ios: the app opened non-loopback sockets (spec N3), see ${report}`);
    return 1;
  }
  return status;
}

function main(): number {
  const cli = parseCli(process.argv.slice(2));
  execFileSync('bash', [join('packages', 'tooling', 'scripts', 'install-maestro.sh')], {
    stdio: 'ignore',
  });
  const app = readAppInfo(findSimulatorBuild(cli.game, cli.appPath));
  const udid = ensureSimulator('e07-e2e-phone', 'iPhone 17 Pro Max');
  prepareSimulator(udid, app, 'large');
  setAppearance(udid, 'light');
  const out = join('reports', 'e2e', cli.game);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  return runWithSocketSampler(maestroArgs({ cli, udid, app, out }), app, join(out, 'network.txt'));
}

process.exitCode = main();
```

- Extra arguments go to `maestro test`, for example `npm run e2e:ios -- --app line-siege --include-tags smoke`.
- iOS simulators have no airplane mode (Maestro's `setAirplaneMode` is Android-only): offline runs use the debug switch `offline=1`, and the runner wraps every `maestro test` in docs/13's layer-F socket sampler (`sample-sockets.ts`, one sample per second). Any non-loopback socket of the app fails the run and is listed in `reports/e2e/<game-id>/network.txt`.
- `--app-path <.app>` overrides the build location (default `apps/<game-id>/build/dd/Build/Products/Release-iphonesimulator/*.app`, docs/14). `DEVELOPER_DIR` follows docs/14 when several Xcodes are installed.
- Optional: register Maestro's MCP server with the local binary: `claude mcp add maestro -e JAVA_HOME="$JAVA_HOME" -- "$PWD/tools/maestro/bin/maestro" mcp`.

#### Flow conventions

- `packages/shell/e2e/flows/<area>/<nn>-<name>.yaml`: Shell journeys every game runs. `apps/<game-id>/e2e/flows/<area>/<nn>-<name>.yaml`: the game's own flows (`nn` 10 and up).
- Sub-flows in `packages/shell/e2e/subflows/`; relative paths (`../../subflows/debug-setup.yaml`; from an app flow `../../../../../packages/shell/e2e/subflows/debug-setup.yaml`).
- Tags: `smoke` (fast, every E2E run), `shell`, `rtl`, `offline`, `<game-id>`, `quarantine` (excluded, section 3.16). Every `smoke` flow ends with `- runFlow: <relative path>/subflows/assert-no-network.yaml` (docs/13).
- testIDs follow docs/03 section 8: the scope is the kebab route name (`language-choice`, `settings-language`), an overlay (`pause`, `result`) or a dialog (`restart-dialog`); repeated items append their key as a segment (`language-choice.language-row.en`).
- Strings in single quotes (Prettier's `singleQuote` formats YAML too); `${VAR}` works inside single quotes (verified).
- Useful commands (all verified on 2.10.0): `launchApp: { clearState, clearKeychain, stopApp }`, `killApp` (process death), `stopApp`, `openLink`, `runFlow: { file, env }` and `runFlow: { when: { visible }, commands }`, `extendedWaitUntil`, `assertVisible`/`assertNotVisible` with `id` and optional `text` (regex), `tapOn: { id }` and `tapOn: { point }`, `copyTextFrom`, `evalScript`, `assertTrue`, `waitForAnimationToEnd`, `takeScreenshot`. *Source:* [Maestro commands](https://docs.maestro.dev/api-reference/commands/openlink), [parameters](https://docs.maestro.dev/advanced/parameters-and-constants).

Sub-flows:

```yaml
# packages/shell/e2e/subflows/debug-setup.yaml — sub-flow, never run on its own (not under flows/).
# Applies deterministic state through the test-build-only debug deep link, then waits for WAIT_FOR.
appId: ${APP_ID}
---
- openLink: '${APP_SCHEME}://debug/setup?${QUERY}'
- runFlow:
    when:
      visible: 'Open'
    commands:
      - tapOn: 'Open'
- extendedWaitUntil:
    visible:
      id: '${WAIT_FOR}'
    timeout: 15000
```

```yaml
# packages/shell/e2e/subflows/shoot-screen.yaml — opens one screen and screenshots it after it settles.
appId: ${APP_ID}
---
- runFlow:
    file: debug-setup.yaml
    env:
      QUERY: 'screen=${SCREEN}'
      WAIT_FOR: '${SCREEN}.screen'
- waitForAnimationToEnd:
    timeout: 5000
- takeScreenshot: ${SCREEN}
```

```yaml
# packages/shell/e2e/subflows/assert-no-network.yaml — the last step of every smoke flow (docs/13):
# the test build's JS network guard must have counted zero attempts.
appId: ${APP_ID}
---
- runFlow:
    file: debug-setup.yaml
    env:
      QUERY: 'screen=debug'
      WAIT_FOR: 'debug.screen'
- assertVisible:
    id: 'debug.network-attempts'
    text: '0'
```

Shell flows (the core journey is spec 15 item 2 in offline mode, plus the kill test of spec 15 item 6):

```yaml
# packages/shell/e2e/flows/smoke/01-first-launch.yaml — S1 -> S2 -> S13 (spec 1.2 and S2 rules).
appId: ${APP_ID}
name: First launch goes from language choice to the tutorial
tags: [smoke, shell]
---
- launchApp:
    clearState: true
    clearKeychain: true
- assertVisible:
    id: 'language-choice.screen'
- assertVisible:
    id: 'language-choice.language-row.en'
- tapOn:
    id: 'language-choice.continue-button'
- extendedWaitUntil:
    visible:
      id: 'tutorial.screen'
    timeout: 10000
- assertNotVisible:
    id: 'tutorial.skip-button'
- takeScreenshot: first-launch-tutorial
- runFlow: ../../subflows/assert-no-network.yaml
```

```yaml
# packages/shell/e2e/flows/journeys/02-core-journey-offline.yaml — spec 15 item 2, offline via the debug switch
# (iOS simulators have no airplane mode). Every step asserts by testID, never by translated text.
appId: ${APP_ID}
name: Core journey works offline and survives a kill
tags: [smoke, shell, offline]
---
- launchApp:
    clearState: true
- runFlow:
    file: ../../subflows/debug-setup.yaml
    env:
      QUERY: 'lang=en&theme=light&seed=42&date=2026-09-26&ads=off&offline=1&firstRun=0&reduceMotion=1'
      WAIT_FOR: 'home.screen'
- assertNotVisible:
    id: 'home.banner-ad'
- tapOn:
    id: 'home.play-button'
- assertVisible:
    id: 'game.screen'
- runFlow:
    file: ../../subflows/debug-setup.yaml
    env:
      QUERY: 'action=win-level'
      WAIT_FOR: 'result.screen'
- assertVisible:
    id: 'result.next-button'
- tapOn:
    id: 'result.next-button'
- assertVisible:
    id: 'game.screen'
- killApp
- launchApp:
    stopApp: false
- extendedWaitUntil:
    visible:
      id: 'pause.resume-button'
    timeout: 15000
- tapOn:
    id: 'pause.home-button'
- tapOn:
    id: 'home.daily-card'
- assertVisible:
    id: 'daily.screen'
- tapOn:
    id: 'daily.top-bar.back-button'
- tapOn:
    id: 'home.stats-button'
- assertVisible:
    id: 'stats.overview-card'
- tapOn:
    id: 'stats.top-bar.back-button'
- runFlow: ../../subflows/assert-no-network.yaml
```

```yaml
# packages/shell/e2e/flows/rtl/03-language-switch.yaml — S11a: LTR -> RTL needs "Restart to apply".
appId: ${APP_ID}
name: Switching to Persian restarts once and keeps progress
tags: [shell, rtl]
---
- launchApp:
    clearState: true
- runFlow:
    file: ../../subflows/debug-setup.yaml
    env:
      QUERY: 'lang=en&theme=light&seed=42&date=2026-09-26&ads=off&firstRun=0&reduceMotion=1&stars=1:3'
      WAIT_FOR: 'home.screen'
- tapOn:
    id: 'home.settings-button'
- tapOn:
    id: 'settings.language-row'
- tapOn:
    id: 'settings-language.language-row.fa'
- tapOn:
    id: 'restart-dialog.restart-button'
- extendedWaitUntil:
    visible:
      id: 'home.screen'
    timeout: 20000
- runFlow:
    file: ../../subflows/debug-setup.yaml
    env:
      QUERY: 'screen=levels'
      WAIT_FOR: 'levels.level-tile.1'
- assertVisible:
    id: 'levels.level-tile.1.stars-3'
- takeScreenshot: fa-levels-after-restart
```

One game flow. The Skia canvas has no accessibility nodes (docs/03 section 8), so with `boardLayout=1` the test build publishes the board's geometry in a `game.board-layout` Text (section 3.12) and the flow taps coordinates. The expressions below (`JSON.parse`, `regions.find` with an arrow function, the centre maths, `tapOn: { point }`, a comment between steps and the short `runFlow:` form) ran on Maestro 2.10.0 against a probe app on the iOS 26.5 simulator; a point tap reaching a Skia canvas gesture in a Release build was verified too. Reading the JSON from a real Shell Text is not verified yet.

```yaml
# apps/line-siege/e2e/flows/smoke/10-level-1.yaml — real touches on the Skia board. Canvas content has
# no testIDs (docs/03 section 8); with boardLayout=1 the test build renders `game.board-layout`, a Text
# holding { x, y, layout } (section 3.12), and the flow turns a region cell into a tap point.
appId: ${APP_ID}
name: Line Siege level 1 accepts a placement, resumes after a kill, then wins
tags: [smoke, line-siege]
---
- launchApp:
    clearState: true
- runFlow:
    file: ../../../../../packages/shell/e2e/subflows/debug-setup.yaml
    env:
      QUERY: 'lang=en&theme=light&seed=42&level=1&ads=off&firstRun=0&reduceMotion=1&boardLayout=1&screen=game'
      WAIT_FOR: 'game.board'
- copyTextFrom:
    id: 'game.board-layout'
- evalScript: ${output.board = JSON.parse(maestro.copiedText)}
- evalScript: ${output.tray = output.board.layout.regions.find((region) => region.id === 'tray')}
- evalScript: ${output.grid = output.board.layout.regions.find((region) => region.id === 'board')}
# Cell centre = canvas origin + region origin + (col + 0.5) * cell (Line Siege does not mirror).
- evalScript: ${output.tray0 = Math.round(output.board.x + output.tray.x + 0.5 * output.tray.cell) + ',' + Math.round(output.board.y + output.tray.y + 0.5 * output.tray.cell)}
- evalScript: ${output.cell20 = Math.round(output.board.x + output.grid.x + 2.5 * output.grid.cell) + ',' + Math.round(output.board.y + output.grid.y + 0.5 * output.grid.cell)}
- tapOn:
    point: ${output.tray0}
- tapOn:
    point: ${output.cell20}
- assertVisible:
    id: 'game.moves-label'
    text: '.*1.*'
- killApp
- launchApp:
    stopApp: false
- extendedWaitUntil:
    visible:
      id: 'pause.resume-button'
    timeout: 15000
- tapOn:
    id: 'pause.resume-button'
- assertVisible:
    id: 'game.moves-label'
    text: '.*1.*'
- runFlow:
    file: ../../../../../packages/shell/e2e/subflows/debug-setup.yaml
    env:
      QUERY: 'action=win-level'
      WAIT_FOR: 'result.screen'
- assertVisible:
    id: 'result.stars-3'
- takeScreenshot: line-siege-level-1-won
- runFlow: ../../../../../packages/shell/e2e/subflows/assert-no-network.yaml
```

### 3.12 Deterministic setup: the debug deep link

Test builds (`EXPO_PUBLIC_APP_VARIANT=test`, docs/14) register one URL handler, inside test-only code reached only through `packages/shell/src/app/test-only.ts` (docs/14 rule 5; the navigator itself has no `linking`, docs/06); store builds do not contain it (the release audit greps the store bundle for `debug/setup`). The Shell's debug module applies the parameters in order, saves, reloads once if the direction flips (`reloadAppAsync`, FINAL A.31), then shows the requested screen. Flows then wait for an id, so the reload is invisible to them. Launch arguments read with `Settings.get` are the alternative for language and digits (docs/10).

`<scheme>://debug/setup?<param>=<value>&…` (all optional; an unknown parameter or value shows an error on the debug screen instead of being ignored):

| Parameter | Values | Effect |
|---|---|---|
| `lang` | `en`, `de`, `fa`, `ckb` | forced app language (direction follows) |
| `digits` | `auto`, `latin`, `local` | digit setting |
| `theme` | `system`, `light`, `dark` | theme setting (`system` for the matrix; the simulator appearance decides) |
| `seed`, `level` | integers | level seed override, current level |
| `date` | `YYYY-MM-DD` | `FakeClock` date for daily challenges and streaks (S15) |
| `ads` | `off`, `test` | S15 "always test ads / never ads"; has an effect only in an `ADS_MODE=test` build (E2E and screenshots use `ADS_MODE=off` builds, which never start the SDK) |
| `premium` | `0`, `1` | Premium on/off without a purchase (S15) |
| `offline` | `0`, `1` | "Simulate offline": `ConnectivityPort`, ads and store adapters report offline (S15) |
| `firstRun` | `0`, `1` | `1` = first-launch state (S2 next); `0` = language chosen, tutorial done |
| `reduceMotion` | `0`, `1` | Reduce motion setting |
| `stars` | `demo` or `<level>:<stars>,…` | progress fixtures (`demo` = the screenshot fixture) |
| `screen` | route or example state | opens a docs/06 route in kebab-case (`home`, `levels`, `daily`, `stats`, `settings`, `premium`, `how-to-play`, `debug`, `game`), or the game's example states `game-start`, `game-middle`, `result-win`, `result-lose` (spec 10 TESTING) |
| `action` | `win-level`, `lose-level` | the game module's solver/bot plays the current level to that outcome |
| `boardLayout` | `0`, `1` | `1` renders `game.board-layout` (below); off by default, so screenshots never show it |

The debug screen shows `debug.network-attempts` (docs/13's JS network guard counter), which every smoke flow asserts is `0`.

`game.board-layout` (test builds, `boardLayout=1` only) is one small `AppText` that the board host renders next to the canvas. Its text is `JSON.stringify({ x, y, layout })`: `x` and `y` are the canvas's top-left corner in window points (`measureInWindow` on `game.board`), and `layout` is docs/08's `BoardLayout` for the current canvas size (regions in canvas points, unmirrored, plus `isMirrored`). A cell's centre on screen is `x + region.x + (col + 0.5) * region.cell` and `y + region.y + (row + 0.5) * region.cell`; when `isMirrored` is true, the horizontal centre is `x + layout.width - region.x - (col + 0.5) * region.cell` (docs/08's `mirrorRect`).

### 3.13 Screenshot matrix (`npm run screenshots:ios -- --app <game-id>`)

4 languages x light/dark x phone/tablet x 11 screens = 176 PNGs per game, plus an optional 200% text pass (`--text-size accessibility-extra-extra-extra-large`, spec 8.11). Maestro captures (it waits for the UI to settle); `comparePng` compares with baselines; the owner opens `reports/screenshots/index.html` (baseline | this run | diff, changed rows first).

```yaml
# packages/shell/e2e/screenshots/matrix.yaml — run ONLY by `npm run screenshots:ios` (not under flows/).
appId: ${APP_ID}
name: Screenshot matrix
tags: [screenshots]
---
- launchApp:
    clearState: true
- runFlow:
    file: ../subflows/debug-setup.yaml
    env:
      QUERY: 'lang=${LANG}&theme=system&seed=42&date=2026-09-26&ads=off&premium=0&offline=0&firstRun=0&reduceMotion=1&stars=demo'
      WAIT_FOR: 'home.screen'
- runFlow: { file: ../subflows/shoot-screen.yaml, env: { SCREEN: home } }
- runFlow: { file: ../subflows/shoot-screen.yaml, env: { SCREEN: levels } }
- runFlow: { file: ../subflows/shoot-screen.yaml, env: { SCREEN: daily } }
- runFlow: { file: ../subflows/shoot-screen.yaml, env: { SCREEN: stats } }
- runFlow: { file: ../subflows/shoot-screen.yaml, env: { SCREEN: settings } }
- runFlow: { file: ../subflows/shoot-screen.yaml, env: { SCREEN: premium } }
- runFlow: { file: ../subflows/shoot-screen.yaml, env: { SCREEN: how-to-play } }
- runFlow: { file: ../subflows/shoot-screen.yaml, env: { SCREEN: game-start } }
- runFlow: { file: ../subflows/shoot-screen.yaml, env: { SCREEN: game-middle } }
- runFlow: { file: ../subflows/shoot-screen.yaml, env: { SCREEN: result-win } }
- runFlow: { file: ../subflows/shoot-screen.yaml, env: { SCREEN: result-lose } }
```

```ts
// packages/tooling/src/e2e/simulator.ts — dedicated, named simulators (never touch other agents' ones)
// and the environment every Maestro run needs.
import { execFileSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { join } from 'node:path';

export const IOS_RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-26-5';
const ANDROID_STUDIO_JAVA = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';

/** `name` is the executable (CFBundleExecutable), which docs/13's socket sampler looks for. */
export type AppInfo = {
  readonly path: string;
  readonly id: string;
  readonly scheme: string;
  readonly name: string;
};

type SimDevice = { readonly name: string; readonly udid: string; readonly state: string };
type SimctlDevices = { readonly devices: Readonly<Record<string, readonly SimDevice[]>> };

function simctl(args: readonly string[]): string {
  return execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' });
}

export function readAppInfo(appPath: string): AppInfo {
  const plist = join(appPath, 'Info.plist');
  const read = (keyPath: string): string =>
    execFileSync('plutil', ['-extract', keyPath, 'raw', '-o', '-', plist], {
      encoding: 'utf8',
    }).trim();
  return {
    path: appPath,
    id: read('CFBundleIdentifier'),
    scheme: read('CFBundleURLTypes.0.CFBundleURLSchemes.0'),
    name: read('CFBundleExecutable'),
  };
}

export function ensureSimulator(name: string, model: string): string {
  const list = JSON.parse(simctl(['list', 'devices', '--json'])) as SimctlDevices;
  const existing = (list.devices[IOS_RUNTIME] ?? []).find((device) => device.name === name);
  const udid = existing?.udid ?? simctl(['create', name, model, IOS_RUNTIME]).trim();
  if (existing?.state !== 'Booted') {
    simctl(['boot', udid]);
  }
  simctl(['bootstatus', udid, '-b']);
  return udid;
}

export function prepareSimulator(udid: string, app: AppInfo, textSize: string): void {
  simctl(['install', udid, app.path]);
  simctl([
    'status_bar',
    udid,
    'override',
    '--time',
    '9:41',
    '--dataNetwork',
    'wifi',
    '--wifiMode',
    'active',
    '--wifiBars',
    '3',
    '--cellularMode',
    'active',
    '--cellularBars',
    '4',
    '--batteryState',
    'charged',
    '--batteryLevel',
    '100',
  ]);
  simctl(['ui', udid, 'content_size', textSize]);
}

export function findSimulatorBuild(game: string, override: string | undefined): string {
  const built = join('apps', game, 'build', 'dd', 'Build', 'Products', 'Release-iphonesimulator');
  const appPath = override ?? globSync(join(built, '*.app'))[0];
  if (appPath === undefined) {
    throw new Error(`no simulator build in ${built}: run npm run build:ios:sim -- --app ${game}`);
  }
  return appPath;
}

export function setAppearance(udid: string, theme: 'light' | 'dark'): void {
  simctl(['ui', udid, 'appearance', theme]);
}

function javaHome(): string {
  try {
    return execFileSync('/usr/libexec/java_home', ['-v', '17'], { encoding: 'utf8' }).trim();
  } catch {
    return ANDROID_STUDIO_JAVA;
  }
}

/** Java 17 and no telemetry, update check or analysis prompt (FINAL D.40). */
export function maestroEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    JAVA_HOME: process.env['JAVA_HOME'] ?? javaHome(),
    MAESTRO_CLI_NO_ANALYTICS: 'true',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
    MAESTRO_DISABLE_UPDATE_CHECK: 'true',
  };
}
```

```ts
// packages/tooling/src/e2e/write-gallery.ts — one static HTML page the owner opens locally.
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { PngComparison } from '@e07/tooling/visual/compare-png.ts';

export const NEW_BASELINE = 'baseline-written';
export type RowResult = PngComparison | typeof NEW_BASELINE;
export type GalleryRow = {
  readonly label: string;
  readonly actual: string;
  readonly baseline: string;
  readonly result: RowResult;
};

const OUT_DIR = join('reports', 'screenshots');

export function isChanged(result: RowResult): boolean {
  return result !== NEW_BASELINE && result.kind !== 'match';
}

function cell(path: string | null): string {
  return path === null
    ? '<td></td>'
    : `<td><img loading="lazy" src="${relative(OUT_DIR, path)}"></td>`;
}

function row({ label, actual, baseline, result }: GalleryRow): string {
  const status = result === NEW_BASELINE ? 'new baseline' : result.kind;
  const diff = result !== NEW_BASELINE && result.kind === 'mismatch' ? result.diffPath : null;
  return `<tr class="${status}"><th>${label}<br>${status}</th>${cell(baseline)}${cell(actual)}${cell(diff)}</tr>`;
}

export function writeGallery(rows: readonly GalleryRow[]): string {
  const sorted = [...rows].sort(
    (a, b) => Number(isChanged(b.result)) - Number(isChanged(a.result)),
  );
  const html = `<!doctype html><meta charset="utf-8"><title>Screenshot matrix</title>
<style>body{font:14px system-ui;margin:16px}img{width:220px}th{text-align:start;vertical-align:top}
tr.mismatch th,tr.size-changed th{color:#b00020}</style>
<h1>Screenshot matrix</h1><p>Columns: baseline | this run | diff (red = changed pixels). Changed rows first.</p>
<table>${sorted.map(row).join('\n')}</table>`;
  const file = join(OUT_DIR, 'index.html');
  writeFileSync(file, html);
  return file;
}
```

```ts
// packages/tooling/src/e2e/capture-screenshots-ios.ts
// `npm run screenshots:ios -- --app line-siege [--update] [--devices phone] [--langs en,fa]`
// 4 languages x light/dark x phone/tablet. Maestro captures (it waits for the UI to settle); comparePng
// checks each PNG against apps/<game>/e2e/baselines/<device>/<lang>-<theme>[-<text size>]/<screen>.png.
import { execFileSync } from 'node:child_process';
import { copyFileSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  isChanged,
  NEW_BASELINE,
  writeGallery,
  type GalleryRow,
} from '@e07/tooling/e2e/write-gallery.ts';
import { comparePng } from '@e07/tooling/visual/compare-png.ts';

import {
  ensureSimulator,
  findSimulatorBuild,
  maestroEnv,
  prepareSimulator,
  readAppInfo,
  setAppearance,
  type AppInfo,
} from './simulator.ts';

const DEVICES: Readonly<Record<string, { readonly name: string; readonly model: string }>> = {
  phone: { name: 'e07-shots-phone', model: 'iPhone 17 Pro Max' },
  tablet: { name: 'e07-shots-tablet', model: 'iPad Pro 13-inch (M5)' },
};
const DEFAULT_TEXT_SIZE = 'large';
const MAX_DIFF_RATIO = 0.002;
const MAESTRO = join('tools', 'maestro', 'bin', 'maestro');

type Cli = {
  readonly game: string;
  readonly app: AppInfo;
  readonly flow: string;
  readonly isUpdate: boolean;
  readonly devices: readonly string[];
  readonly langs: readonly string[];
  readonly textSize: string;
};
type Combo = { readonly device: string; readonly lang: string; readonly theme: 'light' | 'dark' };

function comboDir(cli: Cli, combo: Combo): string {
  const suffix = cli.textSize === DEFAULT_TEXT_SIZE ? '' : `-${cli.textSize}`;
  return join(combo.device, `${combo.lang}-${combo.theme}${suffix}`);
}

function capture(cli: Cli, udid: string, combo: Combo): string[] {
  const outDir = join('reports', 'screenshots', 'raw', comboDir(cli, combo));
  const vars = {
    APP_ID: cli.app.id,
    APP_SCHEME: cli.app.scheme,
    LANG: combo.lang,
    THEME: combo.theme,
  };
  rmSync(outDir, { recursive: true, force: true });
  execFileSync(
    MAESTRO,
    [
      'test',
      cli.flow,
      '--udid',
      udid,
      '--test-output-dir',
      outDir,
      ...Object.entries(vars).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    ],
    { stdio: 'inherit', env: maestroEnv() },
  );
  return globSync(join(outDir, '**', '*.png'));
}

function check(cli: Cli, combo: Combo, actual: string): GalleryRow {
  const relativeDir = comboDir(cli, combo);
  const baseline = join('apps', cli.game, 'e2e', 'baselines', relativeDir, basename(actual));
  const label = `${relativeDir}/${basename(actual, '.png')}`;
  if (cli.isUpdate) {
    mkdirSync(join('apps', cli.game, 'e2e', 'baselines', relativeDir), { recursive: true });
    copyFileSync(actual, baseline);
    return { label, actual, baseline, result: NEW_BASELINE };
  }
  const diffPath = join('reports', 'screenshots', 'diff', relativeDir, basename(actual));
  const result = comparePng(readFileSync(actual), {
    baselinePath: baseline,
    diffPath,
    maxDiffRatio: MAX_DIFF_RATIO,
  });
  return { label, actual, baseline, result };
}

function parseCli(): Cli {
  const { values } = parseArgs({
    options: {
      app: { type: 'string' },
      'app-path': { type: 'string' },
      flow: {
        type: 'string',
        default: join('packages', 'shell', 'e2e', 'screenshots', 'matrix.yaml'),
      },
      update: { type: 'boolean', default: false },
      devices: { type: 'string', default: 'phone,tablet' },
      langs: { type: 'string', default: 'en,de,fa,ckb' },
      'text-size': { type: 'string', default: DEFAULT_TEXT_SIZE },
    },
  });
  if (values.app === undefined) {
    throw new Error('usage: npm run screenshots:ios -- --app <game-id> [--update]');
  }
  return {
    game: values.app,
    app: readAppInfo(findSimulatorBuild(values.app, values['app-path'])),
    flow: values.flow,
    isUpdate: values.update,
    devices: values.devices.split(','),
    langs: values.langs.split(','),
    textSize: values['text-size'],
  };
}

function runDevice(cli: Cli, device: string): GalleryRow[] {
  const spec = DEVICES[device];
  if (spec === undefined) {
    throw new Error(`unknown device ${device}`);
  }
  const udid = ensureSimulator(spec.name, spec.model);
  prepareSimulator(udid, cli.app, cli.textSize);
  const rows: GalleryRow[] = [];
  for (const theme of ['light', 'dark'] as const) {
    setAppearance(udid, theme);
    for (const lang of cli.langs) {
      const combo = { device, lang, theme };
      rows.push(...capture(cli, udid, combo).map((actual) => check(cli, combo, actual)));
    }
  }
  return rows;
}

const cli = parseCli();
const rows = cli.devices.flatMap((device) => runDevice(cli, device));
writeFileSync(join('reports', 'screenshots', 'summary.json'), `${JSON.stringify(rows, null, 2)}\n`);
const changed = rows.filter(({ result }) => isChanged(result));
console.warn(
  `${String(rows.length)} screenshots, ${String(changed.length)} changed; gallery: ${writeGallery(rows)}`,
);
process.exitCode = changed.length === 0 ? 0 : 1;
```

Baselines:

- Path: `apps/<game-id>/e2e/baselines/<device>/<lang>-<theme>[-<text size>]/<screen>.png`, one device model and runtime per set: `phone` = iPhone 17 Pro Max, `tablet` = iPad Pro 13-inch (M5), both iOS 26.5 (present locally and on the `macos-26` runner; "iPhone 16 Pro on iOS 26.5" does not exist).
- First capture or intended change: `npm run screenshots:ios -- --app <game-id> --update`, open every new PNG with the Read tool, then commit with `Gate-Change: <which screens and why>`.
- Tolerance: 0.2% of pixels (`MAX_DIFF_RATIO`) for full screens, 0.1% for boards. Never raise it to hide a diff.
- A runtime or Xcode change regenerates all baselines in one dedicated commit, after the old baselines passed on the old runtime.
- A capture flow that fails stops the run (non-zero exit); its Maestro log is in `reports/screenshots/raw/<device>/<lang>-<theme>/`.

### 3.14 Test naming

| Good | Bad | Why |
|---|---|---|
| `it('clears the column and emits a column-cleared event')` | `it('should clear the column')`, `test('clear')` | third-person verb, `it` only |
| `describe('applyMove')` → `describe('when the move is illegal')` | `describe('tests')` | exported name, then the condition |
| `it.each(...)('refuses when %s', …)` | 8 copy-pasted tests | tables for rule matrices |
| `it('keeps cached Premium when restore finds nothing')` | `it('restore test 3')` | the title is the spec sentence |
| `makeLineSiegeState({ score: 10 })` | a 40-line object literal in every test | builders (docs/03) |

### 3.15 What NOT to test

- Component trees as snapshots, style objects, class names, private helpers or hook internals. Test behaviour through roles, names and visible text.
- Third-party internals: React Navigation transitions, Skia's rasteriser, Reanimated's animation engine, StoreKit dialogs, Google's consent form content. Test our use of them (adapter mapping, our timeline, our draw calls).
- Translations' wording in component tests (catalog checks do that, docs/10). Component tests assert English source strings only.
- Layout and mirroring in Jest (no Yoga): screenshots do it.
- Timing with real clocks, sleeps or `setTimeout` waits; network; the device's locale or time zone.
- Trivial type-only modules, re-exports, constants tables (they are covered by the tests that use them).
- The same behaviour at two levels without a reason: a rule proven by properties does not need an E2E flow; the flow proves the wiring.

### 3.16 Flaky-test policy

A flaky test passed and failed on the same commit. It is a bug in the test or the product, found early.

1. **Jest:** no retries (`jest.retryTimes` is banned), no skips. Rerun with the printed seed: `npx jest --ci --randomize --seed=<n> -i <file>`. Typical causes: shared mutable module state (use factories), real timers, time zone, unawaited promises (RNTL: `no-floating-promises`), order dependence. Fix the cause in the same session.
2. **fast-check:** never flaky by definition; a new failure is a new counterexample (rule 16).
3. **Pixel goldens:** CanvasKit renders are byte-identical run to run (verified); a varying board golden means the draw path reads time or randomness.
4. **Maestro:** rerun the failing flow once alone (`tools/maestro/bin/maestro test <flow> --udid <udid> -e …`). If it passes, it is flaky: fix the wait (`extendedWaitUntil` on an id, never a sleep), the setup (debug link) or the app. `retry:` is allowed only around OS-owned UI (system alerts), never around app assertions. If the fix needs more than the current session, add `quarantine` to the flow's tags with a comment `# quarantine <date>: <reason>`, report it in the evidence, and fix it within 7 days. A `smoke` flow can never be quarantined: it blocks the release.
5. **Screenshots:** rerun once. A diff in a different place on each run means the screen is not still (animation, clock, random particles, blinking caret); fix the setup, not the tolerance.
6. **Simulators:** only dedicated, named simulators (`e07-e2e-phone`, `e07-shots-phone`, `e07-shots-tablet`). When state looks wrong, `xcrun simctl erase <udid>` and rerun.

### 3.17 Reporting evidence to the owner

The owner reads plain English, not logs. At the end of every slice (short form) and every release (full form), the agent writes this report in its final message (and the PR/commit body when relevant), with numbers taken from the report files, never from memory:

```text
Evidence: <game-id> <slice or release> on <date>, commit <sha>

Checks
- Types, lint, format: pass
- Tests: <passed>/<total> pass (unit <n>, golden <n>), random seed <seed>
- Coverage: lines <x>% (gate 90), logic folders <x>% (gate 95)         reports/coverage/coverage-summary.json
- Mutation (release only): <score>% (break 75), survivors explained below reports/stryker/mutation.html
- Bots: <summary line per difficulty>                                  reports/sim/<game-id>.json
- End-to-end: <passed>/<total> flows pass, quarantined: <none | list>  reports/e2e/<game-id>/junit.xml
- Network: 0 JS attempts, no non-loopback sockets                      reports/e2e/<game-id>/network.txt
- Screenshots: <n> captured, <n> changed (all intended)                reports/screenshots/index.html

What changed for players
- <one line per behaviour, in the spec's words>

Please look at (at most 5)
- <screenshot or gallery row>, because <reason>

Goldens and baselines changed on purpose
- <file>: <reason> (Gate-Change trailer in <sha>)

Not tested or not verified
- <honest list: device-only behaviour, StoreKit Tier 2/3, anything skipped>
```

For a release, attach the gallery by opening it for the owner (`open reports/screenshots/index.html`) and list the manual checks from docs/12, docs/14 and docs/15 (TestFlight purchase, VoiceOver spot check, play-test sign-off).

### 3.18 npm scripts owned by this doc

The commands and file paths are fixed in docs/16 section 1 (copied here for reference); this doc owns the implementation files:

```json
{
  "test": "jest --ci",
  "test:golden": "jest --ci --selectProjects golden",
  "test:sim": "jest --ci --config jest.sim.config.js",
  "test:coverage": "jest --ci --coverage --randomize",
  "test:mutation": "stryker run",
  "e2e:ios": "node packages/tooling/src/e2e/run-e2e-ios.ts",
  "screenshots:ios": "node packages/tooling/src/e2e/capture-screenshots-ios.ts"
}
```

## 4. Checklist

Before calling any work done:

- [ ] Every new behaviour has a test that was seen failing for the right reason, in the same commit as the code.
- [ ] `npm run -s check:fast` passes; `npm run verify` passes before push (coverage gates and sims included).
- [ ] Pure modules have examples, properties and at least one pinned golden value; new fast-check counterexamples are example tests.
- [ ] Node-API tests and helpers are under `test/`; nothing in `apps/*/src`, `packages/game-kit/src` or `packages/shell/src` imports `node:*` (tooling may).
- [ ] No `.skip`, `.only`, `jest.retryTimes`, real timers, `Math.random`, `Date.now` or component snapshots were added.
- [ ] Goldens, pixel baselines, screenshot baselines or save fixtures changed only on purpose, each with a `Gate-Change:` trailer and a reason.
- [ ] Save format changes: new `fixtures/save-vN.minimal.json` and `save-vN.full.json`, migration test, property over old documents, docs/06's node:sqlite tests green.
- [ ] Premium and ads changes: fake-based tests cover every affected S12 state and 8.8 rule, including every limit at exactly its value; Stryker shows no survivor in the changed policy or reducer.
- [ ] UI changes: RNTL tests via `renderWithShell`; every tappable element has a `<screen>.<element>` testID and every screen `<screen>.screen`.
- [ ] Before a release: `npm run test:mutation` at or above 75% with survivors explained; `npm run e2e:ios -- --app <game-id>` green on an `ADS_MODE=off` test build, with no quarantined smoke flow and an empty `network.txt`; `npm run screenshots:ios -- --app <game-id>` reviewed (every changed PNG opened with Read).
- [ ] `npm ls react react-native` shows one version of each; `npx expo install --check` is clean in every app.
- [ ] The evidence report (section 3.17) is written with numbers from `reports/`.
- [ ] Simulators created for the run are shut down; nothing was run on another agent's simulator.

## 5. Sources

- Expo unit testing: https://docs.expo.dev/develop/unit-testing/
- Expo monorepos: https://docs.expo.dev/guides/monorepos/
- Expo versions API: https://api.expo.dev/v2/versions/latest
- Jest configuration: https://jestjs.io/docs/configuration
- Jest CLI: https://jestjs.io/docs/cli
- Jest manual mocks: https://jestjs.io/docs/manual-mocks
- RNTL 14 release: https://github.com/callstack/react-native-testing-library/releases/tag/v14.0.0
- RNTL LLM guidelines: https://github.com/callstack/react-native-testing-library/blob/main/docs/guides/llm-guidelines.md
- fast-check: https://fast-check.dev/
- jest-image-snapshot: https://github.com/americanexpress/jest-image-snapshot
- pixelmatch: https://github.com/mapbox/pixelmatch
- React Native Skia, installation and Jest: https://shopify.github.io/react-native-skia/docs/getting-started/installation
- React Native Skia, headless: https://shopify.github.io/react-native-skia/docs/getting-started/headless
- Reanimated testing: https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/
- Reanimated useFrameCallback: https://docs.swmansion.com/react-native-reanimated/docs/advanced/useFrameCallback/
- Worklets testing: https://docs.swmansion.com/react-native-worklets/docs/guides/testing/
- Gesture Handler testing: https://docs.swmansion.com/react-native-gesture-handler/docs/guides/testing
- Node node:sqlite: https://nodejs.org/api/sqlite.html
- Node module customization hooks: https://nodejs.org/api/module.html
- Node TypeScript type stripping: https://nodejs.org/api/typescript.html
- npm package.json overrides: https://docs.npmjs.com/cli/v11/configuring-npm/package-json
- StrykerJS configuration: https://stryker-mutator.io/docs/stryker-js/configuration/
- StrykerJS Jest runner: https://stryker-mutator.io/docs/stryker-js/jest-runner/
- Maestro 2.10.0 release: https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.10.0
- Maestro commands: https://docs.maestro.dev/api-reference/commands/openlink, https://docs.maestro.dev/api-reference/commands/runflow, https://docs.maestro.dev/api-reference/commands/killapp, https://docs.maestro.dev/api-reference/commands/extendedwaituntil, https://docs.maestro.dev/api-reference/commands/waitforanimationtoend, https://docs.maestro.dev/api-reference/commands/takescreenshot, https://docs.maestro.dev/api-reference/commands/retry
- Maestro parameters: https://docs.maestro.dev/advanced/parameters-and-constants
- Google Testing Blog, code coverage best practices: https://testing.googleblog.com/2020/08/code-coverage-best-practices.html
- Claude Code best practices: https://code.claude.com/docs/en/best-practices

## 6. Verified

Verified on 2026-09-26 on this Mac (macOS 27.0, Node 26.4.0, npm 11.17.0, Xcode 26.6, iOS 26.5 simulator runtime, Java 17.0.11) in copies of the canonical monorepo layout (`apps/line-siege`, `packages/{game-kit,shell,tooling}`, npm workspaces) with expo 57.0.25, react-native 0.86.3, react 19.2.3 (after the override), jest 29.7.0, jest-expo 57.0.5, @react-native/jest-preset 0.86.3, @testing-library/react-native 14.0.1, test-renderer 1.2.0, fast-check 4.10.2, jest-image-snapshot 6.5.2, pixelmatch 7.2.0, pngjs 7.0.0, Stryker 10.0.0, @shopify/react-native-skia 2.6.2, react-native-reanimated 4.5.1, react-native-worklets 0.10.1, react-native-gesture-handler 2.32.0, react-intl 12.1.3, react-native-google-mobile-ads 17.2.0, expo-iap 5.8.0, valibot 1.5.0, ESLint 9.39.5 with docs/04's `eslint.config.mjs` copied verbatim, TypeScript 6.0.3 with docs/04's tsconfig files, Maestro 2.10.0.

What ran:

- **Every code block in this doc is byte-identical to a file that passed** Prettier, `tsc -p` for all six programs (root, three packages, the app, `tsconfig.stryker.json`) and docs/04's ESLint with `--max-warnings 0`. The one exception is the GMA mock's PascalCase names, which need open issue 5(a); with that block added, the whole repo lints clean. The code was checked against the other docs' real modules, copied verbatim: docs/02's ports and `Services`, docs/05's theme, `AppText` and `PrimaryButton`, docs/06's save stack and `dailySeed`, docs/08's `sfc32`, `Track`, `board-scene`, `play-bot`, `GameEngine` and the worklet boundary check, docs/10's i18n modules, docs/11's `ad-policy` and consent adapter, docs/12's purchase stack, and docs/13's socket sampler.
- **Jest**, with this doc's `jest.config.js`, `jest.setup.ts` and `babel.config.js`: 20 suites and 95 tests in the doc-07 repo (both projects, the `test/` roots, docs/06's `node:sqlite` tests, docs/11's and docs/12's tests on the updated root mocks, and docs/12's expo-iap adapter on the mock), and docs/08's full suite (21 suites, 61 tests, 9 snapshots, including its moved pixel golden against the committed baselines) in a copy of docs/08's verification workspace. Both pass with the polyfills in the `golden` project and with docs/02's `"type": "module"` packages. `npm run test:sim`: 3 tests in 9 s; the medians rise with difficulty (65, 134, 203, 335 moves).
- `jest --ci` refused to write the six new data snapshots; `-u` wrote them to `*.snap.ios` next to the test. The coverage gate and its key filter resolve all four keys and fail on low numbers as intended.
- **Stryker**, full run: the initial run and the TypeScript checker pass, and the run takes 1 min 50 s. The break threshold sets exit code 1 below 75%. On `ad-policy.ts` (23 s): 2 survivors, 100% with the two cases in section 3.8.6. Without the workspace `moduleNameMapper`, mutants of `daily-seed.ts` were reported as "NoCoverage"; without the Stryker branch in `babel.config.js`, the initial run failed on a file-level worklet module (writer).
- **Headless Skia** in plain Node ran docs/08's `paintBoardPng` with Line Siege's real draw, layout, palettes and timeline. A missing baseline exits 1, `--update` writes it, and a rerun matches with diff ratio 0 (the render was checked by eye). The file-level `'worklet';` directive works after a leading path comment (`__workletHash` present).
- **Maestro 2.10.0**: `check-syntax` passes every flow and sub-flow here (and rejects a bad command or property). On a dedicated iOS 26.5 simulator with a probe app (created and deleted by the run), the board-layout expressions, `assertTrue`, `tapOn: { point }`, a comment between steps and the short `runFlow:` form with `output` shared from a sub-flow all ran. The writer also verified: `install-maestro.sh` (cached zip, idempotent rerun, checksum mismatch deletes the file and exits 1); `run-e2e-ios.ts` against a probe Release build (flow discovery by area folder, tag pass-through, JUnit output, exit code); flow `env:` overriding `-e`; sub-folders not run; `killApp`/`launchApp`; a point tap reaching a Skia canvas gesture; `status_bar override`, `ui appearance`, `ui content_size`; `capture-screenshots-ios.ts` (`--update`, compare, gallery, 200% text pass).
- **`renderWithShell` with stores (2026-09-26, `scratchpad/fix-final/repo`, a copy of `rn/verify-testing/repo` with jest-expo 57.0.5, RNTL 14.0.1, test-renderer 1.2.0).** The helper and its test above, docs/05's `premium-entry.test.tsx`, `primary-button.test.tsx` and `icon-button.test.tsx`, docs/10's `t.test.tsx`, docs/15's `level-grid.test.tsx` and `palette-checks.test.ts`, and docs/06's `settings-store.test.ts` pass (`unit` project: 26 suites, 105 tests; `golden`: 6 tests) with no act() warnings; `tsc` passes for all five programs; docs/04's merged ESLint (now including open issue 5(a)) and Prettier pass.
- Facts re-read today: npm versions of every tool in section 3.1; the Expo versions API (`jest ~29.7.0`, `@types/jest 29.5.14` for SDK 57 and 58); `bundledNativeModules.json` of expo 57.0.25 and 58.0.0-preview.7; the Maestro 2.10.0 checksum file; the analytics and update env vars in the 2.10.0 jar; `simctl` device types and flags; GMA 17.2.0's enums and iOS `TestIds`; expo-iap 5.8.0's `ErrorCode`; Stryker's option schema.

Not verified (needs the real Shell): the Shell-specific testIDs, the debug deep-link handler, reading `game.board-layout` from a real Text, layer F inside a real E2E run (docs/13 verified the `lsof` approach), and the StoreKit Tier 2 harness (docs/12).

## 7. Open issues

1. **Node types for tests (FINAL A.3 vs A.6/D.38).** A.3 gives app and test code `types: ["jest"]`, but the tests A.6 and D.38 require use Node APIs (`node:sqlite`, `Buffer` for PNGs, `node:fs` for fonts and reports). Verified: those files fail `tsc -p packages/shell` and `tsc -p apps/line-siege`. This doc adopts docs/04's resolution (Node-API tests and helpers live under the root `test/`, whose tsconfig has `node`). Consequence: pixel goldens, SQL tests and report-writing sims are not colocated with their units.
2. **`draw(canvas, view, fx, colors, layout)` (FINAL B.12, F) has five positional parameters; FINAL D.35 limits functions to three.** docs/08 groups them into `draw(canvas, frame)`; this doc follows docs/08. FINAL B.12's wording should be read that way.
3. **Resolved: font folder.** Every doc now uses `apps/<game-id>/assets/fonts/` (docs/10 owns the files; docs/02's tree, `shellPlugins` and the new-game scaffold follow it), so the goldens load the same file the app bundles.
4. **Resolved: gated paths in docs/16.** `gatedPaths` now also lists `**/*.golden.test.ts.snap.ios` (what the `jest-expo/ios` preset writes next to the test; add `**/*.snap.android` when Android starts), `babel.config.js`, `jest.setup.ts`, `tsconfig.stryker.json`, `test/goldens/boards/skia-golden.ts` (it holds the 0.1% tolerance) and `packages/tooling/scripts/install-maestro.sh` (checksum pin).
5. **ESLint adjustments the tests need (docs/04).** (a) Resolved: the GMA mock mirrors PascalCase library exports (`AdsConsent`, `TestIds`), so docs/04's config turns `@typescript-eslint/naming-convention` off for `__mocks__/**` (merged into docs/04 section 3; the repo lints clean). (b) In test files `@typescript-eslint/unbound-method` flags `expect(sdk.method)` when the method is typed by the library; this doc's adapter test avoids it by typing the `requireMock` result locally, but `jest/unbound-method` (eslint-plugin-jest's replacement) is the general fix. (c) Keep `Math.random`, `Date.now`, `new Date()` and `performance.now()` banned in tests, and add `jest.retryTimes` to the banned properties. Today colocated tests inherit the runtime bans, but files under `test/` do not. (d) If a tooling test file is ever matched by a block with `disableTypeChecked`, `jest/unbound-method` crashes; exclude `**/*.test.ts` from such blocks.
6. **One clock test file, two docs.** This doc (section 3.8.8) and docs/08 section 5 both write `packages/shell/src/game-host/board-scene.test.ts`. It is one file: keep this doc's fake-`FrameInfo` cases and docs/08's `sceneElapsedMs` and end-frame cases together.
7. **Board input in E2E.** docs/03 decides that the canvas has no internal testIDs. Section 3.12 defines `game.board-layout`, and docs/08 section 5 now requires its board host (`game-board-host.tsx`) to render it in test builds when `boardLayout=1`; the rendering code is not written yet.
8. **File-level `'worklet';` directive (FINAL B.15) vs Stryker (FINAL D.39).** Stryker injects helper functions into each mutated file; the Worklets plugin workletizes them and the initial run fails (verified). Resolved here by compiling Stryker workers without the Worklets/Reanimated plugins (`babel.config.js`, gated per issue 4). Mutation runs therefore never exercise the worklet transform itself; `worklet-transform.test.ts` covers it in normal runs.
9. **One `unit` project for everything (FINAL D.38).** Pure-logic tests pay the jest-expo environment cost (the challenger measured 0.6-1.5 s vs 6.2-7.0 s cold per file for a plain Node project). Kept as decided; revisit if `npm test` passes about 60 s.
10. **Resolved: name drift in other docs.** docs/15's save perf test now uses docs/06's `createNodeSqliteSqlDriver` and real `SaveStore` API, and docs/03's Maestro excerpt uses `language-choice.continue-button`.
11. **Surviving mutants in docs/12's tests (Stryker, verified).** docs/11's two survivors are killed (its test now has the section 3.8.6 cases). docs/12's `premium-reducer.test.ts` never dispatches `connect-started` (NoCoverage at `premium-reducer.ts:22`), and replacing `state.flow.kind === 'loading'` (line 27) with `true` survives; add one example for each when the reducer is implemented.
