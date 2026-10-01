---
name: unit-and-component-tests
description: Sets up Jest and writes Pocket Arcade test code - two projects, RNTL 14 async via renderWithShell, root SDK mocks, fakes, fast-check, coverage, Stryker. Use when a test needs the Shell wrapper, a mock or a fake, or Jest fails. Not for the red-green loop (tdd-workflow) or goldens (golden-tests).
---

# Unit and component tests

Every rule, service, store, hook and component of the Shell and the games is proven in Jest (jest-expo 57, React Native Testing Library 14, fast-check, Stryker) through one root configuration, with components rendered in the real Shell provider tree. This skill builds that set-up, says how each kind of test is written, and its scripts prove the set-up, the test code and the mutation results.

## Rules that must hold

1. **One Jest config at the root with exactly two projects**: `unit` (preset `jest-expo/ios`) and `golden` (Skia's CanvasKit environment, `*.golden.test.ts` only); bot sims only through `jest.sim.config.js`. Run Jest from the repo root. Why: Skia's environment must not replace React Native's for every test, and jest-expo reads Babel options from the working directory.
2. **Exact pins and one React**: jest 29.7.0, jest-expo 57.0.5, `@react-native/jest-preset` = React Native (0.86.3), RNTL 14.0.1 with its companion test-renderer 1.2.0 (the React 19.2 line; installed in the same command, because npm alone picks 1.3.0 for React 19.3), fast-check 4.10.2, Stryker 10.0.0; root `overrides` pin `react` 19.2.3 and `react-native` 0.86.3. Why: without the override npm hoisted React 19.3 for the tests while the app ships 19.2.3 (verified).
3. **Import workspace code by package name** (`@e07/shell/…/x.ts`), which `jest.config.js` maps to `<rootDir>/packages/<pkg>/src`. Why: through the `node_modules` symlinks Stryker tests the original files and reports false survivors (verified).
4. **Await every RNTL call** (`render`, `renderWithShell`, `renderHook`, `act`, `waitFor`, `fireEvent`, `findBy*`, `user.*`). Query `getByRole` first, `findBy*` for async, `queryBy*` only for absence; press with `userEvent.setup()`. Why: RNTL 14 is async; an un-awaited call runs after the assertions.
5. **Render every component and hook through `renderWithShell` / `createShellWrapper`**: real English catalog (a missing message throws), stores built from a seeded in-memory save, only the ports the test passes (others throw and name themselves). A unit that reads nothing from the Shell (props or injected dependencies only) may use plain `render`/`renderHook` with `// no-shell-context: <why>` in the file. Assert visible text, roles and accessible names. Styles only where the style is the contract: Toybox measurements and the 44 pt box in `packages/shell/src/ui/`, the `<T>` contract in `packages/shell/src/i18n/`; anywhere else mark it `// allow-style-assertion: <why>`. No component snapshots. Why: tests see what the app and VoiceOver see, and survive refactors.
6. **Vendor SDKs only through the root `__mocks__`**: tests never import `react-native-google-mobile-ads`, `expo-iap` or `expo-tracking-transparency`; an adapter test uses `jest.mock('<sdk>')` plus `jest.requireMock('<sdk>')`. Skia is mocked once, centrally, in `jest.setup.ts` (inert `Skia<Component>` host elements); a test mocks it itself only to inspect Skia calls. Why: both SDKs and Skia's native module crash on import in Jest, and without `jest.mock` `requireMock` returns a second instance with zero calls (verified).
7. **Everything above an adapter is tested through fakes** (`fake-<port>.ts`: a small real implementation with a shared call log), and store state changes only by seeding and dispatching, never by mocking a store module. Why: fakes make ad and Premium rules millisecond tests and prove cross-service order.
8. **Tests are deterministic**: `TZ=UTC` in the Jest configs, injected `ClockPort` and seeded RNG, `flushMicrotasks()` instead of sleeps, fake timers only for UI timers in components, no retries. Why: a flaky test is a bug, and replays must be exact.
9. **Pure logic gets examples, fast-check properties and a pinned value**; a counterexample becomes an example test before the fix. Why: properties alone left 3 of 8 RNG mutants alive.
10. **Tests that need Node APIs live under the root `test/`** (`node:sqlite`, `node:fs`, `Buffer`). Why: app-world programs have only `jest` types and lint bans `node:*` there.
11. **Coverage 90/90/90/85 globally and 95/95/95/90 for game-kit, the save service and every rules file; mutation score at least 75%** with survivors killed by boundary examples. Never lower a threshold, never `// Stryker disable`. Why: one agent writes code and tests; coverage was 97.8% while the mutation score was 77.1%.
12. **Every file ships with a test or starts with `// device-only: covered by <e2e flow or simulator check>` in its first 6 lines**, and only native adapters, Skia and frame-callback modules, composition files and tooling entry points may carry the marker. `jest.config.js` leaves exactly the marked files out of coverage through the tested helper `packages/tooling/src/quality/device-only.ts`; fakes and pure helpers always get tests. Why: untested templates held the Shell at 83.8% statements, and a hand-written exclusion would hide real code.

## Workflow

1. **Check the set-up** from the repo root: `node ${CLAUDE_SKILL_DIR}/scripts/check-test-setup.mjs .`. For each missing file copy the template of the same path from `templates/` (root configs, `__mocks__/`, `packages/shell/src/testing/`, `packages/game-kit/src/testing/`), and merge `templates/package.test-deps.json` into the root `package.json` (then `npm install`; when adding the Testing Library later, install it with its companion in one command: `npm install -D --save-exact @testing-library/react-native@14.0.1 test-renderer@1.2.0`). Read [references/jest-config.md](references/jest-config.md) before changing any config; config files are gated (owner agreement and a `Gate-Change:` trailer).
2. **Pick the kind of test** and read its reference once per session:
   - component or screen: [references/component-tests.md](references/component-tests.md); model: `templates/packages/shell/src/testing/render-with-shell.test.tsx`;
   - hook: same reference; copy [templates/hook.test.tsx](templates/hook.test.tsx);
   - adapter over a vendor SDK, fake, service or policy: [references/mocks-and-fakes.md](references/mocks-and-fakes.md); copy [templates/adapter.test.ts](templates/adapter.test.ts); models: [examples/admob-consent-adapter.test.ts](examples/admob-consent-adapter.test.ts), [examples/premium-service.test.ts](examples/premium-service.test.ts);
   - game rules or other pure logic: [references/properties.md](references/properties.md); copy [templates/rules.test.ts](templates/rules.test.ts); model: [examples/apply-move.test.ts](examples/apply-move.test.ts).
3. **Fill the template**: replace every `__UPPER_SNAKE__` placeholder, keep the file next to its unit as `<unit>.test.ts(x)` (Node-API tests under `test/integration/<area>/`). Titles read as the spec and pass lint (`jest/valid-title` `^(can|[a-z]+s)\b`): `describe('<exported name>')` → optional `describe('when …')` → `it('clears …')`, never `it('should …')`; no `it.skip`, `it.only`, `xit` (lint errors).
4. **Run the one file and read the failure**: `npx jest <file> --ci --selectProjects unit`. Red must be an assertion diff, not an import or type error. For a subset with coverage, put the paths first and switch the thresholds off: `npx jest <paths> --ci --selectProjects unit --coverage --collectCoverageFrom='<path>/**/*.ts' --coverageThreshold='{}'` (only `npm run test:coverage` judges the thresholds; a subset always misses the global one).
5. **Make it green, then check the test code**: `node ${CLAUDE_SKILL_DIR}/scripts/check-test-code.mjs .`. Fix each `FAIL` line (file, rule and fix are printed) and rerun until `RESULT: PASS`. A verified test copied from another skill's template that is flagged only for plain `render`, a hook without a wrapper, a style assertion or fake timers gets the reasoned marker the fix names (`no-shell-context`, `allow-style-assertion`, `allow-fake-timers`), not a rewrite; `--help` lists the markers.
6. **Run the whole suite with coverage**: `npm run test:coverage`. Below a threshold, add tests for the uncovered behaviour ([references/coverage-and-mutation.md](references/coverage-and-mutation.md)); a native adapter, Skia or frame-callback module or composition file gets the device-only marker instead, naming the check that covers it (the reference lists which template files need which). Read the numbers for the report from `reports/coverage/coverage-summary.json`.
7. **Mutation-test finished logic** (a rules, policy or reducer module; nightly and before a release: the whole set): `npx stryker run --mutate <file>`, then `node ${CLAUDE_SKILL_DIR}/scripts/check-mutation-report.mjs reports/stryker/mutation.json --changed <file>`. Kill each survivor with a boundary example and rerun both; an equivalent mutant is accepted only with `--allow <id>` and a sentence in the report.
8. **Rerun the three checks** until all print `RESULT: PASS`, then `npm run -s check:fast`.

## Definition of done

- [ ] `npx jest --ci` passes with no `act(...)` warnings, and `npm ls react react-native` shows one version of each.
- [ ] Every new test sits next to its unit (or under `test/` when it needs Node), and was seen failing on an assertion first.
- [ ] Components and hooks render through `renderWithShell` / `createShellWrapper`; adapters are tested against the root mocks; services over fakes.
- [ ] `npm run test:coverage` passes (90/90/90/85 global, 95/95/95/90 logic).
- [ ] Finished logic modules: `check-mutation-report.mjs --changed <file>` prints `RESULT: PASS` (score at least 75%, no survivor in the file).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-test-setup.mjs .` prints `RESULT: PASS`.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-test-code.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **`render(<X />)` without the Shell tree or without `await`.** The component misses its catalog, stores and ports, and assertions run before React commits. Use `await renderWithShell(<X />, options)`.
- **Mocking a store or a Shell module to "make the test easy".** The test then proves the mock. Seed with `settings` / `isPremium` and dispatch on the returned `stores`.
- **A bag of `jest.fn()` standing in for a port.** It cannot prove order or state. Write or reuse `fake-<port>.ts` with a call log.
- **`import { AdsConsent } from 'react-native-google-mobile-ads'` in a test.** Crashes or reads a second instance. `jest.mock` + typed `jest.requireMock`.
- **`await new Promise((r) => setTimeout(r, 50))`.** Slow and flaky. `findBy*` for UI, `flushMicrotasks()` for services.
- **`queryByText(...)` plus `toBeOnTheScreen()`, or `getByText(...)` plus `.not.toBeOnTheScreen()`.** The first hides a missing element's error message, the second throws before asserting.
- **Relative imports into another workspace (`../../game-kit/src/...`).** Stryker then mutates a different copy. Import by `@e07/` name.
- **Weakening a gate to get green: lower coverage numbers, `--break` under 75, `istanbul ignore`, `Stryker disable`, `jest.retryTimes`.** Fix the test or the code; if a gate looks wrong, stop and ask the owner.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/jest-config.md](references/jest-config.md) | Versions and re-verify commands, file layout, Babel, both Jest configs part by part, setup, sims config, scripts, known failures, flaky tests | Workflow step 1, and whenever a config or pin changes or Jest fails oddly |
| [references/component-tests.md](references/component-tests.md) | RNTL 14 async model, renderWithShell options, queries, matchers, user-event, bidi names, hooks, stores, gestures, what not to test | Workflow step 2 for components, screens and hooks |
| [references/mocks-and-fakes.md](references/mocks-and-fakes.md) | Root SDK mocks, adapter tests with requireMock, fakes with call logs, services and policies over fakes | Workflow step 2 for adapters, services, policies |
| [references/properties.md](references/properties.md) | Examples + fast-check properties + pinned values, playChoices, the per-game property checklist, counterexamples, sims and node:sqlite placement | Workflow step 2 for rules and pure logic |
| [references/coverage-and-mutation.md](references/coverage-and-mutation.md) | Coverage thresholds and key semantics, Stryker config, running, reading survivors, a worked boundary example | Workflow steps 6 and 7 |
| [templates/jest.config.js](templates/jest.config.js) | The one Jest config (unit + golden projects, mapper, UTC, coverage gates) (synced from the library; do not edit here) | Copy to the repo root (step 1) |
| [templates/jest.setup.ts](templates/jest.setup.ts) | Gesture Handler, Worklets and Reanimated test setup, and the one central Skia mock (inert `Skia<Component>` elements) (synced from the library; do not edit here) | Copy to the repo root (step 1) |
| [templates/jest.sim.config.js](templates/jest.sim.config.js) | Plain-Node config for `*.sim.test.ts` (synced from the library; do not edit here) | Copy to the repo root (step 1) |
| [templates/babel.config.js](templates/babel.config.js) | Root Babel config with the Stryker branch (synced from the library; do not edit here) | Copy to the repo root (step 1) |
| [templates/stryker.config.json](templates/stryker.config.json) | Stryker scope, thresholds, reporters (synced from the library; do not edit here) | Copy to the repo root (step 1) |
| [templates/tsconfig.stryker.json](templates/tsconfig.stryker.json) | The jest-only program Stryker's type checker uses (synced from the library; do not edit here) | Copy to the repo root (step 1) |
| [templates/package.test-deps.json](templates/package.test-deps.json) | Test scripts, exact devDependency pins (RNTL with its companion test-renderer), React overrides | Merge into the root package.json (step 1) |
| `templates/packages/tooling/src/quality/` | `device-only.ts`, the one helper that turns `// device-only: covered by ...` markers into Jest coverage exclusions, and its test (synced from the library; do not edit here) | Copy with `jest.config.js` (step 1); it is a gated path |
| [templates/__mocks__/react-native-google-mobile-ads.ts](templates/__mocks__/react-native-google-mobile-ads.ts) | Root manual mock of GMA 17.2.0 | Copy to `__mocks__/` when an app uses ads |
| [templates/__mocks__/expo-iap.ts](templates/__mocks__/expo-iap.ts) | Root manual mock of expo-iap 5.8.0 | Copy to `__mocks__/` when an app sells Premium |
| [templates/__mocks__/expo-tracking-transparency.ts](templates/__mocks__/expo-tracking-transparency.ts) | Root manual mock of expo-tracking-transparency 57.0.2 (nothing asked yet, the player declines when asked) | Copy to `__mocks__/` when an app shows ads (the consent adapter asks for App Tracking Transparency) |
| [templates/packages/shell/src/testing/render-with-shell.tsx](templates/packages/shell/src/testing/render-with-shell.tsx) | `renderWithShell`, `createShellWrapper`, `createTestServices` | Copy once the Shell's stores, i18n and theme exist |
| [templates/packages/shell/src/testing/render-with-shell.test.tsx](templates/packages/shell/src/testing/render-with-shell.test.tsx) | The helper's own test (and the proof that the central Skia mock works); the model for every component test pattern | Copy with the helper; read before the first component test |
| [templates/packages/shell/src/testing/flush-microtasks.ts](templates/packages/shell/src/testing/flush-microtasks.ts) | Lets queued promise callbacks run without fake timers | Copy with the helper |
| [templates/packages/game-kit/src/testing/play-choices.ts](templates/packages/game-kit/src/testing/play-choices.ts) | Turns fast-check integers into legal moves for any rules module | Copy before the first rules property test |
| [templates/rules.test.ts](templates/rules.test.ts) | The template game's (Tap Flip) `apply-move.test.ts`: examples, illegal move, determinism, invariants, JSON round trip; synced from the library (game-rules-engine owns it), copy it and replace the Tap Flip examples | Workflow step 2 for rules |
| [templates/adapter.test.ts](templates/adapter.test.ts) | Vendor adapter test against the root mock | Workflow step 2 for adapters |
| [templates/hook.test.tsx](templates/hook.test.tsx) | Hook test through `createShellWrapper`, seeded and dispatched | Workflow step 2 for hooks |
| [examples/apply-move.test.ts](examples/apply-move.test.ts) | Verified Line Siege v1 rules test (synced from the library's canonical Line Siege; do not edit here) | To imitate for rules |
| [examples/admob-consent-adapter.test.ts](examples/admob-consent-adapter.test.ts) | Verified adapter test against the GMA and tracking mocks: UMP mapping, offline fallback, and `requestTracking` (asked once while not-determined, only while the app is active, restricted reported as denied) | To imitate for adapters |
| [examples/premium-service.test.ts](examples/premium-service.test.ts) | Verified service test over the purchase fake (persist before finish) | To imitate for services |
| `scripts/check-test-setup.mjs` | Checks pins and their companions, overrides, scripts, Babel, both Jest configs (including the ignored `skills/` and `.claude/`), coverage scope and the device-only exclusions, setup with the Skia and icon mocks, Stryker, root mocks, helper (tests marked `no-shell-context` need no helper) | Workflow step 1 and the definition of done |
| `scripts/check-test-code.mjs` | Checks test files: awaits, renderWithShell, query use, style assertions, SDK imports, requireMock, store mocks, timers, sleeps, cross-workspace imports | Workflow step 5 and the definition of done |
| `scripts/check-mutation-report.mjs` | Reads `reports/stryker/mutation.json`: score vs break, survivors in `--changed` files | Workflow step 7 |
| `scripts/selftest.mjs` | Proves the three checkers pass good fixtures and catch every planted bug | After changing a checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs for the self-test (the setup fixture is built from the templates) | When adding a rule to a checker |

## Related skills

- `tdd-workflow` - the red-green loop, test names and the order of layers.
- `golden-tests` - data goldens, pixel goldens and when `jest -u` is allowed.
- `e2e-maestro` - end-to-end flows and the screenshot matrix on the simulator.
- `quality-gates` - `check:fast`, `verify` and the guardrail around these configs.
- `save-persistence-and-migrations` - the node:sqlite save tests and frozen fixtures.
- `board-rendering-skia` - board draw-call tests, the frame-clock tests and board pixel goldens.
