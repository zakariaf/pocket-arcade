# How Claude Code finds, lists, loads and runs a skill

The mechanics behind the standard's rules, as verified with Claude Code 2.1.283 on 2026-09-28 (headless `claude -p` runs in throwaway repos) and read in the Claude Code documentation. Read this when a skill does not load, does not trigger, loses its rules in a long session, or its script is denied.

## Contents

- Discovery
- Frontmatter parsing
- The listing and its budget
- Invocation
- What the body can do
- Compaction
- Permissions
- Diagnostics
- Pitfalls, by symptom

## Discovery

- Project skills are found at `.claude/skills/<name>/SKILL.md`, exactly one folder below `.claude/skills`. A skill inside a grouping folder (two levels below `.claude/skills`) is not discovered. A flat `name.md` is not a skill.
- A skill folder may be a symlink; Pocket Arcade links `.claude/skills/<name>` to `../../skills/<name>`. Tested: linked skills appear in the listing and in `/` commands, and the Skill tool loads them.
- Claude Code walks up from the start folder to the repo root, so root skills load from any subfolder. Nested `.claude/skills` folders below the start folder (for example in `apps/<game>/`) load only after Claude reads or edits a file there; until then they are absent from the listing and `/name` does nothing. Keep every skill at the root.
- Folders named `synced` or `anthropic-skills` are skipped.
- Claude Code watches `.claude/skills/` and picks up added, edited and deleted skills during a session (it watches the `SKILL.md` text; other files are read on demand anyway). A `.claude/skills` folder that did not exist when the session started needs `/reload-skills` or a new session; do the same when a newly linked skill does not show up in `/skills`.
- A skill whose folder name differs from `name:` is listed under the folder name and both names invoke it; keep them equal.
- Precedence for a shared name: enterprise, then personal (`~/.claude/skills`), then project. A project skill with a bundled command's name replaces that command. So never reuse a bundled name, and check that no personal skill has the same name as a project skill.

## Frontmatter parsing

- The opening `---` must be line 1. With a blank line or a byte-order mark first, the whole file becomes the body and the listing shows the description as `---`.
- If the YAML does not parse, every field is dropped silently: no description (the first body line is used instead) and the skill is missing from the SDK's `init.skills` list.
- Misspelled keys (`allowed_tools`, `disableModelInvocation`) are ignored without a warning.
- `claude plugin validate .claude/skills` reports YAML parse errors and a missing description only. It does not check name format, name versus folder, description length, unknown keys, reserved words or angle brackets; the library validator does.

## The listing and its budget

- Every turn Claude sees each skill's name and description. That listing is all it uses to decide whether a skill fits; the body is read only after invoking.
- Each entry is cut at 1,536 characters (description plus `when_to_use`).
- The whole listing has a budget: `skillListingBudgetFraction` of the context window, default 0.01. Measured: 30,000 characters at the default. When over budget, Claude Code drops whole descriptions, starting with the least-used skills, which keep only their name ("Skill listing over budget: 73 skills, 37308 chars > 30000 budget" in the debug log; 15 of 60 test skills became name-only). Descriptions are never cut halfway.
- A name-only skill can still be invoked when the owner names it, but Claude will not pick it for an unnamed task. Hence the 300-character limit, trigger words first, and the proposed `skillListingBudgetFraction: 0.04`.
- `disable-model-invocation` skills are left out of the listing; `paths` skills are left out until a matching file is read.

## Invocation

- The owner types `/name` or `/name arguments`. Up to six skills can be stacked in one message (`/a /b task`).
- The owner names the skill in prose ("use the troubleshooting-playbook skill") and Claude calls the Skill tool. This works whenever the skill is listed, even name-only.
- Claude picks a skill itself when the task matches a description. It tends to skip skills for tasks that look easy, so descriptions name the situations, not only the topic.
- `disable-model-invocation: true` blocks Claude from invoking the skill at all (it tells the owner to type `/name`). `user-invocable: false` hides it from the `/` menu.
- When the skill loads, Claude receives "Base directory for this skill: <absolute path>" and then the body.

## What the body can do

- `${CLAUDE_SKILL_DIR}` expands to the skill's own folder (for a linked skill: the `.claude/skills/<name>` link path). Scripts are always called as `node ${CLAUDE_SKILL_DIR}/scripts/<x>.mjs`; a relative `scripts/x.mjs` runs from the session folder and fails.
- `@${CLAUDE_SKILL_DIR}/references/<file>.md` in the body attaches that file automatically; `@references/<file>.md` does not. Pocket Arcade links references normally and says when to read each one.
- `` !`command` `` injection runs at load time in the session folder. A non-zero exit, a command that is not pre-approved, or a run over 2 minutes aborts the whole invocation and Claude never sees the skill. Pocket Arcade runs checks as normal Bash calls from the instructions, never as injections.
- `context: fork` runs the skill in a separate context; on a guidelines skill that returns nothing useful. Not used here.
- Bash output over about 30,000 characters reaches Claude as a file path plus a preview, so checkers print short problem lines and write long reports to files.

## Compaction

- In a long session, auto-compaction keeps the most recent invocation of each skill, but only its first 5,000 tokens (about 20,000 characters), with 25,000 tokens in total, most recent skill first. Older skills can disappear entirely; the listing itself is not re-injected.
- So the rules and the definition of done sit at the top of SKILL.md, and a long session re-invokes a skill before its verification step.

## Permissions

- Claude's Skill tool call is allowed without a prompt for skills without `allowed-tools` or `hooks`. A skill with either needs a `Skill` or `Skill(<exact-name>)` allow rule; in headless runs it was denied (`permission_denials: [Skill]`), and a wildcard `Skill(prefix-*)` did not match.
- Skill scripts run as ordinary Bash calls under the normal rules. The project allow rules in the library-commands reference let them run without prompts; without them a script call was denied ("This command requires approval").
- Project allow rules are dropped while the workspace is untrusted ("Dropped 2 project-scoped permissions.allow entries - workspace not yet trusted"); the owner accepts the trust dialog once.
- Writes under `.claude/` are protected paths and always ask, whatever the allow rules say. That is why skills are written in `skills/` and linked.

## Diagnostics

| Tool | Shows |
|---|---|
| `/skills` | the loaded skills, with a search box |
| `/context` | the listing size after the budget is applied |
| `/doctor`, `/skill-doctor` | listing cost and the biggest entries; skills that are never used |
| `/reload-skills` | re-scans the skill folders |
| `claude --debug` | parse errors and the over-budget warning |
| `claude -p "..." --output-format stream-json --verbose` | the `init` event lists `skills` and `slash_commands`; assistant events show each `tool_use` (a Skill call carries `input.skill`) |

## Pitfalls, by symptom

| Symptom | Cause | Fix |
|---|---|---|
| The skill never appears | grouping folder, nested folder not yet touched, reserved folder name, created mid-session | root `skills/<name>` linked from `.claude/skills/<name>`; `/reload-skills` |
| Listed with description `---` | `---` not on line 1 | put it on line 1, no BOM |
| Listed with its first body line | YAML parse error or no description | one-line values, quote `: ` and ` #` |
| Only the name is listed | listing over budget | shorter description; `skillListingBudgetFraction` |
| Claude tells the owner to type `/name` | `disable-model-invocation` | remove it |
| `/name` does nothing | `paths`, `user-invocable: false`, nested skill | remove the key; root placement |
| The Skill call is denied in a headless run | `allowed-tools` or `hooks` in frontmatter | remove them; project Bash rules for scripts |
| "Shell command failed for pattern" and no skill | a failing or unapproved `!` injection | run the check as a normal Bash step |
| Rules forgotten late in a session | compaction kept only the first 5,000 tokens | rules and done list at the top; re-invoke before verifying |
| A script works in one session only | relative script path | `node ${CLAUDE_SKILL_DIR}/scripts/<x>.mjs` |
| Another skill with the same name loads | a personal skill shadows it | unique project names |
