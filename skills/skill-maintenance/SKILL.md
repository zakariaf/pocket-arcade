---
name: skill-maintenance
description: Adds, updates and repairs Pocket Arcade skills to the authoring standard - scaffold, SKILL.md, description, scripts and self-tests, validator, sources, routing evals. Use when creating, editing or checking a skill, or one does not load or trigger. Not for app failures (troubleshooting-playbook).
---

# Skill maintenance

Makes every change to a Pocket Arcade skill land finished: built to the authoring standard, self-contained, routed by a sharp description, proven by its own self-test, and recorded against the project files it was copied from. The owner never reads the skills, so a skill is correct only when the checks here say so.

## Rules that must hold

1. **A skill is done only when the checks pass.** The library validator, the skill's own self-test and `check-skill.mjs` all print `RESULT: PASS`; nothing else counts, because the owner never reads skill files.
2. **Copy knowledge in; never point at it.** No handbook chapter, spec, design file, research note, scratch path, other skill's folder or library internal file is named in a skill; skills are loaded alone and pointers go stale.
3. **The description decides whether the skill is ever used.** At most 300 characters, a verb first, trigger words, "Use when", and "Not for <work> (<neighbour-skill>)"; Claude sees nothing else before it invokes a skill.
4. **Rules and the definition of done sit at the top, and SKILL.md stays at 300 lines or fewer.** After compaction only the first 5,000 tokens of a skill survive.
5. **Every script proves itself.** A good fixture and one bad fixture per rule with an EXPECT naming the rule id; nothing to check exits 2. A check that has only ever passed proves nothing.
6. **Edit the canonical copy, never a synced or generated file.** Shared files change in the library and arrive through sync-shared; generated references change through their generator. The next sync or render erases a hand edit, and the validator fails on drift.
7. **Record every copy from the project, and re-copy (never just re-record) when a source changes.** The staleness check works only with records, and re-recording hides the drift.
8. **Only frontmatter `name` and `description`.** Never `disable-model-invocation`, `allowed-tools`, `hooks`, `paths` or `user-invocable`: the owner names skills in plain words, and those keys hide the skill or make its invocation need approval.
9. **Touch only the skill you were asked to change** (plus its prompts in this skill's routing evals). Other builders work in parallel, writes under `.claude/` need the owner, and the library belongs to the lead; propose other changes in the report instead.

## Workflow

1. **Decide: new skill or change to an existing one.** List `skills/` and run `node ${CLAUDE_SKILL_DIR}/scripts/check-routing.mjs --skills-root skills --prompt "<the task>"` to see which skill already wins that task. Read [references/descriptions-and-routing.md](references/descriptions-and-routing.md) when the boundary is unclear.
2. **New skill:** `node ${CLAUDE_SKILL_DIR}/scripts/new-skill.mjs <name> --skills-root skills`, then `node skills/_library/sync-shared.mjs <name>`. The scaffold (`templates/new-skill/`) holds the six sections, a reference, a working pattern checker with its self-test and fixtures, and `__FILL_...__` placeholders wherever you must write. Read [references/authoring-standard.md](references/authoring-standard.md) before filling it; [examples/new-skill-walkthrough.md](examples/new-skill-walkthrough.md) shows a complete run.
3. **Knowledge:** copy it into `references/` (a Contents list over 100 lines), `templates/` (real files: test them in a scratch copy of a verified workspace with `tsc`, ESLint and Jest; never `npm install` through a symlinked `node_modules`), `examples/` and `assets/`. After each copy from the project run `node skills/_library/record-sources.mjs <name> <skill-file> <project-files>`; [references/library-commands.md](references/library-commands.md) has every library command.
4. **Scripts:** read [references/writing-scripts.md](references/writing-scripts.md). Write each checker on `check-lib.mjs`, one bad fixture per rule, and run the checker on a real verified workspace to be sure it has no false findings.
5. **Description:** write it with the descriptions reference, then add two realistic prompts for the skill to `assets/routing-evals.json` in this skill.
6. **Check the skill:** `node skills/_library/validate-skills.mjs <name>`, `node skills/<name>/scripts/selftest.mjs`, then `node ${CLAUDE_SKILL_DIR}/scripts/check-skill.mjs skills/<name>`. Fix every `FAIL` line and rerun until all three pass.
7. **Check the set:** `node ${CLAUDE_SKILL_DIR}/scripts/check-skill-set.mjs skills` and `node ${CLAUDE_SKILL_DIR}/scripts/check-routing.mjs --skills-root skills`. A problem your change caused is yours to fix; one that belongs to a skill still being built goes into the report (`--skip-missing` turns evals for unbuilt skills into notes). After a new or changed description, confirm with Claude itself: `check-routing.mjs --skills-root skills --live --only <name> --runs 3` (a few short model calls).
8. **Library round:** `node skills/_library/sync-shared.mjs`, `node skills/_library/validate-skills.mjs`, `node skills/_library/selftest-all.mjs <name>`, `node skills/_library/check-staleness.mjs <name>`, then `node skills/_library/link-skills.mjs` so Claude Code sees a new skill (the owner approves the write under `.claude/`).
9. **When a skill does not load, trigger or run,** match the symptom in the pitfalls table of [references/how-skills-load.md](references/how-skills-load.md).
10. **Report:** the skill, its description, what its scripts check, the `RESULT` lines, and anything left for the owner or the lead (links, settings, another group's skill).

## Definition of done

- [ ] `node skills/_library/validate-skills.mjs <name>` prints `RESULT: PASS`, and so does `node skills/<name>/scripts/selftest.mjs` when the skill has scripts.
- [ ] Every file copied from the project has recorded sources, and `node skills/_library/check-staleness.mjs <name>` prints `RESULT: PASS`.
- [ ] `check-skill-set.mjs skills` shows no problem caused by this change, and `check-routing.mjs --skills-root skills` passes (with `--skip-missing` only while other skills are still being built).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-skill.mjs skills/<name>` prints `RESULT: PASS`

## Anti-patterns

- **"See the handbook, chapter 14, for the details."** The chapter is not there when the skill runs elsewhere; copy the rows you need.
- **Fixing a routing miss by pasting the eval's words into the description.** Name the category of work, or add a "Not for" to the skill that won.
- **Editing `scripts/check-lib.mjs` in a skill.** It is a synced copy; the next sync reverts it and the validator fails first.
- **A checker that exits 0 when its folder is missing.** A typo then turns the gate green; exit 2.
- **A bad fixture whose EXPECT says only "FAIL".** It passes on any failure, including a crash; name the rule id and the line.
- **Recording sources again to silence a stale warning.** Re-copy the changed knowledge first.
- **Writing the skill straight into `.claude/skills/`.** Every write there needs the owner's approval; author in `skills/` and link.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/authoring-standard.md](references/authoring-standard.md) | The whole standard restated: placement, self-containment, anatomy, frontmatter, section order, scripts, templates, quality bar, every validator rule, what check-skill adds | Workflow step 2, before writing any skill file |
| [references/library-commands.md](references/library-commands.md) | Every library command with options, exit codes and when to run it; sources.json; shared files; settings; the library's own tests | Workflow steps 3 and 8 |
| [references/writing-scripts.md](references/writing-scripts.md) | The script contract, a complete checker, the check-lib API, self-tests, fixture patterns, packages | Workflow step 4 |
| [references/descriptions-and-routing.md](references/descriptions-and-routing.md) | The description formula and rules, good and bad examples, keeping descriptions apart, routing evals offline and live | Workflow steps 1, 5 and 7 |
| [references/how-skills-load.md](references/how-skills-load.md) | Discovery, parsing, listing budget, invocation, compaction, permissions, diagnostics, pitfalls by symptom | Workflow step 9, and when a rule of the standard needs its reason |
| [examples/new-skill-walkthrough.md](examples/new-skill-walkthrough.md) | A real new skill from scaffold to PASS, and an update after a stale source | Workflow step 2 |
| `templates/new-skill/` | The scaffold new-skill.mjs copies: `SKILL.md.tmpl`, a reference, `check-rules.mjs`, its self-test and fixtures, `assets/shared.json` | Workflow step 2 (through the script) |
| `assets/routing-evals.json` | At least two realistic task prompts per skill with the skill that should win | Workflow steps 5 and 7 |
| `scripts/new-skill.mjs` | Creates a skill from the scaffold; refuses bad, reserved or taken names | Workflow step 2 |
| `scripts/check-skill.mjs` | Checks one skill is finished (boundaries, reasons, orphans, placeholders, self-test coverage, EXPECT ids, sources) | Workflow step 6 and the definition of done |
| `scripts/check-skill-set.mjs` | Checks the set: overlapping or duplicate descriptions, hand-offs, listing budget, index coverage | Workflow step 7 |
| `scripts/check-routing.mjs` | Routing evals, offline ranking or live with Claude Code | Workflow steps 1 and 7 |
| `scripts/lib/skill-md.mjs` | SKILL.md reader used by the checkers | Never by hand |
| `scripts/lib/router.mjs` | The offline ranking used by check-routing | When tuning the offline router |
| `scripts/lib/live-route.mjs` | Runs `claude -p` and reads the first tool call | Never by hand |
| `scripts/selftest.mjs` | Proves all four scripts pass good fixtures and catch every planted bug | After changing a script or the scaffold |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad skills, skill sets, eval files and scaffold cases | When adding a rule |

## Related skills

- `troubleshooting-playbook` - failures in the app or its tooling rather than in a skill.
- `git-commits-and-reporting` - committing a skill change and reporting it to the owner.
