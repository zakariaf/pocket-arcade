# The gates: what runs when, and what each script does

There is no human reviewer, so quality is a stack of automatic gates, each cheaper and earlier than the next. This page lists every gate, every canonical npm script, and the order and cost of `npm run verify`.

## Contents

- The gate stack
- The canonical npm scripts
- The verify pipeline, step by step
- A partial Shell: SKIP lines in verify
- When verify is green
- check:fast, the inner loop
- What is outside verify

## The gate stack

| When | Gate | Blocks | Typical time |
|---|---|---|---|
| After every Edit/Write by Claude | PostToolUse hook: Prettier + ESLint on that file | nothing (feeds errors back to Claude, exit 2) | about 5 s |
| When Claude wants to stop | Stop hook: `npm run -s check:fast` | Claude from stopping (exit 2) | about 7-12 s |
| `git commit` | lefthook `pre-commit`: secrets, format, lint, typecheck, related tests (parallel) | the commit | about 3-4 s |
| `git commit` | lefthook `commit-msg`: Conventional Commits, spec lines in `feat`/`fix` bodies, `Gate-Change:` trailer (the same rules and ids as `check-commits.mjs`) | the commit | 0.1 s |
| `git push` | lefthook `pre-push`: `npm run verify` | the push | minutes |
| Every `verify` | the guardrail: resolved configs equal `quality-gates.json` | the push | about 6-30 s |
| Nightly / manual (optional) | GitHub Actions `static` and `ios-e2e` | merge, if the owner uses pull requests | 5-60 min |

End-to-end flows (`e2e:ios`), the screenshot matrix (`screenshots:ios`) and mutation testing (`test:mutation`) are outside `verify` and run nightly, before a release, and when a rules module is finished.

## The canonical npm scripts

All scripts live in the root `package.json` and run from the repo root. The exact commands are in `templates/package-scripts.json`; copy them byte for byte, because the guardrail compares the gate scripts exactly and a weaker copy elsewhere would bypass it. Game-specific scripts take `-- --app <game-id>` (and `--variant test|store` for builds).

| Script | What it does | Needs |
|---|---|---|
| `prepare` | installs the git hooks (`lefthook install`); npm runs it after `npm install` / `npm ci` | a git repo |
| `verify` | `node packages/tooling/src/quality/run-verify.ts`: every gate except end-to-end and mutation, cheapest first, stopping at the first failure; reads `shell-slice.json` | network (dependency checks) |
| `check:fast` | Prettier check, ESLint (cached), every `tsc` project, tests related to uncommitted changes | a git repo |
| `format` / `format:check` | Prettier write / check on the whole repo | |
| `lint` | ESLint on the whole repo with `--max-warnings 0`, no cache (type-aware results can go stale in a cache) | |
| `typecheck` | root `tsconfig.json`, then `tsc -p` for every `packages/*` and `apps/*` | |
| `test` | all Jest projects (`unit`, `golden`); `--ci` never writes snapshots | |
| `test:golden` | only the `golden` project | |
| `test:sim` | bot and balance simulations (`*.sim.test.ts`), own config | |
| `test:coverage` | all Jest projects with coverage thresholds, random order | |
| `test:mutation` | Stryker on logic folders (nightly, before a release) | |
| `knip` | unused files, exports and dependencies; sets `APP_VARIANT=test ADS_MODE=off` because knip evaluates `app.config.ts` | |
| `audit:network` | the static no-network layers for every app; writes each export to `dist-audit/<game-id>/` | Expo CLI |
| `audit:licenses` | the licence of every npm package in the exported bundles | after `audit:network` |
| `audit:privacy` | aggregates the iOS privacy manifests against `app.config.ts` | macOS, after prebuild + pod install |
| `i18n:verify` | FormatJS verify + the catalog linter for Shell and game catalogs | |
| `e2e:ios`, `screenshots:ios` | Maestro flows and the screenshot matrix on a Release simulator build | macOS, simulator, Java 17 |
| `build:ios:sim`, `release:ios` | local `xcodebuild` pipelines | macOS, Xcode |
| `new-game` | scaffolds `apps/<game-id>` | |

Two scripts are gates but run elsewhere: `audit:privacy` needs `ios/Pods`, so the simulator build and the release run it right after prebuild; `test:golden` is already inside `test:coverage`. `build:ios:sim`, `release:ios`, `screenshots:ios` and `new-game` are tools, not gates.

Who builds the files behind the scripts: this skill ships the guardrail, the edit hook, the commit-message check, the dependency check and the licence audit (`templates/packages/tooling/src/`). `i18n:verify` comes from the `i18n-strings-and-catalogs` skill, `audit:network` and `audit:privacy` from `privacy-and-network-audit`, `e2e:ios` and `screenshots:ios` from `e2e-maestro`, the build and release scripts from `ios-simulator-build` and `ios-release-testflight`, and `new-game` from `new-game-scaffold`.

## The verify pipeline, step by step

`npm run verify` runs `packages/tooling/src/quality/run-verify.ts`, which runs the steps of `verify-plan.ts` in this order, cheapest and most likely to fail first, and stops at the first failure (like `a && b && c`). A green run ends with `verify: <n> steps passed, 0 skipped`; while `shell-slice.json` exists it names the steps that printed a `SKIP` line apart (`verify: 11 steps passed, 1 with SKIP lines`, or `verify: 10 steps passed, 1 skipped, 1 with SKIP lines` before the first sim), so a slice run never reads as clean.

| # | Step | Measured (sample repo) | Expected with the Shell + pilot | Fails when |
|---|---|---|---|---|
| 1 | `format:check` | 0.6-1.4 s | about 2 s | a file is not Prettier-formatted |
| 2 | `lint` | 3.6 s | 15-40 s | any ESLint error or warning |
| 3 | `typecheck` | 2 s warm, about 5 s cold | 5-15 s | any `tsc` error in any project |
| 4 | `i18n:verify` | not built yet | about 2 s | missing or extra keys, ICU mismatch, bad key names |
| 5 | `knip` | 1.4 s | about 3 s | an unused file, export or dependency; an unlisted dependency |
| 6 | guardrail `check-quality-gates.ts` | 6-29 s | about 30 s | a resolved config differs from `quality-gates.json` |
| 7 | `test:coverage` | 2-13 s | 30-120 s | a failing test or a coverage threshold |
| 8 | `test:sim` | not built yet | 1-10 min | a bot or balance property fails |
| 9 | `audit:network` | about 13 s per app (probe) | about 15 s per app | a new network-capable path |
| 10 | `audit:licenses` | under 1 s | under 1 s | a shipped package without an allowed licence |
| 11 | `deps/check-deps.ts` | about 5 s | 10-20 s per app | an undated or expired release-age exception, apps out of lockstep, `expo install --check` or `expo-doctor` failing, or an unreviewed install script |

Step 11 needs the network (Expo's version API and npm); offline, `verify` fails there, which is correct: a push without the dependency checks would be unverified. Set `EXPO_NO_TELEMETRY=1` in tooling environments. An Expo patch that `expo install --check` or `expo-doctor` expects but that is younger than 7 days is a `WARN` line naming its due date (installing it now would break the release-age rule); from that date it fails like any other mismatch (dependency-management).

## A partial Shell: SKIP lines in verify

A repo without every Shell screen declares so in `shell-slice.json` at the repo root (`{ "screens": ["S4", "S11", "S12"], "why": "Home + Settings parity slice" }`; `"screens": []` for a game-first repo). While the file exists, exactly two steps change, each with a `SKIP` line that counts as a pass:

- `knip` runs without its export and type issue kinds (`SKIP shell-slice.json [knip-exports] ...`): exports that only a later screen uses are expected until the screen exists. Files, dependencies, unlisted dependencies and binaries are still checked.
- `test:sim` is skipped while no game has a `*.sim.test.ts` (`SKIP jest.sim.config.js [test-sim] ...`). Once a sim exists it runs.

Every other step stays strict, a malformed `shell-slice.json` stops `verify` at once, and a slice never ships: the release checks fail while the file exists. The last line names a step that ran with a `SKIP` line apart from a clean one (`verify: 11 steps passed, 1 with SKIP lines`), so a slice run is never reported as clean.

Skill checkers print a second kind of `SKIP` line during the Shell build: `due at Shell step <n>: <file> not yet created`, for a rule whose target a later build step creates (the plugin list at step 8, the Shell catalogs and boot file at step 6). It counts as a pass until that step; from then on the rule is strict, and the build order reruns the check. A checker that decides whether something may ship never prints it. [root-files.md](root-files.md) explains the runner, the file format and each knip entry.

## When verify is green

Some verify steps depend on files that later build steps create. Before the step in the "Green from" column (the Shell build order of `pocket-arcade-index`), the verify step is expected red for the reason given; any other red step is a real failure. On the Shell build `verify` as a whole is green from Shell step 8 (with the `SKIP` lines while `shell-slice.json` exists), and green with no `SKIP` line from step 10, when the slice file is deleted (every screen is built by then, and step 11's release gates fail while it exists).

| verify step | Green from | Before that |
|---|---|---|
| `format:check`, `lint`, `typecheck`, the guardrail | Shell step 1 | never expected red |
| `test:coverage` | Shell step 1 | never expected red: every template ships a test or the `// device-only: covered by ...` marker; a red run names a file that lacks both |
| `check-deps.ts` | Shell step 1 | never expected red; a young Expo patch is a `WARN` with its due date, and fails from that date |
| `knip`: files, dependencies, unlisted, binaries | Shell step 1 | never expected red: the template already ignores the macOS tools started by name and the root mocks' native libraries |
| `knip`: exports and types | Shell step 10 | exports that only a later layer uses; skipped with the `SKIP shell-slice.json [knip-exports]` line while `shell-slice.json` exists |
| `test:sim` | Shell step 3 | "No tests found" until the pilot's `*.sim.test.ts` exist; the `SKIP jest.sim.config.js [test-sim]` line while `shell-slice.json` exists |
| `i18n:verify` | Shell step 6 | `packages/tooling/src/i18n/verify-catalogs.ts` arrives with i18n-strings-and-catalogs; until then `check-gate-wiring.mjs` names it with `--pending` |
| `audit:network`, `audit:licenses` | Shell step 8 | `packages/tooling/src/audit/audit-network.ts` and the licence audit's bundle export arrive with the audit tooling, which lands before the first simulator build; until then `check-gate-wiring.mjs` names the network audit with `--pending` |

Never make a step green early with `--passWithNoTests`, an ignore entry or a stub file: the table is the plan, and the report names each expected-red step with its reason.

## check:fast, the inner loop

`check:fast` is the inner loop and the Stop hook's command: Prettier check, ESLint with a content-based cache in `node_modules/.cache/eslint/`, the full `typecheck` (incremental), and `jest --onlyChanged` (tests related to files changed since the last commit). It took 6.6-12 s on sample repos. The ESLint cache is safe because `lint` (no cache) runs again in `verify`.

Run it at the end of every slice and before saying any change is done. Run `npm run verify` before every push (the pre-push hook does it anyway).

## What is outside verify

| Run | When | Owner skill |
|---|---|---|
| `npm run test:mutation` | nightly, before a release, when a rules module is finished (break below 75%) | `unit-and-component-tests` |
| `npm run e2e:ios -- --app <game-id>` | nightly, before a release, after UI or navigation changes | `e2e-maestro` |
| `npm run screenshots:ios -- --app <game-id>` | before a release, after any UI change | `e2e-maestro`, `toybox-visual-parity` |
| `npm run audit:privacy` | after every prebuild (inside the build and release scripts) | `privacy-and-network-audit` |
