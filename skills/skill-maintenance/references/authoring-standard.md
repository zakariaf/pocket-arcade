# The Pocket Arcade skill authoring standard

The binding rules every skill in `skills/` follows, restated in full so this skill stands alone. The library validator (`node skills/_library/validate-skills.mjs`) enforces the checkable parts; `check-skill.mjs` in this skill checks the finishing parts; a skill is finished only when both, and the skill's own self-test, print `RESULT: PASS`.

## Contents

- 1. Where skills live
- 2. Self-contained, always
- 3. Folder anatomy
- 4. Frontmatter
- 5. SKILL.md body and section order
- 6. Scripts
- 7. References, templates, examples, assets
- 8. Quality bar and the verified stack
- 9. Every validator rule
- 10. What check-skill.mjs adds

## 1. Where skills live

- Author each skill at `skills/<name>/`. Claude Code loads it through a symlink `.claude/skills/<name> -> ../../skills/<name>`, which `node skills/_library/link-skills.mjs` creates. Writing inside `.claude/` asks the owner for approval on every file; one link per skill avoids that.
- A skill is exactly one folder deep. Nothing but skill folders, `_library/` and `README.md` lives in `skills/`.

## 2. Self-contained, always

The owner's rule: a skill never depends on anything else in the project.

- Never reference or link knowledge files outside the skill: no handbook chapter from the docs folder, the spec file, the design folder, the idea research folder, the final-decisions document, absolute home paths, scratch or temporary paths, `../` links, or another skill's folder. Copy the knowledge into this skill's `references/` or `assets/` instead.
- Paths the skill creates or checks in the app repo (`packages/shell/src/ui/app-text.tsx`, `apps/<game>/app.config.ts`) are content, not dependencies, and are allowed.
- Another skill may be named for a hand-off ("then load `toybox-visual-parity`"), but the skill must still finish and verify its own job without it. Never call another skill's scripts and never read its files.
- The only library paths a skill may name are the library's tool commands, such as `node skills/_library/validate-skills.mjs`; never its internal files.
- Shared data (tokens, fonts, copy deck, the script helper, and any template two skills ship for the same repo path) has one canonical copy in the library's shared folder; `node skills/_library/sync-shared.mjs` copies it into each skill that declares it in `assets/shared.json`, and the validator fails on drift. Never edit a synced copy.

## 3. Folder anatomy

```
<name>/
  SKILL.md          required, at most 300 lines
  references/       knowledge Claude reads on demand (.md; a Contents list when over 100 lines)
  templates/        files Claude copies and fills in (real, compiling code and config)
  examples/         complete worked examples to imitate
  scripts/          checkers and generators Claude runs (Node .mjs)
  scripts/selftest.mjs   proves every checker passes good fixtures and fails bad ones
  tests/fixtures/   good/ and bad-*/ inputs for the self-test
  assets/           data files (tokens.json, fonts, reference PNGs, manifests, shared.json)
```

Create only the folders the skill needs; an empty folder fails the validator. Every file must be listed in the SKILL.md "Files in this skill" table with when to read or run it (a row ending in `/` covers a folder). Files are linked one level deep from SKILL.md: a reference never sends Claude to another reference.

## 4. Frontmatter

```yaml
---
name: kebab-case-name
description: Builds X for Pocket Arcade (what it does). Use when <concrete intents and trigger words>. Not for <neighbour work> (<other-skill>).
---
```

- `---` on line 1, nothing before it (no blank line, no byte-order mark). Only `name` and `description` unless there is a strong reason (the validator allows `argument-hint`, `arguments`, `metadata`, `license`, `compatibility`).
- `name` equals the folder name: 1 to 64 characters of `a-z`, `0-9` and single hyphens, no leading or trailing hyphen. It never shadows a bundled command (`verify`, `run`, `debug`, `loop`, `init`, `review`, `code-review`, `simplify`, `security-review`, `help`, `doctor`, `skills`, `batch`, `schedule` and the rest of the bundled list) and never contains `claude` or `anthropic`.
- Never `disable-model-invocation` (the owner names skills in plain words and that flag stops Claude invoking them), never `allowed-tools` or `hooks` (Claude's own Skill call then needs approval and is denied in unattended runs), never `paths` (it hides the skill until a matching file is read), never `user-invocable`, `context` or `when_to_use`.
- Values stay on one line. Double-quote a value that holds `: ` or ` #`.
- Description: third person, starts with a verb ("Builds", "Checks", "Ships"), at most 300 characters, no `<` or `>`, no "I" or "you", contains "Use when", and ends with "Not for ... (neighbour-skill)". Lead with the trigger words a task would contain. Be a little pushy: Claude tends to under-use skills. The detailed rules and examples are in the descriptions-and-routing reference.

## 5. SKILL.md body and section order

```markdown
# Title

One or two sentences: what this skill makes true.

## Rules that must hold
1. **Rule.** Why it matters (one line).   (numbered, testable, most important first)

## Workflow
1. Step ... (say exactly which reference to read at which step, which template to copy, which script to run)
N. Run the checks (run, fix, rerun until PASS).

## Definition of done
- [ ] Concrete, checkable items ...
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/<check>.mjs <args>` prints `RESULT: PASS`

## Anti-patterns
- What goes wrong and what to do instead.

## Files in this skill
| File | What it is | Read/run when |

## Related skills
- `other-skill` - when to hand off (name only)
```

- The six sections appear once each, in this order; extra sections may sit between them.
- The rules and the definition of done sit near the top: after context compaction only the first 5,000 tokens (about 20,000 characters) of each invoked skill survive. The validator checks that the Definition of done ends inside that window.
- A skill with scripts ends its Definition of done with a `${CLAUDE_SKILL_DIR}/scripts/` command that prints `RESULT: PASS`.
- Write calmly and explain why; no capitalised shouting (the validator rejects the capitalised forms of must, never, always, important, critical, mandatory, warning, do not). Give one default, not a menu. Be prescriptive where the work is fragile (configs, pins, thresholds), flexible where judgement is needed (game feel, copy).
- Say plainly what the owner must do by hand and when a step is a human step; stop and ask before anything irreversible or outward-facing (uploading, pushing, tagging, submitting, deleting real data).

## 6. Scripts

- Node ESM `.mjs`, Node 22 or newer, zero dependencies (only `node:` built-ins). A skill that truly needs packages ships `scripts/package.json` with exact pins, installs them into its own `scripts/node_modules` with `npm ci --prefix ${CLAUDE_SKILL_DIR}/scripts`, and loads them with `await import()` inside `main()`, exiting 2 with the install command when they are missing.
- Invoked as `node ${CLAUDE_SKILL_DIR}/scripts/<name>.mjs [args]`; the working directory is the app repo root; paths are arguments with sensible defaults.
- The repo root is an optional positional argument (default `.`): `node <the skill's scripts folder>/check-x.mjs . --game line-siege`, never `--root`. The shared helper answers a guessed `--root` with the positional form, and a script that still declares a `--root` option accepts the root positionally as well. SKILL.md workflows, definitions of done and the index write every command out in full, with its arguments.
- `--help` prints usage. Exit 0 = pass, 1 = violations found, 2 = bad input or environment. The last line is always `RESULT: PASS` or `RESULT: FAIL (<n> problems)`, and every problem line names the file, the rule and the fix.
- A checker that finds nothing to check fails with exit 2; it never passes silently. Run with no arguments in an empty folder it must exit 2 without side effects (no build, simulator, download or network). When the target is due (the build step that makes it has passed), a missing target is a problem (exit 1).
- SKIP: a rule that a repo fact puts out of reach is reported with `report.skip({ file, rule, message })`, which prints `SKIP <file> [<rule>] <message>` and does not count as a problem. There are exactly two such facts:
  1. A partial Shell. `readShellSlice(root)` reads `shell-slice.json` (`{ "screens": ["S4", "S11"], "why": "..." }`; `"screens": []` for a game-first repo; no file means the full Shell and every rule is strict). A rule tied to a screen outside the slice prints `SKIP <file> [<rule>] <S-id> not in shell-slice.json` (`sliceSkipReason(slice, 'S5')` gives the text); rules that need the Shell app itself skip only when `screens` is `[]` (`sliceSkipReason(slice)`). Everything inside the slice is checked strictly.
  2. A rule that is not yet due. When a rule's target is a file that a later Shell build step creates, `dueSkipReason(root, { file, step })` returns `'due at Shell step <step>: <file> not yet created'` while that file is missing, and `null` once it exists, from which point the rule is strict. `SHELL_DUE_TARGETS` names the usual targets: `plugins` (`packages/shell/src/config/shell-plugins.ts`, step 8: plugin-entry rules such as the ads, IAP, audio and font plugins), `catalogs` (`packages/shell/src/i18n/catalogs/en.json`, step 6: catalog-key rules) and `boot` (`packages/shell/src/app/start-shell.ts`, step 6: boot wiring such as hydration, the background checkpoint and UI feedback). Use it only for a target the build order creates later, never for a file the checker's own step should have written.

  A checker that decides whether something may ship (a release, store-artifact or completeness gate) never skips: it fails while `shell-slice.json` exists, and it never calls `dueSkipReason`.
- NOT APPLICABLE: when a repo fact proves the whole check does not apply (every game module has `realtime: null`, so a real-time checker has nothing to judge), the checker returns `report.notApplicable('<the fact>')`: it prints `NOT APPLICABLE: <the fact>`, then `RESULT: PASS`, and exits 0. Never use it for a target that is simply missing; that stays exit 2 (or exit 1 when due).
- SKIP lines and NOT APPLICABLE count as a pass wherever results are read (the index, quality-gates, reports); exit 2 never does.
- Every checker that walks the app repo broadly passes `REPO_SCAN_IGNORES` to `walk` (`walk(root, { ignore: [...REPO_SCAN_IGNORES, ...extra] })`), and one that reads paths from git (diffs, logs) drops them with `isRepoScanIgnored(path)`. The list skips the in-repo `skills/` library and `.claude/` (their fixtures hold planted bugs, goldens and skipped tests on purpose), `node_modules`, `Pods`, `.expo`, and each app's generated `ios/`, `android/`, `build/` and `out/`, while same-named source folders such as `packages/tooling/src/build/` are still scanned. Every such checker has a fixture with a `skills/` folder full of planted findings that must stay silent.
- Every skill with scripts ships `scripts/selftest.mjs` and `tests/fixtures/`: good fixtures pass, each planted-bug fixture fails with its expected message. Helpers that are not entry points go in `scripts/lib/`. The writing-scripts reference has the helper API and the fixture patterns.

## 7. References, templates, examples, assets

- References are copied, adapted knowledge (handbook, spec, design, research) rewritten so they make sense inside the skill: no "see chapter N". A reference over 100 lines starts with `## Contents` and a list in its first 40 lines. After copying from a project file, record the source (library-commands reference, record-sources).
- Templates are real files that compile and lint under the project's rules (strict TypeScript 6, the ESLint flat config, naming, size limits, no enums, named exports, logical style props, i18n strings). Placeholders are upper-snake between double underscores, such as `__GAME_ID__` or `__UPPER_SNAKE__`. Test them in a scratch copy of a verified workspace with `tsc`, ESLint and Jest before shipping.
- Examples are complete, realistic and small; one good example beats three partial ones.
- Assets are data the scripts or Claude use (tokens, reference images, catalogues). Data another skill also needs belongs in the shared folder and is synced, never copied by hand.

## 8. Quality bar and the verified stack

- Complete: someone who has only this skill can do the job right the first time.
- Correct: versions and APIs match the verified stack: Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3, React Navigation 7 static, Zustand 5, expo-sqlite, Skia 2.6.2, Reanimated 4.5.1, Worklets 0.10.1, Gesture Handler 2.32, react-intl 12, react-native-google-mobile-ads 17, expo-iap, Jest 29.7 with jest-expo 57 and RNTL 14, Maestro 2.10, Xcode 26.6.
- Self-verifying: the definition of done ends in a script that proves the work, and the script proves itself with its self-test.

## 9. Every validator rule

`node skills/_library/validate-skills.mjs <skill>` reports each problem as `FAIL <skill>/<file>:<line> [<rule>] <message> Fix: <fix>`.

| Rule | Holds when |
|---|---|
| `skill-md` | the folder has a `SKILL.md` |
| `fm-line1` | `---` is exactly line 1 |
| `fm-close` | the frontmatter has a closing `---` line |
| `fm-yaml` | the frontmatter is one-line values, quoted when they hold `: ` or ` #`, flow lists, one-level `metadata:` |
| `fm-key` | only `name`, `description`, `argument-hint`, `arguments`, `metadata`, `license`, `compatibility` |
| `fm-no-disable-model-invocation` | no `disable-model-invocation` |
| `fm-no-allowed-tools` | no `allowed-tools` |
| `name-format` | 1-64 characters of `[a-z0-9-]`, no leading, trailing or double hyphen |
| `name-match` | name equals the folder name |
| `name-reserved` | not a bundled command or skill, no `claude` or `anthropic` |
| `desc-length` | description present, at most 300 characters |
| `desc-angle` | no `<` or `>` |
| `desc-verb` | starts with a third-person verb |
| `desc-person` | no "I" or "you" |
| `desc-trigger` | contains "Use when" |
| `skill-lines` | `SKILL.md` has at most 300 lines |
| `sections` | H1 title, intro line, then Rules > Workflow > Definition of done > Anti-patterns > Files in this skill > Related skills, each once |
| `section-format` | numbered rules and steps, `- [ ]` done items, the Files header `\| File \| What it is \| Read/run when \|`, list items under Related skills |
| `dod-position` | the Definition of done ends within the first 20,000 characters |
| `dod-script` | a skill with scripts ends its Definition of done with a skill-script command that prints `RESULT: PASS` |
| `link-resolve` | every relative markdown link and every skill-folder path written with the `CLAUDE_SKILL_DIR` variable (code included) resolves to a file inside the skill |
| `files-listed` | every file except `SKILL.md` is in the Files table (a `dir/` row covers the folder) |
| `files-exist` | every file the table lists exists |
| `ref-toc` | a `references/*.md` over 100 lines has a Contents heading with a list in its first 40 lines |
| `no-project-ref` | no project knowledge paths (see section 2); URLs are ignored; `tests/fixtures/` is exempt; `../` is flagged in markdown prose and `../../` in scripts |
| `no-shouting` | no capitalised shouting outside code |
| `layout` | only the seven top-level entries, no symlinks, no empty folders, no nested `SKILL.md` outside `tests/fixtures/` |
| `script-lib` | top-level `scripts/*` are `.mjs` entry points importing `./check-lib.mjs`; `selftest.mjs` uses `runSelftest` |
| `script-deps` | imports are `node:` built-ins, relative files, or exactly pinned packages loaded with `await import()` |
| `script-help` | `node <script> --help` in an empty folder exits 0 and prints `Usage:` |
| `script-result` | `node <script>` with no arguments in an empty folder exits 0, 1 or 2 and ends with the RESULT line (30-second limit) |
| `selftest-missing` | a skill with scripts has `scripts/selftest.mjs` |
| `fixtures` | `tests/fixtures/good/` and at least one `bad-*/`, each with a non-empty `EXPECT.txt` (per suite folder when there are several) |
| `shared-json` | `assets/shared.json` is a valid list of `{ "from", "to" }` |
| `shared-drift` | every declared copy is identical to the canonical shared file |
| `shared-undeclared` | a `check-lib.mjs` copy or import is declared in `assets/shared.json` |
| `library-layout` | `skills/` holds only skill folders, `_library/` and `README.md` (checked when run without arguments) |

Patterns the validator reads as project references: a checker that must itself detect such text (for example "no absolute home paths") builds the pattern from parts or regex escapes, so its own source stays clean.

## 10. What check-skill.mjs adds

The validator proves the structure; `check-skill.mjs` proves the content is finished:

| Rule | Holds when |
|---|---|
| `desc-not-for` | the description has a "Not for" boundary |
| `desc-neighbours` | skills named in the "Not for" parentheses exist |
| `rule-why` | each rule is a bold statement followed by a reason of at least four words |
| `workflow-mentions` | each reference, example and script is named somewhere in the body, not only in the Files table (a workflow step that says "Files table" covers references with a when-cell) |
| `files-when` | each Files row has a non-empty "Read/run when" cell |
| `related-names` | each Related skills item starts with an existing skill name in backticks |
| `placeholder-left` | no upper-snake placeholder stands alone in markdown prose, and no `__FILL_...__` token is left in scripts |
| `template-markers` | templates hold no TODO, FIXME or XXX and no mixed-case double-underscore placeholder |
| `selftest-covers` | the self-test runs every checker script |
| `expect-rule-id` | every `bad-*` EXPECT.txt names a rule id (a line that is the id, or `[rule-id]` inside a line) |
| `sources-recorded` | with `--sources`: every reference and example has recorded sources |
