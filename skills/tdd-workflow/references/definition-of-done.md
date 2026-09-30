# Definition of done and the evidence each change needs

A task is done only when every line that applies is true and its evidence is in the report. Numbers in the report come from the files in `reports/`, never from memory.

## Contents

- Always
- Evidence by kind of change
- The test pyramid
- Coverage and mutation gates
- Where the evidence files are

## Always

- Every new behaviour has a test that was run and seen failing for the right reason (an assertion, not an import or type error) before the code was written, and the test and the code are in the same commit.
- `npm run -s check:fast` is green. Before any push, `npm run verify` is green (the pre-push hook runs it).
- The checklist of every area touched was run (the skill for that area names it).
- No gate was weakened, no hook bypassed, and no `eslint-disable`, `@ts-ignore`, `.skip` or `.only` was added.
- This skill's `scripts/check-tests.mjs` (on the repo) and `scripts/check-test-edits.mjs` (on the new commits) pass.
- The report is written with numbers taken from `reports/`.

## Evidence by kind of change

| Change | Evidence required |
|---|---|
| Pure logic (rules, levels, reducers, policies, game-kit) | example tests + fast-check properties + one pinned golden value; coverage at or above the gates; for a finished rules module or policy, a Stryker run with survivors explained |
| Levels, daily challenge, board drawing | data or pixel goldens created or changed only on purpose, each PNG opened with the Read tool, a `Gate-Change:` trailer; daily goldens for existing dates never change |
| Save format | new schema version, pure migration, frozen `save-vN.*.json` fixtures, migration test and property, `node:sqlite` tests, then the simulator kill test |
| UI (screens, components) | component tests through the Shell's render helper, accessibility check clean; simulator screenshots of each changed screen in at least `en` and `fa`, light and dark, opened with the Read tool and matched against the Toybox design screenshot; before a release, the full matrix |
| Navigation, flows, first run, restart for direction | the end-to-end flows that cover them pass on a Release simulator build of the test variant with ads off |
| Native modules, config plugins, `app.config.ts`, the config composer | `npx expo config --json` for every allowed variant pair, a clean prebuild, a simulator build, a launch screenshot looked at, the privacy and network audits |
| A new dependency | exact version, at least 7 days old (or a dated exception), all apps in lockstep, install script reviewed, licence allowed, knip clean, network audit clean |
| Ads or Premium | fake-based tests for every affected spec 8.8 rule or S12 state (each numeric limit at exactly its value); Premium changes also the StoreKit harness on the simulator |
| Anything that reaches players (a release) | the release checklist, end-to-end and screenshot runs green on this commit, mutation score at or above 75%, the owner's play-test and VoiceOver check |

## The test pyramid

| Level | What | Tool / file | Speed | Runs in |
|---|---|---|---|---|
| 0 | Types, lint | `tsc`, ESLint | seconds | edit hook, pre-commit, `check:fast` |
| 1 | Pure logic: rules, level generator, game-kit, reducers, policies, migrations | Jest `unit`, examples + fast-check properties, `<unit>.test.ts` | ms per test | pre-commit (related), `test`, `verify` |
| 2 | Data goldens (levels, daily seeds, formats) and pixel goldens (boards) | Jest `golden`, `*.golden.test.ts` | under 3 s total | same as level 1 |
| 3 | Integration in Jest: services with fakes, real SQL on `node:sqlite`, screens with the testing library | Jest `unit`, `test/integration/**`, `*.test.tsx` | 0.1-2 s per file | same as level 1 |
| 4 | Bot simulations (balance, winnability, determinism) | `*.sim.test.ts` via `jest.sim.config.js` | 10 s - 10 min | `test:sim` inside `verify` (pre-push), never pre-commit |
| 5 | Mutation testing of logic folders | Stryker | 1-30 min | nightly, before a release, when a rules module is finished |
| 6 | End-to-end on a Release simulator build | Maestro flows | 10-60 s per flow | `e2e:ios`: nightly, before a release, after UI or navigation changes |
| 7 | Screenshot matrix (4 languages x light/dark x phone/tablet) | Maestro + image compare | 5-20 min | `screenshots:ios`: before a release, after any UI change |
| 8 | Store sandbox and the owner's play-test | StoreKit harness, TestFlight, the owner | manual | per release |

Most tests live in levels 1-3. A typical game ships with a few hundred level-1 and level-2 tests, 10-40 component tests, 3-6 simulations, 3-8 own end-to-end flows plus the Shell's shared flows, and about 180 matrix screenshots.

## Coverage and mutation gates

- Coverage: global statements/lines/functions 90, branches 85; logic folders (`packages/game-kit/src/`, `packages/shell/src/services/save/`, `apps/*/src/rules/`) 95/95/95/90. A threshold key only becomes active once its folder has source files.
- Add tests for uncovered behaviour; never assertion-free tests (Stryker and `jest/expect-expect` catch those).
- Mutation (Stryker): run nightly, before a release and when a rules module is finished; the break threshold is 75%. Kill surviving mutants with boundary examples, never by relaxing thresholds.

## Where the evidence files are

| Artefact | Location | In git? |
|---|---|---|
| Data golden snapshots | `<test>.golden.test.ts.snap.ios` next to the test | yes, gated |
| Pixel golden baselines | `__image_snapshots__/<id>.png` next to the test | yes, gated |
| Pixel golden diffs | `reports/visual/diff/<id>-diff.png` | no |
| Coverage | `reports/coverage/coverage-summary.json`, `reports/coverage/lcov-report/index.html` | no |
| Mutation | `reports/stryker/mutation.json`, `reports/stryker/mutation.html` | no |
| Simulations | `reports/sim/<game-id>.json` | no |
| End-to-end | `reports/e2e/<game-id>/junit.xml`, `reports/e2e/<game-id>/network.txt` | no |
| Screenshot matrix | `reports/screenshots/index.html`, `summary.json`, `raw/`, `diff/`; baselines in `apps/<game-id>/e2e/baselines/` | baselines yes, gated |
