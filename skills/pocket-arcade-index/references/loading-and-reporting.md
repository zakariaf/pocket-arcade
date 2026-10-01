# Loading skills and reporting

How a session picks up the Pocket Arcade skills, how the owner names them, and how every task ends: the report the owner reads instead of the code.

## Contents

- How skills load
- The owner's "Skills:" line
- Loading order, long sessions and compaction
- When no row fits
- Reading check results: PASS, SKIP, NOT APPLICABLE, exit 2
- Reporting
- Asking the owner

## How skills load

- Claude Code shows Claude the name and the one-line description of every skill; the full `SKILL.md` loads only when the skill is invoked. Descriptions decide whether a skill is used at all, which is why this index names skills explicitly instead of trusting description matching.
- Three ways to invoke a skill, all equivalent: the Skill tool with the skill's exact name (Claude does this itself when a description matches), a prompt that names it ("use the toybox-screens skill"), or `/skill-name` typed in the prompt.
- The skills live in `skills/<name>/` in the repo and are linked into `.claude/skills/<name>`, so Claude Code finds them when a session starts at the repo root. Start every session at the repo root: hooks, permissions and skills load from there.
- Inside a skill, `${CLAUDE_SKILL_DIR}` is that skill's folder. Its scripts run from the repo root as `node ${CLAUDE_SKILL_DIR}/scripts/<script>.mjs`.
- A skill that does not show up or will not run: check its link with `node skills/_library/link-skills.mjs --check`, then load `skill-maintenance`, whose pitfalls table covers every known cause.

## The owner's "Skills:" line

The owner may start a task with a line such as:

```text
Skills: /toybox-screens /tdd-workflow /toybox-visual-parity
```

- Load every named skill before anything else, in the order given. Their rules and definitions of done are binding for this task.
- Then add the other skills of the task's row in the task table; never drop a named skill in favour of a row skill.
- A name that does not exist: say so in one line of the report, pick the closest skill from `references/skill-table.md`, and continue. Never invent a skill's content.
- Without a "Skills:" line, the task table decides.

## Loading order, long sessions and compaction

- Load the lead skill (the first of the row) first, then the others. Read each skill's "Rules that must hold" and "Definition of done" before writing code: those are the parts the checks enforce.
- In a long session Claude Code compacts the context and keeps only about the first 5,000 tokens of each loaded skill. The rules and the definition of done sit there on purpose; before running a skill's checks late in a long session, invoke the skill again so its workflow and file table are complete.
- Reference files are read when the skill's workflow says so, not all at once.

## When no row fits

1. Read `references/skill-table.md` and load every skill whose description matches a part of the task.
2. A question of what the product must do (a screen, a rule, a feature, a game): load `pocket-arcade-product-spec`.
3. A failure or error message: load `troubleshooting-playbook` and let its catalogue name the owning skill.
4. When a task pattern repeats, add a row to `assets/index.json` and regenerate (`build-index.mjs --write`, then `check-index.mjs`).

## Reading check results: PASS, SKIP, NOT APPLICABLE, exit 2

Every skill script runs from the repo root with the root as its optional first argument (`node <the skill's scripts folder>/check-x.mjs . --game line-siege`), never `--root`; a guessed `--root` exits 2 and the error prints the positional form. The build orders write every command out in full. The last line decides:

| Output | Exit | Counts as |
|---|---|---|
| `RESULT: PASS` | 0 | a pass |
| `SKIP <file> [<rule>] <reason>` lines, then `RESULT: PASS` | 0 | a pass. A repo fact put those rules out of reach, and there are exactly two: a partial Shell, `shell-slice.json` (`<S-id> not in shell-slice.json` for a screen outside the slice, or `"screens": []` for rules that need the Shell app), and a rule not yet due (`due at Shell step <n>: <file> not yet created`: a later build step creates its target, and from then on the rule is strict). Everything else was checked strictly. Quote the skip count in the report; a not-yet-due SKIP line still printed after its step is a failure of that step |
| `NOT APPLICABLE: <fact>`, then `RESULT: PASS` | 0 | a pass. The fact proves the whole check does not apply (every game module has `realtime: null`, so the real-time loop checker has nothing to judge). Quote the fact in the report |
| `RESULT: FAIL (<n> problems)` | 1 | a failure: fix every `FAIL` line and rerun |
| `ERROR [bad-input] ...`, then `RESULT: FAIL (1 problems)` | 2 | never a pass: nothing to check (a missing folder, zero files) or bad arguments. Fix the command (the build order has it) or build the missing target; when its build step has passed, the target is due and missing it is a failure |

`npm run verify` prints its own `SKIP` lines while `shell-slice.json` exists (knip without its export and type kinds, `test:sim` while no game has sims); those count as a pass the same way, and its last line names them apart (`verify: 11 steps passed, 1 with SKIP lines`), so quote that line as it is. A clean run ends `verify: 11 steps passed, 0 skipped`. The build orders' table "When npm run verify is green" lists which verify steps are expected red before which build step; any other red step is a real failure. A slice never ships: the release checks fail while `shell-slice.json` exists.

## Reporting

Every task ends with one message to the owner. The owner never reads code or logs, so this message is the review. Its shape (the `git-commits-and-reporting` skill has the full format, templates and a checker):

1. **Outcome first, in players' words,** with screens named by name and ID ("Home (S4) now shows today's daily card").
2. **Evidence, copied, never retyped:** test counts from the Jest summary, numbers from the files in `reports/` (naming each file), and the `RESULT` line of every loaded skill's check, for example `check-screens.mjs . --screen S4: RESULT: PASS`, with the number of `SKIP` lines or the `NOT APPLICABLE` fact when there were any.
3. **Design match** for every changed screen: all four variants passed visual parity (light and dark times en and fa, at every planned scroll offset, against the reference the game's facts pick) and any waiver with its reason; a run narrowed with `--theme` or `--lang` never counts.
4. **Not verified:** an honest list (sound, haptics, 120 Hz, purchases and VoiceOver need a device or the owner); a keyless rehearsal (`REHEARSAL: not a release gate`) goes here, never under the checks.
5. **Owner steps (not blocking):** the owner's own checks, one line each: the review of pending fa and ckb texts, the play-test, listening to the sound previews ("none pending" or "done" when that is so). They are listed, never waited for; no step of the work stops for them.
6. **At most one question,** with the default that applies until the owner answers.
7. **Details last:** commits, commands, the red test runs.

A short slice report, for shape:

```text
Home (S4) is built and matches its design in light and dark, English and Persian.
Skills: toybox-screens, toybox-components, toybox-design-system, i18n-strings-and-catalogs,
rtl-and-direction, accessibility, toybox-visual-parity, unit-and-component-tests, tdd-workflow.
Checks: check-screens.mjs . --screen S4 PASS; check-signoff.mjs --screen S4 PASS;
check-i18n-code.mjs . PASS; check-rtl.mjs . PASS; check-a11y-code.mjs . PASS; check:fast green.
Tests: 214/214 (reports/jest-summary.txt).
Not verified: VoiceOver speech (owner checklist before release).
Owner steps (not blocking): fa and ckb texts: none pending; Line Siege play-test: still open;
the Line Siege sound previews: still open.
Question: none.
```

## Asking the owner

Stop and ask, in one message with one question answerable in a word and the default that applies meanwhile, before anything that cannot be undone or belongs to the owner:

- anything outward-facing: a push, a tag push, an upload, an App Store Connect or AdMob change, a submission;
- a conflict with a non-negotiable (N1 to N12), a spec gap a player would see, a new screen, route, setting or game;
- a change to a quality gate, a golden, a baseline, a budget or a pinned version;
- account steps (keys, agreements, app records, consoles, Xcode installs, `sudo`).

Never stop for the owner's own checks (the review of fa and ckb texts, the play-test, listening to the sound previews): list them under "Owner steps (not blocking)" and keep going.

Keep working on everything that does not depend on the answer.
