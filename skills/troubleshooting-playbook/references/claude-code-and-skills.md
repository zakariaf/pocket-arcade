# Claude Code and skills

Why a skill does not load, trigger or run, and other Claude Code behaviours that break an unattended session. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Loading
- Invocation
- Listing
- Context
- Setup
- Naming
- Scripts
- Validation
- Session

## Loading

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `skills-grouping-folder` | A skill placed in a grouping sub-folder, two levels below .claude/skills, never appears | Skills are discovered exactly one folder deep | Keep skills/<name>/SKILL.md and link .claude/skills/<name> to it | verified | `skill-maintenance` |
| `skills-frontmatter-line1` | The skill is listed with the description "---" | The opening --- is not line 1 (blank line or BOM before it), so the whole file became the body | Put --- on line 1 | verified | `skill-maintenance` |
| `skills-yaml-parse` | The skill is listed with its first body line as description | The frontmatter YAML does not parse, so every field is dropped silently | Keep one-line values; quote values containing ": " or " #" | verified | `skill-maintenance` |
| `skills-at-attach` | @references/x.md in SKILL.md is not attached | Only @ paths that start with the skill-folder variable are attached automatically | Link references normally and say when to read each one | verified | `skill-maintenance` |
| `skills-nested-skills` | A skill in apps/<game>/.claude/skills is missing from the / menu | Nested skills load only after Claude reads or edits a file in that folder | Keep every skill at the repo root (skills/<name>, linked from .claude/skills/<name>) | verified | `skill-maintenance` |
| `skills-reserved-folder` | A skill folder named synced or anthropic-skills never loads | Those names are reserved | Rename the folder and the name field | verified | `skill-maintenance` |
| `skills-misspelled-field` | allowed_tools or disableModelInvocation has no effect | Unknown frontmatter keys are ignored silently | Use only name and description (the validator rejects other keys) | verified | `skill-maintenance` |
| `skills-missing-description` | The skill is listed with its first body line and is missing from init.skills | The description field is missing | Write a description of at most 300 characters: verb first, trigger words, Not for | verified | `skill-maintenance` |
| `skills-reload-skills` | A skill folder created mid-session does not appear | A new top-level skills folder is not watched until re-scanned | Run /reload-skills or start a new session | documented | `skill-maintenance` |

## Invocation

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `skills-disable-model-invocation` | Claude says to type /name instead of using the skill the owner named | disable-model-invocation: true removes the description and blocks the Skill tool | Never use disable-model-invocation on Pocket Arcade skills | verified | `skill-maintenance` |
| `skills-paths-hides` | A skill with paths: is missing from the listing and /name does nothing | paths hides the skill until a matching file is read | Do not use paths on skills the owner names | verified | `skill-maintenance` |
| `skills-allowed-tools-approval` | Claude's Skill call is denied in headless runs (permission_denials: [Skill]) | A skill with allowed-tools or hooks needs approval to be invoked by Claude; Skill(prefix-*) wildcards do not match | No allowed-tools; allow the scripts with a project Bash rule instead | verified | `skill-maintenance` |
| `skills-injection-abort` | Shell command failed for pattern ... and the skill never loads | A !`command` in SKILL.md exited non-zero or was not pre-approved | Run checks as normal Bash calls from the instructions, not as injected commands | verified | `skill-maintenance` |
| `skills-user-invocable-false` | Typing /name does nothing | user-invocable: false hides the skill from the / menu | Never set user-invocable on Pocket Arcade skills | verified | `skill-maintenance` |
| `skills-shadowed-name` | A different skill loads than the one in skills/<name> | A personal skill with the same name has higher precedence | Keep names unique and project-specific | documented | `skill-maintenance` |
| `skills-fork-empty` | A skill run returns nothing | context: fork on a guidelines-only skill runs it in a separate context with no task | No context key on Pocket Arcade skills (the validator rejects it) | documented | `skill-maintenance` |
| `skills-checker-root-flag` | A skill checker prints ERROR [bad-input] Unknown option '--root' | Every checker takes the repo root as its first positional argument, never --root | Run node <skill scripts folder>/<checker>.mjs . [options], exactly as the build order and the SKILL.md write it; the error's Fix text prints the positional form | verified | `pocket-arcade-index` |
| `skills-exit-2-is-not-a-pass` | A checker exits 2 with ERROR [bad-input] nothing to check (no flows yet, a turn-based repo, a folder that does not exist) | Exit 2 means bad input or nothing to check; it is never a pass. A checker that can prove from a repo fact that it does not apply prints NOT APPLICABLE: <fact> and RESULT: PASS instead, and rules out of reach in a partial Shell print SKIP lines | Rerun with the full command from the build order; if the target is built by a later step, name the check as not run yet in the report. Count only RESULT: PASS (with SKIP lines or NOT APPLICABLE) as a pass | verified | `pocket-arcade-index` |

## Listing

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `skills-listing-budget` | Some skills show only their name, no description | The skill listing exceeded its character budget (30,000 at the default 0.01) and dropped the least-used descriptions | skillListingBudgetFraction 0.04 in .claude/settings.json; keep descriptions ≤300 characters | verified | `skill-maintenance` |

## Context

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `skills-compaction` | After a long session a skill's later sections are forgotten | After compaction only the first 5,000 tokens of each invoked skill are re-attached (25,000 in total) | Keep rules and the definition of done near the top; re-invoke the skill before verifying | verified | `skill-maintenance` |

## Setup

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `skills-protected-claude-dir` | Every write under .claude/ asks for approval | .claude/ is a protected path | Author skills in skills/<name> and link .claude/skills/<name> once (link-skills.mjs) | verified | `skill-maintenance` |

## Naming

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `skills-bundled-name` | A skill named verify/run/debug replaced a bundled command | Same-name project skills shadow bundled ones | Never use bundled names (verify, run, debug, loop, init, review, code-review, simplify, security-review) | verified | `skill-maintenance` |

## Scripts

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `skills-cwd-relative-script` | A skill script path works in one session and not another | Injected and Bash commands run in the session folder, not the skill folder | Always call scripts through the skill-folder variable: node <skill dir>/scripts/<x>.mjs | verified | `skill-maintenance` |
| `skills-long-output` | A script's output arrives as a file path plus a preview | Bash output over about 30,000 characters is not shown inline | Checkers print short problem lines and a RESULT line; long reports go to files | documented | `skill-maintenance` |
| `skills-checker-scans-skill-library` | A repo checker reports findings inside skills/ (check-golden-changes: 396 fixture PNGs without Gate-Change; check-test-edits: it.skip and retryTimes lines; check-premium: get-task-allow in templates) | The checker walked or diffed the whole repo, including the in-repo skill library, whose fixtures plant these findings on purpose | Use the current skills: every repo-scanning checker skips REPO_SCAN_IGNORES (skills/, .claude/, node_modules, Pods, generated native and build output). A checker that still reports skills/ paths is a library bug: fix it with skill-maintenance (walk with REPO_SCAN_IGNORES, filter git paths with isRepoScanIgnored, add a fixture with a planted skills/ folder) | verified | `skill-maintenance` |

## Validation

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `skills-plugin-validate-weak` | claude plugin validate passes a skill that is still broken | It checks only YAML parsing and a missing frontmatter or description | Run node skills/_library/validate-skills.mjs, which checks the whole standard | verified | `skill-maintenance` |

## Session

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `skills-bash-every-call-exits-1` | Every Bash call exits 1 with no output, even true or exit 0, in the foreground and in the background (Read and Write still work) | The Claude Code session's shell tool broke after hours of long runs (most likely exhausted processes or descriptors); nothing in the repo or the skills causes it | Stop at once and reply with exactly what is done and what is left. Never build a workaround such as a job queue or a file-watcher runner; the session needs a restart. Prevent it: shut down your own simulators and stop your own Metro, Maestro drivers, log streams and monitors as soon as you are done with them | verified, owner | `troubleshooting-playbook` |
