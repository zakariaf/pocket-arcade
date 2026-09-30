# Quality gates, hooks and git

Failures of the gates themselves, lefthook, Claude Code hooks and commit rules. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Commits
- Claude Code hooks
- Hooks
- Guardrail
- Claude Code settings

## Commits

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `gates-gate-change-trailer` | A commit is rejected: gate files changed without a Gate-Change trailer | The commit-msg hook requires Gate-Change: <reason> for gated paths | Get the owner's agreement, then commit the gate change with the trailer | verified | `git-commits-and-reporting` |
| `gates-commit-header` | Commit rejected: "Updated stuff." or feat(ui): ... | Conventional Commits with a folder scope are required | feat(line-siege): ..., scope = a folder under apps/ or packages/, or one of repo, deps, docs, ci, skills | verified | `git-commits-and-reporting` |
| `gates-no-secrets-hook` | Commit refused by no-secrets (AuthKey_*.p8, *.p12, .env) | Key and signing files are never committed, even with git add -f | Remove the file from the commit; keys live outside the repo | verified | `quality-gates` |
| `gates-first-commit-add-all` | The first commit swept in the owner's uncommitted handbook edits, the design folder and skills/ | The bootstrap staged with git add -A | Stage only the generated files and ask the owner about the rest | verified | `monorepo-bootstrap` |
| `gates-gated-paths-in-skills` | A commit that touches only skills/ is rejected for a missing Gate-Change trailer | An older commit-msg hook (or check-commits.mjs) matched gated-path globs such as **/tsconfig.json, **/__image_snapshots__/**, **/fixtures/save-v*.json and **/*.snap.ios against skill templates and fixtures | Update packages/tooling/src/git/commit-message-rules.ts from the monorepo-bootstrap or quality-gates templates: isGatedFile matches whole repo paths and lets a file under skills/ or .claude/ count only for a pattern that starts with that folder (.claude/settings.json stays gated); git-commits-and-reporting's check-commits.mjs applies the same rule | verified | `quality-gates` |
| `gates-device-only-code-without-test` | check-test-edits reports code-without-test for a fix to a device-only wrapper (the expo-sqlite driver) | The rule ignored the device-only marker; with --log it can only see the marker when the diff shows the first lines | Keep "// device-only: covered by <check>" in the first 6 lines and check with --range or --staged (current tdd-workflow) | verified | `tdd-workflow` |
| `gates-spec-ref-missing-after-hook` | check-commits fails spec-ref-missing ("the body names no spec line") on commits the commit-msg hook accepted | An older commit-msg hook used a weaker rule set than check-commits.mjs | Copy commit-message-rules.ts, commit-trailer-rules.ts, commit-message-samples.json and the test from quality-gates' templates: the hook now enforces the same rules with the same ids. Name the spec lines in every feat or fix body; report commits already made instead of rewriting shared history | verified | `git-commits-and-reporting` |

## Claude Code hooks

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `gates-posttooluse-exit-code` | Lint errors after an edit never reach Claude | A PostToolUse hook that exits 0 or 1 is not shown to Claude | Print to stderr and exit 2 | verified | `quality-gates` |
| `gates-stop-hook-cap` | The Stop hook keeps blocking and Claude stops anyway | The Stop hook blocks at most 8 consecutive continuations (CLAUDE_CODE_STOP_HOOK_BLOCK_CAP) | Read stop_hook_active; after the cap, report the failing gate to the owner instead of working around it | verified | `quality-gates` |

## Hooks

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `gates-bare-tsc-root` | Pre-commit typecheck passes although a package has errors | A bare tsc --noEmit checks only the root program | Run npm run -s typecheck (every project, incremental) | verified | `quality-gates` |
| `gates-eslint-rule-override` | A rule was switched off for one run with eslint --rule | The CLI flag overrides the config | Hooks and CI call only the canonical npm scripts | verified | `quality-gates` |
| `gates-commit-msg-enobufs` | The commit-msg hook fails with spawnSync git ENOBUFS | check-commit-message.ts read the staged diff with the default 1 MB buffer; staging skills/ exceeds it | Use the current check-commit-message.ts (raised maxBuffer) | verified | `monorepo-bootstrap` |

## Guardrail

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `gates-guardrail-drift` | check-quality-gates reports "max-params[1]: expected 3, got 5" | A limit in eslint.config.mjs was raised | Restore the limit; limits change only with the owner and a Gate-Change trailer | verified | `quality-gates` |
| `gates-art-check-missing` | Stale generated icons are not caught by verify | render-art.ts --check is not wired into the verify script yet | Add node packages/tooling/src/art/render-art.ts --app <id> --check for every app with the npmScripts entry in quality-gates.json (Gate-Change) | open | `code-drawn-art-and-icons` |
| `gates-guardrail-message-reworded` | check-quality-gates fails: a no-restricted-properties message (Date.now) differs from the recorded one | The guardrail compares the restricted-property messages word for word; a reworded ESLint template breaks every npm run verify | Never reword RESTRICTED_PROPERTIES messages; copy eslint.config.mjs from typescript-and-lint-rules byte for byte | verified | `typescript-and-lint-rules` |
| `gates-wiring-pending-targets` | check-gate-wiring fails script-target-missing for packages/tooling/src/i18n/verify-catalogs.ts and packages/tooling/src/audit/audit-network.ts on a fresh skeleton | Later skills build those two gate scripts (i18n-strings-and-catalogs, privacy-and-network-audit) | Run build step 1's command in full: check-gate-wiring.mjs . --pending packages/tooling/src/i18n/verify-catalogs.ts --pending packages/tooling/src/audit/audit-network.ts; drop each flag once its file exists | verified | `quality-gates` |

## Claude Code settings

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `gates-settings-overwrite` | Skill permissions or the Expo plugin entry vanished from .claude/settings.json | The file was replaced instead of merged | Merge keys; the edit asks the owner | verified | `quality-gates` |
| `gates-untrusted-workspace` | Project allow rules are ignored: "Dropped 2 project-scoped permissions.allow entries - workspace not yet trusted" | Claude Code drops project allow rules until the workspace is trusted | The owner accepts the trust dialog in the project folder once | verified, owner | `skill-maintenance` |
