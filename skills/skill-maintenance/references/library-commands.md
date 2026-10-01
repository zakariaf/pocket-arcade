# The skill library commands

Every tool in the skill library, what it does, when to run it, and its options, restated so this skill needs nothing else. All run from the repo root with Node 22 or newer and no dependencies; all print `--help`, exit 0 (pass), 1 (problems found) or 2 (bad input or environment), and end with `RESULT: PASS` or `RESULT: FAIL (<n> problems)`.

## Contents

- The order to run things
- validate-skills
- sync-shared
- selftest-all
- link-skills
- record-sources and sources.json
- check-staleness
- refresh-shared
- Shared files and assets/shared.json
- Settings for .claude/settings.json
- The library's own tests

## The order to run things

After any change to a skill or to the shared files:

```sh
node skills/_library/sync-shared.mjs        # 1. copy shared files into every skill that declares them
node skills/_library/validate-skills.mjs    # 2. check every skill against the standard
node skills/_library/selftest-all.mjs       # 3. prove every checker (the library's own self-test included)
node skills/_library/link-skills.mjs        # 4. make Claude Code see new skills (.claude/skills/<name> links)
```

Each takes skill names to limit the run (`node skills/_library/validate-skills.mjs my-skill`). Also run `node skills/_library/check-staleness.mjs` before a release or after the project handbook changes. When the Toybox tokens or the copy deck change in the project, run `node skills/_library/refresh-shared.mjs` first, then the four steps.

## validate-skills

`node skills/_library/validate-skills.mjs [skill...] [--no-run] [--json] [--skills-root <dir>] [--shared <dir>]`

- Checks skills against the standard (every rule is listed in the authoring-standard reference, section 9). A skill argument is a folder name in `skills/` or a path.
- No arguments: every skill, the library's model skill, and the layout of `skills/` itself.
- Prints `PASS`/`FAIL` per skill with each problem, then the RESULT line.
- `--no-run` skips running the skill scripts (the `--help` and no-argument runs, 30 seconds each).
- `--skills-root` and `--shared` let it validate a skill in a scratch folder (used to test the new-skill scaffold).

## sync-shared

`node skills/_library/sync-shared.mjs [skill...] [--check]`

- Copies files from the library's shared folder into each skill that lists them in `assets/shared.json`, and removes extra files from mirrored folders.
- `--check` changes nothing and fails on a missing, changed or extra copy.
- No arguments: every skill, the model skill and the validator's sample skills.

## selftest-all

`node skills/_library/selftest-all.mjs [skill...] [--skip-library] [--timeout <seconds>]`

- Runs the library's self-test, each shared `*.selftest.mjs`, and every skill's `scripts/selftest.mjs` from the repo root, then prints a table.
- A skill without scripts is skipped; a skill with scripts and no `selftest.mjs` fails. Default time limit 600 seconds per self-test.
- The shared `check-testids` self-test renders the design in Chrome through Playwright: it uses `PARITY_TOOLING_DIR` (or its alias `PLAYWRIGHT_DIR`) when set, otherwise the pinned install of a skill that syncs `check-testids.mjs` (installed with `npm ci --prefix` on that skill's `scripts/`); with neither it stops with exit 2 and says so.

## link-skills

`node skills/_library/link-skills.mjs [--check] [--copy] [--root <dir>]`

- Creates `.claude/skills/<name> -> ../../skills/<name>` (relative symlinks) for every skill folder with a `SKILL.md`, and removes links it made whose skill is gone. Real folders and links pointing elsewhere are never touched (a real folder in the way is a `link-conflict`).
- `--check` changes nothing; exit 1 when a link is missing, wrong or stale (`link-missing`, `link-wrong`, `link-stale`).
- `--copy` copies instead of linking (fallback only, for tools that do not follow symlinks; copies carry a marker file).
- Writes under `.claude/` are protected paths: an interactive session asks the owner to approve them. Symlinked skills were tested with Claude Code 2.1.283: they appear in the listing, `/name` works, the Skill tool loads them, and the skill-folder variable expands to the link path, not the target.

## record-sources and sources.json

`node skills/_library/record-sources.mjs <skill> <skill-file> <source-file>... [--append] [--lock-wait <seconds>]`

- Records that a skill file was copied from the given project files, with each source's sha256 now. It replaces that file's earlier list unless `--append` is given. `<skill>` may be `_library` for the shared folder.
- Safe while other sessions write too. The write takes the exclusive lock `sources.json.lock` next to the file, re-reads `sources.json` under it, changes only this skill file's entry (entries other sessions recorded in the meantime stay) and replaces the file atomically (a temporary file, then a rename). `refresh-shared.mjs` writes its `_library` entries the same way.
- A lock held by another writer is waited for up to `--lock-wait` seconds (default 60); then the run stops with exit 2 and names the holder (`sources.json.lock is held by record-sources <skill>/<file> (pid <n>) since <time>`). Rerun when that writer is done. A lock older than 10 minutes is left over from a crashed writer: the next writer breaks it and prints a `WARN ... broke it` line. Never delete a fresh lock by hand.
- Sources must be files inside the repo (a handbook chapter, the spec, a design file). Research notes outside the repo cannot be recorded; name the closest project source, or leave the file untracked and say so in your report.
- Example: `node skills/_library/record-sources.mjs toybox-design-system references/tokens.md <handbook-chapter-path> <token-file-path>`, with the project paths relative to the repo root. They are arguments to the tool only; a skill file never names them.

`sources.json` (library-only; skills never read it at run time) has this shape:

```json
{
  "version": 1,
  "skills": {
    "<skill>": {
      "references/tokens.md": {
        "recorded": "2026-09-28",
        "sources": [{ "path": "<repo-relative path>", "sha256": "<hex>" }]
      }
    }
  }
}
```

Record after every copy from the project, one command per skill file (templates and examples too when they came from project text). `sources.json` is shared by every builder, and the lock makes parallel sessions safe: each owner re-records its own skill files right after reviewing the changed sources, then shows `node skills/_library/check-staleness.mjs <its skills>` passing, rather than leaving stale entries for someone else to re-record unread.

## check-staleness

`node skills/_library/check-staleness.mjs [skill...] [--strict]`

- Compares each recorded source with the project file today and prints `ok` or `STALE` per skill, then "stale skills: ...".
- Rules: `stale-source` (a source changed since it was recorded), `missing-source` (it was deleted or moved), `missing-copy` (the skill file is gone), `unknown-skill` (the skill folder is gone).
- `--strict` also fails on `references/` files with no recorded sources (`untracked-reference`) and on skills with no entries at all (`untracked-skill`).
- Fix a stale file by re-copying the changed knowledge (read the new source, rewrite the skill file), then record again. Never record again without re-copying: that only hides the drift.

## refresh-shared

`node skills/_library/refresh-shared.mjs [--check]`

- Re-imports the project's Toybox token file and copy deck into the shared folder (`toybox-tokens.json`, `copy-deck.json`), rewriting the few strings that name project files ("handbook chapter 18 (design system toybox)", "the Toybox HTML mockup", "the product spec"); everything else stays byte-for-byte the same. It refuses to write a copy that still names a project path, and records the sources under `_library`.
- `--check` changes nothing and fails when a shared copy differs from a fresh import. Run sync-shared afterwards.

## Shared files and assets/shared.json

The shared folder holds one canonical copy of what several skills need: `scripts/check-lib.mjs` (the script helper), `toybox-tokens.json`, `copy-deck.json` and `fonts/` (Lilita One, Rubik 400/500/700, Vazirmatn Regular/Bold, their OFL texts and a sources note with the sha256 of each file). It also holds every file that two skills ship for the same place in the app repo, so the copies cannot drift apart:

| Shared path | What it is | Synced into |
|---|---|---|
| `repo-templates/` | Root configs and repo files by their repo path (`dot-` names are dotfiles; `apps/__GAME_ID__/` is any game): `eslint.config.mjs`, `dot-prettierignore`, `dot-prettierrc.json`, `dot-gitignore`, the tsconfig set, `knip.json`, `lefthook.yml`, `quality-gates.json`, `dot-claude/settings.json`, `package-scripts.json`, the Jest, Babel and Stryker files, the tooling gate scripts, `packages/tooling/src/scaffold/new-game.ts`, and the Shell and repo files several skills write (`app-variant.ts`, `app-env.d.ts`, `test-only.ts`, the i18n polyfills, `with-app-variant-marker.ts`, `app/press-feedback-context.tsx`, the six `stores/settings-*` files, the socket sampler under `packages/tooling/src/audit/`, the RTL language-switch flow, the test-only pair `app/test-only-api.ts` and `test-only-entry.ts`, the template game's rules test and board golden test, the root mocks, game-kit's dates, geometry, timeline and bot helpers, the Shell's motion, i18n, contrast and theme-provider files, the starting workspace manifests and the App Store Connect client; `_library/README.md` lists each with its owner) | monorepo-bootstrap, quality-gates, typescript-and-lint-rules, architecture-and-boundaries, unit-and-component-tests, new-game-scaffold, game-audio-and-haptics, toybox-design-system, state-stores, settings-and-preferences, e2e-maestro, privacy-and-network-audit, rtl-and-direction, and the other skills that write the same file |
| `tooling-deps/` | The dependency gate, the one tooling wall clock (`todayIso`, `nowEpochSeconds`, with the test that keeps knip green before the App Store Connect client lands) and the licence audit tooling | monorepo-bootstrap, dependency-management, quality-gates, privacy-and-network-audit; the clock also into premium-purchase and ios-release-testflight |
| `shell-services/` | The `ClockPort` and `ErrorLogPort` files (port, adapter, fake, tests) | save-persistence-and-migrations, architecture-and-boundaries, daily-and-statistics |
| `line-siege/` | Line Siege v1, the canonical worked example: rules, testing, levels, sims and report, i18n, tutorial, board and sounds | the game skills' `examples/line-siege/` folders (rules, balance, levels, board, input, audio, host, naming, unit tests) and the bootstrap's pilot catalogs |
| `app-scaffold/app-files.mjs` | The one renderer of the per-app files, with the fixed `io.applander.<game id>` ids (`bundleIdFor`, `premiumIdFor`) and `withoutBundleIdOption`; it keeps no placeholder list of its own but re-exports `PLACEHOLDERS`, `ownerStepsPendingLine` and `finishWithOwnerSteps` from `scripts/lib/ship-placeholders.mjs` for `check-game-app --stage complete` | monorepo-bootstrap, new-game-scaffold |
| `scripts/lib/source-scan.mjs`, `scripts/lib/workspaces.mjs` | The lexer and workspace reader of the code checkers | typescript-and-lint-rules, naming-conventions, architecture-and-boundaries |
| `expo-sdk-57-module-map.json` | Expo SDK 57's `bundledNativeModules.json` | dependency-management, expo-sdk-upgrade |
| `screen-testids.json` with `scripts/check-testids.mjs` | The screen testID map (each part's testID, parity checks, `coveredBy`; `when` marks a part only some games draw, keyed by a game fact such as `hasMusic`, `hasHints` or `winLine`; `surface: true` marks an accessible card layer such as `home.daily-card`) and its checker | toybox-screens, toybox-visual-parity, e2e-maestro |
| `scripts/lib/maestro-spawns.mjs` | The `maestro-device` rule helper: every Maestro spawn in repo tooling names `--device <udid>` and its own `--driver-host-port` before the command (the repo's `maestroGlobalArgs()` in `packages/tooling/src/e2e/maestro-args.ts`, itself a shared repo template) | e2e-maestro, ios-simulator-build |
| `scripts/lib/ship-placeholders.mjs`, `scripts/lib/tracking-text.mjs` | The ship gates' one `PLACEHOLDERS` list (`com.example.*` with no owner step, the AdMob placeholder app and units for owner step G5, `example.com` and `support@example.com` for owner step G3) with the `owner-placeholder` result (`ownerStepsPendingLine` prints `OWNER STEPS PENDING: G3, G5` before a RESULT that stays FAIL), the `io.applander.<game>` id rule, and the App Tracking Transparency text check (`NSUserTrackingUsageDescription` in `Info.plist` and each language's `InfoPlist.strings`) | ios-release-testflight, privacy-and-network-audit, ios-simulator-build; `ship-placeholders.mjs` also into new-game-scaffold and monorepo-bootstrap next to `app-files.mjs` |

Every shared file has one owner, the package of the first skill the library README names for it: only that owner edits the canonical copy, and it runs sync-shared for its own skills (another skill is synced by its owner, or by the owner of a changed file when that file is the skill's only difference). The rule: when a second skill needs a file another skill already ships at the same repo path (or the same data), move the file into the shared folder instead of copying it, declare it in both skills' `assets/shared.json` (the destination names may differ, for example `templates/.prettierignore` and `templates/repo/dot-prettierignore`), and run sync-shared. From then on change only the canonical copy; a template placeholder such as `__GAME_ID__` must be one every consuming skill's generator or instructions fill. Before editing a shared file that other skills also sync, check which skills declare it (`grep -l '"<shared path>"' skills/*/assets/shared.json`) and rerun their self-tests: the edit reaches all of them at once.

A skill declares what it uses in `assets/shared.json`, a JSON array:

```json
[
  { "from": "scripts/check-lib.mjs", "to": "scripts/check-lib.mjs" },
  { "from": "toybox-tokens.json", "to": "assets/toybox-tokens.json" },
  { "from": "fonts/", "to": "assets/fonts/" }
]
```

- `from` is relative to the shared folder, `to` to the skill folder; neither may contain `..`.
- A folder entry ends both paths with `/` and mirrors the whole folder (extra files in the copy are removed).
- `to` may not be `SKILL.md`, `assets/shared.json` or a folder that holds it.
- List `assets/shared.json` and every copied file (or its folder) in the Files table. A skill without scripts and without shared data has no `assets/shared.json`.

## Settings for .claude/settings.json

The lead installs these (a write under `.claude/` needs the owner's approval; merge keys, never overwrite the file):

```json
{
  "skillListingBudgetFraction": 0.04,
  "permissions": {
    "allow": [
      "Bash(node */.claude/skills/*/scripts/*)",
      "Bash(node skills/*/scripts/*)"
    ]
  }
}
```

plus a third allow entry for the library tools, Bash(node skills/\_library/\*) (the backslashes only keep this file clean for the validator; the real entry has none).

- The listing budget: at the default fraction 0.01 the measured budget was 30,000 characters; 0.04 gives 120,000. The project's skills plus the bundled and synced ones would otherwise overflow and lose their descriptions.
- The three rules let skill scripts (through the skill-folder variable, which expands to the `.claude/skills/<name>` link path), a builder's direct runs and the library commands run without prompts. Tested headlessly: without the rules a skill script was denied ("This command requires approval").
- Claude Code drops project allow rules while the workspace is untrusted; the owner accepts the trust dialog in the project folder once.

## The library's own tests

- The library's own self-test (the first row of selftest-all) proves the helper, the validator on its sample skills (two good ones and one case per rule, each with exactly one planted bug), sync-shared, link-skills, record-sources, check-staleness, selftest-all, the fonts and the settings file.
- To add a validator rule: implement it in the validator, add it to its rule list, add a case to the case table of the build-cases tool in the library's tests folder, run that tool to rewrite the sample skills, then run selftest-all. The library self-test fails if a rule has no case. Changing the library is the lead's job; propose the rule in your report.
