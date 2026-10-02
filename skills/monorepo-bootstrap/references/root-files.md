# Every root file: what it holds and why

The generator writes these files from `templates/repo/`. This reference explains the decisions inside each one, so a conflict can be resolved and a failing check understood without guessing. The templates are the exact content; this file is the reasoning.

## Contents

- package.json
- .npmrc, .nvmrc, .mise.toml
- .gitignore
- Prettier: .prettierrc.json and .prettierignore
- TypeScript: the two worlds and six tsconfig files
- eslint.config.mjs
- knip.json
- lefthook.yml
- quality-gates.json (the guardrail)
- .claude/settings.json
- Jest, Babel and Stryker files
- AGENTS.md and CLAUDE.md
- Merging an existing repo (conflicts)

## package.json

- `"private": true` and `"workspaces": ["apps/*", "packages/*"]`: the four workspace kinds.
- `"engines": { "node": ">=22.18", "npm": ">=11.17.0" }` with `engine-strict=true` in `.npmrc`. Node 22.18 is the first release with type stripping on by default, which `app.config.ts` relies on (without the `.ts` extension or with `--no-strip-types` Expo fails with "Cannot find module" or "Unexpected token '{'", both verified). npm 11.17.0 is the first release that reads `min-release-age-exclude`; an older npm silently ignores the excludes and the install fails with `ETARGET`.
- `"overrides"`: exact pins for every package whose caret range could pull a second copy of a pinned package into the tree. The skeleton ships no lockfile, so every bootstrap resolves the tree afresh on its own day; without these rows the result depends on what npm published that morning. Three groups, each proven by a failure:

| Group | Keys (value) | Why |
|---|---|---|
| One React | `react` 19.2.3, `react-native` 0.86.3 | Without it npm hoisted React 19.3.0 (pulled by a dev tool's peer) next to the app's 19.2.3; Jest resolves from the root, so tests ran a different React than the app ships. Check: `npm ls react react-native` shows one version each. |
| One typescript-eslint | the ten `@typescript-eslint/*` packages (`eslint-plugin`, `parser`, `project-service`, `scope-manager`, `tsconfig-utils`, `type-utils`, `types`, `typescript-estree`, `utils`, `visitor-keys`) at 8.70.1, the `typescript-eslint` pin | `eslint-config-expo` 57.0.2 asks for `^8.59.0` of them. On 2026-09-29 a fresh install resolved them to 8.71.0 (one day old) at the root while `typescript-eslint` 8.70.1 nested its own 8.70.1, and every ESLint run crashed with `Cannot redefine plugin "@typescript-eslint"`. Check: `npm ls @typescript-eslint/eslint-plugin` shows only 8.70.1. |
| One copy of each Shell native peer | every native module `packages/shell` lists as a `"*"` peer, at the version the apps install: `expo` 57.0.25, `@shopify/react-native-skia` 2.6.2, `react-native-gesture-handler` 2.32.0, `react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1 (later skills add `react-native-screens` 4.26.2, `react-native-safe-area-context` 5.7.0 and the others with the package) | A `"*"` peer is satisfied by any release, so npm may put its newest one at the root for the Shell next to the app's SDK pin (seen: `react-native-screens` 4.28.0 beside the app's 4.26.2). JavaScript then resolves one copy while autolinking builds the other, and `expo-doctor` reports duplicate native modules. |

  The values change only together with what they pin: the apps' versions (an SDK move, `expo-sdk-upgrade`) or the `typescript-eslint` row (`dependency-management`). `check-monorepo.mjs` fails a missing or different key (`root-overrides`), and the `dependency-management` skill's `check-deps-policy.mjs` fails two installed versions of any versions-table package (`one-version`).
- `scripts`: the canonical names and commands. The quality-gates guardrail compares the gate scripts byte for byte, and `check-monorepo.mjs` compares all of them with `templates/package-scripts.json`, the one list this skill and the quality-gates skill both ship (synced from the skill library, so the two cannot drift).

| Script | Runs | Available after the bootstrap |
|---|---|---|
| `prepare` | `lefthook install` (npm runs it after every install) | yes |
| `check:fast` | Prettier check, ESLint (cached), every tsc project, `jest --onlyChanged` | yes |
| `verify` | `node packages/tooling/src/quality/run-verify.ts`: the 11 gates in cheapest-first order, stopping at the first failure; while `shell-slice.json` exists it prints `SKIP` lines for knip's export and type kinds and for `test:sim` while no game has a `*.sim.test.ts` | stops at `i18n:verify` until that script exists |
| `format`, `format:check`, `lint`, `typecheck` | Prettier write/check, ESLint `--max-warnings 0`, root program then each `packages/*` and `apps/*` | yes |
| `test`, `test:golden`, `test:coverage` | Jest projects `unit` and `golden`; coverage thresholds | yes |
| `test:sim` | bot simulations (`jest.sim.config.js`) | fails "No tests found" until the first `*.sim.test.ts` |
| `test:mutation` | Stryker on logic folders (nightly, before releases) | yes (nothing to mutate much yet) |
| `knip` | unused files, exports and dependencies (`APP_VARIANT=test ADS_MODE=off` because knip evaluates `app.config.ts`) | yes |
| `audit:licenses` | licence of every package in the release bundles | needs `audit:network`'s exports |
| `new-game` | `packages/tooling/src/scaffold/new-game.ts`, written by the bootstrap: forwards `npm run new-game -- <args>` to the new-game-scaffold skill's generator in `skills/` (or the `.claude/skills/` link) | yes, once the skills folder is in the repo |
| `audit:network`, `audit:privacy`, `i18n:verify`, `e2e:ios`, `screenshots:ios`, `build:ios:sim`, `release:ios` | tooling scripts built by later skills | pending |

- `devDependencies`: exactly the tools the configs reference, each pinned exactly. `allowScripts` is written by `npm approve-scripts` after the first install.
- Never add `expo`, `react`, `react-native` or any native module at the root: they belong to the apps (autolinking and `npx expo install --check` only see an app's own dependencies).

## .npmrc, .nvmrc, .mise.toml

`.npmrc` holds the supply-chain policy: `min-release-age=7` (refuse versions younger than 7 days), `engine-strict=true`, `save-exact=true` (plain `npm install x` writes `1.2.3`, never `^1.2.3`).

The dated exclude block exists because several verified versions were younger than 7 days on 2026-09-26 (`expo` 57.0.25, `react-native-google-mobile-ads` 17.2.0, `expo-iap` 5.8.0, Prettier 3.9.9, knip 6.38.0 and others): a fresh resolution fails with `ETARGET No matching version found … with a date before …`. The block header is `# exclude-block expires=2026-10-03 reason=…`, and each of its 13 patterns was proven necessary by removal. `typescript-eslint` and `@typescript-eslint/*` left the block on 2026-09-29: 8.70.1 is 7 days old from that day, and the `@typescript-eslint/*` glob was what let a one-day-old 8.71.0 into a fresh install (the "one typescript-eslint" overrides above now pin all ten packages). The generator includes it only while today is on or before the expiry date; on 2026-10-04 and later every package is old enough and the block is omitted. An existing block must be deleted (never extended) once expired; the lockfile keeps the installed versions because `npm ci` and `npm install` with a lockfile do not re-check age. `check-deps.ts` (in `verify`) and `check-monorepo.mjs` fail on an undated or expired exclude.

`.nvmrc` holds `26.4.0` and `.mise.toml` pins `node = "26.4.0"` and `ruby = "3.2.2"` (Ruby only runs CocoaPods). Node 26 becomes LTS on 2026-10-28; after that, move both files to the newest 26.x LTS that is at least 7 days old, with a full verify run.

## .gitignore

Generated native projects and build output (`apps/*/ios/`, `apps/*/android/`, `apps/*/build/`, `apps/*/dist/`, `apps/*/sfx-preview/`), tool downloads (`/tools/`), reports, coverage, Stryker sandboxes, `node_modules/`, `.expo/`, `expo-env.d.ts`, and every signing or key file (`*.p8`, `*.p12`, `*.mobileprovision`, `*.keystore`, `*.jks`, `AuthKey_*`, `ApiKey_*`, `*.xcarchive`, `*.ipa`, `.env*`), plus `.claude/settings.local.json`. The generator appends missing lines to an existing `.gitignore` and never removes lines. The lefthook `no-secrets` job also refuses staged key files, which catches `git add -f`.

## Prettier: .prettierrc.json and .prettierignore

Options: `printWidth` 100, `singleQuote`, `trailingComma` "all", `bracketSpacing`, `arrowParens` "always", `endOfLine` "lf". Prettier runs as its own check (`format:check`); there is no `eslint-plugin-prettier`, and `eslint-config-prettier` only switches off conflicting ESLint rules. Prettier formats `package.json` like `JSON.stringify` (objects expanded), which is why the templates spell `"exports"` over three lines.

`.prettierignore` lists the lockfile, generated folders, snapshot and baseline folders, `skills/`, `.claude/`, and every pre-existing top-level entry (see the layout reference).

## TypeScript: the two worlds and six tsconfig files

Code lives in one of two worlds and never mixes them. App code (types `jest`, React Native) never imports a Node-world file, not even with `import type`, because a type-only import still pulls the file into the app program where `process` and `node:fs` do not type-check. Node code (tooling, the config composer, config plugins; types `node`) is never bundled into an app.

| File | World | `types` | Covers |
|---|---|---|---|
| `tsconfig.base.json` | shared | `[]` | compiler options only |
| `tsconfig.json` (root) | tests + Node-side config | `jest`, `node` | `jest.setup.ts`, `__mocks__/**`, `test/**`, `apps/*/app.config.ts`, `packages/shell/src/config/**`, `packages/shell/plugins/**` |
| `packages/game-kit/tsconfig.json` | app (pure) | `jest`, `lib: ESNext` | `src/**` |
| `packages/shell/tsconfig.json` | app | `jest` | `src/**` except `src/config/**` |
| `apps/<id>/tsconfig.json` | app | `jest` | `index.ts`, `game.config.ts`, `src/**`, the Shell's `app-env.d.ts` |
| `packages/tooling/tsconfig.json` | Node | `node`, `jest` (tests are colocated) | `src/**` |

A workspace tsconfig may set only `types`, `lib`, `include` and `exclude`; everything else comes from the strict base: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `erasableSyntaxOnly` (no enums), `allowImportingTsExtensions`, `verbatimModuleSyntax`, `isolatedModules`, `useUnknownInCatchVariables`, `allowUnreachableCode: false`, `allowUnusedLabels: false`, `forceConsistentCasingInFileNames`, `noErrorTruncation`, `incremental` with a build-info file under each project's `node_modules/.cache/tsc/`, and `customConditions: ["react-native-strict-api", "react-native"]` (overriding replaces the base array, so `react-native` must stay). TypeScript 6 defaults `types` to `[]`, so each world lists exactly what it may use; the tooling program needs `jest` too, or its colocated tests fail with TS2593.

Keep `expo-env.d.ts` and `.expo/types` out of every program: `expo/types` augments React Native with react-native-web props and breaks `TextStyle` under the Strict TypeScript API (TS2559, verified). `app-env.d.ts` declares `EXPO_PUBLIC_APP_VARIANT` (Expo inlines `EXPO_PUBLIC_*` only for dot access) and `declare const process`, and only app programs include it: in the root (Node) program it would replace `@types/node`'s `process`. `tsc` checks each file list separately (`npm run typecheck`); ESLint's projectService and the editor walk up to the nearest tsconfig that includes a file, which is how `packages/shell/src/config/**` reaches the root program.

## eslint.config.mjs

The one ESLint 9 flat config for the whole repo: `eslint-config-expo/flat`, then typescript-eslint `strictTypeChecked` + `stylisticTypeChecked` (projectService), then the project rules, then `eslint-config-prettier` last. Inline `eslint-disable` comments are inert (`noInlineConfig: true`) and reported; every exception is a `files`-scoped block. The rule blocks (limits, determinism, N3 network bans, N11 logical styles, N12 literal strings, vendor SDKs only in adapters, dependency zones, test rules) belong to the `typescript-and-lint-rules` skill.

What the bootstrap adds to the verified config: `globalIgnores` also lists `'skills/**'`, `'.claude/**'` and `...PRE_EXISTING` (the generator fills that list with the pre-existing top-level entries). The app zones read the folder names under `apps/` each time ESLint starts, so a new app needs no edit, and the config loads before any app exists.

## knip.json

Every issue type knip 6 knows is `"error"` (`cycles` defaults to `warn`, which would not fail). `includeEntryExports: true` on the three packages: their `exports` map turns every file into an entry, so without it a dead Shell or game-kit file is never reported. `ignoreExportsUsedInFile` keeps knip quiet about types used in their own file. The root workspace ignores the native libraries that the root Jest config, setup and `__mocks__/` load but the apps install: `@shopify/react-native-skia` (the golden project's test environment), `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`, `expo-iap` and `react-native-audio-api` (their root mocks), plus `@formatjs/cli` (run by name from the i18n tooling, never imported). Skia was added to that list on 2026-09-28: without it knip reported "Unlisted dependencies: @shopify/react-native-skia jest.config.js". `ignoreBinaries` lists the macOS tools the tooling spawns by name (`footprint`, `pgrep`, `plutil`, `sqlite3`), which no package provides. knip loads `app.config.ts`, which is why the `knip` script sets `APP_VARIANT=test ADS_MODE=off`, why `withShell` sets `updates.enabled: false` (else knip expects `expo-updates`) and why every app depends on `expo-system-ui` (`userInterfaceStyle: 'automatic'`). "Configuration hints" (patterns with no matches yet) do not fail the run.

Top-level `"ignore": ["skills/**"]`: knip's Jest plugin cannot read the `testMatch` of Jest projects, so it falls back to Jest's default test globs (`**/*.test.*`, `**/__tests__/**`, `**/__mocks__/**`) anywhere in the repo. Without the ignore it analysed every skill template and fixture and failed with 477 "Unlisted dependencies" and 115 "Unresolved imports" (verified 2026-09-28 with the full skills folder). The same list sits in `quality-gates.json` (`knip.ignore`), so the guardrail catches a widened ignore. Only a pre-existing top-level folder that holds such test-like files may join it (`<folder>/**`, with a `Gate-Change:` trailer); `check-monorepo.mjs` fails on anything else.

## lefthook.yml

- `pre-commit` (parallel, staged files): `no-secrets` (refuses key and signing files, with and without `**/`, because the default matcher needs a `/` before `**/.env*`), `format` (Prettier check), `lint` (ESLint `--max-warnings 0 --no-warn-ignored`), `typecheck` (the whole-project script: one file can break another), `test-related` (`jest --findRelatedTests`).
- `commit-msg`: `check-commit-message.ts` (Conventional Commits, scopes from `apps/` and `packages/` plus `repo`, `deps`, `docs`, `ci`, `skills`, 72-character header, `Gate-Change:` trailer when a gated path is staged).
- `pre-push`: `npm run verify`.
- `assert_lefthook_installed: true` fails loudly when the hooks were not installed. `npm install` installs them through `prepare` (so the repo must be a git repository before the first install).

## quality-gates.json (the guardrail)

The most likely failure of an unsupervised agent is quietly relaxing a threshold. `packages/tooling/src/quality/check-quality-gates.ts` compares what the tools resolve with this file: `eslint --print-config` for four probe paths (one names the pilot app: `apps/<pilot>/src/rules/gate-probe.ts`), `tsc --showConfig` for every tsconfig (the key `apps/*/tsconfig.json` covers every app), `jest --showConfig` coverage thresholds (a folder key may be absent while that folder has no source files), the gate scripts, the `.claude/settings.json` permissions and hooks, the knip rules, `lefthook dump`, and the three `.npmrc` policy lines. Objects are compared as subsets, arrays by position, values exactly. The `perf`, `a11y` and `gatedPaths` sections are read by tests and by the commit-msg hook. The hook (`commit-message-rules.ts`, `isGatedFile`) never lets a pattern that starts with a wildcard (`**/tsconfig.json`, `**/__image_snapshots__/**`) reach into `skills/` or `.claude/`: editing a skill's templates or fixtures needs no trailer, while `.claude/settings.json`, which a pattern names directly, stays gated (`check-monorepo.mjs` rule `gate-scope`). A mismatch means: restore the gate, never edit the JSON to match. When a new package is added under `packages/`, its tsconfig joins `typescript.projects` in the same commit.

## .claude/settings.json

- `enabledPlugins`: the Expo template enables `expo@claude-plugins-official`; it is kept (merge, do not drop), and `AGENTS.md` says not to use its EAS and cloud skills.
- `permissions.allow`: the skill scripts run without prompts (`Bash(node */.claude/skills/*/scripts/*)`, `Bash(node skills/*/scripts/*)`); the generator keeps every allow rule already in the file (the lead adds the rule for the skill library's own commands).
- `skillListingBudgetFraction: 0.04`: the skill listing budget, so all Pocket Arcade skills keep their descriptions in Claude's listing (the default 0.01 gave about 30,000 characters).
- `permissions.deny`: reading App Store Connect keys and signing files, and `git commit/push --no-verify` or `-n`. Deny rules cover Claude Code's own tools and recognised shell commands, not arbitrary subprocesses; the rule "never open or print the key" still applies to scripts.
- `permissions.ask`: every edit to a gate file (`eslint.config.mjs`, `quality-gates.json`, `lefthook.yml`, `knip.json`, `.prettierrc.json`, `.npmrc`, the Jest and Stryker configs, the `tsconfig*.json` files at the root and under `apps/` and `packages/`, the settings file itself) asks the owner. The tsconfig rules are anchored at the repo root (`Edit(/tsconfig*.json)`, `Edit(/apps/**/tsconfig*.json)`, `Edit(/packages/**/tsconfig*.json)`; a leading `/` means the project folder), because an unanchored `Edit(**/tsconfig*.json)` also prompted for every tsconfig template inside `skills/` (rule `gate-scope`). In a non-interactive run the edit is refused, which is the intended stop-and-ask.
- `hooks.PostToolUse` (`Edit|Write`): `node "$(git rev-parse --show-toplevel)/packages/tooling/src/hooks/after-edit.ts"`; it formats the edited file, runs `eslint --fix`, and exits 2 with the problems on stderr so Claude sees them. `git rev-parse --show-toplevel` finds the repo from any subfolder the shell has moved into and needs nothing from the environment; the script finds the repo root from its own path. This is exactly the form the `quality-gates` skill keeps as its baseline (its `check-gate-wiring.mjs` reports any other form as `gate-weakened`).
- `hooks.Stop`: `cd "$(git rev-parse --show-toplevel)" && npm run -s check:fast 1>&2 || exit 2`, which keeps Claude from stopping on a red tree. Claude Code allows 8 consecutive Stop-hook continuations; after that, report the failing gate.
- Hooks and permissions load only from the settings file of the folder the session starts in, so sessions start at the repo root.
- The skill-listing budget key (`skillListingBudgetFraction`) and any other key already in the file are kept by the merge.

## Jest, Babel and Stryker files

- `babel.config.js`: `babel-preset-expo` at the root so the root Jest run finds it; Stryker workers compile without the Worklets and Reanimated plugins (`STRYKER_MUTATOR_WORKER`), because Stryker's injected helpers inside a file-level `'worklet'` module fail with "stryNS_… is read-only".
- `jest.config.js`: projects `unit` (jest-expo iOS) and `golden` (Skia CanvasKit environment, `*.golden.test.ts`); `transformIgnorePatterns` allowlist for React Native, Expo, React Navigation, Skia and FormatJS; `moduleNameMapper` for `@e07/*`; `setupFiles` loads `packages/shell/src/i18n/intl-polyfills.ts` first; `TZ=UTC`; coverage thresholds 90/90/90/85 global and 95/95/95/90 for game-kit, the save service and `apps/*/src/rules`, each folder key added only once the folder has source files. `coveragePathIgnorePatterns` comes from `packages/tooling/src/quality/device-only.ts` (`deviceOnlyCoveragePatterns`): exactly the files whose first 6 lines carry `// device-only: covered by <e2e flow or simulator check>` leave coverage, the same marker check-tests and check-test-edits honour. The skills folder and `.claude/` are in `modulePathIgnorePatterns`.
- `jest.setup.ts`: Gesture Handler's Jest setup, the Worklets mock, Reanimated's `setUpTests()`, and the central Skia mock (Skia's native module does not load in the `unit` project; pixels are proven in `golden`).
- `jest.sim.config.js`: bot simulations only, Node environment, `babel-jest`, never in pre-commit.
- `stryker.config.json` + `tsconfig.stryker.json`: mutation testing on logic folders, thresholds high 90 / low 80 / break 75, incremental file under `reports/stryker/`. `ignorePatterns` keeps `skills` and `.claude` out of every sandbox copy (with the skills inside, Stryker copied 16,152 files); `check-monorepo.mjs` rule `stryker-config`.

These root files are shared byte for byte with the skills that maintain them (the tsconfig set, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore` with typescript-and-lint-rules; `knip.json`, `lefthook.yml`, `quality-gates.json`, `.gitignore`, `.claude/settings.json` and the tooling gate scripts with quality-gates; the Jest, Babel and Stryker files with unit-and-component-tests; `new-game.ts` with new-game-scaffold). Each has one canonical copy in the skill library, synced into every skill that ships it; change the canonical copy and run `node skills/_library/sync-shared.mjs`, never one skill's copy.

## AGENTS.md and CLAUDE.md

`AGENTS.md` is the short session contract every agent reads: sources of truth (the skills, starting with `pocket-arcade-index`), the session-start ritual, how to work, commands, what the project does not use, when to stop and ask, safety of the Mac and accounts, commits and reporting. It replaces the Expo template's `AGENTS.md` (which says "Use Expo Router"). `CLAUDE.md` is the one line `@AGENTS.md`, so Claude Code imports it and nothing is written twice. The owner may keep project notes for Claude Code in `CLAUDE.md` (how epics are run, where things are). The generator keeps an existing `CLAUDE.md` that already has the `@AGENTS.md` line (it prints `same CLAUDE.md (kept: ...)`), and gives one without it that line as its first line (`merge`). It is never a conflict.

## Merging an existing repo (conflicts)

The generator never overwrites a file whose content differs from the template:

- `.gitignore`: missing lines are appended.
- `package.json`: a manifest that differs from the template only by the `allowScripts` approvals (written by `npm approve-scripts` after the first install) counts as unchanged, so the dry run stays clean after the install; any other difference is a conflict.
- `.claude/settings.json`: existing keys and allow rules are kept; plugins are merged; `deny`, `ask` and `hooks` are set to the gate values. If the existing file already had different deny or ask rules or hooks, that is a conflict: the guardrail compares these arrays exactly, so either drop the extra rules or add them to `quality-gates.json` too, with the owner's agreement.
- Any other existing file that differs (for example an older `tsconfig.base.json`) is a conflict. Read both, keep what the owner needs by editing the template content into the file, or rerun with `--replace <file>` when the existing file is only an old draft. Report every replaced file.
