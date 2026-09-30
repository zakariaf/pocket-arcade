# The root gate files, entry by entry

Why each entry of the root gate files exists, so a failing gate can be fixed at its cause and no entry is "cleaned up" by mistake. Every file here is synced from the skill library and is a gated path: a change needs the owner's agreement, the matching `quality-gates.json` change and a `Gate-Change:` trailer in the same commit.

## Contents

- knip.json
- The verify runner and shell-slice.json
- jest.config.js: thresholds and the device-only marker
- The commit-message rules: one rule set for the hook and check-commits
- What check-gate-wiring compares

## knip.json

knip 6.38.0 reports unused files, exports and dependencies and unlisted dependencies and binaries. Every issue type is `"error"` (`cycles` defaults to `warn`, which would not fail the run), and `quality-gates.json` holds the same `rules` and `ignore` list, so the guardrail catches a relaxed rule. The three ignore lists below hold the only entries allowed, because an ignore entry silences knip for good: this skill's `check-gate-wiring.mjs` fails any extra `ignoreBinaries` or `ignoreDependencies` entry (`knip-ignores`), and monorepo-bootstrap's `check-monorepo.mjs` any extra `ignore` glob.

| Entry | Why it is there | What happened without it (verified) |
|---|---|---|
| `"ignore": ["skills/**"]` | knip's Jest plugin cannot read the `testMatch` of Jest projects and falls back to Jest's default test globs anywhere in the repo, so it would analyse every skill template and fixture | 477 "Unlisted dependencies" and 115 "Unresolved imports" from the skills folder |
| `"ignoreBinaries": ["footprint", "pgrep", "plutil", "sqlite3"]` | macOS system tools that tooling templates start by name: `footprint` and `sqlite3` in the simulator performance steps (`packages/tooling/src/e2e/sim-perf-steps.ts`), `pgrep` in the simulator helper and the runtime network audit (`e2e/simulator.ts`, `audit/network-runtime-layer.ts`), `plutil` in the simulator helper, the build script, the privacy manifest audit, the release build and the StoreKit harness, `sqlite3` again in `build/build-ios-sim.ts`. They ship with macOS and are not npm packages, so they can never be listed | "Unlisted binaries (8)" on a repo built only from the templates |
| root `ignoreDependencies`: `@shopify/react-native-skia`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets` | native libraries the root Jest config and `jest.setup.ts` load (Skia is the golden project's test environment); the apps install them, the root does not | "Unlisted dependencies: @shopify/react-native-skia jest.config.js" and the same for the other three |
| root `ignoreDependencies`: `@formatjs/cli` | `packages/tooling/src/i18n/verify-catalogs.ts` runs the `formatjs verify` command through `npx`; knip sees no import of the package, so it calls the root devDependency unused | "Unused devDependencies: @formatjs/cli" |
| root `ignoreDependencies`: `expo-iap`, `react-native-audio-api` | the root `__mocks__/expo-iap.ts` (unit-and-component-tests) and `__mocks__/react-native-audio-api.ts` (game-audio-and-haptics) import the real libraries' types and helpers; the apps install them, the root does not | "Unlisted dependencies: expo-iap/build/types.js __mocks__/expo-iap.ts" and "react-native-audio-api __mocks__/react-native-audio-api.ts" |
| `includeEntryExports: true` on `packages/game-kit`, `packages/shell`, `packages/tooling` | their `exports` map makes every file an entry, so without it an unused export there is never reported | dead Shell and game-kit exports passed silently |
| `ignoreExportsUsedInFile: true` | a props type or an `as const` table used by its own file is not dead code | noise on every component's props type |
| the `workspaces` entry and project globs | the root workspace sees `__mocks__/` and `test/`; apps enter through `src/index.ts` and their tests; the Shell also through `plugins/*.ts` | unused-file reports for mocks, root tests and config plugins |

Two findings are not handled by `knip.json`, on purpose:

- **Exports reached only through `require` in `app/test-only.ts`** (the test-build entry `test-only-entry.ts` and the parity harness it re-exports): knip does not follow that `require`, and with `includeEntryExports` adding the file as an entry does not help. Each such export carries `/** @public */`, which knip honours (ios-simulator-build's `test-only-entry.ts` template does). Never add the file to `ignore`.
- **Exports that only a later build layer uses** (a selector the Stats screen will read, a hook of a screen not built yet): these are expected while a partial Shell is being built. `npm run verify` runs knip without its export and type kinds while `shell-slice.json` exists (next section); once the file is gone every export must be used or deleted.

"Configuration hints" (for example "Remove redundant entry pattern" for `apps/<id>/src/index.ts`, or a pattern that matches nothing yet) are printed but do not fail the run. The `knip` script sets `APP_VARIANT=test ADS_MODE=off` because knip's Expo plugin evaluates `app.config.ts`.

## The verify runner and shell-slice.json

`npm run verify` is `node packages/tooling/src/quality/run-verify.ts`. The steps live in `verify-plan.ts` (tested by `verify-plan.test.ts`), in this order, stopping at the first failure like `a && b && c`: `format:check`, `lint`, `typecheck`, `i18n:verify`, `knip`, the guardrail, `test:coverage`, `test:sim`, `audit:network`, `audit:licenses`, `check-deps.ts`. `run-verify.ts` only wires the plan to the shell and carries the device-only marker (the plan is what the tests cover).

`shell-slice.json` at the repo root declares a partial Shell:

```json
{ "screens": ["S4", "S11", "S12"], "why": "Home + Settings parity slice" }
```

Valid ids are S1-S15 and S11a-S11d. `"screens": []` means a game-first repo with no Shell app; no file means the full Shell, and every gate is strict. `shell-slice.ts` parses it (tested by `shell-slice.test.ts`); a malformed file (unknown key, unknown or repeated screen, empty `why`) stops `verify` at once instead of relaxing anything. The skill checkers read the same file with the same rules (`readShellSlice` in their helper).

While the file exists, exactly two steps change, and each prints a `SKIP` line that does not count as a failure:

| Step | While shell-slice.json exists | The SKIP line |
|---|---|---|
| `knip` | runs as `npm run -s knip -- --exclude exports,nsExports,types,nsTypes,enumMembers,namespaceMembers,duplicates`: files, dependencies, unlisted and binaries are still checked | `SKIP shell-slice.json [knip-exports] knip runs without the export and type issue kinds while shell-slice.json exists (<why>); ...` |
| `test:sim` | does not run while no `*.sim.test.ts` exists under `apps/*/src`, `packages/*/src` or `test/`; once one exists it runs and must pass | `SKIP jest.sim.config.js [test-sim] no game has a *.sim.test.ts yet and shell-slice.json exists: test:sim has nothing to run` |

Without the file, `test:sim` with no sims fails with "No tests found", which is correct: the full Shell has a pilot with sims. Nothing uses `--passWithNoTests`. The last line of a green run is `verify: <n> steps passed, 0 skipped` when no step printed a `SKIP` line. A step that ran with a `SKIP` line (knip without its export kinds) is counted apart and a step that did not run is counted as skipped, so a slice run never reads as clean: `verify: 11 steps passed, 1 with SKIP lines` (a slice with sims) or `verify: 10 steps passed, 1 skipped, 1 with SKIP lines` (a slice before the first sim). A report quotes that line as it is.

A slice never ships: `check-navigation.mjs . --complete` (navigation-and-routing), `check-game-app.mjs . --stage complete` (new-game-scaffold), `check-release-setup.mjs .` and `check-store-artifact.mjs` (ios-release-testflight) fail while `shell-slice.json` exists or any route still points at `NotBuiltScreen`. Writing the file only to silence knip or `test:sim` is a gate bypass.

Which verify steps are expected red before which build step is in [gates-overview.md](gates-overview.md) ("When verify is green").

## jest.config.js: thresholds and the device-only marker

- Thresholds: global 90/90/90/85 (statements, lines, functions, branches); 95/95/95/90 for `packages/game-kit/src/`, `packages/shell/src/services/save/` and every `apps/*/src/rules/**/*.ts` file. A folder key joins only once the folder has source files, because a key with no data makes Jest exit 1.
- `coveragePathIgnorePatterns` is `['/node_modules/', ...deviceOnlyCoveragePatterns(__dirname)]` and nothing else. `packages/tooling/src/quality/device-only.ts` (tested by `device-only.test.ts`) lists every source file under `apps/*/src` and `packages/*/src` whose first 6 lines hold `// device-only: covered by <the e2e flow or simulator check that exercises it>`, and turns each into one exact path pattern. A marker without "covered by" and a few words counts as no marker.
- The marker is only for native adapters over a device API, Skia and frame-callback modules, composition files that only wire tested parts, and tooling entry points. Fakes and pure helpers always get tests. The unit-and-component-tests skill documents the policy and which template files carry the marker; tdd-workflow's `check-tests.mjs` and `check-test-edits.mjs` read the same marker.
- Why: on the first Shell build, template files shipped without tests or markers held global statements at 83.8%, and a hand-written ignore list would hide real code. With the helper, the only way out of coverage is a marker that names the check that covers the file, in the file itself, where review sees it.

## The commit-message rules: one rule set for the hook and check-commits

The `commit-msg` hook runs `node packages/tooling/src/git/check-commit-message.ts {1}`, which applies `commit-message-rules.ts` and `commit-trailer-rules.ts`. The git-commits-and-reporting skill's `check-commits.mjs` enforces the same rules with the same ids, so a message the hook accepts never fails `check-commits.mjs` later, and the other way round:

- header `type(scope): subject`, a known type, a scope that is a folder under `apps/` or `packages/` or one of `repo`, `deps`, `docs`, `ci`, `skills`, at most 72 characters, lowercase, imperative, no period, not vague;
- a blank second line; a `feat` or `fix` has a body (`body-missing`) that names the spec lines it serves (`spec-ref-missing`, for example "Spec S9 and 8.3: ..."), except in the `tooling` scope and the fixed scopes;
- trailers in the last paragraph, with a real reason; `Spec-Change: spec <section> <what changed>`; `Gate-Change:` exactly when a changed file matches `gatedPaths` (`gate-change-missing`, `gate-change-unneeded`); no `__PLACEHOLDER__` left;
- git-generated headers (`Merge`, `Revert "`, `fixup!`, `squash!`, `amend!`) pass; comment lines and everything below the scissors line are dropped first.

`packages/tooling/src/git/commit-message-samples.json` holds a good message and at least one sample per rule with the exact rule ids it must give. `commit-message-rules.test.ts` runs every sample through the hook's rules, and git-commits-and-reporting's self-test runs the same list through `check-commits.mjs --samples`. A new rule is added to both rule sets and to the sample list in one change; otherwise one of the two tests fails.

## What check-gate-wiring compares

`check-gate-wiring.mjs` reads the files without running any tool: the gate files and tooling files exist; the canonical npm scripts match `templates/package-scripts.json` byte for byte (`verify` included); `quality-gates.json` is no weaker than the template; the hooks, permissions and `.npmrc` lines are there; `verify-plan.ts`, `run-verify.ts`, `shell-slice.ts` and `device-only.ts` equal the templates (`gate-script-changed`); `shell-slice.json`, when present, parses; knip's ignore lists hold only the entries above (`knip-ignores`); the commit rules keep `skills/` and `.claude/` out of gated paths (`gate-scope`). The guardrail (`check-quality-gates.ts`, a step of `verify`) then compares what the tools actually resolve.
