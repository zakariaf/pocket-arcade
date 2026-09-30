# Coverage gates and mutation testing (Stryker)

Coverage proves code ran; mutation testing proves the tests would notice if it were wrong. One agent writes both code and tests, so both gates exist.

## Contents

- Coverage thresholds
- How Jest applies the keys
- Files Jest cannot run: the device-only marker
- Which template files still need a test or the marker
- Running a subset with coverage
- Reading coverage
- Why coverage is not enough
- Stryker configuration
- Running Stryker
- Reading the report and killing survivors
- A worked example: two boundary survivors
- Equivalent mutants

## Coverage thresholds

| Scope | Statements | Lines | Functions | Branches |
|---|---|---|---|---|
| global | 90 | 90 | 90 | 85 |
| `./packages/game-kit/src/` | 95 | 95 | 95 | 90 |
| `./packages/shell/src/services/save/` | 95 | 95 | 95 | 90 |
| `./apps/*/src/rules/**/*.ts` | 95 | 95 | 95 | 90 |

`npm run test:coverage` (`jest --ci --coverage --randomize`) runs both projects and fails below these numbers; `verify` includes it. The thresholds are gated values: lowering one is never a fix.

## How Jest applies the keys

- A path key that matches no file makes Jest exit 1 ("Coverage data for ./packages/... was not found"), so `jest.config.js` adds a logic key only once `fs.globSync` finds a non-test source file under it. An empty repo passes; the first rules file switches its key on automatically.
- Directory keys (`./packages/game-kit/src/`) are checked as one total. The glob key `./apps/*/src/rules/**/*.ts` is checked file by file, so every rules file must reach 95/95/95/90 on its own.
- Files matched by any key are left out of the `global` numbers.
- Tests under the root `test/` count toward the source files they exercise (the save threshold is met by `test/integration/save/`).
- `collectCoverageFrom` leaves out tests, `*.d.ts`, `fixtures/`, `testing/` and `packages/tooling`, and nothing else (`check-test-setup.mjs` rule `coverage-scope` fails any other `!` glob).
- `coveragePathIgnorePatterns` holds `/node_modules/` plus one exact path per file marked device-only (next section), and nothing else (`check-test-setup.mjs` rule `coverage-device-only`).

## Files Jest cannot run: the device-only marker

Every template file either ships with a test or starts with this line in its first 6 lines (usually line 2, after the path comment):

```ts
// device-only: covered by <the e2e flow or simulator check that exercises it>
```

The marker is only for four kinds of file: native adapters over a device API (the `expo-sqlite` driver, the StoreKit adapter), Skia and frame-callback modules (the board canvas, the frame clock, the board recorder), composition files that only wire tested parts together (`start-shell.ts`, the providers, the navigation root), and tooling entry points that only wire a tested plan to the shell (the verify runner, the hooks). Fakes and pure helpers never get it: they always get a test, because every other test leans on them.

One rule, three readers:

- `jest.config.js` takes its `coveragePathIgnorePatterns` from `deviceOnlyCoveragePatterns(__dirname)` in `packages/tooling/src/quality/device-only.ts` (a template of this skill, with its test): exactly the marked files leave coverage, nothing else. The helper is a gated path; changing it needs the owner and a `Gate-Change:` trailer.
- `tdd-workflow`'s `check-tests.mjs` accepts a marked file as tested (and fails a marker that names no check); its `check-test-edits.mjs` lets a `feat`/`fix` that changes only marked files pass `code-without-test`.
- `check-test-setup.mjs` fails when a marked file is still counted, or when a hand-written exclusion hides an unmarked file.

The reason must name a real check (`covered by the Release simulator smoke run`, `covered by e2e flow 03-language-switch`); a marker without `covered by <at least a few words>` counts as no marker.

## Which template files still need a test or the marker

On the Shell clean-room build (Home and Settings slice, all templates copied) `npm run test:coverage` failed at global statements 83.8% and the save folder at 83.3%. Re-run with this `jest.config.js` and the helper on a copy of that build (2026-09-29): with the device-only marker on the 24 composition, native, Skia and parity files that had no test (the start-up and provider files, the composition root, the navigation root and route files, the board canvas and host, the parity harness wiring) and the two shared app tests added (`use-is-app-active`, `system-a11y-store`), 37 marked files left coverage and none was still counted. Global statements, functions and lines passed (92.2/91.6/93.7); branches stood at 84.7% because five model hooks (`use-home-model.ts`, `use-settings-extras.ts`, `use-settings-context.ts`, `use-settings-resets.ts`, `use-stats-summary.ts`) had no tests yet, and without them the global numbers are 94.4/85.6/94.9/95.9 (statements, branches, functions, lines), above the gate. Each owning skill adds a test or the marker to its template:

| Owning skill | Files | What they need |
|---|---|---|
| `board-rendering-skia`, `board-gestures-and-input` | `game-host/board-canvas.tsx`, `game-host/game-board-host.tsx`, `app/use-is-app-active.ts`, `app/system-a11y-store.ts` | the marker for the Skia and native files; a test for the store (it is plain logic over a native event) |
| `toybox-design-system` | `app/motion-config.tsx` and any other provider that only passes a system value through | the marker, or a render test |
| `toybox-screens`, `navigation-and-routing` | the model hooks (`use-home-model.ts`, `use-settings-extras.ts` and every other `use-<screen>-model.ts`), `navigation/navigation-root.tsx`, `screens/settings/settings-screen.tsx` | a `renderHook` test through `renderWithShell` for each hook; the marker for the navigation root and the three-line route files |
| `game-host-integration`, `save-persistence-and-migrations`, `premium-purchase`, `game-audio-and-haptics` | `app/start-shell.ts`, `app/shell-providers.tsx`, `app/hydrate-save.ts`, `app/use-checkpoint-on-background.ts`, the composition root (`create-shell-app.tsx`, `create-shell-parts.ts`, `shell-app.tsx`, `shell-features.tsx`, `shell-navigator.tsx`, `connect-premium-reloads.ts`; the adapters are created in `device-adapters.ts`, which carries the marker), `services/save/fake-save-store.ts`, `services/audio/fake-audio.ts`, `services/haptics/fake-haptics.ts` | the marker for the start-up and provider files; a test for the composition root (one render test of `ShellApp` through the real providers) and for every fake |
| `toybox-visual-parity` | the parity harness under `app/parity/` and `app-parity` start-up | the marker (the parity runs on the simulator cover it) or tests for its pure parts |

The save folder has its own 95/95/95/90 key: on that build it stayed at 92.1/82.5/93.3/84.3 because `fake-save-store.ts`, `load-plan.ts`, `save-codec.ts` and `sqlite-save-store.ts` lack branch tests; those need tests (under `test/integration/save/` where they need `node:sqlite`), never the marker.

## Running a subset with coverage

Only `npm run test:coverage` judges the thresholds. A subset run with `--coverage` counts every file the root config collects, so the global threshold fails with numbers like "0%" or "6.18%" even when every file of the subset passes. Run a subset like this (paths first, because `--selectProjects` takes every word after it as a project name):

```sh
npx jest apps/line-siege/src/rules apps/line-siege/src/testing --ci --selectProjects unit \
  --coverage --collectCoverageFrom='apps/line-siege/src/rules/**/*.ts' --coverageThreshold='{}'
```

Read the per-file numbers it prints; then run `npm run test:coverage` for the verdict.

## Reading coverage

`reports/coverage/coverage-summary.json` holds the numbers for the evidence report (`total.lines.pct` and so on, plus one entry per file); `reports/coverage/lcov-report/index.html` shows uncovered lines. Add tests for uncovered behaviour, never assertion-free tests (`jest/expect-expect` and Stryker catch those), never `istanbul ignore` comments.

## Why coverage is not enough

In the verification repo, line coverage was 97.8% while the mutation score was 77.1%. Coverage counts executed lines; a test that runs a line without checking its result still covers it.

## Stryker configuration

`templates/stryker.config.json` and `templates/tsconfig.stryker.json`:

- **Scope: logic only.** `packages/game-kit/src/**`, `apps/*/src/{rules,levels}/**`, `packages/shell/src/services/save/**`, and every `*-policy.ts` and `*-reducer.ts` in the Shell; tests, `testing/`, `fixtures/` and `test/` excluded. UI is covered by end-to-end flows and screenshots.
- `testRunner: jest` with `projectType: custom`, `configFile: jest.config.js`, `enableFindRelatedTests: true`; `coverageAnalysis: perTest`.
- `checkers: ["typescript"]` with `tsconfig.stryker.json`: mutants that do not compile count as errors, not kills. It is an app-world program (`jest` types, no `test/**`): the Shell's `app-env.d.ts` declares its own `process`, which clashes with `@types/node` in a combined program (`Property 'cwd' does not exist`, verified), and the tests under `test/` are type-checked by the root program anyway. Its own `tsBuildInfoFile` keeps it from overwriting the root program's build info.
- `ignorePatterns` keeps generated native folders, reports, `tools`, `skills` and `.claude` out of the sandbox copy: with the skills folder inside it Stryker copied 16,152 files instead of 338 and one file took 28 s instead of 17 s (verified).
- `incremental: true` with `reports/stryker/incremental.json`: reruns reuse results for unchanged code. Keep the file between local runs.
- `ignoreStatic: true`: static mutants (module-level constants) are skipped; they would rerun every test.
- `thresholds: { high: 90, low: 80, break: 75 }`: below 75% the run exits 1.
- Reports: `reports/stryker/mutation.json` (read by `check-mutation-report.mjs`) and `mutation.html`.
- Stryker workers compile without the Worklets and Reanimated Babel plugins (the branch in `babel.config.js`); the logic is identical as plain JS, and the file-level-worklet modules (game-kit geom, timeline, sims) stay in scope. The one test that checks the plugin's output is skipped inside mutation runs.
- Inline Stryker config is off repo-wide: never `// Stryker disable`.

## Running Stryker

| When | Command | Time |
|---|---|---|
| A rules, policy or reducer module is finished | `npx stryker run --mutate <file>` | 20-30 s per file |
| Nightly and before a release | `npm run test:mutation` | 1.5-2 min for a verification repo's logic set |

Then: `node ${CLAUDE_SKILL_DIR}/scripts/check-mutation-report.mjs reports/stryker/mutation.json --changed <file>` lists every surviving or uncovered mutant of that file with its line and replacement, and fails when the overall score is under 75% or the changed file has a survivor.

## Reading the report and killing survivors

For each survivor:

1. Read the mutated line and the replacement (`last > nowMs` became `last >= nowMs`).
2. Ask which input tells the two apart; it is almost always a boundary (exactly the limit, the same millisecond, an empty list, the last index).
3. Add that example, see it fail against the mutant's logic (it passes against the real code), rerun Stryker on the file.
4. Or delete dead code the mutant exposed.

`NoCoverage` means no test ran the line at all: a missing example, often a whole branch (`connect-started` never dispatched in a reducer test, for example).

## A worked example: two boundary survivors

Stryker on the ad policy (23 s) left two survivors that its table and property did not kill:

```
[Survived] EqualityOperator  packages/shell/src/services/ads/ad-policy.ts:56:27
-  return last === null || last > nowMs ? null : nowMs - last;
+  return last === null || last >= nowMs ? null : nowMs - last;
[Survived] EqualityOperator  packages/shell/src/services/ads/ad-policy.ts:67:7
-  if (context.levelsCompletedTotal < config.minLevelsCompletedBeforeFirst) return false;
+  if (context.levelsCompletedTotal <= config.minLevelsCompletedBeforeFirst) return false;
```

Two examples at exactly the boundaries killed both (41 of 41 mutants):

```ts
it('allows the first interstitial at exactly 3 completed levels', () => {
  const exactly = { ...READY, levelsCompletedTotal: 3 };
  expect(shouldShowInterstitial(request({ context: exactly }))).toBe(true);
});

it('blocks an interstitial in the same millisecond as the last one', () => {
  expect(shouldShowInterstitial(at(AFTER_TWO_WINS, 'win', T0))).toBe(false);
});
```

## Equivalent mutants

A mutant with no observable change (for example a bound that is never reachable with valid input) cannot be killed. Note it in the evidence report with the file, line and why it is equivalent, and pass `--allow <mutant id>` to the report checker. Never hide it with `// Stryker disable`, and never relax a threshold.
