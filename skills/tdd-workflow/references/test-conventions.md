# Test names, places and limits

Where every kind of test lives, what it is called, what it must not do, and how flaky tests are handled. `scripts/check-tests.mjs` checks the mechanical parts of this page.

## Contents

- File names and places
- Titles
- Builders and tables
- What never goes in a test
- What not to test
- Snapshots and goldens
- Flaky-test policy

## File names and places

| Kind | File | Where | Runs in |
|---|---|---|---|
| Unit or component test | `<unit>.test.ts` / `<unit>.test.tsx` | next to the unit | `npm test` (Jest project `unit`), pre-commit (related), `check:fast` (changed) |
| Data golden | `<unit>.golden.test.ts` | next to the unit | `npm run test:golden`, `npm test` |
| Board pixel golden | `<game-id>-board.golden.test.ts` | `test/goldens/boards/` (needs Node APIs) | `npm run test:golden` |
| Bot or balance simulation | `<name>.sim.test.ts` | `test/sims/<game-id>/` (writes reports with Node APIs) | `npm run test:sim` only, never pre-commit |
| Integration (several modules, or Node APIs such as `node:sqlite`, `node:fs`, `Buffer`) | `<name>.test.ts` | `test/integration/<area>/` | `npm test` |
| Perf budget (the save-write p95 under 5 ms) | `<name>.perf.test.ts` | `test/integration/<area>/` (imports `node:perf_hooks`) | `npm test`, `verify` |
| Frozen save fixture | `fixtures/save-v<N>[.<case>].json` | next to the migration tests | gated: changing it needs a `Gate-Change:` trailer |

Rules behind the table:

- **Colocate unit tests** as `<unit>.test.ts(x)` next to the unit. No `__tests__/` folders and no `.spec.ts` files: the Jest projects select by suffix, and a stray name is never run.
- **Tests that need a Node API live under the root `test/` folder**, next to their helper. The app-world programs (`packages/game-kit`, `packages/shell`, `apps/*`) carry Jest types only and ban `node:*` imports; only the root program and `packages/tooling` have Node types.
- **Import workspace code by package name** (`@e07/game-kit/rng/sfc32.ts`) or by `./` for the same folder; never `../`. The Jest config maps package names straight to source, which Stryker's sandbox needs.
- **Every tappable or asserted element has a testID** `<screen>.<element>` in kebab-case (`home.play-button`, `levels.level-tile.12`), and every screen root `<screen>.screen`. End-to-end flows select by id, so they run unchanged in four languages.

## Titles

- `describe('<exported name>')`, exactly the function, hook or component name.
- Optional `describe('when <condition>')` for a group of cases.
- `it('<third-person verb> ...')`: the first word is a verb ending in "s" or the word "can" (`returns`, `emits`, `keeps`, `rejects`, `shows`, `clears`). The lint rule `jest/valid-title` enforces `^(can|[a-z]+s)\b` for `it`.
- Use `it`, not `test`.
- The title is the spec sentence: `it('keeps cached Premium when restore finds nothing')`, not `it('restore test 3')`. Put the spec ID in the title or a comment above it when the behaviour comes from a spec line: `it('counts only the first completion of the day (spec S9)')`.

| Good | Bad | Why |
|---|---|---|
| `it('clears the column and emits a column-cleared event')` | `it('should clear the column')`, `test('clear')` | third-person verb, `it` only |
| `describe('applyMove')` then `describe('when the move is illegal')` | `describe('tests')` | exported name, then the condition |
| `it.each(...)('refuses when %s', ...)` | 8 copy-pasted tests | tables for rule matrices |
| `it('keeps cached Premium when restore finds nothing')` | `it('restore test 3')` | the title is the spec sentence |
| `makeLineSiegeState({ score: 10 })` | a 40-line object literal in every test | builders |

## Builders and tables

- Fixture builders are `make<Thing>(overrides)` (`makeLineSiegeState({ score: 10 })`), living in the test file or in a `testing/` folder of the package.
- Use `it.each` tables for rule matrices (every S12 state, every spec 8.8 condition, every limit at exactly its value and one past it).
- Keep helper functions outside `it` callbacks so the nested-callback limit (4 in tests) holds.

## What never goes in a test

- `.skip`, `.only`, `.failing`, `.todo`, `xit`, `xdescribe`, `fit`, `fdescribe`, `jest.retryTimes`.
- `Math.random`, `Date.now`, `new Date()` with no arguments, `performance.now()`, real `setTimeout` waits. The one exception: a perf budget test (`test/**/<name>.perf.test.ts`) times real work with `performance` imported from `node:perf_hooks`, because the React Native Jest preset replaces the global `performance.now` with a 1 ms `Date.now` mock.
- Vendor SDK imports (the ads SDK, the purchase SDK): test through the port with its `fake-<port>.ts`; only an adapter's own test reads the SDK's root mock.
- Component-tree snapshots (`toMatchSnapshot` outside `*.golden.test.ts`).
- `node:*` imports in tests under `apps/*/src`, `packages/game-kit/src` or `packages/shell/src`.

## What not to test

- Component trees as snapshots, style objects, class names, private helpers or hook internals. Test behaviour through roles, names and visible text.
- Third-party internals: navigation transitions, Skia's rasteriser, Reanimated's animation engine, StoreKit dialogs, Google's consent form content. Test our use of them (adapter mapping, our timeline, our draw calls).
- Translations' wording in component tests (catalog checks do that). Component tests assert English source strings only.
- Layout and mirroring in Jest (there is no layout engine there): screenshots do it.
- Timing with real clocks, sleeps or `setTimeout` waits; the network; the device's locale or time zone.
- Trivial type-only modules, re-exports, constants tables (covered by the tests that use them).
- Thin device-only wrappers that Jest cannot load (the `expo-sqlite` driver): Jest runs the same logic through the node:sqlite driver, and the device check covers the wrapper. Mark such a file in its first lines (usually line 2) with `// device-only: covered by <the simulator kill test, the e2e flow ...>`; `check-tests.mjs` then skips it (and fails a marker that names no check), and `check-test-edits.mjs` lets a `feat`/`fix` commit that changes only such wrappers pass `code-without-test` (with `--range` or `--staged` it reads the marker from git; with `--log` only when the diff shows the file's first lines). The system clock adapter is not device-only: Jest's fake timers drive it, so it has its own test. An adapter that has a root mock (the ads and purchase SDKs) is not device-only: it gets its own test.
- The same behaviour at two levels without a reason: a rule proven by properties does not need an end-to-end flow; the flow proves the wiring.

## Snapshots and goldens

- No component-tree snapshots: agents rubber-stamp large UI snapshots with `-u`.
- Snapshots exist only in `*.golden.test.ts` as readable data (ASCII boards, JSON).
- Create or change a golden only on purpose: `npx jest <file> --selectProjects golden -u`, never `-u` in scripts or hooks, and commit with a `Gate-Change: <reason>` trailer. `jest --ci` refuses to write new snapshots.
- Daily-challenge goldens never change for an existing date (spec 8.3 makes them a compatibility contract).
- Open every changed golden PNG or screenshot with the Read tool before committing it.

## Flaky-test policy

A flaky test passed and failed on the same commit. It is a bug in the test or the product, found early.

1. **Jest:** no retries, no skips. Rerun with the printed seed: `npx jest --ci --randomize --seed=<n> -i <file>`. Typical causes: shared mutable module state (use factories), real timers, time zone, unawaited promises, order dependence. Fix the cause in the same session.
2. **fast-check:** never flaky by definition; a new failure is a new counterexample.
3. **Pixel goldens:** renders are byte-identical run to run; a varying board golden means the draw path reads time or randomness.
4. **End-to-end flows:** rerun the failing flow once alone. If it then passes, it is flaky: fix the wait (wait on an id, never a sleep), the setup or the app. A retry is allowed only around system alerts, never around app assertions. If the fix needs more than the current session, tag the flow `quarantine` with a dated comment, report it in the evidence, and fix it within 7 days. A smoke flow can never be quarantined.
5. **Screenshots:** rerun once. A diff in a different place on each run means the screen is not still (animation, clock, particles, a blinking caret); fix the setup, not the tolerance.
