---
name: quality-gates
description: Sets up and repairs Pocket Arcade's quality gates - npm scripts, check:fast, verify, lefthook, Claude Code hooks, the guardrail - without weakening them. Use when a gate, hook or verify fails or a gate file changes. Not for one tsc or lint error (typescript-and-lint-rules) or tests (tdd-workflow).
---

# Quality gates

No person reviews the code, so the gates are the reviewer: a hook after every edit, `check:fast` before Claude stops, lefthook on every commit and push, `npm run verify` with a guardrail that compares every resolved config with `quality-gates.json`. This skill installs those gates from real, tested templates, explains each one, fixes failures the right way, and proves with two scripts that nothing is missing, weakened or bypassed.

## Rules that must hold

1. **When a gate fails, fix the code, never the gate.** No lowered threshold, raised limit, wider exemption glob, `eslint-disable`, `@ts-ignore`, `.skip`, `jest.retryTimes`, istanbul or Stryker ignore comment. The most likely failure of an unsupervised agent is quietly relaxing a check to get green.
2. **Never bypass a hook:** no `--no-verify`, `git commit -n`, `LEFTHOOK=0`, `core.hooksPath` tricks, or `skip:` in `lefthook.yml`. The hooks are the only reviewer; the pre-push `verify` reruns everything anyway.
3. **A gate changes only with the owner's agreement**, in one commit that changes the gate and `quality-gates.json` together, with a `Gate-Change: <reason>` trailer. If a gate looks wrong, stop and send the note in `templates/gate-question.md`.
4. **Use the canonical npm scripts byte for byte** (`templates/package-scripts.json`). The guardrail compares them exactly; an ad-hoc variant in a hook or CI would bypass it.
5. **Run `npm run -s check:fast` before saying any change is done, and `npm run verify` before every push** (the pre-push hook runs it).
6. **Hooks that must reach Claude exit 2 and write to stderr.** Exit 1 is a non-blocking error Claude never sees.
7. **Start Claude Code at the repository root, and merge `.claude/settings.json`, never replace it.** Hooks and permissions load only from the session's start folder; other keys (the Expo plugin, the skill permissions, the listing budget) stay.
8. **Pin every dependency exactly, respect the 7-day release-age cooldown, approve install scripts after reading them, ship only allowed licences.** Exceptions live only in a dated `.npmrc` block or `license-exceptions.json`, each agreed with the owner.
9. **When a size or complexity limit trips, split by responsibility,** never by line count and never by compressing code or moving logic into JSON.
10. **A partial Shell relaxes exactly two verify steps, and a slice never ships.** While `shell-slice.json` exists, the verify runner runs knip without its export and type kinds and skips `test:sim` while no game has sims, each with a `SKIP` line; every other step stays strict, and the release checks fail while the file exists. Writing the file to get green is a bypass.
11. **`SKIP` lines and `NOT APPLICABLE` count as a pass; exit 2 never does.** A checker prints `SKIP` for a rule a repo fact puts out of reach (a screen outside `shell-slice.json`, or a rule not yet due: `due at Shell step <n>: <file> not yet created` until a later build step creates its target) and `NOT APPLICABLE: <fact>` when the whole check cannot apply, both before `RESULT: PASS`. Exit 2 means nothing to check or a bad command: fix the command, never read it as not applicable.

## Workflow

1. **Know the gates.** Read [references/gates-overview.md](references/gates-overview.md): what runs when, every npm script, and the order of `verify`.
2. **Install or repair them** (a new repo, or `check-gate-wiring.mjs` reports a missing or changed gate file). Copy from this skill, then read [references/hooks-and-settings.md](references/hooks-and-settings.md):

   | Template | Goes to |
   |---|---|
   | `templates/package-scripts.json` | the `scripts` of the root `package.json` (merge, keep other keys) |
   | `templates/lefthook.yml` | `lefthook.yml` |
   | `templates/claude-settings.json` | `.claude/settings.json` (merge: keep existing keys; the edit asks the owner) |
   | `templates/quality-gates.json` | `quality-gates.json`, with `__GAME_ID__` (the pilot's gate probe) replaced by the pilot app id |
   | `templates/knip.json` | `knip.json` |
   | `templates/gitignore` | `.gitignore` (merge) |
   | `templates/npmrc` | the policy lines of `.npmrc` (the dependency skill owns the rest) |
   | `templates/packages/tooling/src/...` | the same path in the repo (guardrail, verify runner and its plan, `shell-slice.json` reader, device-only coverage helper, edit hook, commit-message check, dependency check, licence audit, their tests) |
   | `templates/github/verify.yml` | `.github/workflows/verify.yml`, only if the owner wants CI |

   The configs, the settings and the tooling gate scripts are the same bytes the monorepo-bootstrap skill writes (synced from the skill library), so a bootstrapped repo already holds them. Then `npx lefthook install` and `npx lefthook validate` (prints `All good`). The tools (`lefthook`, `knip`, `prettier`, `eslint`, `typescript`, `jest`) are root devDependencies installed by the dependency skill.
3. **Prove the wiring:** run the guardrail `node packages/tooling/src/quality/check-quality-gates.ts` (prints `all resolved configs match quality-gates.json`), then the wiring check with the repo root as its first argument (never `--root`). `node ${CLAUDE_SKILL_DIR}/scripts/check-gate-wiring.mjs .` checks every canonical script's target (rule `script-target`). On a fresh skeleton seven targets come from later Shell steps, so it passes with one not-yet-due SKIP line each, `SKIP package.json [script-target] npm run <script>: due at Shell step <n>: <file> not yet created (<skill> copies it)`: `i18n:verify` (step 6), `audit:network`, `audit:privacy` and `build:ios:sim` (step 8), `e2e:ios` and `screenshots:ios` (step 10) and `release:ios` (step 11, when ios-release-testflight's templates are copied). Each line disappears at its step; a missing target of a step-1 script (`verify`, `audit:licenses`, `new-game`) is a problem at once. `--pending <path>` is still accepted (it turns that SKIP line into a note) but is no longer needed. On a fresh repo the bootstrap skill's own `check-monorepo.mjs .` runs in the same step (build step 1 of `pocket-arcade-index`). The step ends with `npm run -s check:fast` green.
4. **When a gate fails**, read [references/fixing-failures.md](references/fixing-failures.md): the fix for each failure, the limits table and how to split code, the never list. Fix, rerun the script, rerun `npm run -s check:fast`. When `npm run verify` is red, first look up the current build step in [references/gates-overview.md](references/gates-overview.md) ("When verify is green"): a step listed there as expected red before a later build step is not a failure yet; anything else is. Each entry of `knip.json` and the coverage policy of `jest.config.js` is explained in [references/root-files.md](references/root-files.md).
5. **When a gate itself looks wrong**, follow [references/guardrail.md](references/guardrail.md), "Changing a gate": stop, send [templates/gate-question.md](templates/gate-question.md) to the owner, change nothing until they agree.
6. **For a dependency, install-script, licence or knip failure**, read [references/supply-chain.md](references/supply-chain.md).
7. **Before calling the work done**, run `npm run -s check:fast`, then both checkers from the repo root: `node ${CLAUDE_SKILL_DIR}/scripts/check-gate-wiring.mjs .` and `node ${CLAUDE_SKILL_DIR}/scripts/check-bypasses.mjs .`. Fix every `FAIL` line and rerun until both print `RESULT: PASS`. Before a push, `npm run verify` must be green.

## Definition of done

- [ ] `npm run -s check:fast` is green; before any push `npm run verify` is green.
- [ ] The guardrail prints `all resolved configs match quality-gates.json`, and `npx lefthook validate` prints `All good`.
- [ ] No gate file changed without the owner's agreement and a `Gate-Change:` trailer; no hook was bypassed.
- [ ] `.claude/settings.json` still holds its other keys plus every deny and ask rule and both hooks.
- [ ] `npm run verify` shows only the red steps that the "When verify is green" table expects at this build step, and no `SKIP` line once `shell-slice.json` is gone.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-gate-wiring.mjs .` (with a `script-target` SKIP line only for a script whose Shell step has not come yet) and `node ${CLAUDE_SKILL_DIR}/scripts/check-bypasses.mjs .` print `RESULT: PASS`

## Anti-patterns

- **Editing `quality-gates.json` to match a weakened config.** The guardrail then passes and the gate is gone. Restore the config.
- **`// eslint-disable-next-line` "just this once".** It is inert here (`noInlineConfig`) and reported; fix the code or ask for a named, agreed exception block.
- **Retrying a failing commit with `--no-verify`.** Denied by the permissions and found by `check-bypasses.mjs`; read the hook's output instead.
- **Replacing `.claude/settings.json` with the template.** That drops the skill permissions and the Expo plugin entry; merge instead.
- **Splitting a 300-line file into `part-1.ts` and `part-2.ts`.** Split by responsibility, each part with its own test.
- **Adding `--passWithNoTests` or `-u` to a script to get green.** A test command that finds no tests must fail; goldens change only by hand with a trailer. Before the first game has sims, `test:sim` is expected red (or a `SKIP` line while `shell-slice.json` exists).
- **Writing `shell-slice.json` to silence knip or test:sim.** It is only for a repo that really lacks Shell screens, lists exactly the screens built, and must be gone before a release.
- **Guessing `--root .` for a checker.** Every checker takes the repo root as its first positional argument; the exit 2 it prints is not a result.
- **Extending an expired release-age block.** Delete it; the lockfile keeps the installed versions.
- **Looping on the Stop hook.** After its 8 continuations, report the failing gate to the owner instead of working around it.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/gates-overview.md](references/gates-overview.md) | The gate stack, every canonical npm script, the verify pipeline with timings, check:fast, what is outside verify | Workflow step 1, and when a script's purpose is unclear |
| [references/hooks-and-settings.md](references/hooks-and-settings.md) | lefthook jobs, the commit-msg check, the Claude Code hooks and permissions, merging settings, repo-root resolution, what was verified | Workflow step 2, and when a hook misbehaves |
| [references/guardrail.md](references/guardrail.md) | What the guardrail compares, what `quality-gates.json` holds, the gated paths, how a gate may change, new packages | Workflow step 5, and before touching any gate file |
| [references/fixing-failures.md](references/fixing-failures.md) | Fix by failure, the limits table, how to split code, the never list, the gate-looks-wrong note | Workflow step 4, whenever a gate fails |
| [references/supply-chain.md](references/supply-chain.md) | Exact pins, the release-age cooldown and dated exceptions, install scripts, licences, lockstep, knip, optional CI | Workflow step 6 |
| [references/root-files.md](references/root-files.md) | The root gate files entry by entry: why each `knip.json` ignore exists, the verify runner and `shell-slice.json`, the device-only coverage policy of `jest.config.js`, the one commit-message rule set | Workflow step 4, and before changing a root gate file |
| `templates/package-scripts.json` | The canonical root npm scripts (synced from the library; do not edit here) | Workflow step 2 |
| `templates/lefthook.yml` | pre-commit, commit-msg and pre-push hooks (synced from the library) | Workflow step 2 |
| `templates/claude-settings.json` | Deny and ask rules, the PostToolUse and Stop hooks, the skill-script allow rules and listing budget (synced from the library) | Workflow step 2 (merge) |
| `templates/quality-gates.json` | The guardrail's expectations, the budgets and the gated paths; also the baseline `check-gate-wiring.mjs` compares with, reading `__GAME_ID__` as the repo's pilot (synced from the library) | Workflow step 2 |
| `templates/knip.json` | The knip configuration: `skills/**` ignored, the macOS tools in `ignoreBinaries`, the root mocks' libraries and `@formatjs/cli` in `ignoreDependencies` (synced from the library; reasons in `references/root-files.md`) | Workflow step 2 |
| `templates/gitignore` | The root `.gitignore` (copy as `.gitignore`; synced from the library) | Workflow step 2 |
| `templates/npmrc` | The three `.npmrc` policy lines and the dated-exception format | Workflow step 2 |
| `templates/github/verify.yml` | Optional GitHub Actions workflow | Only when the owner wants CI |
| `templates/packages/` | The tooling gate files, tested with tsc, ESLint, Prettier and Jest: guardrail and `gate-diff`, `after-edit` hook, commit-message check and rules (`isGatedFile` keeps wildcard gates out of `skills/` and `.claude/`), the dependency check, lockstep, banned list, release-age check, system clock, licence policy and audit; every file is synced from the library (do not edit here) | Workflow step 2 |
| [templates/gate-question.md](templates/gate-question.md) | The one-message note to the owner when a gate looks wrong | Workflow step 5 |
| `scripts/check-gate-wiring.mjs` | Checks gate files, scripts, hooks, settings, `.npmrc`, linter options and thresholds, that `quality-gates.json` is no weaker than the baseline, that the verify runner, slice reader and coverage helper are canonical, that knip's ignore lists hold only the documented entries (`knip-ignores`), and that no gate reaches into `skills/` or `.claude/` (`gate-scope`) | Workflow steps 3 and 7 |
| `scripts/check-bypasses.mjs` | Finds suppressions, ignore comments, hook bypasses, auto-updated snapshots, relaxed ESLint flags and stale release-age exceptions | Workflow step 7 and the definition of done |
| `scripts/lib/not-weaker.mjs` | The direction-aware comparison used by the wiring check | Never by hand |
| `scripts/selftest.mjs` | Proves both checkers pass good fixtures and catch each planted bug | After changing a checker or a template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad repos for the self-test | When adding a rule to a checker |

## Related skills

- `monorepo-bootstrap` - creates the empty repo and its other config files.
- `typescript-and-lint-rules` - the full `eslint.config.mjs` and tsconfig files the guardrail probes.
- `dependency-management` - adding, upgrading and approving packages; owns the rest of `.npmrc`.
- `tdd-workflow` - the test-first loop that `check:fast` closes.
- `git-commits-and-reporting` - commit messages, the `Gate-Change:` trailer and asking the owner.
- `privacy-and-network-audit` and `i18n-strings-and-catalogs` - build `audit:network` and `i18n:verify`.
