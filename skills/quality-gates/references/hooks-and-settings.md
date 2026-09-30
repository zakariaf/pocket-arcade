# Git hooks and Claude Code hooks

How the hooks are wired, why each part is there, and what was verified. The files are `templates/lefthook.yml` (copy to `lefthook.yml`) and `templates/claude-settings.json` (merge into `.claude/settings.json`).

## Contents

- lefthook: pre-commit, commit-msg, pre-push
- The commit-msg check
- Claude Code hooks: after every edit, before stopping
- Permissions: deny and ask
- Merging `.claude/settings.json`
- How the hooks find the repo root
- Verified behaviour

## lefthook: pre-commit, commit-msg, pre-push

- `pre-commit` jobs run in parallel on the staged files: `no-secrets` (refuses any staged signing file, App Store Connect key or `.env` file), `format` (Prettier check), `lint` (ESLint, no warnings), `typecheck` (the whole-project script, because a change in one file can break another), `test-related` (`jest --ci --bail --findRelatedTests --passWithNoTests`).
- `commit-msg` runs `node packages/tooling/src/git/check-commit-message.ts {1}`.
- `pre-push` runs `npm run verify`.
- `assert_lefthook_installed: true` makes lefthook fail loudly if the hooks were not installed. The root `prepare` script installs them on every `npm install` / `npm ci`.
- Each secret pattern appears with and without `**/`: lefthook's default matcher needs a `/` before `**/.env*`, so without the bare `.env*` a root `.env` slipped through (verified with lefthook 2.1.14).
- A hook or job with `skip:` or `only:` no longer runs; never add either.

## The commit-msg check

`check-commit-message.ts` reads the message file, the staged files and `gatedPaths` from `quality-gates.json`, and calls the pure rules in `commit-message-rules.ts` and `commit-trailer-rules.ts`. They are the one rule set: the git-commits-and-reporting skill's `check-commits.mjs` enforces the same rules with the same ids, so a message the hook accepts never fails `check-commits.mjs` later (the first game build had five commits the hook let through and `check-commits.mjs` failed for `spec-ref-missing`; that can no longer happen):

- the header is `type(scope): subject` with a known type (`feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `style`, `revert`), a scope that is a folder under `apps/` or `packages/` or one of `repo`, `deps`, `docs`, `ci`, `skills`, at most 72 characters, a lowercase imperative subject that says something, and no trailing period;
- the second line is blank; a `feat` or `fix` has a body that says why (`body-missing`) and names the spec lines it serves, for example `Spec S9 and 8.3: ...` (`spec-ref-missing`; the `tooling` scope and the fixed scopes are exempt);
- trailers sit in the last paragraph with a real reason; `Spec-Change: spec <section> <what changed>`; a staged file matching `gatedPaths` needs a `Gate-Change: <reason>` trailer, and a commit without one must not carry it; no `__PLACEHOLDER__` is left;
- git runs with a 256 MB output buffer, because a commit that stages the `skills/` folder lists thousands of paths and the default 1 MB made the hook crash with `spawnSync git ENOBUFS` (verified 2026-09-28);
- git-generated headers (`Merge`, `Revert "`, `fixup!`, `squash!`, `amend!`) pass.

The two cannot drift: `packages/tooling/src/git/commit-message-samples.json` holds a good message and one sample per rule with the rule ids it must give; `commit-message-rules.test.ts` runs it through the hook's rules and git-commits-and-reporting's self-test runs it through `check-commits.mjs --samples`. A new rule goes into both rule sets and the sample list in one change.

Find every gate change later with `git log --format='%h %s%n%(trailers:key=Gate-Change)' --grep='^Gate-Change:'`.

## Claude Code hooks: after every edit, before stopping

- **PostToolUse `Edit|Write`** runs `packages/tooling/src/hooks/after-edit.ts`. It formats the edited file with Prettier, runs `eslint --fix --max-warnings 0` on it, and on failure prints the problems to stderr and exits 2, so Claude sees them next to the tool result. Files outside the repo and non-code files are skipped. About 5 s per edit.
- **Stop** runs `npm run -s check:fast` with stdout sent to stderr; on failure it exits 2, which keeps Claude working and feeds the errors back.
- **Only exit code 2 with stderr reaches Claude.** Exit 1 is a non-blocking error Claude never sees.
- **Claude Code allows 8 consecutive Stop-hook continuations.** If the cap ends the turn with checks still failing, report the failing gate to the owner instead of trying to get around it.
- **Hooks change nothing silently beyond formatting.** After the edit hook reformats a file, read it again before the next edit of that file.
- **Start Claude Code at the repository root.** Hooks and permissions load only from the `.claude/settings.json` of the folder the session starts in; there is no parent-folder fallback.

## Permissions: deny and ask

- `permissions.deny` stops Claude's file tools and recognised shell commands from reading App Store Connect keys and signing files, and blocks the common hook-bypass commands (`git commit ... --no-verify`, `git commit -n`, `git push ... --no-verify`; `*` in a Bash rule matches anywhere). Deny rules do not cover arbitrary subprocesses, so the rule "never open or print the key" still applies to scripts.
- `permissions.ask` makes every edit to a gate file prompt the owner in real time: `eslint.config.mjs`, `quality-gates.json`, `lefthook.yml`, `knip.json`, `.prettierrc.json`, `.npmrc`, `jest.config.js`, `jest.sim.config.js`, `stryker.config.json`, the `tsconfig*.json` files at the root and under `apps/` and `packages/`, `.claude/settings.json`. The tsconfig rules are anchored (`Edit(/tsconfig*.json)`, `Edit(/apps/**/tsconfig*.json)`, `Edit(/packages/**/tsconfig*.json)`; in project settings a leading `/` is the project folder): an unanchored `Edit(**/tsconfig*.json)` also prompted for every tsconfig template inside `skills/`. In a non-interactive run the prompt cannot be answered and the edit is refused, which is the intended "stop and ask".

## Merging `.claude/settings.json`

`.claude/settings.json` may already hold keys the gates do not own. Merge, never replace:

- Keep the Expo template's `enabledPlugins` entry (the owner decides whether to keep the Expo plugin; if kept, the agent instructions forbid EAS and over-the-air updates).
- Keep the skill library's entries (`skillListingBudgetFraction`, the `permissions.allow` rules that let skill scripts run without prompts). The template carries them too (it is the same file the monorepo-bootstrap skill writes), so a repo without them gets them from the merge.
- Add every `deny` and `ask` rule and both hooks from the template.
- The guardrail compares objects as subsets and arrays by position, so the `deny` and `ask` lists and the hook arrays must match the template exactly; extra top-level keys and an `allow` list are fine.
- Editing `.claude/settings.json` itself triggers the owner's approval prompt (it is in `ask`): that is the owner's human step for new hooks and permissions.

## How the hooks find the repo root

The hook commands locate the repository with `git rev-parse --show-toplevel`, and `after-edit.ts` resolves the root from its own location (`packages/tooling/src/hooks/` is four levels below it). That keeps both hooks correct when Claude's shell has moved into a subfolder such as `apps/line-siege`, and needs nothing from the environment. The repo must be a git repository, which it always is (`check:fast` and the hooks need git anyway).

## Verified behaviour

Checked on 2026-09-28 in a copy of the platform's conventions workspace (lefthook 2.1.14, ESLint 9.39.5, TypeScript 6.0.3, Jest 29.7 + jest-expo 57.0.5, knip 6.38.0), with this skill's templates installed:

- The guardrail passed on the templates (ESLint probes, every tsconfig, Jest thresholds, npm scripts, `.claude/settings.json`, `knip.json`, `lefthook dump`, `.npmrc`), and reported `max-params[1]: expected 3, got 5` for both logic probes after `max-params` was raised in `eslint.config.mjs`.
- The PostToolUse command, run from `apps/line-siege/` and `packages/shell/`, exited 0 on a clean file and 2 on a file using `Math.random`, naming the file by its repo path.
- The Stop command, run from `apps/line-siege/`, exited 0 on the clean tree (about 12 s) and 2 after a `Math.random` was added.
- `lefthook validate` printed "All good"; a real commit staging gate files was refused until a `Gate-Change:` trailer was added, then accepted with every pre-commit job green.
