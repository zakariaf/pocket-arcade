# The guardrail: quality-gates.json

The most likely failure of an unsupervised agent is quietly relaxing a threshold to get green. The guardrail makes that impossible to do silently: `node packages/tooling/src/quality/check-quality-gates.ts` (step 6 of `verify`) compares what the tools actually resolve with a checked-in expectation, `quality-gates.json`.

## Contents

- What the guardrail compares
- What quality-gates.json holds
- The gated paths
- Changing a gate (the only way)
- Adding a package or an app
- This skill's static check

## What the guardrail compares

- `eslint --print-config <probe>` for four probe paths (a game-kit file, a rules file, a component, a test; the files need not exist) against named rule sets (`logic`, `component`, `test`) and the linter options.
- `tsc -p <project> --showConfig` for every tsconfig against the shared strict options plus the per-project `types` and `lib`. A key may be a glob (`apps/*/tsconfig.json` covers every app); a key that matches nothing is an error.
- `jest --showConfig` -> `coverageThreshold`. A per-folder key may be absent only while that folder has no source files, because Jest fails on threshold keys that match nothing.
- The gate scripts in `package.json`, the `permissions` and `hooks` of `.claude/settings.json`, the `rules` and workspace settings of `knip.json`, the three hooks of `lefthook dump --format json`, and the `min-release-age=7`, `engine-strict=true` and `save-exact=true` lines of `.npmrc`.

Objects are compared as subsets (tools add defaults), arrays by position, values exactly. A mismatch prints the path and both values and exits 1, with the reminder "Restore the gate; never edit the JSON to match." The pure comparison lives in `gate-diff.ts` and has its own tests.

## What quality-gates.json holds

| Section | Holds |
|---|---|
| `eslint.linterOptions` | `noInlineConfig: true`, `reportUnusedDisableDirectives: 2`, `reportUnusedInlineConfigs: 2` |
| `eslint.ruleSets.logic` | limits (250 lines per file, 40 per function, complexity 10 modified, cognitive 15, depth 3, 3 parameters, 3 nested callbacks, 1 class per file), no floating promises, strict booleans, no `any`, ts-comment descriptions, no default export, the banned `Math.random` / `Date.now` / `performance.now` / `I18nManager.isRTL` |
| `eslint.ruleSets.component` | 80 lines per component, JSX depth 5, one component per file, no JSX string literals, no inline styles or colour literals, exhaustive deps |
| `eslint.ruleSets.test` | 400 lines per test file, 4 nested callbacks, expect-expect, no identical titles, no focused or disabled tests, third-person-verb titles |
| `eslint.probes` | the four probe paths and their rule set |
| `typescript.shared` / `projects` | the strict compiler options and each project's `types` / `lib` |
| `jest.coverageThreshold` | global 90/90/90/85; `packages/game-kit/src/`, `packages/shell/src/services/save/`, `apps/*/src/rules/**/*.ts` 95/95/95/90 |
| `npmScripts` | the exact gate scripts |
| `claudeSettings` | the deny and ask rules and both hooks |
| `knip`, `lefthook`, `npmrcLines` | the knip rules, the three git hooks, the three `.npmrc` policy lines |
| `perf`, `a11y` | the performance budgets and accessibility minimums; tests read them from this file, so they are protected by its `Gate-Change:` rule rather than by a comparison |
| `gatedPaths` | the files whose change needs a `Gate-Change:` trailer |

## The gated paths

A commit that stages any of these needs a `Gate-Change: <reason>` trailer (the commit-msg hook enforces it), and the edit prompts the owner for the config files:

`quality-gates.json`, `eslint.config.mjs`, `tsconfig.base.json`, `tsconfig.json`, `**/tsconfig.json`, `jest.config.js`, `jest.sim.config.js`, `stryker.config.json`, `knip.json`, `lefthook.yml`, `.prettierrc.json`, `.prettierignore`, `.npmrc`, `.claude/settings.json`, `packages/tooling/network-audit/**` (network baselines), `packages/tooling/license-exceptions.json`, `packages/tooling/scripts/install-maestro.sh` (checksum pin), `babel.config.js`, `jest.setup.ts`, `tsconfig.stryker.json`, `test/goldens/boards/skia-golden.ts` (holds the pixel tolerance), `**/__snapshots__/*.golden.test.ts.snap`, `**/*.golden.test.ts.snap.ios` (data goldens), `**/__image_snapshots__/**` (pixel goldens), `apps/*/e2e/baselines/**` (screenshot baselines), `**/fixtures/save-v*.json` (frozen save fixtures), `parity/waivers.json` (the visual-parity waivers: each one changes what the parity gate accepts) and `parity/game-facts.json` (the game facts that choose a frame's reference variant, such as no music or a score-rated win line), plus the verify runner files `packages/tooling/src/quality/verify-plan.ts`, `run-verify.ts`, `shell-slice.ts` and `device-only.ts`.

A commit that adds, removes or changes a parity waiver therefore carries `Gate-Change: <which frames, which class, why>`, and the owner report names the waivers; `git log --grep Gate-Change` then finds every waiver change. The same holds for `parity/game-facts.json`, because a wrong fact silently picks another reference.

The skill library (`skills/`) and Claude Code's folder (`.claude/`) are knowledge, not gates. The commit-msg hook (`isGatedFile` in `packages/tooling/src/git/commit-message-rules.ts`) never lets a pattern that starts with a wildcard reach into them: a skill's `templates/tsconfig.json`, a fixture's `__image_snapshots__/` or a linked skill under `.claude/skills/` needs no trailer. A pattern that starts with the folder itself still gates it, so `.claude/settings.json` stays gated. For the same reason the tsconfig `ask` rules are anchored at the repo root. `check-gate-wiring.mjs` reports either leak as `gate-scope`.

## Changing a gate (the only way)

1. A gate looks wrong (a false positive, a rule that contradicts the spec, a tool bug). Stop that line of work.
2. Send the owner one short note: the gate, the file and line, the exact message, why it looks wrong, and the smallest proposed change (`templates/gate-question.md`). Continue with other work if possible.
3. Only after the owner agrees: change the gate and `quality-gates.json` together, in one commit, with `Gate-Change: <reason>`. The `ask` permission prompt appears for the config files; that prompt is the owner's approval.
4. Run the guardrail and this skill's `check-gate-wiring.mjs`. A tightened value passes the wiring check; a loosened one keeps failing it until this skill's baseline is updated with the owner's agreement.

Never edit `quality-gates.json` to match a weakened config, never add `eslint-disable` or `@ts-ignore`, never lower a threshold, never widen an exemption glob.

## Adding a package or an app

- A new app under `apps/` is covered automatically: the ESLint globs and the `apps/*/tsconfig.json` key match it, and its folder becomes a valid commit scope.
- A new package under `packages/` needs its `tsconfig.json` under `typescript.projects` and a knip workspace entry, in the same commit, with a `Gate-Change:` trailer.

## This skill's static check

`scripts/check-gate-wiring.mjs` runs without any installed tool (useful before `npm ci`, in review, and in this skill's self-test). It compares the repo's `quality-gates.json` with this skill's baseline in the direction that matters: coverage minimums and accessibility minimums may only rise, limits and budgets may only fall, lists (gated paths, deny and ask rules, secret globs) may only grow, and everything else must be equal. It also checks the npm scripts, the hooks, the `.npmrc` lines, the ESLint linter options, the Jest thresholds and the tooling files the gates run. The guardrail is still the authority on what the tools resolve.
