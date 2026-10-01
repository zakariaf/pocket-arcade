# First install and verification of the skeleton

The exact commands after `scaffold-monorepo.mjs --write`, what each one prints when things are right, what to do when they are not, and the evidence recorded when the skeleton was built end to end on 2026-09-28. Read it at workflow steps 6 to 10.

## Contents

- What gets installed at the bootstrap, and why only that
- Install and approve install scripts
- Format once
- The gate runs, one by one
- The Expo config for every allowed variant
- The first commit
- Pending gates (not failures)
- Known traps
- Verified on 2026-09-28
- Verified again on 2026-09-29 (one typescript-eslint, the pilot's files, native peers)

## What gets installed at the bootstrap, and why only that

The generated manifests already carry the exact versions of the verified Expo SDK 57 set, with the specifiers `npx expo install` writes for Expo-managed packages (`"expo": "~57.0.25"`, `"expo-system-ui": "~57.0.4"`, `"react-native-gesture-handler": "~2.32.0"`, exact for `react`, `react-native`, Skia, Reanimated and Worklets). `npx expo install --check` proves the specifiers afterwards.

| Where | Packages | Why at the bootstrap |
|---|---|---|
| root devDependencies | typescript 6.0.3, @types/node 26.4.1, @types/jest 29.5.14, @types/react 19.2.18, jest 29.7.0, jest-expo 57.0.5, babel-jest 29.7.0, @react-native/jest-preset 0.86.3, eslint 9.39.5, eslint-config-expo 57.0.2, typescript-eslint 8.70.1, eslint-plugin-sonarjs 4.2.1, eslint-plugin-react-native 5.0.0, @react-native/eslint-plugin 0.86.3, eslint-plugin-check-file 3.3.2, eslint-plugin-jest 29.16.6, eslint-plugin-testing-library 7.16.2, eslint-plugin-formatjs 8.1.0, eslint-config-prettier 10.1.8, globals 17.12.0, prettier 3.9.9, knip 6.38.0, lefthook 2.1.14, @stryker-mutator/core, jest-runner, typescript-checker 10.0.0 | every one is named by a config or a script |
| pilot app | expo, react, react-native, expo-system-ui, @shopify/react-native-skia, react-native-gesture-handler, react-native-reanimated, react-native-worklets, `@e07/shell` | the app runtime; Skia is the golden Jest environment, the other three are loaded by `jest.setup.ts` |
| packages/shell | the four `@formatjs/intl-*` polyfills (exact); peers for every native module of the apps | `intl-polyfills.ts` is Jest's first setup file |
| root `overrides` | `react`, `react-native`; the ten `@typescript-eslint/*` packages at 8.70.1; `expo`, Skia, Gesture Handler, Reanimated and Worklets at the versions the pilot installs | one copy of each: see `references/root-files.md` ("package.json"). The bootstrap ships no lockfile, so these pins are what makes a bootstrap on any day resolve the same tree |

The pilot's `package.json` is this minimal runtime set and nothing more (it is the shared per-app template the new-game scaffold copies for a first app too). Later games never take their dependencies from a template: the scaffold copies the newest app's list, so every app stays in lockstep.

Everything else (React Navigation, Zustand, valibot, expo-sqlite, expo-constants, expo-localization, expo-font, AdMob, expo-iap, the audio library, react-intl, @formatjs/cli, RNTL and test-renderer, fast-check, image-snapshot tools) is installed by the skill that first imports it, through the `dependency-management` skill. knip fails on a dependency nobody uses, and a package installed early is a package that ages without review.

## Install and approve install scripts

```sh
npm install                      # the first install writes package-lock.json (later: npm ci)
npm approve-scripts --allow-scripts-pending
npm approve-scripts lefthook unrs-resolver @shopify/react-native-skia
npm approve-scripts --allow-scripts-pending    # must print: No packages with unreviewed install scripts.
npm ls react react-native        # exactly one version of each (19.2.3, 0.86.3)
```

- The repo must be a git repository first: `npm install` runs `prepare` (`lefthook install`), which prints `sync hooks: ✔️(commit-msg, pre-commit, pre-push)`.
- Expected `npm warn deprecated` lines (inflight, glob 7, uuid 7, eslint 9 "no longer supported"…) come from pinned tools and are not failures. ESLint 9 is end-of-life since 2026-08-06 and held back on purpose: ESLint 10 breaks `eslint-plugin-react` inside `eslint-config-expo` 57.
- Read each install script before approving (`npm view <pkg>@<version> scripts`), then approve one package at a time; approvals are pinned to the installed version (`"lefthook@2.1.14": true`), so a version bump needs a new approval. What the three do:
  - `lefthook@2.1.14` postinstall: installs the platform binary of the git-hook runner.
  - `unrs-resolver@1.12.2` postinstall: picks the native resolver binary used by the ESLint import resolver (from `eslint-config-expo`).
  - `@shopify/react-native-skia@2.6.2` postinstall (`scripts/install-libs.js`): copies about 205 MB of iOS xcframeworks into `libs/`; an empty `libs/ios` breaks the iOS build. Skia 2.6.5 and later (SDK 58's 2.11.2) have no postinstall.
  - `fsevents@2.3.3` (install: `node-gyp rebuild`): the macOS file-watching addon, an optional dependency of `jest-haste-map` (through `jest`; `npm explain fsevents` shows the path). The first `npm install` usually leaves it out, but any later install on a Mac (after an `overrides` change, or the first `npx expo install`) installs it and lists it as pending; the pending list shows it as `fsevents@2.3.3 (install: (install scripts present))`. The script compiles its native addon locally with node-gyp; nothing is downloaded. Approving it is expected: `npm approve-scripts fsevents`, then `--allow-scripts-pending` must print `No packages with unreviewed install scripts.` again.
- The command exits 0 either way, so read its output; `check-deps.ts` and `check-monorepo.mjs` both fail while a script is pending.
- `npm install` also prints some moderate advisories ("N moderate severity vulnerabilities"; 23 on 2026-09-30, and the number grows as advisories are published). `npm audit` is not a gate, so the count is information for the report, never a failure. On 2026-09-30 every one of them traced back to two packages in build tooling: `uuid` 7 inside the `xcode` project parser of Expo's config plugins, and `qs` inside Stryker's `typed-rest-client` (`npm audit` lists the rest as `via` chains through `expo`; `npm explain <pkg>` shows the path); none reaches the app bundle, and `npm audit` proposes `npm audit fix --force`, which would move `expo` off SDK 57. Never run `npm audit fix`; note the count in the report. A fix arrives with an Expo patch release through the `dependency-management` upgrade procedure.

## Format once

```sh
npm run format
```

The generator writes merged JSON (`.claude/settings.json`) with `JSON.stringify`; Prettier makes it canonical. The templates themselves are already Prettier-clean, so a clean root shows no other change (`git diff` stays empty for them).

## The gate runs, one by one

`npm run verify` stops at the first missing tool (see "Pending gates"), so run the gates that exist on their own and keep every output for the report:

```sh
npm run -s check:fast                                   # Prettier, ESLint, all tsc projects, jest --onlyChanged
npm run -s lint                                          # full ESLint, no cache
npm run -s typecheck
npm run -s test:coverage                                 # 10 suites, 100% coverage on the seed code
npm run -s knip                                          # hints are fine; issues are not
node packages/tooling/src/quality/check-quality-gates.ts # prints: all resolved configs match quality-gates.json
EXPO_NO_TELEMETRY=1 node packages/tooling/src/deps/check-deps.ts   # silent, exit 0 (needs the network)
npx lefthook validate                                    # All good
node ${CLAUDE_SKILL_DIR}/scripts/check-monorepo.mjs .
```

`check-deps.ts` runs `npx expo install --check` ("Dependencies are up to date") and `npx expo-doctor` ("21/21 checks passed") in every app, the dated-exclude check, the banned-package check on the lockfile, the lockstep check and the install-script check. When Expo has published a patch in the last 7 days (for example `expo@57.0.25 - expected version: ~57.0.26`), it prints a `WARN` line with the day the patch becomes due and still exits 0: installing the patch today would break `min-release-age=7`. From that day on the mismatch fails; the `dependency-management` skill then moves the package, its versions-table row and its root override in one commit.

The pilot must also pass the new-game checks, because every later game is compared with it: the bootstrap already wrote its `.gitignore`, the five fonts with their three licence texts and the four canonical Line Siege catalogs, so the `new-game-scaffold` skill's `check-game-app.mjs . --app line-siege --stage scaffold` passes on the fresh skeleton without moving a file (`check-monorepo.mjs` checks the same files under `app-files`).

## The Expo config for every allowed variant

```sh
cd apps/<pilot>
export EXPO_NO_TELEMETRY=1 CI=1
APP_VARIANT=test  EXPO_PUBLIC_APP_VARIANT=test  ADS_MODE=test npx expo config --json
APP_VARIANT=test  EXPO_PUBLIC_APP_VARIANT=test  ADS_MODE=off  npx expo config --json
APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off  npx expo config --json
APP_VARIANT=test  EXPO_PUBLIC_APP_VARIANT=test  ADS_MODE=off  npx expo config --type introspect --json
APP_VARIANT=test  EXPO_PUBLIC_APP_VARIANT=test  ADS_MODE=off  npx expo export --platform ios --output-dir <scratch folder>
```

Expect: `ios.bundleIdentifier` and `android.package` `io.applander.linesiege` in every variant, `scheme` `e07-<pilot>` only in test builds, `extra.appVariant` and `extra.adsMode` as set, no `extra.adUnits` key unless `ADS_MODE=live`, no `null` anywhere in `extra` (a `null` arrives on the device as `{}` and breaks the strict parser), `updates.enabled: false`, `experiments.reactCompiler: true`, the local plugin `@e07/shell/plugins/with-app-variant-marker.ts`, and in the introspected config `ios.infoPlist.E07AppVariant` equal to the variant and `ITSAppUsesNonExemptEncryption: false`. `APP_VARIANT=store` without `EXPO_PUBLIC_APP_VARIANT=store` must fail with "EXPO_PUBLIC_APP_VARIANT=test must equal APP_VARIANT=store". The export bundles the placeholder entry; it proves Metro, the React Compiler and the workspace links work with the skills folder present.

## The first commit

```sh
git status --short        # what else is uncommitted: the owner's own changes stay out of this commit
git add package.json package-lock.json .npmrc .nvmrc .mise.toml .gitignore .prettierrc.json .prettierignore \
  tsconfig.base.json tsconfig.json tsconfig.stryker.json eslint.config.mjs knip.json lefthook.yml quality-gates.json \
  .claude/settings.json AGENTS.md CLAUDE.md babel.config.js jest.config.js jest.setup.ts jest.sim.config.js \
  stryker.config.json apps packages
git commit -m "chore(repo): scaffold the monorepo and its gates" -m "Gate-Change: initial quality gates"
```

Stage exactly the files the generator wrote (the list above), never `git add -A`: the repo may hold the owner's uncommitted edits or folders (handbook changes, design exports, the skills), and those belong in their own commits, which the owner decides. If `git status` shows such changes, name them in the report and ask. The commit stages gated files, so the `Gate-Change:` trailer is required. The hooks run: pre-commit (format, lint, typecheck, related tests, no-secrets) and commit-msg. A header such as "Updated stuff." is rejected. Never pass `--no-verify` (the deny rules block it anyway). Pushing is outward-facing: only when the owner asks, and then `pre-push` runs `npm run verify`.

## Pending gates (not failures)

| Gate | State after the bootstrap | Becomes green when |
|---|---|---|
| `npm run i18n:verify` | `packages/tooling/src/i18n/verify-catalogs.ts` does not exist | the `i18n-strings-and-catalogs` skill writes it with the first catalogs |
| `npm run test:sim` | "No tests found", exit 1 | the first `*.sim.test.ts` (`game-balance-and-bots`) |
| `npm run audit:network` | script missing | the `privacy-and-network-audit` skill |
| `npm run audit:licenses` | "no source maps at dist-audit/…; run npm run audit:network first" | after `audit:network` exports the bundles |
| `npm run verify` | stops at `i18n:verify` | all four above exist |

Other skills' checkers run on the fresh skeleton report the same phase-0 gaps, which are expected, not bootstrap bugs: `quality-gates` `check-gate-wiring.mjs` passes with `--pending packages/tooling/src/i18n/verify-catalogs.ts --pending packages/tooling/src/audit/audit-network.ts`; `architecture-and-boundaries` `check-layout.mjs` passes and only notes that the placeholder `index.ts` and the missing `src/index.ts` are not checked until `packages/shell/src/app/start-shell.ts` exists; `unit-and-component-tests` `check-test-setup.mjs` reports RNTL, `test-renderer` and `fast-check` until the first component or property test installs them.

`check-monorepo.mjs` prints each missing tool script as `pending` with the skill that builds it. Report them to the owner in plain words ("the full pre-push check is not complete yet; four checks arrive with later steps"); never stub a script so that `verify` passes.

## Known traps

- `npx expo install X -- --save-dev` puts packages into `dependencies`; use `npx expo install X --dev`. For a package outside Expo's module map, `npx expo install` just runs `npm install --save` at npm `latest` with a caret: use `npm install <pkg>@<exact> -w <workspace>` instead.
- `npm ls --parseable` redacts UUID-like path segments as `***`; read `package-lock.json` instead.
- A `.DS_Store` file inside `apps/` is not an app; `check-deps.ts` and `check-monorepo.mjs` only count folders that hold a `package.json`.
- Every ESLint run (`npm run lint`, `check:fast`, the pre-commit hook) crashes with `ConfigError: Config "UserConfig[0][4] > typescript-eslint/base": Key "plugins": Cannot redefine plugin "@typescript-eslint".` Two copies of `@typescript-eslint/eslint-plugin` are installed: `eslint-config-expo` resolved its `^8.59.0` range to a newer release at the root while `typescript-eslint` 8.70.1 nested its own 8.70.1 (`npm ls @typescript-eslint/eslint-plugin` shows both). Fix: restore the ten `@typescript-eslint/*` rows in the root `overrides` (all at the `typescript-eslint` pin), make sure no `.npmrc` exclude names `typescript-eslint` or `@typescript-eslint/*`, run `npm install`, and check that `npm ls @typescript-eslint/eslint-plugin` shows one version. `check-monorepo.mjs` (`root-overrides`) and the `dependency-management` skill's `check-deps-policy.mjs` (`one-version`) name the same cause.
- `check-deps.ts` or `expo-doctor` reports duplicate native modules (`Found duplicates for react-native-screens: 4.28.0, 4.26.2`) right after a skill added a native module: the Shell's `"*"` peer let npm put the newest release at the root next to the app's SDK pin. Add the package to the root `overrides` at the version the app installed (`npm ls <pkg>`), `npm install`, and rerun; the `dependency-management` skill's `plan-dependency.mjs` prints that override with every native install.
- `check-deps.ts` prints `WARN ... was published <date>; min-release-age=7 refuses it until <due date>`: an Expo patch younger than 7 days. It is not a failure yet; leave it until the due date (the dependency-management skill's "When a gate fails" section).
- A `min-release-age` failure looks like `npm error notarget No matching version found for <pkg>@<v> with a date before <date>`: the version is younger than 7 days. Do not delete the lockfile or loosen the policy; the `dependency-management` skill has the dated-exception procedure.
- A first `jest` run takes about 40 s (cold transform cache); later runs take about 2 s.
- knip failing with hundreds of "Unlisted dependencies" or "Unresolved imports" under `skills/…` means `knip.json` lost `"ignore": ["skills/**"]` (its Jest plugin falls back to Jest's default test globs everywhere); restore it from the template.
- The commit-msg hook crashing with `spawnSync git ENOBUFS` means a `check-commit-message.ts` without the raised `maxBuffer` (a commit that stages the skills folder lists over 1 MB of paths); restore the file from the template.
- If `npm run knip` reports "Unlisted dependencies" for a native library that a root config names (Jest environment or setup), add it to the root workspace's `ignoreDependencies` in `knip.json` with a `Gate-Change:` trailer; installing it at the root would split its version from the apps.

## Verified on 2026-09-28

In a scratch repo generated by `scaffold-monorepo.mjs` (pilot `line-siege`, a pre-existing `README.md`, `notes/` and `handbook/` with a `.mjs` file), Node 26.4.0, npm 11.17.0, macOS 27:

- `npm install`: 1,212 packages in 1 min 16 s, hooks synced; three install scripts pending, approved as above; `npm ls react react-native` showed only 19.2.3 and 0.86.3.
- `format:check` clean after copying Prettier's layout back into the templates; ESLint clean in 5 s; `typecheck` (root, three packages, the app) in 2 s.
- `test:coverage`: 10 suites, 43 tests (46 after the reviewer added three release-age cases), 100% statements, branches, functions and lines.
- `knip`: clean once `@shopify/react-native-skia` joined the root `ignoreDependencies`; six configuration hints.
- Guardrail: "all resolved configs match quality-gates.json" in 9 s. `lefthook validate`: "All good".
- `check-deps.ts`: exit 0 in 5.5 s; `expo install --check`: "Dependencies are up to date"; `expo-doctor`: 21/21.
- `expo config --json` for test/test, test/off and store/off, plus `--type introspect` (E07AppVariant = test); `expo export --platform ios`: 579 modules, React Compiler enabled.
- First commit through all hooks with the `Gate-Change:` trailer; "Updated stuff." rejected by commit-msg; `after-edit.ts` exited 2 on a game-kit file using `Math.random`; `check:fast` green in 6.5 s.
- With a copy of the skills folder and a `.claude/skills/<name>` link inside the repo: Prettier, ESLint and knip clean; Jest printed five "Haste module naming collision" warnings until `skills` and `.claude` joined `modulePathIgnorePatterns`, then none.
- `check-monorepo.mjs .` PASS on the installed repo; with `--today 2026-10-04` it reported the expired excludes (15 then, 13 since `typescript-eslint` left the block).
- Not run here: prebuild and a Release simulator build of the placeholder app (the `ios-simulator-build` skill owns them).

Re-run by the reviewer on 2026-09-28 in a fresh folder with the complete skills library at `skills/` (40 skills) and `.claude/skills/<name>` links: a real `npm install` (1,212 packages in 56 s, 12 moderate advisories that day), the three approvals, then every gate above green, including knip once `skills/**` joined its `ignore` (before: 477 unlisted dependencies from skill fixtures); the `quality-gates` skill's `check-gate-wiring.mjs` and `check-bypasses.mjs` passed on the generated files with the two `--pending` targets; the PostToolUse hook command, run from `apps/line-siege`, exited 2 on a game-kit file using `Math.random`, and the Stop hook command exited 0. The first commit (skills folder staged) crashed the commit-msg hook with `ENOBUFS` until `check-commit-message.ts` raised its `maxBuffer`; after that "Updated stuff." and a missing `Gate-Change:` trailer were rejected and the real commit went through every hook.

## Verified again on 2026-09-29 (one typescript-eslint, the pilot's files, native peers)

In an empty git repo, Node 26.4.0, npm 11.17.0: `scaffold-monorepo.mjs --root . --app line-siege --name "Line Siege" --write` wrote 92 files (the dry run afterwards: `0 new, 0 merged`), including `apps/line-siege/.gitignore`, the eight font files and the four Line Siege catalogs.

- Before `npm install`, the new-game scaffold's `check-game-app.mjs . --app line-siege --stage scaffold` passed, and its `scaffold-game.mjs --app line-siege --add-missing` reported every file `same` (`0 new files`): the two skills write identical bytes.
- `npm install`: 1,212 packages in 54 s, 12 moderate advisories, the three expected install scripts. `package-lock.json` held exactly one version of each `@typescript-eslint/*` package (8.70.1), `react` 19.2.3, `react-native` 0.86.3 and `expo` 57.0.25.
- `check:fast`, `lint`, `test:coverage` (14 suites, 113 tests), `knip` (configuration hints only) and the guardrail passed; `check-monorepo.mjs .`, the dependency-management skill's `check-deps-policy.mjs .`, the typescript-and-lint-rules skill's `check-configs.mjs .` and the expo-sdk-upgrade skill's `check-sdk-alignment.mjs .` printed `RESULT: PASS`. The app program type-checks with the `react-navigation.d.ts` include before the file exists.
- `check-deps.ts` exited 0 with two `WARN` lines: `expo` 57.0.26 had been published that morning, so `expo install --check` and `expo-doctor` both expected it; the warning names 2026-10-07 as the day it becomes due.
- The same skeleton without the ten `@typescript-eslint/*` overrides and with the old `typescript-eslint` excludes resolved `node_modules/@typescript-eslint/eslint-plugin` 8.71.0 next to `typescript-eslint`'s nested 8.70.1, and ESLint crashed with `Cannot redefine plugin "@typescript-eslint"`. `check-monorepo.mjs` failed `root-overrides` and `check-deps-policy.mjs` failed `one-version` for each package.
- Adding `react-native-screens` and `react-native-safe-area-context` as Shell `"*"` peers without overrides, `npm install`, then `npx expo install` of both in the app left 4.28.0 and 5.10.0 at the root beside the app's 4.26.2 and 5.7.0 (`check-deps-policy.mjs` `one-version` and `peer-override`, `check-sdk-alignment.mjs` `duplicate-native` naming 4.26.2 and 5.7.0). With the two overrides and `npm install` one copy of each remained, and `fsevents@2.3.3` appeared as a pending install script (the later-install case above); after `npm approve-scripts fsevents` everything passed.
