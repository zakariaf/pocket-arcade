# Writing skill scripts and their self-tests

How a skill script is built on the shared helper `check-lib.mjs`, how its self-test proves it, and the fixture patterns that have worked. Read this before writing or changing any script in a skill.

## Contents

- The contract
- A checker, complete
- The check-lib API
- The self-test
- Fixture patterns
- Scripts that need packages
- Text the validator reads as a project reference
- Checklist

## The contract

- One entry point per file in `scripts/`, Node ESM `.mjs`, importing `./check-lib.mjs` (declared in `assets/shared.json`, synced, never edited). Helpers that are not entry points live in `scripts/lib/`.
- Run as `node ${CLAUDE_SKILL_DIR}/scripts/<name>.mjs [args]` from the app repo root. Paths are arguments with sensible defaults.
- `--help` prints `Usage:` and exits 0. Exit 0 = pass, 1 = problems found, 2 = bad input or environment. The last line is `RESULT: PASS` or `RESULT: FAIL (<n> problems)`.
- Every problem line is `FAIL <file>:<line> [<rule>] <message> Fix: <fix>`: the file, the rule id and the fix, so Claude can act without reading the script.
- The repo root is the optional first positional argument (default `.`), never `--root`: `node <skill>/scripts/check-x.mjs . --game line-siege`. `parseArgs` answers a guessed `--root` with the positional form.
- Nothing to check (missing folder, zero matching files) is exit 2, never a pass. With no arguments in an empty folder a script exits 2 fast and has no side effects: it never starts a simulator, a build, a download or a network call because it got no arguments. Once the build step that makes the target has passed, a missing target is a problem (exit 1).
- A rule that a repo fact puts out of reach is a `SKIP` line, not a problem. There are two such facts: a partial Shell (`shell-slice.json`, read with `readShellSlice` and `sliceSkipReason`), and a rule that is not yet due because a later Shell build step creates its target (`dueSkipReason(root, SHELL_DUE_TARGETS.plugins)`, which says `due at Shell step 8: packages/shell/src/config/shell-plugins.ts not yet created` until the file exists). A checker that decides whether something may ship never skips either way. A whole check that a repo fact proves irrelevant ends with `NOT APPLICABLE: <fact>` and `RESULT: PASS` (exit 0). Both count as a pass; exit 2 never does.
- A checker that walks the app repo passes `REPO_SCAN_IGNORES` to `walk`, and one that reads paths from git filters them with `isRepoScanIgnored`, so the in-repo `skills/` library (whose fixtures plant bugs, goldens and skipped tests on purpose), `.claude/`, `node_modules`, Pods and generated native and build output are never judged. Give it a fixture with a `skills/` folder full of planted findings that must stay silent.
- Keep output short: problems and one summary line. Long reports go to a file whose path the script prints.
- Zero dependencies: only `node:` built-ins (fs, path, child_process, crypto, zlib, url, os, util ...). Node 22 or newer.

## A checker, complete

```js
#!/usr/bin/env node
// check-names.mjs: checks that TypeScript files are kebab-case.
// Run: node <skill folder>/scripts/check-names.mjs [folder]   (in SKILL.md: the skill-folder variable)
import { REPO_SCAN_IGNORES, createReporter, parseArgs, requireDir, run, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-names',
  summary: 'Checks that TypeScript file names are kebab-case.',
  usage: '[options] [repo-root]',
  positionals: { min: 0, max: 1 },
  options: { json: { type: 'boolean', help: 'Also print problems as JSON' } },
  details: 'Rules:\n  file-name-kebab  lowercase words joined by hyphens',
};

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC); // --help handled, exit 0
  const root = requireDir(positionals[0] ?? '.', 'repo root');            // missing folder: exit 2
  const report = createReporter({ name: 'check-names', json: options.json });
  const files = walk(root, { include: ['*.ts', '*.tsx'], ignore: [...REPO_SCAN_IGNORES, '**/__generated__/**'] });
  for (const rel of files) {
    const base = rel.split('/').pop();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9-]+)*\.tsx?$/.test(base)) {
      report.problem({ file: rel, line: 1, rule: 'file-name-kebab', message: `"${base}" is not kebab-case`, fix: 'Rename it, for example clamp-value.ts.' });
    }
  }
  return report.finish({ checked: files.length, unit: 'files' }); // 0 files checked: exit 2
});
```

## The check-lib API

| Export | Purpose |
|---|---|
| `parseArgs(argv, spec)` | Long options (`type` string/boolean, `default`, `multiple` (defaults to `[]`), `short`, `help`), positional count limits, automatic `--help` from `name`, `summary`, `usage`, `options`, `details`. Unknown options exit 2; a guessed `--root` on a script that takes a positional root is answered with the positional form, and a script that declares a `--root` option and no positionals also takes the root as its one positional argument. |
| `walk(root, { include, ignore, defaultIgnores, followSymlinks, onSymlink })` | Sorted relative posix paths. A glob without `/` matches any path segment (`*.png`, `node_modules`); a glob with `/` is anchored at the root; `{a,b}` braces work. Default ignores: `node_modules`, `.git`, `.DS_Store`, `EXPECT.txt` (pass `defaultIgnores: false` to see them). |
| `REPO_SCAN_IGNORES`, `isRepoScanIgnored(rel)` | What every checker that walks the app repo skips: `skills/**`, `.claude/**`, `node_modules`, `Pods`, `.expo`, and `ios/`, `android/`, `build/`, `out/` at the root and in each `apps/*/` (so `packages/tooling/src/build/` is still scanned). Pass the list to `walk` from the repo root (or one app folder); filter git paths with `isRepoScanIgnored`. |
| `readShellSlice(root)`, `sliceSkipReason(slice, screenId?)`, `SHELL_SCREEN_IDS` | `null` without `shell-slice.json` (the full Shell), else `{ file, screens: Set, why, hasShellApp }`; a malformed file exits 2. `sliceSkipReason` returns `'<S-id> not in shell-slice.json'` for a screen outside the slice, `'no Shell app (...)'` (no screen given) for `"screens": []`, else `null`. |
| `dueSkipReason(root, { file, step })`, `SHELL_DUE_TARGETS` | `'due at Shell step <step>: <file> not yet created'` while the repo-relative `file` a later Shell build step creates is missing, else `null` (strict from then on); a bad target throws. Targets: `SHELL_DUE_TARGETS.plugins` (`packages/shell/src/config/shell-plugins.ts`, step 8: plugin entries and the perf layer's native half), `.catalogs` (`packages/shell/src/i18n/catalogs/en.json`, step 6), `.boot` (`packages/shell/src/app/start-shell.ts`, step 7: the boot wiring and the perf layer's JS half), `.e2e` (`packages/tooling/src/e2e/run-e2e-ios.ts`, step 10) and `.release` (`packages/tooling/src/release/release-ios.ts`, step 11; check-gate-wiring's `script-target` rule). Never in a checker that decides whether something may ship. |
| `createReporter({ name, json })` | `problem({ file, line, rule, message, fix })`, `skip({ file, rule, message })` (a rule a repo fact puts out of reach: printed as `SKIP <file> [<rule>] <message>`, never counted), `note(text)` (prints at once), `count`, `finish({ checked, unit })`: prints the sorted SKIP and problem lines, a summary (`, <n> skipped` when any), JSON if asked, the RESULT line, and returns the exit code. `finish` with 0 checked, 0 problems and 0 skips exits 2. `notApplicable(fact)` prints `NOT APPLICABLE: <fact>` and `RESULT: PASS` and returns 0: only for a repo fact that proves the whole check does not apply, never for a missing target. |
| `run(main)` | Runs `main`, uses its return value as the exit code; a `UsageError` or `fail()` prints `ERROR [bad-input] ... Fix: ...` and exits 2; a crash prints `ERROR [crash]` with the stack and exits 2. Both end with a RESULT line. |
| `fail(message, fix)`, `UsageError` | Bad input or environment: exit 2. |
| `requireDir(path, what)`, `requireFile(path, what)` | Resolve a path or exit 2 with "nothing to check". |
| `runSelftest(import.meta.url, suites)`, `SELFTEST_CASES`, `selftestCaseKind(name)` | The self-test runner (next section) and its four fixture kinds. |
| `resolveToolingDir({ given, envVar, scriptsDir })`, `importPackage(name, dir, { what, fix })`, `packageInstallFix({ scriptsDir, envVar, option, repoDir })` | Pinned packages: the folder that holds them (`--tooling`, else the variable, else the skill's `scripts/`), loading one from there (missing: exit 2), and the fix text with both install forms. |
| `readText`, `isBinary`, `lineOf(text, index)`, `maskComments(source)`, `sha256`, `toPosix`, `globToRegExp`, `matchGlob(rel, glob)`, `makeTempDir`, `removeTempDir`, `resultLine`, `RESULT_PATTERN`, `EXIT` | Small helpers. `maskComments` blanks JS/TS comments (strings and regex literals kept) without changing line numbers, so grep rules ignore commented-out code. |

## The self-test

`scripts/selftest.mjs`:

```js
import { runSelftest } from './check-lib.mjs';
await runSelftest(import.meta.url, [{ script: 'check-names.mjs', fixtures: '../tests/fixtures', args: (dir) => [dir] }]);
```

For each suite it checks that `--help` exits 0 and runs every fixture folder by its name:

| Folder | Must | EXPECT.txt |
|---|---|---|
| `good/` | exit 0, last line `RESULT: PASS` | optional |
| `pass-<case>/` | exit 0, last line `RESULT: PASS` | required: what a passing run prints (a SKIP line, a NOT APPLICABLE fact, the variant it picked) |
| `bad-<case>/` | exit 1 with a RESULT line | required: the rule id and `file:line` of the planted bug |
| `error-<case>/` | exit 2 with a RESULT line | required: the `ERROR [bad-input] ...` text; an optional `ARGS.txt` replaces `args(dir)` with its words |

Every non-empty `EXPECT.txt` line must appear in the output. A suite with no `bad-*` fixture fails: a check that has only ever passed proves nothing. The checker runs with the fixture folder as its working directory; `args(dir)` builds its arguments. When every good, pass and bad fixture stops with the same exit-2 error, the runner reports the environment once (a package is not installed); error cases never count towards that. So passing outcomes and bad-input stops need no harness of their own inside `selftest.mjs`: one folder per case.

- Several checkers: one fixture folder per checker (`tests/fixtures/<checker>/good`, `.../bad-*`) and one suite each.
- `EXPECT.txt` names the rule id (as `[rule-id]` or on its own line) and, where it matters, `file:line`, so the fixture fails for the planted reason and not for any failure.
- One planted bug per bad fixture keeps the cause obvious; a fixture that plants several related bugs lists each rule.
- `node skills/_library/selftest-all.mjs` runs every skill's self-test.

## Fixture patterns

- **Per-fixture arguments.** Put an `args.json` next to the inputs and build the arguments from it: `args: (dir) => ['--app', join(dir, 'App.app'), ...JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8'))]`.
- **Generated fixtures.** Large or binary inputs (PNG screenshots, `.app` bundles, plists) are written by a small generator once and committed; the generator stays in your scratch folder, the output in `tests/fixtures/`.
- **Files git or a hook would refuse** (a `.p8` key, a `.claude/settings.json`, a secret-looking file): list them in the fixture (for example a `plant.json`) and let `selftest.mjs` write them into a temporary copy at run time, then point the suite at the copy.
- **Writers and scaffolders.** A script that creates files takes its output folder as an argument; the self-test passes a fresh temporary folder for the good case (made with `makeTempDir`, removed on exit) and a fixture folder for the refusal cases (name taken, bad name).
- **Real inputs.** Build fixtures from real, verified files (a real `metro.config.js`, a real ExportOptions plist), then plant one bug; a toy input that no real repo looks like proves little.
- **Check the checker on real repos too.** Before shipping a rule, run it on a verified workspace and read every finding: a rule that fires on correct code will be ignored or, worse, "fixed" by breaking the code.

## Scripts that need packages

Only when truly needed (image comparison, a browser): ship `scripts/package.json` and its lock with exact versions (`"pngjs": "7.0.0"`, never `^` or `~`), install with `npm ci --prefix ${CLAUDE_SKILL_DIR}/scripts` into the skill's own `scripts/node_modules` (gitignored), and load each package inside `main()`, exiting 2 with the install command when it is missing, so `--help` works before the install. When the skill folder must stay read-only or is shared by sessions, accept `--tooling <dir>` (or a documented environment variable), install into `<repo>/.<skill-short-name>/tooling` with `npm ci --prefix`, and load through check-lib:

```js
const tooling = resolveToolingDir({ given: options.tooling, envVar: 'PARITY_TOOLING_DIR', scriptsDir: SCRIPTS_DIR });
const fix = packageInstallFix({ scriptsDir: SCRIPTS_DIR, envVar: 'PARITY_TOOLING_DIR', repoDir: '.parity/tooling' });
const { PNG } = await importPackage('pngjs', tooling, { what: 'pngjs 7.0.0', fix });
```

Scripts write only into the app repo, never next to themselves. Never run `npm install` through a symlinked `node_modules`.

## Text the validator reads as a project reference

The validator scans every skill file (scripts too) for project paths. A checker that must itself look for such text (an absolute home path, a handbook path, a scratch path, a library-internal path) builds the pattern from parts or regex escapes (`/\/Users\//`, `'do' + 'cs/'`), so its own source stays clean. The same trick keeps a scaffolder's own placeholder tokens out of its source (`` `__${word}__` ``).

## Checklist

- [ ] `--help` works; no arguments in an empty folder exits 2 with a RESULT line.
- [ ] Every problem names file, line, rule and fix; exit codes are 0/1/2.
- [ ] The repo root is the optional positional argument; a repo-wide walk uses `REPO_SCAN_IGNORES` and has a fixture with a planted `skills/` folder that stays silent.
- [ ] Rules that a partial Shell or a later build step puts out of reach print `SKIP` lines (`sliceSkipReason`, `dueSkipReason`), with a fixture for the SKIP and one for the strict case once the target exists; `NOT APPLICABLE` only for a repo fact, never for a missing target.
- [ ] `node:` built-ins only (or exact pins loaded with `await import()`).
- [ ] The self-test has a good fixture and one bad fixture per rule, each EXPECT naming the rule id; passing outcomes worth pinning are `pass-*` fixtures and bad input is an `error-*` fixture.
- [ ] Every maestro, simctl and xcodebuild call the script makes or prints names its simulator (`--device <udid>`, a UDID, `-destination id=<udid>`).
- [ ] The script ran on a real verified workspace with no false findings.
- [ ] `node skills/_library/validate-skills.mjs <skill>` and `node <skill>/scripts/selftest.mjs` print `RESULT: PASS`.
