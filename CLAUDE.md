@AGENTS.md

# Pocket Arcade: how Claude Code works in this repo

AGENTS.md, imported above, holds the engineering rules. This file adds how work runs here: where
things are, how to run an epic, which source wins, and the decisions already made.

## The owner

- The owner's only steps are the Apple, AdMob and Google accounts, play-tests, the Persian and
  Sorani (fa, ckb) text review and listening to sounds. None of them blocks a task.
- At the start of each epic, tell the owner in two lines what it will build and roughly how long
  it will take.
- To ask something, follow `git-commits-and-reporting` rule 8: one request, answerable in a word,
  with the default that applies meanwhile, then keep working. The tasks that collect the owner's
  steps (E17-T01, each game's T01) send them as one list.
- For a product question (the spec is contradicted, ambiguous or silent), build with the default
  while you wait. For product questions this replaces AGENTS.md's "stop that line of work". Still
  stop that line for anything AGENTS.md lists as irreversible or leaving this Mac, and for a gate,
  golden, baseline or fixture change without an agreed reason.

## Where things are

- `epics/`: the plan of all work, one branch per epic. `epics/README.md` is the index and the
  order. Work from an epic or a direct request from the owner.
- `skills/`, seen as `.claude/skills/`: the self-contained skills (`pocket-arcade-index` lists
  them). Each one says how to build its part, with templates and checkers.
- `spec.txt`: the product spec. Change it only on the owner's word. A test expectation that
  changes because of it carries `Spec-Change: spec <section> <what changed>`.
- `docs/`: the engineering handbook. `docs/99-final-decisions.md` section H holds the decisions.
- `design/`: Toybox, the chosen design: `toybox.html`, `toybox/tokens.json` and the copy deck.
  Transit and Night Cabinet are the designs the owner did not pick. Change it only with the
  owner's approval, as an epic's design pass describes. Run `node skills/_library/refresh-shared.mjs`
  after the change, and record a `referenceChanges` entry.
- `idea-hunt/`: step 1 research and toys. Read it, never change it.
- `AGENTS.md` is a byte-for-byte copy of monorepo-bootstrap's `templates/repo/AGENTS.md.tmpl`.
  Never edit it by hand. Change the template with `skill-maintenance`, and put notes for this repo
  in this file.

Until E01-T04 has installed the packages (no root `package.json` or `node_modules/`), skip the npm
steps of AGENTS.md's session start. From then on they apply, on the E01 branch too. During E01-T03
to T05, `check:fast` is expected to be red.

## Running an epic

"Do epic E05" is the owner's request to commit every task on the epic's branch and merge it into
the local `main`. It never covers a push.

1. Read `epics/E05-*.md` completely. Check that the epics it depends on are merged into `main`;
   for a game epic, the previous game may instead be closed as dropped with its report. Then
   compare the epic's "Current state" with the repo. A difference that changes what a task must
   do (a missing file, a red check, another tool version) is a stop: say what differs. A newer
   commit, a later date or a changed count goes into the report, and the work goes on.
2. Load the four "Always" skills with the Skill tool. Before each task, load the skills on that
   task's "Skills" line that are not loaded yet. After a context compaction, load the current
   task's skills again before running their checks.
3. Create the branch named at the top of the epic: `git switch main && git switch -c <branch>`.
4. Do the tasks in order, each one test-first as `tdd-workflow` says, starting from the task's
   "Tests first". Never weaken a test to make it pass. The epic's own "How we work in this epic"
   section and its tasks win over these general steps. For example, E01 lands T01 to T06 as one
   commit, and a game epic closes in a task before its release tasks, which run on `main`.
5. A screen task is done only when
   `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen <S-id>` prints
   `RESULT: PASS`. It must cover the full set: light and dark, en and fa, every scroll offset,
   with de and ckb added before a release. A run narrowed with `--themes` or `--langs` never
   counts. Read every `sheet.png`, `zoom-*.png` and `eye-*.png` with the Read tool, and record the
   eye checks in `parity/signoff.json`. If a difference survives three fixes or needs a waiver,
   send the owner one request.
6. Close the epic by following its "Close the epic" section step by step. Its order and its list
   of gates that are expected to be red win over this summary. Run `/simplify` and then
   `/code-review` on the whole branch, `main...HEAD`, not only on uncommitted changes. Their
   findings are fixed test-first, never applied directly. Wait for the code review's findings
   before fixing, reporting or merging.
7. Push only when the owner has said so in this session. Before E10 the pre-push hook cannot
   pass, so merges stay local.
8. Make the epic's evidence report, in the `git-commits-and-reporting` form, your final message.

A direct request outside an epic becomes its own commit when an epic branch is open. Otherwise it
goes on a branch from `main` named `<type>/<scope>-<slug>`, closed the same way as an epic.

## Which source wins

- When instructions disagree, follow them in this order:
  1. the owner's word in this session;
  2. `docs/99-final-decisions.md` section H;
  3. the skills;
  4. the epic;
  5. the docs.
- A doc that disagrees with a skill is corrected to match the skill (L14). An epic that disagrees
  with a skill is fixed in its own `docs(docs)` commit, named in the report.
- When two skills disagree, ask the owner as AGENTS.md says. Meanwhile, follow the skill that owns
  the topic.
- A checker's `SKIP` lines and `NOT APPLICABLE` count as a pass; exit 2 never does. The one
  accepted FAIL is a ship gate whose only problems are `owner-placeholder` lines ending in
  `OWNER STEPS PENDING: G3, G5`. Report it as not verified and go on.

## Skills

- When real work shows that a skill is wrong or incomplete, fix the skill. This holds in every
  epic. For this work you are the "lead" that `skill-maintenance` names. Use that skill:
  1. Edit the canonical copy: the skill's own file, or a synced file's copy under
     `skills/_library/shared/`. After a shared file, run `node skills/_library/sync-shared.mjs`.
  2. When a checker rule changes, add a planted-bad fixture whose `EXPECT.txt` names the rule.
  3. Run these until each prints `RESULT: PASS`:
     - `node skills/_library/validate-skills.mjs <name>`
     - `node skills/<name>/scripts/selftest.mjs`
     - `node skills/_library/check-staleness.mjs <name>`
     - `node skills/skill-maintenance/scripts/check-skill.mjs skills/<name>`
  4. Commit it as its own `fix(skills): ...` commit. Then copy the changed template into the repo
     again, in a commit that gives the reason.

  Never work around a skill silently.

- Do not run throwaway from-scratch rebuilds to test the skills. The real epics test them.

## Decisions already made (do not reopen them)

Owner decisions, 2026-09-30. These O1-O6 are not the human-step IDs O1-O10 in `epics/README.md`.

- **O1 Tracking:** the S3 intro and Google's form where Google requires it, then Apple's App
  Tracking Transparency prompt while the status is not determined. When no form is due, Apple's
  prompt shows alone (L10).
- **O2 Price:** Premium costs EUR 1.99, always shown from the store's price.
- **O3 Family Sharing:** none.
- **O4 App ids:** `io.applander.<game id without hyphens>` on iOS and Android. Premium is
  `<app id>.premium`.
- **O5 Contrast:** 4.5:1 or more for every text in every state.
- **O6 Owner checks:** the owner personally reviews fa and ckb, play-tests and listens to the
  sounds; none of this blocks a task.

The lead's decisions L1-L14 are in `docs/99-final-decisions.md` section H.

## Background agents and workflows

- Never send a message to a running workflow agent by its id. It starts a second copy that edits
  the same files. Wait for the workflow's result instead.
- Subagents follow these same rules, and shut down the simulators they started when they are done.
- When an API, usage-limit or network error stops a workflow, resume it so that finished agents
  are not run again.

## Safety

- Never open, print, copy or commit an `AuthKey_*.p8`, `.p12`, `.jks`, keystore,
  `play-service-account.json` or token anywhere on this Mac; some sit in the parent folder. Only
  the release scripts read them, in memory.
- No uploads, App Store Connect or Play Console changes, or pushes without the owner's word in this
  session.
