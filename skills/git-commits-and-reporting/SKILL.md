---
name: git-commits-and-reporting
description: Writes Pocket Arcade commit messages, Gate-Change and Spec-Change trailers, per-app release tags, plain-English evidence reports and stop-and-ask messages to the owner. Use when committing, tagging, reporting a slice or release, or blocked on the owner. Not for running gates (use quality-gates).
---

# Git commits and reporting

Every change reaches the owner twice: as a commit history they can search, and as a short plain-English message they actually read. This skill makes both exact: Conventional Commits with the right trailers, per-app tags, an evidence report built from the files in `reports/`, and one clear question when something needs a person. Three scripts check the messages, the tags and the reports before anything is committed or sent.

## Rules that must hold

1. **Headers are Conventional Commits: `<type>(<scope>): <subject>`**, at most 72 characters, imperative, lowercase start, no trailing period. Scope is a folder under `apps/` or `packages/` (`line-siege`, `shell`, `game-kit`, `tooling`) or `repo`, `deps`, `docs`, `ci`, `skills`. The owner and later sessions search the history by scope, and the `commit-msg` hook rejects anything else.
2. **One behaviour per commit, its tests and code together**, with a body that says why and, for a `feat` or a `fix` outside `tooling`, `repo`, `deps`, `docs`, `ci` and `skills`, names the spec lines it serves (`Spec S9 and 8.3: ...`, `N3`, `D4`). The history is the proof that each behaviour was built test-first.
3. **Trailers sit in the last paragraph.** `Gate-Change: <reason>` exactly when a staged file matches `gatedPaths` (gate configs, goldens, baselines, save fixtures, `parity/waivers.json` and `parity/game-facts.json`, `.npmrc`, `.claude/settings.json`): a gate config changes only after the owner agreed; a golden, baseline or fixture only on purpose, with the reason. `Spec-Change: spec <section> <what changed>` only when a test expectation changed because the spec changed, never for "the test was wrong". Keep any `Co-Authored-By:` line the session asks for. Git reads trailers only there, and the owner lists gate changes by them.
4. **Never bypass or rewrite:** no `--no-verify`, no `LEFTHOOK=0`, no amend or rebase of pushed commits. A failing hook means the commit is not ready.
5. **Nothing leaves this Mac without the owner's word in this session:** no push, no tag push, no upload, no App Store Connect change, no "submit for review" until the owner says "submit". These cannot be undone.
6. **Tags and release commits come only from `npm run release:ios`:** `chore(<game-id>): build <n>`, then `<game-id>/vX.Y.Z+<build>` after each upload and `<game-id>/vX.Y.Z` when the owner says "ship". Never move, delete or reuse a tag; build numbers only go up.
7. **Every finished slice and release ends with the evidence report:** outcome first in players' words, spec names (Home, S4), numbers copied from `reports/` files with the file named, at most one request with its default, at most five things to look at, an honest "not verified" list, technical detail last. Intended changes the owner could miss get their own block: design references changed on purpose (frames and the `referenceChanges` id), parity waivers changed (class and the Gate-Change commit) and texts changed in all four languages (fa and ckb awaiting native review). The owner never reads code or logs; this message is the review.
8. **Stop and ask in the listed situations** (`references/stop-and-ask.md`): one message, one request answerable in a word, the human-step ID, the default that applies meanwhile; then keep working on anything else. Release stops (signing, agreement, 401/403, INVALID) are never retried.
9. **Never read, print, copy or commit the App Store Connect `.p8` key, a JWT or a password.** If a task seems to need one, ask.

## Workflow

1. **Stage exactly one slice.** `git status` and `git diff --cached --stat`: one behaviour, its tests and code, and any docs it changes. Split unrelated changes into their own commits. Read [references/commit-format.md](references/commit-format.md) before the first commit of a session.
2. **Write the message into a file** from [templates/commit-message.txt](templates/commit-message.txt), for example `reports/commit-message.txt` (`reports/` is gitignored). Replace every `__PLACEHOLDER__`; delete the trailer lines that do not apply. [examples/commit-messages.md](examples/commit-messages.md) shows good and bad messages.
3. **Check it against the staged files:** `node ${CLAUDE_SKILL_DIR}/scripts/check-commits.mjs . --message reports/commit-message.txt --staged`. Fix every `FAIL` line and rerun until `RESULT: PASS`, then `git commit -F reports/commit-message.txt`. The `commit-msg` hook runs the same rules with the same ids (`packages/tooling/src/git/commit-message-rules.ts`), so a message this script passes is never rejected there, and one the hook accepts never fails here later.
4. **Check the session's history** before reporting: `node ${CLAUDE_SKILL_DIR}/scripts/check-commits.mjs . --range <base>..HEAD` (`<base>` = `git rev-parse --short HEAD` noted at the start of the session; `--range HEAD` checks the whole history). A bad unpushed commit may be reworded with `git commit --amend` (last commit) before anything is pushed; a pushed one stays and the report says so.
5. **Write the evidence report.** Read [references/owner-updates.md](references/owner-updates.md). Copy [templates/evidence-slice.md](templates/evidence-slice.md) (a slice) or [templates/evidence-release.md](templates/evidence-release.md) (a release) to `reports/evidence-<YYYY-MM-DD>-<slug>.md`, fill it only from the files in `reports/` and the Jest summary (a changed screen also gets the "Design match" line against its Toybox design screenshot, see the reference), and compare with [examples/slice-evidence.md](examples/slice-evidence.md) or [examples/release-evidence.md](examples/release-evidence.md). When the work changed a committed design reference, a parity waiver or a player-visible text, paste the matching blocks of [templates/report-changes.md](templates/report-changes.md) above "Not tested or not verified" ([examples/reference-and-copy-changes.md](examples/reference-and-copy-changes.md) shows all three).
6. **Check the report:** `node ${CLAUDE_SKILL_DIR}/scripts/check-report.mjs reports/evidence-<...>.md`. Fix and rerun until `RESULT: PASS`, then put the report in the final message (the red run and commands stay under "Details").
7. **When something needs the owner**, read [references/stop-and-ask.md](references/stop-and-ask.md), fill [templates/owner-request.md](templates/owner-request.md) (human step or spec question) or [templates/release-stop.md](templates/release-stop.md) (a release stopped), check it with `check-report.mjs <file> --kind request` ([examples/owner-requests.md](examples/owner-requests.md) has one of each), send it, and continue with work that does not depend on the answer.
8. **After a release upload or a "ship"**, read [references/tags-and-releases.md](references/tags-and-releases.md) and run `node ${CLAUDE_SKILL_DIR}/scripts/check-tags.mjs .`. Push tags only when the owner has said so in this session.
9. **At the end of every session:** the Stop hook runs `npm run -s check:fast`; commit the finished slices (steps 1-4), write the report (steps 5-6). If the Stop hook still fails after its 8 continuations, report the failing gate and what was tried instead of working around it.

## Definition of done

- [ ] Each new commit holds one behaviour with its tests; its body says why and names the spec lines of a `feat` or `fix`.
- [ ] `Gate-Change:` appears exactly on commits that touch a gated path (gate configs agreed with the owner, goldens and baselines changed on purpose); `Spec-Change:` only where the spec changed.
- [ ] No hook was bypassed; nothing was pushed, tagged, uploaded or submitted without the owner's word in this session.
- [ ] The evidence report takes every number from a named `reports/` file, lists what was not verified, names every intended design-reference change (with its `referenceChanges` id), waiver change (with its Gate-Change commit) and text change (four languages, fa and ckb awaiting native review), and passes `check-report.mjs`.
- [ ] Every owner request carries one action, its step ID when there is one, and a default; tags (after a release) pass `check-tags.mjs`.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-commits.mjs . --range <base>..HEAD` and `node ${CLAUDE_SKILL_DIR}/scripts/check-report.mjs reports/<report>.md` print `RESULT: PASS`

## Anti-patterns

- **`fix: stuff` or `Updated files.`** The history becomes unsearchable; write what changes for the player or the code, with a scope.
- **One commit for "stars, packs and unlocks".** Three behaviours, three commits; otherwise nobody can see that each was test-first.
- **`Gate-Change: update` on a commit that also relaxed a lint rule.** Gate changes need the owner's agreement first and a reason that says why.
- **`Spec-Change: the test was wrong`.** That is editing a test to pass; fix the code or ask the owner.
- **"All tests green, coverage great!"** Numbers come from `reports/` with the file named: "Tests: 214/214 pass (unit 192, golden 22), random seed 48213".
- **Five questions in one message.** Ask the most blocking one with its default; the rest can wait for the next message.
- **Retrying `release:ios` after `errSecInternalComponent` or a 401.** It needs a person or a credential; retries can lock the account or burn build numbers.
- **Pushing "because the work is done".** Pushing is outward-facing until the owner says otherwise.
- **Tagging by hand, or reusing `line-siege/v1.0.0` for a rebuilt binary.** A new build gets a new build number and a new upload tag.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/commit-format.md](references/commit-format.md) | Header, types, scopes, body, trailers, slices, good and bad headers | Workflow step 1, first commit of a session |
| [references/owner-updates.md](references/owner-updates.md) | The seven reporting rules, the evidence message shape, slice and release form, where each number comes from, honest limits, plain words | Workflow step 5 |
| [references/stop-and-ask.md](references/stop-and-ask.md) | When to stop, every human-step ID (O, G, P, R, A), release stops, how to write the message | Workflow step 7, and whenever a step needs a person |
| [references/tags-and-releases.md](references/tags-and-releases.md) | Upload and release tags, version and build numbers, release commits, pushing | Workflow step 8 |
| [templates/commit-message.txt](templates/commit-message.txt) | Commit message with placeholders and hints (comment lines are dropped) | Workflow step 2 |
| [templates/evidence-slice.md](templates/evidence-slice.md) | Evidence report, slice form | Workflow step 5 |
| [templates/evidence-release.md](templates/evidence-release.md) | Evidence report, release form | Workflow step 5 |
| [templates/report-changes.md](templates/report-changes.md) | The three optional report blocks: design references changed on purpose, parity waivers changed, texts changed in all four languages | Workflow step 5, when the work changed a reference, a waiver or a text |
| [templates/owner-request.md](templates/owner-request.md) | One request: a human step or a spec question with options | Workflow step 7 |
| [templates/release-stop.md](templates/release-stop.md) | The message when a release step stops | Workflow step 7 |
| [examples/commit-messages.md](examples/commit-messages.md) | Good messages and bad ones with the rule each breaks | Workflow step 2 |
| [examples/slice-evidence.md](examples/slice-evidence.md) | A complete slice report | Workflow step 5 |
| [examples/release-evidence.md](examples/release-evidence.md) | A complete release report | Workflow step 5 for a release |
| [examples/reference-and-copy-changes.md](examples/reference-and-copy-changes.md) | A complete report with all three change blocks (the Line Siege no-music, score-line, Persian-digit, version-gap and march-text changes) | Workflow step 5, with the change blocks |
| [examples/owner-requests.md](examples/owner-requests.md) | A human-step request, a spec question and a release stop | Workflow step 7 |
| `scripts/check-commits.mjs` | Checks a planned message (`--message`, with `--staged` or `--files`) or history (`--range`, `--log`): header, scope, mood, body, spec lines, trailers, gated paths, leftover placeholders; the same rules and ids as the repo's `commit-msg` hook. `--samples <list>` proves both still agree on the shared sample list | Workflow steps 3-4 and the definition of done |
| `scripts/check-report.mjs` | Checks an evidence report (`--kind slice` or `release`) or a request (`--kind request`) | Workflow steps 6-7 and the definition of done |
| `scripts/check-tags.mjs` | Checks tag names, game ids, an upload tag behind every release tag, build-number order across versions and in tag-date order (the repo's tags or `--list <file>`) | Workflow step 8 |
| `scripts/selftest.mjs` | Proves all three checkers pass good fixtures and catch each planted bug, and that `check-commits.mjs` gives every sample of the shared commit-message list (the one the hook's own test runs) exactly its rule ids | After changing a checker, a template or an example |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in: `check-lib.mjs` and the shared commit-message sample list (into `tests/fixtures/check-commits-samples/good/`) | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs; the commit logs are real `git log` output from throwaway repos; `check-commits-samples/good/` is the synced sample list (do not edit here) | When adding a rule to a checker (add its sample to the shared list too) |

## Related skills

- `quality-gates` - what `check:fast`, `verify` and the `commit-msg` hook run, and which paths are gated.
- `tdd-workflow` - how each slice is built test-first before it is committed.
- `pocket-arcade-product-spec` - the spec IDs that commit bodies, reports and questions quote.
- `ios-release-testflight` - `release:ios`, which makes release commits and tags.
- `golden-tests` - when a golden or baseline may change (and so needs `Gate-Change:`).
