# Pocket Arcade skills — authoring standard

Every skill in `skills/` follows this standard. `node skills/_library/validate-skills.mjs` enforces the checkable parts; a skill is finished only when the validator and the skill's own self-test print `RESULT: PASS`.

## 1. Where skills live

- Author each skill at `skills/<name>/`. Claude Code loads it through a symlink `.claude/skills/<name> -> ../../skills/<name>`, which `skills/_library/link-skills.mjs` creates. (Writing inside `.claude/` asks the owner for approval on every file; one symlink per skill avoids that.)
- A skill is exactly one folder deep. Nothing but skill folders and `_library/` lives in `skills/` (plus `README.md`).

## 2. Self-contained, always

The owner's rule: **a skill never depends on anything else in the project.**

- Never reference or link knowledge files outside the skill: no `docs/`, `spec.txt`, `SPEC.md`, `design/`, `idea-hunt/`, `99-final-decisions`, `/Users/...`, scratchpad paths, `../` links, or another skill's folder. Copy the knowledge into this skill's `references/` or `assets/` instead.
- Code paths the skill *creates or checks in the app repo* (for example `packages/shell/src/ui/app-text.tsx`) are content, not dependencies, and are allowed.
- Another skill may be named for a hand-off ("then load `toybox-visual-parity`"), but this skill must still finish and verify its own job without it. Never call another skill's scripts.
- Shared data (tokens, fonts, copy deck, script helpers) has one canonical copy in `_library/shared/`; `node skills/_library/sync-shared.mjs` copies it into each skill that declares it, and the validator fails on drift.

## 3. Folder anatomy

```
<name>/
  SKILL.md          required, ≤ 300 lines
  references/       knowledge Claude reads on demand (.md; ToC when > 100 lines)
  templates/        files Claude copies and fills in (real, compiling code/config)
  examples/         complete worked examples to imitate
  scripts/          checkers and generators Claude runs (Node .mjs)
  scripts/selftest.mjs   proves every checker passes good fixtures and fails bad ones
  tests/fixtures/   good/ and bad-*/ inputs for the self-test
  assets/           data files (tokens.json, fonts, reference PNGs, manifests)
```

Only create the folders a skill needs. Every file must be listed in SKILL.md's "Files in this skill" table with when to read or run it (files linked one level deep from SKILL.md).

## 4. Frontmatter

```yaml
---
name: kebab-case-name            # = folder name; 1-64 chars [a-z0-9-]; no leading/trailing/double hyphen
description: Builds X for Pocket Arcade (what it does). Use when <concrete intents and trigger words>. Not for <neighbour work> (use <other-skill>).
---
```

- `---` on line 1. Only `name` and `description` unless there is a strong reason. Never `disable-model-invocation` (the owner names skills in plain words; that flag hides them). No `allowed-tools` (it makes autonomous runs ask for permission).
- Description: third person, starts with a verb, ≤ 300 characters, no `<` or `>`, no "I"/"you". Lead with the trigger words a task would contain. Be a little pushy: Claude tends to under-use skills.
- Names never shadow bundled commands (`verify`, `run`, `debug`, `loop`, `init`, `review`, `code-review`, `simplify`, `security-review`), never contain "claude" or "anthropic".

## 5. SKILL.md body — this section order

```markdown
# Title

One or two sentences: what this skill makes true.

## Rules that must hold
1. **Rule.** Why it matters (one line). — numbered, testable, most important first

## Workflow
1. Step … (say exactly which reference to read at which step, which template to copy, which script to run)
…
N. Run the checks (validation loop: run → fix → rerun until PASS).

## Definition of done
- [ ] Concrete, checkable items …
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/<check>.mjs <args>` prints `RESULT: PASS`

## Anti-patterns
- What goes wrong and what to do instead.

## Files in this skill
| File | What it is | Read/run when |

## Related skills
- `other-skill` — when to hand off (name only)
```

- The rules and the definition of done must sit near the top: after context compaction only the first ~5,000 tokens of a skill survive.
- Write calmly and explain *why*; no ALL-CAPS shouting. Give one default, not a menu. Be prescriptive where the work is fragile (configs, pins, thresholds), flexible where judgement is needed (game feel, copy).
- Say plainly what the owner must do by hand, when anything is a human step, and stop and ask before anything irreversible or outward-facing.

## 6. Scripts

- Node ESM `.mjs`, Node ≥ 22, **zero dependencies** (only `node:` built-ins). A skill that truly needs packages (image comparison, Playwright) ships `scripts/package.json` with exact pins and installs them itself into its own `scripts/node_modules` (gitignored) via `npm ci --prefix`.
- Invoked as `node ${CLAUDE_SKILL_DIR}/scripts/<name>.mjs [args]`; the working directory is the app repo root; paths are arguments with sensible defaults.
- **The repo root is an optional positional argument** (default `.`): `node ${CLAUDE_SKILL_DIR}/scripts/check-x.mjs . --game line-siege`, never `--root`. check-lib answers a guessed `--root` with the positional form, and a script that still declares a `--root` option (and no positional arguments of its own) accepts the root positionally as well. SKILL.md workflows, definitions of done and the index write every command out in full, with its arguments.
- `--help` prints usage. Exit `0` = pass, `1` = violations found, `2` = bad input or environment. The last line is always `RESULT: PASS` or `RESULT: FAIL (<n> problems)` and every problem line names the file, the rule and the fix.
- A checker that finds nothing to check (missing target) fails with exit 2 — it never passes silently. When the target is due (the build step that makes it has passed), a missing target is a problem (exit 1).
- **SKIP:** a rule that a repo fact puts out of reach is reported with `report.skip({ file, rule, message })`, which prints `SKIP <file> [<rule>] <message>` and does not count as a problem. There are exactly two such facts:
  1. **A partial Shell.** `readShellSlice(root)` reads `shell-slice.json` (`{ "screens": ["S4", "S11"], "why": "..." }`; `"screens": []` for a game-first repo; no file means the full Shell and every rule is strict). A rule tied to a screen outside the slice prints `SKIP <file> [<rule>] <S-id> not in shell-slice.json` (`sliceSkipReason(slice, 'S5')` gives the text); rules that need the Shell app itself skip only when `screens` is `[]` (`sliceSkipReason(slice)`). Everything inside the slice is checked strictly.
  2. **A rule that is not yet due.** When a rule's target is a file that a later Shell build step creates, `dueSkipReason(root, { file, step })` returns `'due at Shell step <step>: <file> not yet created'` while that file is missing, and `null` once it exists, from which point the rule is strict. `SHELL_DUE_TARGETS` names the usual targets: `plugins` (`packages/shell/src/config/shell-plugins.ts`, step 8: every plugin-entry rule, such as the ads, IAP, audio and font plugins), `catalogs` (`packages/shell/src/i18n/catalogs/en.json`, step 6: catalog-key rules) and `boot` (`packages/shell/src/app/start-shell.ts`, step 6: boot wiring such as hydration, the background checkpoint and UI feedback). Use it only for a target the build order creates later, never for a file the checker's own step should have written.

  A checker that decides whether something may ship (a release, store-artifact or completeness gate) never skips: it fails while `shell-slice.json` exists, and it never calls `dueSkipReason`.
- **NOT APPLICABLE:** when a repo fact proves the whole check does not apply (every game module has `realtime: null`, so a real-time checker has nothing to judge), the checker returns `report.notApplicable('<the fact>')`: it prints `NOT APPLICABLE: <the fact>`, then `RESULT: PASS`, and exits 0. Never use it for a target that is simply missing; that stays exit 2 (or exit 1 when due).
- SKIP lines and NOT APPLICABLE count as a pass wherever results are read (the index, quality-gates, reports); exit 2 never does.
- **Every checker that walks the app repo broadly passes `REPO_SCAN_IGNORES` to `walk`** (`walk(root, { ignore: [...REPO_SCAN_IGNORES, ...extra] })`), and one that reads paths from git (diffs, logs) drops them with `isRepoScanIgnored(path)`. The list skips the in-repo `skills/` library and `.claude/` (their fixtures hold planted bugs, goldens and skipped tests on purpose), `node_modules`, `Pods`, `.expo`, and each app's generated `ios/`, `android/`, `build/` and `out/`, while same-named source folders such as `packages/tooling/src/build/` are still scanned. Every such checker has a fixture with a `skills/` folder full of planted findings that must stay silent.
- Every skill with scripts ships `scripts/selftest.mjs` + `tests/fixtures/`: good fixtures must pass, each planted-bug fixture must fail with its expected message. `node skills/_library/selftest-all.mjs` runs them all.

## 7. References, templates, examples

- References are copied, adapted knowledge (from the handbook, spec, design and research), rewritten so they make sense inside the skill: no "see docs/NN". Start any reference over 100 lines with a table of contents.
- Templates are real files that compile/lint under the project's rules (strict TypeScript 6, ESLint config, naming, size limits, no enums, named exports, logical style props, i18n strings). Placeholders are `__UPPER_SNAKE__`.
- Examples are complete, realistic and small; one good example beats three partial ones.

## 8. Quality bar

- Complete: someone who has only this skill can do the job right the first time.
- Correct: versions and APIs match the verified stack (Expo SDK 57, RN 0.86.3, React 19.2.3, TypeScript 6.0.3, React Navigation 7 static, Zustand 5, expo-sqlite, Skia 2.6.2, Reanimated 4.5.1, Worklets 0.10.1, RNGH 2.32, react-intl 12, react-native-google-mobile-ads 17, expo-iap, Jest 29.7 + jest-expo 57 + RNTL 14, Maestro 2.10, Xcode 26.6).
- Self-verifying: the definition of done ends in a script that proves the work, and the script proves itself.
