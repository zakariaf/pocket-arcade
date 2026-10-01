# Pocket Arcade skill library

`skills/_library/` holds the tools every skill builder uses. They validate skills against the authoring standard, keep the shared files in sync, run every self-test, link skills into `.claude/skills/`, and track which project files each skill's knowledge was copied from. Everything is Node 22+ with zero dependencies. Every command prints `--help`, exits 0 (pass), 1 (problems found) or 2 (bad input or environment), and ends with `RESULT: PASS` or `RESULT: FAIL (<n> problems)`.

Binding rules: [AUTHORING-STANDARD.md](AUTHORING-STANDARD.md). Build plan: [CATALOGUE.md](CATALOGUE.md).

## Contents

- The order to run things
- Commands
- Starting a new skill
- Shared files and assets/shared.json
- Writing skill scripts with check-lib
- What the validator checks
- Tracking sources: sources.json
- Settings for .claude/settings.json
- Symlinked skills: test results
- The library's own tests
- Folder map

## The order to run things

Run from the repo root after any change to a skill or to the shared files:

```sh
node skills/_library/sync-shared.mjs        # 1. copy shared files into every skill that declares them
node skills/_library/validate-skills.mjs    # 2. check every skill against the standard
node skills/_library/selftest-all.mjs       # 3. prove every checker (library self-test included)
node skills/_library/link-skills.mjs        # 4. make Claude Code see new skills (.claude/skills/<name> links)
```

Also run `node skills/_library/check-staleness.mjs` before a release or after the project docs change. When the Toybox tokens or the copy deck change in the project, run `node skills/_library/refresh-shared.mjs` first, then the four steps above.

## Commands

| Command | What it does | Exit 1 means |
|---|---|---|
| `sync-shared.mjs [skill...] [--check]` | Copies files from `_library/shared/` into each skill that lists them in `assets/shared.json`, and removes extra files from mirrored folders. `--check` changes nothing. No arguments: every skill, the skill template and the validator test cases. | a manifest is invalid, or (with `--check`) a copy is missing, changed or extra |
| `validate-skills.mjs [skill...] [--no-run] [--json]` | Checks skills against the standard (next sections). A skill is a folder name in `skills/`, `skill-template`, or a path. No arguments: every skill, the template, and the layout of `skills/`. Prints `PASS`/`FAIL` per skill, then the RESULT line. `--no-run` skips running skill scripts. | at least one rule is broken |
| `selftest-all.mjs [skill...] [--skip-library]` | Runs the library self-test, each `shared/scripts/*.selftest.mjs`, and every skill's `scripts/selftest.mjs` from the repo root, then prints a table. Skills without scripts are skipped; scripts without `selftest.mjs` fail. The shared `check-testids` self-test needs Playwright: it uses `PLAYWRIGHT_DIR` when set, otherwise the pinned install of a skill that syncs `check-testids.mjs` (`npm ci --prefix skills/toybox-visual-parity/scripts`). | a self-test failed or is missing |
| `link-skills.mjs [--check] [--copy] [--root dir]` | Creates `.claude/skills/<name> -> ../../skills/<name>` for every skill folder with a `SKILL.md`, and removes links it made whose skill is gone. Real folders and links pointing elsewhere are never touched (a real folder in the way is a `link-conflict`). `--copy` copies instead of linking (fallback only; see below). | a link is missing, wrong or stale (`--check`), or a conflict |
| `check-staleness.mjs [skill...] [--strict]` | Compares every source in `sources.json` with the project file today. `--strict` also fails on reference files with no recorded sources. | a source changed (`stale-source`) or disappeared |
| `record-sources.mjs <skill> <skill-file> <source-file>...` | Records the sha256 of each project source a skill file was copied from. Replaces that file's list; `--append` adds to it. `<skill>` may be `_library`. | (never; bad input exits 2) |
| `refresh-shared.mjs [--check]` | Re-imports `design/toybox/tokens.json` and `design/shared/copy-deck.json` into `shared/toybox-tokens.json` and `shared/copy-deck.json`, rewriting the few provenance strings that name project files, and records the sources. | (with `--check`) a shared copy is out of date |
| `tests/build-cases.mjs` | Rewrites `tests/cases/` (the validator's sample skills) from its mutation table. | never |
| `tests/selftest.mjs` | The library's own self-test (run by `selftest-all.mjs`). | a library tool misbehaves |

All tools accept `--skills-root <dir>` or `--root <dir>` so the tests can run them on throwaway folders.

## Starting a new skill

1. Copy the model skill: `cp -R skills/_library/skill-template skills/<new-name>`.
2. In `SKILL.md`, set `name: <new-name>` and rewrite the description ("Builds ... for Pocket Arcade. Use when ... Not for ... (use `other-skill`)."), the title and every section. Keep the section order.
3. Replace `references/`, `templates/`, `scripts/check-exports.mjs` and `tests/fixtures/` with the skill's own content. Delete folders the skill does not need. If the skill has no scripts, delete `scripts/`, `tests/`, and the `check-lib.mjs` line in `assets/shared.json` (delete the file if it becomes `[]`).
4. Copy knowledge in, never point at it (next sections). After copying from project files, run `record-sources.mjs` for each copied file.
5. Run the four steps of the order above until everything prints `RESULT: PASS`.

## Shared files and assets/shared.json

`_library/shared/` holds the one canonical copy of data several skills need:

| Shared path | What it is |
|---|---|
| `scripts/check-lib.mjs` | The script helper every skill script imports (API below) |
| `toybox-tokens.json` | Toybox design tokens (a copy of the project's token file with the provenance strings rewritten) |
| `copy-deck.json` | The copy deck: every UI string in en, de, fa, ckb (same treatment) |
| `fonts/` | `LilitaOne.ttf`, `Rubik-Regular/Medium/Bold.ttf`, `Vazirmatn-Regular/Bold.ttf`, their OFL texts, and `SOURCES.md` (URLs and sha256 of each file) |
| `screen-testids.json` | The screen testID map (every screen part, its testID, its parity checks and its `coveredBy` part for crop-only parts; a part drawn only for some games carries `when` with the game fact that selects it, such as `hasMusic`, `hasHints` (`game.hint-button`: `when: { hasHints: true }`) or `winLine`; a part with `surface: true` is an accessible element drawn as the bottom layer of a card, such as `home.daily-card`, whose visible texts are crop-only parts covered by it; and a `notDrawn` part may carry its accessibility `role`); used by the screens, parity and E2E skills (owned by the parity package) |
| `scripts/check-testids.mjs`, `scripts/check-testids.selftest.mjs`, `tests/fixtures/check-testids/` | The shared testID-map checker, its self-test and fixtures (needs Playwright; see `selftest-all.mjs`) |
| `scripts/lib/source-scan.mjs`, `scripts/lib/workspaces.mjs` | Script helpers (not entry points) for checkers that scan TypeScript sources or read the npm workspaces |
| `scripts/lib/maestro-spawns.mjs` | The `maestro-device` rule (a helper, not an entry point): every spawn of the Maestro binary in repo tooling names `--device <udid>` and its own `--driver-host-port` before the command (`maestroGlobalArgs`), never `--udid` alone or a fixed port; used by e2e-maestro's `check-e2e-setup` and ios-simulator-build's `check-sim-setup` (owned by the native-audit package) |
| `scripts/lib/ship-placeholders.mjs`, `scripts/lib/tracking-text.mjs` | Ship-gate helpers (not entry points): `PLACEHOLDERS`, the scaffold values every ship gate refuses by name (`com.example.*`, the AdMob placeholder app and units, `example.com`, `support@example.com`) with the `io.applander.<game>` app id rule, and the App Tracking Transparency text check (`NSUserTrackingUsageDescription` in `Info.plist` and each `.lproj/InfoPlist.strings`); used by ios-release-testflight, privacy-and-network-audit and ios-simulator-build, whose self-tests pin the list (owned by the native-audit package) |
| `repo-templates/` | One canonical copy of every repo file that more than one skill ships at the same path: root configs (`eslint.config.mjs`, the tsconfigs, Jest, Babel, Stryker, knip, lefthook, `quality-gates.json`, `package-scripts.json`, `dot-*` files that sync to dotfiles, `dot-claude/settings.json`), the tooling git, hook, quality and scaffold scripts (`new-game.ts`; the quality and git folders, owned by quality-gates, hold the verify runner and its plan, the `shell-slice.json` reader, the device-only coverage helper, and the one commit-message rule set with the sample list that `check-commits.mjs` also runs), `result.ts`, the game-kit `contract/input-intent.ts` (tap-then-tap `selected`) and the template game's `apps/__GAME_ID__/src/rules/__GAME_ID__-tuning.ts` with its test (Tap Flip's balance numbers, shipped by the rules and the balance templates; both owned by game-rules-engine's package), the app-variant, intl and `test-only.ts` files, `app/press-feedback-context.tsx`, the Shell's `app/use-is-app-active.ts` (the foreground check; board-rendering-skia and game-audio-and-haptics) and `app/system-a11y-store.ts` (the OS accessibility switches; accessibility and react-components-and-hooks), each with its test and owned by the board-input package, the six `stores/settings-*` files, the socket sampler (`packages/tooling/src/audit/`), the test-only JS network guard (`packages/shell/src/screens/debug/network-guard.ts`; privacy-and-network-audit and e2e-maestro) the Xcode pin (`packages/tooling/src/ios/toolchain.ts`; ios-simulator-build and ios-release-testflight) and the Maestro target helper (`packages/tooling/src/e2e/maestro-args.ts`: the global `--device <udid>` and a free `--driver-host-port` per run before every Maestro command; e2e-maestro, ios-simulator-build and premium-purchase), each with its test and owned by the native-audit package, the RTL language-switch flow, the Shell's `i18n/fonts.ts` and `i18n/use-localized-text-style.ts` with their tests (pixel-snapped line heights; owned by toybox-design-system and rtl-and-direction), and the per-app `apps/__GAME_ID__/` files (`tsconfig.json`, `metro.config.js`, `app.config.ts`, and the pilot's `package.json`, `game.config.ts`, placeholder `index.placeholder.ts` and `dot-gitignore`, which monorepo-bootstrap and new-game-scaffold both write; owned by monorepo-bootstrap's package; the 3-line `index.ts` entry and the game's types bag `src/__GAME_ID__-types.ts`, which game-host-integration and architecture-and-boundaries both ship, are owned by the host-wiring package). Also single copies, each owned by the package of the first skill named: the test-only pair `packages/shell/src/app/test-only-api.ts` and `test-only-entry.ts` (ios-simulator-build, toybox-visual-parity and architecture-and-boundaries; e2e-native, its one editor: the debug kit, the S15 screen with its font test page `FontTestScreen`, the parity harness with `isParityMotionFrozen`, `isParityBoardProbeOn` and `parityGameFixture`, `createPerfLog`, S15's Performance actions `createDebugPerfActions` and the E2E feedback recorders `recordAudioFeedback` and `recordHapticsFeedback` (game-audio-and-haptics' `services/audio/recording-feedback.ts`), each member joining once its file exists); the E2E setup sub-flow `packages/shell/e2e/subflows/debug-setup.yaml` (e2e-maestro, premium-purchase; e2e-native); the template game's rules test `apps/__GAME_ID__/src/rules/apply-move.test.ts` (game-rules-engine, unit-and-component-tests; game-model); the board golden test `test/goldens/boards/__GAME_ID__-board.golden.test.ts`, its matcher `skia-golden.ts` and `apps/__GAME_ID__/src/board/board-palettes.ts` (board-rendering-skia, golden-tests, realtime-game-loop; board-input); the root mocks `__mocks__/expo-iap.ts` (premium-purchase, unit-and-component-tests; host-wiring), `__mocks__/react-native-google-mobile-ads.ts` (admob-ads, unit-and-component-tests; host-wiring from round 4, where App Tracking Transparency joins the consent adapter it mocks) and `__mocks__/expo-tracking-transparency.ts` (admob-ads, unit-and-component-tests; host-ads-perf: jest-expo mocks only the native module, so the JS API for Apple's ATT prompt is scripted here); game-kit's `dates/daily-seed.ts`, `dates/date-key.ts` and its test (daily-and-statistics, level-generation-and-solvers; screens-nav), `geom/board-layout.ts`, `geom/classify-swipe.ts` (each with its test), `timeline/track.ts`, `testing/play-bot.ts` and `testing/play-choices.ts` (game-rules-engine with board-rendering-skia, board-gestures-and-input, game-balance-and-bots, unit-and-component-tests; game-model), `testing/render-cells.ts` and its test (golden-tests, level-generation-and-solvers; gates-library); the Shell's `app/motion-config.tsx` and its test, `app/use-reduce-motion.ts` and its test (the one reduce-motion answer, also true during a parity capture; react-components-and-hooks, accessibility, settings-and-preferences; screens-nav), `app/use-reduce-motion-setting.ts` and its test (the saved choice, never frozen, and free of test-only imports for code the test-only entry reaches; react-components-and-hooks, settings-and-preferences, accessibility; screens-nav), the assembled Game route `screens/game/game-screen.tsx` and its Back test `game-screen-back.test.tsx` (toybox-screens and navigation-and-routing templates, game-host-integration's examples; screens-nav), `i18n/bidi.ts`, `i18n/digits.ts`, `i18n/language-context.tsx`, `i18n/languages.ts` (i18n-strings-and-catalogs, rtl-and-direction; game-model), `theme/contrast.ts` and `theme/theme-provider.tsx` (toybox-design-system with accessibility and settings-and-preferences; toybox-look), `ui/use-hold-to-confirm.ts` (its `frozenProgress` holds the fill still for a parity capture) with its test `ui/use-hold-to-confirm.test.ts` (toybox-components, react-components-and-hooks; toybox-look); the starting workspace manifests `packages/{game-kit,shell,tooling}/package.json` (monorepo-bootstrap, architecture-and-boundaries; repo-deps); and the App Store Connect client `packages/tooling/src/asc/asc-client.ts`, `asc-credentials.ts`, `asc-jwt.ts` (ios-release-testflight, premium-purchase; native-audit). A phase-0 file the bootstrap writes and a later skill replaces at the same path (`with-shell.ts` and its test, `ads-config.ts`, the placeholder `index.ts`) is not a second copy: its header says which template replaces it and when |
| `shell-services/clock/`, `shell-services/error-log/` | The Shell's `ClockPort` (`nowMs`, `today`, `msUntilNextLocalDay`), its system adapter and `createFakeClock`, and the `ErrorLogPort` with its fake, each with tests |
| `tooling-deps/` | The dependency and licence tooling and the one tooling wall clock `src/clock/system-clock.ts` (`todayIso`, `nowEpochSeconds`, with `system-clock.test.ts` so knip sees `nowEpochSeconds` used before the App Store Connect client lands; also synced into premium-purchase and ios-release-testflight) (`check-deps.ts`, `expo-patch-age.ts` (an Expo patch younger than 7 days is a `WARN` with its due date), `audit-licenses.ts`, their policies and tests, `license-exceptions.json`) |
| `app-scaffold/app-files.mjs` | The one renderer of the per-app files (pilot settings, `game.config.ts` placeholders, fonts list, catalogs, lose slugs), with the fixed ids `bundleIdFor` / `premiumIdFor` (`io.applander.<game id without hyphens>`, owner decision O4), the scaffold's `PLACEHOLDERS` list and `withoutBundleIdOption` (an old `--bundle-id` stops unless it names the fixed id) that monorepo-bootstrap and new-game-scaffold sync into `scripts/lib/`, so the pilot gets the same bytes from either skill (owned by monorepo-bootstrap's package) |
| `line-siege/` | Line Siege v1, the canonical worked example every skill imitates: `rules/` (types, tuning, engine, continue, persistence, stats, evaluation), `testing/` (bot and example states), `levels/` (witness plan, describe, 90 generated levels), `test/sims/` (bands and sim), `reports/sim/` (the sim report), `i18n/` (four catalogs) and `tutorial/` (the teaching script: tutorial steps and how-to-play pages, with its test; synced into game-host-integration's examples) are owned by game-rules-engine's package (game-model); `board/` (the board with its palettes and `board-contrast.json`, tests and goldens' draw code) and `sounds/` (the six-sound bank and its test) by board-gestures-and-input's package (board-input). Numbers are defaults until the owner's play-test |
| `expo-sdk-57-module-map.json` | The Expo SDK 57 package-to-version map used by the dependency and SDK-upgrade checkers |

Other builders may add shared files (for example a shared checker and its `*.selftest.mjs`). A new shared folder gets a row here in the same change.

The owners above are the round-2 package names; the round-3 packages inherit them: gates-library is index-gates, host-wiring is host-ads-perf, screens-nav is shell-screens, toybox-look is toybox-ui, board-input and game-model are game-model, native-audit is e2e-native, and repo-deps and parity keep their names. Round 4 keeps them, with one move: the Google Mobile Ads root mock belongs to host-ads-perf.

A skill declares what it uses in `assets/shared.json`, a JSON array:

```json
[
  { "from": "scripts/check-lib.mjs", "to": "scripts/check-lib.mjs" },
  { "from": "toybox-tokens.json", "to": "assets/toybox-tokens.json" },
  { "from": "fonts/", "to": "assets/fonts/" }
]
```

- `from` is relative to `_library/shared/`; `to` is relative to the skill folder. Neither may contain `..`.
- A folder entry ends both paths with `/`. It mirrors the whole folder, and extra files in the copy are removed.
- `to` may not be `SKILL.md`, `assets/shared.json` or a folder that contains it.
- `sync-shared.mjs` copies; the validator fails on any difference (`shared-drift`). Never edit a copy; edit the canonical file and re-sync.
- List `assets/shared.json` and every copied file (or its folder) in the skill's "Files in this skill" table.

The two JSON files are byte-for-byte copies of the project files, except for the strings that named project files ("docs/18-design-system-toybox.md" became "handbook chapter 18 (design system toybox)", "design/toybox.html" became "the Toybox HTML mockup", "spec.txt" became "the product spec"). The self-containment rule would otherwise fail every skill that syncs them. `refresh-shared.mjs` repeats exactly those rewrites and refuses to write a copy that still names a project path.

## Writing skill scripts with check-lib

Every `scripts/*.mjs` entry point imports the shared helper `./check-lib.mjs` (helpers that are not entry points go in `scripts/lib/`):

```js
#!/usr/bin/env node
import { REPO_SCAN_IGNORES, createReporter, parseArgs, requireDir, run, walk } from './check-lib.mjs';

const SPEC = { name: 'check-names', summary: 'Checks ...', usage: '[options] [repo-root]', positionals: { min: 0, max: 1 },
  options: { json: { type: 'boolean', help: 'Also print problems as JSON' } } };

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);   // --help handled, exit 0
  const root = requireDir(positionals[0] ?? '.', 'repo root');               // missing target: exit 2
  const report = createReporter({ name: 'check-names', json: options.json });
  const files = walk(root, { include: ['*.ts', '*.tsx'], ignore: [...REPO_SCAN_IGNORES, '**/__generated__/**'] });
  for (const rel of files) { /* report.problem({ file: rel, line, rule: 'rule-id', message, fix }) */ }
  return report.finish({ checked: files.length, unit: 'files' });              // 0 files checked: exit 2
});
```

| Export | Purpose |
|---|---|
| `parseArgs(argv, spec)` | Long options (`type`, `default`, `multiple`, `short`, `help`), positional count limits, automatic `--help`. Unknown options exit 2; a guessed `--root` on a script that takes a positional root is answered with the positional form, and a script that declares a `--root` option and no positionals also takes the root as its one positional argument (`node check-x.mjs .`). |
| `walk(root, { include, ignore, defaultIgnores, followSymlinks, onSymlink })` | Sorted relative posix paths. A glob without `/` matches any path segment (`*.png`, `node_modules`). Default ignores: `node_modules`, `.git`, `.DS_Store`, `EXPECT.txt`. |
| `REPO_SCAN_IGNORES`, `isRepoScanIgnored(rel)` | What every checker that walks the app repo skips: `skills/**`, `.claude/**`, `node_modules`, `Pods`, `.expo`, and `ios/`, `android/`, `build/`, `out/` at the root and in each `apps/*/` (so `packages/tooling/src/build/` is still scanned). Pass the list to `walk` from the repo root (or one app folder); filter git paths with `isRepoScanIgnored`. |
| `readShellSlice(root)`, `sliceSkipReason(slice, screenId?)`, `SHELL_SCREEN_IDS` | The first SKIP fact, a partial Shell. `readShellSlice` returns `null` without `shell-slice.json` (the full Shell), else `{ file, screens: Set, why, hasShellApp }`; a malformed file exits 2. `sliceSkipReason` returns `'<S-id> not in shell-slice.json'` for a screen outside the slice, `'no Shell app (...)'` (no screen given) for `"screens": []`, else `null`. |
| `dueSkipReason(root, { file, step })`, `SHELL_DUE_TARGETS` | The second SKIP fact, a rule that is not yet due. Returns `'due at Shell step <step>: <file> not yet created'` while the repo-relative `file` that a later Shell build step creates is missing, else `null` (the rule is strict from then on); a bad target throws (exit 2). `SHELL_DUE_TARGETS.plugins` (`packages/shell/src/config/shell-plugins.ts`, step 8: plugin entries and the native half of the perf layer), `.catalogs` (`packages/shell/src/i18n/catalogs/en.json`, step 6) and `.boot` (`packages/shell/src/app/start-shell.ts`, step 7, with the composition root: hydration, the background checkpoint, the startup splash, UI feedback and the JS half of the perf layer) are the usual targets. Never used by a checker that decides whether something may ship. |
| `createReporter({ name, json })` | `problem({ file, line, rule, message, fix })`, `skip({ file, rule, message })`, `count`, `finish({ checked, unit })` prints sorted `SKIP <file> [<rule>] <message>` lines, then `FAIL <file>:<line> [<rule>] <message> Fix: <fix>` lines, the summary (`, <n> skipped` when any) and the RESULT line, and returns the exit code. Skips never count; `checked: 0` with skips is a pass. `notApplicable(fact)` prints `NOT APPLICABLE: <fact>` and `RESULT: PASS` and returns 0 (only for a repo fact that proves the whole check does not apply). |
| `run(main)` | Exit code from `main`; `UsageError`/`fail()` exits 2 with `ERROR [bad-input] ...`; a crash exits 2 with the stack. |
| `runSelftest(import.meta.url, [{ script, fixtures, args }])`, `SELFTEST_CASES`, `selftestCaseKind(name)` | The self-test runner (below) and its four fixture kinds. |
| `resolveToolingDir({ given, envVar, scriptsDir })`, `importPackage(name, dir, { what, fix })`, `packageInstallFix({ scriptsDir, envVar, option, repoDir })` | Pinned packages of a skill that needs them: the folder that holds them (`--tooling`, else the variable, else the skill's `scripts/`), loading one from there (a missing one stops with exit 2), and the fix text that gives both install forms (below). |
| `fail`, `UsageError`, `requireDir`, `requireFile` | Bad input or environment, exit 2. |
| `readText`, `isBinary`, `lineOf`, `maskComments`, `sha256`, `toPosix`, `globToRegExp`, `matchGlob`, `makeTempDir`, `removeTempDir`, `resultLine`, `RESULT_PATTERN`, `EXIT` | Small helpers. `maskComments` blanks JS/TS comments but keeps line numbers. |

**Self-tests.** `scripts/selftest.mjs` is three lines:

```js
import { runSelftest } from './check-lib.mjs';
await runSelftest(import.meta.url, [{ script: 'check-names.mjs', fixtures: '../tests/fixtures', args: (dir) => [dir] }]);
```

For each suite it checks that `--help` exits 0 and runs every fixture folder by its name:

| Folder | Must | EXPECT.txt |
|---|---|---|
| `good/` | exit 0, last line `RESULT: PASS` | optional |
| `pass-<case>/` | exit 0, last line `RESULT: PASS` | required: lines a passing run prints (a SKIP line, a NOT APPLICABLE fact, the reference a run picked) |
| `bad-<case>/` | exit 1 with a RESULT line | required: the rule id and `file.ts:6` of the planted bug |
| `error-<case>/` | exit 2 with a RESULT line | required: the `ERROR [bad-input] ...` text; an optional `ARGS.txt` replaces `args(dir)` with its words, because an error case is usually a bad argument list |

Each non-empty `EXPECT.txt` line must appear in the output. A suite with no `bad-*` fixture fails. A skill with several checkers uses `tests/fixtures/<checker>/good` and `.../bad-*`, one suite each. `args(dir)` builds the arguments for one fixture folder; the checker also runs with that folder as its working directory. When every good, pass and bad fixture stops with the same exit-2 error, the self-test reports the environment once (a package is not installed) and exits 2; `error-*` fixtures stop on purpose and never count towards that. So a skill needs no harness of its own inside `selftest.mjs` for passing outcomes or bad input: one folder per case does it.

**Safe with no arguments.** The validator runs every script once with `--help` and once with no arguments in an empty temporary folder (30-second limit). With no arguments a checker finds nothing and exits 2; a script must never start a simulator, a build, a download or any other side effect just because it got no arguments.

**Packages.** Scripts use `node:` built-ins only. A skill that truly needs packages ships `scripts/package.json` and `package-lock.json` with exact versions and loads them inside `main()`, exiting 2 with the install command when they are missing, so `--help` works before the install. The default install is the skill's own folder, `npm ci --prefix ${CLAUDE_SKILL_DIR}/scripts`. When the skill folder must stay read-only or is shared by several sessions, the packages go into the app repo instead: the script accepts `--tooling <dir>` (or a documented environment variable), the pinned `package.json` and lock are copied to `<repo>/.<skill-short-name>/tooling` (git-excluded) and installed with `npm ci --prefix <repo>/.<skill-short-name>/tooling`. check-lib does the lookup:

```js
import { importPackage, packageInstallFix, resolveToolingDir } from './check-lib.mjs';
const tooling = resolveToolingDir({ given: options.tooling, envVar: 'PARITY_TOOLING_DIR', scriptsDir: SCRIPTS_DIR });
const fix = packageInstallFix({ scriptsDir: SCRIPTS_DIR, envVar: 'PARITY_TOOLING_DIR', repoDir: '.parity/tooling' });
const { PNG } = await importPackage('pngjs', tooling, { what: 'pngjs 7.0.0', fix });   // missing: exit 2 with both install forms
```

Scripts write only into the app repo (reports, caches, `.parity/`), never next to themselves.

**Patterns the validator reads as project references.** A checker that must itself detect these (for example "no absolute home paths") builds them from parts or regex escapes (`/\/Users\//`), so its own source stays clean.

## What the validator checks

Every problem line names the skill file, the rule and the fix.

| Rule | Holds when |
|---|---|
| `skill-md` | the folder has a `SKILL.md` |
| `fm-line1` | `---` is exactly line 1 (no blank line, no BOM) |
| `fm-close` | the frontmatter has a closing `---` line |
| `fm-yaml` | the frontmatter is inside the strict YAML subset: one-line values, double quotes around values that hold `: ` or ` #`, flow lists `[a, b]`, one-level `metadata:` maps |
| `fm-key` | only `name`, `description`, `argument-hint`, `arguments`, `metadata`, `license`, `compatibility` (so no `paths`, `hooks`, `user-invocable`, `when_to_use`, `context`) |
| `fm-no-disable-model-invocation` | no `disable-model-invocation` (the owner names skills in plain words) |
| `fm-no-allowed-tools` | no `allowed-tools` (Claude's own Skill call would then need approval) |
| `name-format` | name is 1-64 characters of `[a-z0-9-]`, no leading, trailing or double hyphen |
| `name-match` | name equals the folder name |
| `name-reserved` | name is not a bundled command or skill (`verify`, `run`, `debug`, `loop`, `init`, `review`, `code-review`, `simplify`, `security-review`, `help`, `doctor`, `skills`, ...), not `synced`/`anthropic-skills`, and has no `claude` or `anthropic` |
| `desc-length` | description present, at most 300 characters |
| `desc-angle` | description has no `<` or `>` |
| `desc-verb` | description starts with a third-person verb ("Builds", "Checks", "Adds") |
| `desc-person` | description has no "I" or "you" |
| `desc-trigger` | description contains "Use when" |
| `skill-lines` | `SKILL.md` has at most 300 lines |
| `sections` | an H1 title and an intro line, then `## Rules that must hold` first, and Rules > Workflow > Definition of done > Anti-patterns > Files in this skill > Related skills in that order, each once |
| `section-format` | numbered rules, numbered workflow steps, `- [ ]` done items, the Files header `\| File \| What it is \| Read/run when \|`, list items under Related skills |
| `dod-position` | the Definition of done ends within the first 20,000 characters, about the 5,000 tokens that survive compaction |
| `dod-script` | a skill with scripts ends its Definition of done with `` `node ${CLAUDE_SKILL_DIR}/scripts/<check>.mjs ...` prints `RESULT: PASS` `` |
| `link-resolve` | every relative markdown link and every `${CLAUDE_SKILL_DIR}/path` resolves to a file inside the skill |
| `files-listed` | every file (except `SKILL.md`) is in the Files table; a row ending in `/` (such as `tests/fixtures/`) covers the whole folder |
| `files-exist` | every file the table lists exists |
| `ref-toc` | a `references/*.md` over 100 lines has a "Contents" heading with a list in its first 40 lines |
| `no-project-ref` | no project knowledge: `docs/...`, `design/...`, `idea-hunt`, `spec.txt`, `SPEC.md`, `99-final-decisions`, `/Users/`, `scratchpad`, temporary paths, `CLAUDE_PROJECT_DIR`, `../` in markdown prose, `../../` in scripts, paths into another skill (`skills/<name>/`, `.claude/skills/<name>/`) or into `_library` beyond `skills/_library/<tool>.mjs`. URLs are ignored. App paths (`packages/...`, `apps/...`, `.claude/settings.json`) are allowed. `tests/fixtures/` is exempt. |
| `no-shouting` | no MUST, NEVER, ALWAYS, IMPORTANT, CRITICAL, MANDATORY, WARNING, DO NOT, DON'T outside code |
| `device-explicit` | every call that reaches a simulator names it, in SKILL.md, references, examples, other markdown and scripts (`tests/` and `assets/` are exempt): a `maestro` command line (`test`, `hierarchy`, `record`, `start-device`) has `--device <udid>` before the command (code builds it with `maestroGlobalArgs()`, passes `'--device', udid` first, or calls a runner made for one device, such as `makeMaestro(..., { udid })`); an `xcrun simctl` call that targets a device names a UDID or variable, never `booted` or `all`; `xcodebuild -destination` uses `id=<udid>` (`generic/platform=iOS` for an archive). Fenced code lines and inline code spans are read; a mention without arguments (`maestro test`), a sentence that forbids the command ("never `...`") and the Anti-patterns section are not command lines |
| `layout` | only `SKILL.md`, `references/`, `templates/`, `examples/`, `scripts/`, `tests/`, `assets/` at the top; no symlinks, empty folders or nested `SKILL.md` |
| `script-lib` | top-level `scripts/*` are `.mjs` entry points that import `./check-lib.mjs`; `selftest.mjs` uses `runSelftest` |
| `script-deps` | imports are `node:` built-ins, relative files, or packages pinned exactly in `scripts/package.json` and loaded with `await import()` |
| `script-help` | `node <script> --help` in an empty folder exits 0 and prints `Usage:` |
| `script-result` | `node <script>` with no arguments in an empty folder exits 0, 1 or 2 and ends with the RESULT line |
| `selftest-missing` | a skill with scripts has `scripts/selftest.mjs` |
| `fixtures` | `tests/fixtures/good/` and at least one `bad-*/`; every `bad-*/`, `pass-*/` and `error-*/` case has a non-empty `EXPECT.txt` |
| `shared-json` | `assets/shared.json` is valid (format above) |
| `shared-drift` | every declared copy is identical to the canonical file |
| `shared-undeclared` | a `check-lib.mjs` copy (or an import of it) is declared in `assets/shared.json` |
| `library-layout` | `skills/` holds only skill folders, `_library/` and `README.md` (checked when run without arguments) |

## Tracking sources: sources.json

Skills copy knowledge from project files. `sources.json` (library-only; skills never read it) remembers where each copy came from, so a change in the project can be noticed:

```json
{
  "version": 1,
  "skills": {
    "toybox-design-system": {
      "references/tokens.md": {
        "recorded": "2026-09-28",
        "sources": [
          { "path": "docs/18-design-system-toybox.md", "sha256": "..." },
          { "path": "design/toybox/tokens.json", "sha256": "..." }
        ]
      }
    }
  }
}
```

- After writing a skill file from project sources: `node skills/_library/record-sources.mjs toybox-design-system references/tokens.md docs/18-design-system-toybox.md design/toybox/tokens.json`.
- `check-staleness.mjs` lists every skill file whose sources changed (`stale-source`) or vanished (`missing-source`), then "stale skills: ...". Re-copy the knowledge, then record again.
- The `_library` key tracks the shared JSON copies; `refresh-shared.mjs` updates them and their entries.

## Settings for .claude/settings.json

`settings.proposed.json` is the content the lead should install as `.claude/settings.json` (or merge into it):

- `"skillListingBudgetFraction": 0.04`. The skill listing is capped at context x 4 x fraction characters. In headless tests on 2026-09-28 the default 0.01 gave a 30,000-character budget (the debug log printed "> 30 budget" at 0.00001), so 0.04 gives 120,000. The 45 Pocket Arcade skills (up to about 330 characters each with names) plus the bundled and synced skills come to roughly 30,000 to 45,000 characters, which would overflow the default and turn the least-used skills into name-only entries. The cap costs nothing until the listing actually grows.
- `permissions.allow`:
  - `Bash(node */.claude/skills/*/scripts/*)`: skill scripts as SKILL.md runs them, `node ${CLAUDE_SKILL_DIR}/scripts/<x>.mjs` (the variable expands to the absolute `.claude/skills/<name>` path, even through a symlink).
  - `Bash(node skills/*/scripts/*)`: a builder running a skill's scripts from the repo root.
  - `Bash(node skills/_library/*)`: the library commands.

Tested headlessly (`claude -p ... --permission-mode default`): with these rules all three command forms ran, and `node other/thing.mjs` was still denied. Without the rules the skill script was denied ("This command requires approval").

Two cautions. First, Claude Code drops project-scoped allow rules while a workspace is not trusted (debug log: "Dropped 2 project-scoped permissions.allow entries - workspace not yet trusted"). The rules above were verified through `--settings`; in the real repo the owner must have accepted the trust dialog in the project folder once. Second, a `*` in a Bash rule also matches spaces, so these rules would also allow an odd command such as `node -e "..." x/.claude/skills/a/scripts/b`. They only remove prompts for commands of that shape; deny rules and the other permission checks still apply.

## Symlinked skills: test results

Claude Code 2.1.283, headless, in a throwaway git repo with `.claude/skills/link-probe -> ../../skills/link-probe` (relative) and `.claude/skills/abs-probe -> /abs/path/elsewhere/abs-probe` (absolute, outside the repo):

- Both appeared in the session's `skills` and `slash_commands` lists.
- `/link-probe` ran the skill body.
- A prose request ("Use the link-probe skill ...") made Claude call the Skill tool, which was auto-allowed and loaded the skill.
- `${CLAUDE_SKILL_DIR}` expanded to the link path (`<repo>/.claude/skills/link-probe`), not the resolved target.

So links are the default, and `--copy` is only a fallback for tools that do not follow symlinks. Commit the links (git stores them as symlinks). Writes under `.claude/` are protected paths, so an interactive session may ask the owner to approve the link creation once.

## The library's own tests

`node skills/_library/tests/selftest.mjs` (also the first row of `selftest-all.mjs`) proves:

- check-lib: globs, the walker, `REPO_SCAN_IGNORES` (the skill library and generated output are skipped, same-named source folders are not), `readShellSlice` and `sliceSkipReason` (valid, game-first and every malformed shape), `dueSkipReason` (a missing target SKIPs with its step, a created one is strict, a bad target throws), argument parsing (including the positional-root answer to `--root`), the output format with SKIP lines and NOT APPLICABLE, and exit codes 0/1/2. It also proves that `runSelftest` catches a checker that misses its planted bug, one that misses a line a `pass-*` case must print, and one that exits 1 instead of 2 on an `error-*` case (whose `ARGS.txt` replaces the suite's arguments), and that the pinned-package helpers load from a `--tooling` folder and name both install forms.
- The validator on all 39 cases in `tests/cases/`, and the `device-explicit` detector on flagged and allowed maestro, simctl and xcodebuild lines. The two good sample skills (`good-basic` without scripts, `good-scripted` with a checker, self-test, fixtures and a synced `check-lib.mjs`) pass. Every other case holds exactly one planted bug and must fail with exactly the one rule its `case.json` names. Every validator rule has a case; `library-layout` runs on a temporary `skills/` folder. The cases run on a temporary copy that is synced first.
- sync-shared, link-skills (both modes, including stale, foreign and conflicting entries), record-sources and check-staleness, and selftest-all, all on throwaway folders.
- The fonts match `fonts/SOURCES.md`, the shared JSON copies hold no project paths, and `settings.proposed.json` has the budget key and the rules.

To add a validator rule: implement it in `validate-skills.mjs`, add it to `RULES`, add a case to the table in `tests/build-cases.mjs`, run `node skills/_library/tests/build-cases.mjs`, then `node skills/_library/tests/selftest.mjs`. The self-test fails if any rule has no case.

## Folder map

```
_library/
  AUTHORING-STANDARD.md   the binding standard
  CATALOGUE.md            the 45 skills and their sources
  README.md               this file
  validate-skills.mjs  sync-shared.mjs  selftest-all.mjs  link-skills.mjs
  check-staleness.mjs  record-sources.mjs  refresh-shared.mjs
  sources.json            skill file -> project sources with sha256
  settings.proposed.json  what .claude/settings.json should contain
  lib/                    library-only helpers (skill discovery, manifest, frontmatter parser, sources)
  shared/                 canonical shared files (scripts/check-lib.mjs, JSON data, fonts/)
  skill-template/         the model skill to copy (passes the validator; its self-test passes)
  tests/                  selftest.mjs, build-cases.mjs, cases/ (39 sample skills)
```
