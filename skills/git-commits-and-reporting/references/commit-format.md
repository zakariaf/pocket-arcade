# Commit messages

The format every Pocket Arcade commit follows. The lefthook `commit-msg` hook and `scripts/check-commits.mjs` enforce one rule set with the same rule ids, so the hook never lets through a message the script fails later.

## Contents

- The shape
- The header
- The body
- Trailers
- Slices: what goes into one commit
- Good and bad headers
- The hook and the script: one rule set

## The shape

```text
<type>(<scope>): <subject>

<body: why the change was made, with the spec lines it serves>

<trailers: Gate-Change / Spec-Change / Co-Authored-By, one per line>
```

Example:

```text
feat(line-siege): clear full columns and fire a beam

Spec 13 (Line Siege) and 8.13: a full column clears and damages the
first monster in that column. Examples, a determinism property and a
golden for daily 2026-09-26 cover it.

Gate-Change: new data golden for the daily level of 2026-09-26
```

## The header

| Part | Rule |
|---|---|
| type | `feat` (new behaviour), `fix` (wrong behaviour corrected), `perf`, `refactor` (no behaviour change), `test` (tests only), `docs`, `build` (build tooling, dependencies), `ci`, `chore` (maintenance, release commits), `style` (formatting only), `revert` |
| scope | a folder under `apps/` or `packages/` (`line-siege`, `shell`, `game-kit`, `tooling`), or `repo`, `deps`, `docs`, `ci`, `skills` (the skill library). Optional for the hook but always expected here: every change lives somewhere |
| subject | imperative ("add", "fix", "keep"), lowercase start, no trailing period, says what changes for the player or the code |
| length | the whole header is at most 72 characters |
| `!` | only for a change that breaks saved data or a public contract (rare; migrations normally prevent it) |

Git-generated headers (`Merge ...`, `Revert "..."`, `fixup! ...`, `squash! ...`, `amend! ...`) are accepted as they are; do not rewrite them.

## The body

- One blank line after the header, then the body.
- Say **why** the change was made, not a list of files (git already shows those).
- A `feat` or `fix` names the spec lines it serves (`Spec S9 and 8.3: ...`, `N10: ...`, `D4: ...`); a `fix` also says what was wrong and how the test proves it now. Commits scoped `tooling`, `repo`, `deps`, `docs`, `ci` or `skills` need no spec line (the spec does not cover the build tooling).
- Wrap at about 72 characters.
- The body is where the owner (or a future session) finds the reason for a change; write it for them.

## Trailers

Trailers go in the last paragraph, after a blank line, one per line, `Key: value`. Git reads trailers only there.

| Trailer | When | Rule |
|---|---|---|
| `Gate-Change: <reason>` | a staged file matches `gatedPaths` in `quality-gates.json` (quality gates, configs, goldens, screenshot baselines, save fixtures, network baselines, the parity waivers and game facts `parity/waivers.json` and `parity/game-facts.json`, `.npmrc`, `.claude/settings.json`). A pattern matches the whole repo-relative path (`eslint.config.mjs` is the root file only, `**/tsconfig.json` any depth), and a file under `skills/` or `.claude/` counts only for a pattern that starts with that folder, so a skills-only commit that edits template configs needs no trailer while `.claude/settings.json` stays gated (the hook and `check-commits.mjs` share this rule) | required; the reason says why the gate, golden or baseline had to change; the owner agreed first for a gate change |
| `Spec-Change: <spec section and what changed>` | an existing test's expectation changed because the spec changed | required then; never for "the test was wrong"; names the spec section or ID, except the build order's one directed swap: Shell step 8 replaces the phase-0 `with-shell.ts` and its test with exactly `Spec-Change: with-shell final composer (phase 0 placeholder replaced)` (the hook's and check-commits' `DIRECTED_SWAP_TRAILERS`; any other wording still needs a spec id) |
| `Co-Authored-By: ...` | the session instructions ask for attribution | keep it in the same final trailer block |
| `Release-Variant: test` or `store` | only on the release commit `chore(<game-id>): build <n>` that `npm run release:ios` writes | written by the release script, never by hand |

The owner finds every gate change with:

```sh
git log --format='%h %s%n%(trailers:key=Gate-Change)' --grep='^Gate-Change:'
```

So a `Gate-Change:` trailer on a commit that changed no gated file is wrong too: it pollutes that list.

## Slices: what goes into one commit

- **One behaviour per commit**, its tests and its code together (red and green in the same commit), and any documentation it changes.
- **Never `--no-verify`** (the permissions deny it) and never `LEFTHOOK=0`: a failing hook means the commit is not ready.
- **Never amend or rebase commits that were pushed.** Amending an unpushed commit of this session is fine.
- **Release commits and tags come only from `npm run release:ios`**: `chore(<game-id>): build <n>`.
- **Branches**, only when one is needed: `<type>/<scope>-<slug>`, for example `feat/line-siege-endless-mode`.

## Good and bad headers

| Header | Verdict |
|---|---|
| `feat(line-siege): fire a beam when a column clears` | good |
| `fix(shell): keep the streak when the clock goes back` | good |
| `test(game-kit): cover the one-star band edge` | good |
| `chore(deps): pin react-native-reanimated 4.5.1 in every app` | good |
| `Updated stuff.` | bad: no type or scope, past tense, vague, trailing period |
| `feat(ui): add buttons` | bad: `ui` is not a workspace folder (use `shell`) |
| `feat: add endless mode` | bad: no scope |
| `fix(line-siege): Fixed the tray` | bad: capital letter, past tense |
| `feat(line-siege): add endless mode, daily seeds, the stats card and the new pause menu layout` | bad: over 72 characters and several behaviours |

## The hook and the script: one rule set

The lefthook `commit-msg` hook (`packages/tooling/src/git/check-commit-message.ts` over `commit-message-rules.ts` and `commit-trailer-rules.ts`, installed by the `quality-gates` skill) and `scripts/check-commits.mjs` apply the same 18 rules with the same ids: `header-format`, `header-type`, `scope-missing`, `header-scope`, `header-length`, `subject-case`, `subject-period`, `subject-mood`, `subject-vague`, `blank-line`, `body-missing`, `spec-ref-missing` (a `feat` or `fix` outside `tooling`, `repo`, `deps`, `docs`, `ci`, `skills`), `trailer-placement`, `trailer-empty`, `spec-change-format`, `gate-change-missing`, `gate-change-unneeded` and `placeholder-left`. Both drop comment lines and everything below git's scissors line first, as git does. Git-generated headers (Merge, Revert, fixup!, squash!, amend!) pass.

The two cannot drift: `packages/tooling/src/git/commit-message-samples.json` holds a good message and at least one sample per rule with the exact rule ids it must give. The hook's Jest test runs every sample through `commit-message-rules.ts`, and this skill's self-test runs the same list through `check-commits.mjs --samples`. A new rule is added to both rule sets and the sample list in one change.

The only difference is what each knows about the files: the hook always has the staged files, so it always applies the `Gate-Change:` rules; the script applies them when it knows the files (`--staged`, `--files`, `--range`, `--log`), not for a bare `--message`. Run the script before `git commit -F` (`node ${CLAUDE_SKILL_DIR}/scripts/check-commits.mjs . --message <file> --staged`) and over the session's commits (`node ${CLAUDE_SKILL_DIR}/scripts/check-commits.mjs . --range <base>..HEAD`). Without `quality-gates.json` it uses the platform's default gated paths:

```text
quality-gates.json  eslint.config.mjs  tsconfig.base.json  tsconfig.json  **/tsconfig.json
jest.config.js  jest.sim.config.js  jest.setup.ts  babel.config.js  stryker.config.json
tsconfig.stryker.json  knip.json  lefthook.yml  .prettierrc.json  .prettierignore  .npmrc
.claude/settings.json  packages/tooling/network-audit/**  packages/tooling/license-exceptions.json
packages/tooling/scripts/install-maestro.sh  test/goldens/boards/skia-golden.ts
**/__snapshots__/*.golden.test.ts.snap  **/*.golden.test.ts.snap.ios  **/__image_snapshots__/**
apps/*/e2e/baselines/**  **/fixtures/save-v*.json  parity/waivers.json  parity/game-facts.json
packages/tooling/src/quality/verify-plan.ts
packages/tooling/src/quality/run-verify.ts  packages/tooling/src/quality/shell-slice.ts
packages/tooling/src/quality/device-only.ts
```
