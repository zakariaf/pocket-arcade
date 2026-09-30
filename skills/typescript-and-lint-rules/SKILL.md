---
name: typescript-and-lint-rules
description: Enforces Pocket Arcade's strict TypeScript 6 tsconfigs, ESLint 9 flat config, Prettier and size limits. Use when writing or splitting .ts/.tsx or fixing a tsc or lint error. Not for gate wiring (quality-gates), names (naming-conventions) or import zones (architecture-and-boundaries).
---

# TypeScript and lint rules

Every `.ts`/`.tsx` file in the monorepo compiles under one strict tsconfig set and passes one ESLint config with no warnings, no inline disables and hard size limits. No human reviews this code line by line, so style is enforced by machines or it does not exist. This skill holds the configs, the limits, the forbidden patterns, and two checkers that prove the repo still follows them.

## Rules that must hold

1. **Never silence a gate.** No `eslint-disable`, `@ts-ignore` or `@ts-nocheck`; `@ts-expect-error` only where a third-party type is wrong, with a reason of 10+ characters. Why: the most likely failure of an unsupervised agent is silencing a check, and inline config is switched off anyway.
2. **One strict `tsconfig.base.json` for every workspace.** A workspace `tsconfig.json` sets only `types`, `lib`, `include` and `exclude`. Why: one set of compiler guarantees for all ~26 apps.
3. **Two worlds never mix.** App code (types `jest`, no Node) never imports a Node-world file, not even with `import type`; Node code (tooling, `packages/shell/src/config`, `packages/shell/plugins`, `app.config.ts`) is never bundled into an app. Why: a type-only import pulls the file into the app program, where `process` and `node:fs` do not type-check.
4. **One ESLint config, errors only.** `eslint.config.mjs` at the root is the only config; every rule is an error, lint runs with `--max-warnings 0`, only through the npm scripts. An exception is a files-scoped block that rebuilds the rule from the shared lists, with a reason comment and a `Gate-Change:` trailer. Why: CLI flags and fresh short lists silently weaken the gate (a later flat-config block replaces options, it does not merge).
5. **Stay inside the limits.** 250 code lines per file (400 in tests), 40 per `.ts` function, 80 per `.tsx` component, cyclomatic complexity 10 (`modified`), cognitive 15, nesting 3, 3 parameters (function types too), 3 nested callbacks (4 in tests), JSX depth 5, one component and one class per file. Why: small units are read whole in one read and fail in one place.
6. **When a limit trips, split by responsibility.** Extract named pure functions, a lookup table, an options object or a sub-component with its own test. Never join lines, never `part-2.ts`, never move logic into JSON; large static data does go in `.json`. Why: the limit detects a symptom; gaming it keeps the problem.
7. **Erasable TypeScript only.** No `enum` (use an `as const` array and a union), no `namespace`, no constructor parameter properties, `type` instead of `interface` (except merging in `*.d.ts`), no `any`, no non-null `!` in app code. Why: Node type stripping and `erasableSyntaxOnly`; unions work with exhaustive switches.
8. **Named exports, explicit extensions, no `../`.** `export default` only in `apps/*/app.config.ts`, config plugins and `__mocks__`. Import `./x.ts` within a folder and `@e07/<package>/<path-under-src>.ts` across folders. Why: greppable names; Node type stripping and the `exports` map need extensions.
9. **Expected failures are values.** Return `Result<TValue, TError>` with a `kind` union (or `T | null`); throw `new Error(message, { cause })` only for programmer errors. Every `catch` maps, records through `ErrorLogPort` with a fallback, or rethrows with `cause`; no empty catch. Why: the type system forces callers to handle every case, and the local error log is the only trace.
10. **No floating promises; handlers stay synchronous.** Await, return, or end with `.catch(reportError)`; `void promise` does not count. A `handleX` function or inline `on*` prop is never `async`. Why: React Native's Strict API types `onPress` as returning `unknown`, so an async handler's rejection vanishes.
11. **Immutable data, pure deterministic rules.** `readonly` everywhere, `as const` tables, new objects instead of mutation; rules, levels and game-kit take time and seeds as values and use only integer-safe math. Why: replays, solvers and daily seeds must match on every device.
12. **Prettier formats, pinned versions build.** Prettier 3.9.9 is the only formatter; ESLint 9.39.5, TypeScript 6.0.3 and the plugins stay on the verified pins. A limit, pin or baseline change is an owner decision: stop and ask.
13. **Comments say why.** Line 1 is `// <repo-relative path>`; exported game-kit APIs, ports, stores and hooks get a one-sentence TSDoc contract; no `TODO`/`FIXME`/`HACK`, no commented-out code.

## Workflow

1. Pick the task: set up or change configs (step 2), write code (step 3), fix a `tsc` or lint error (step 4), or add an exception (step 5). Then always finish with step 6.
2. **Configs.** Read [references/tsconfig-set.md](references/tsconfig-set.md) and [references/eslint-config-guide.md](references/eslint-config-guide.md). Copy each template to its destination (table below), install the pinned versions from the guide's install command, then run `node ${CLAUDE_SKILL_DIR}/scripts/check-configs.mjs .`.
3. **Code.** Before writing error handling, async code, a service or a new module, read the matching section of [references/code-policies.md](references/code-policies.md). Imitate [examples/parse-level-param.ts](examples/parse-level-param.ts) (Result), [examples/with-timeout.ts](examples/with-timeout.ts) (timeouts as values) and [examples/buy-button.tsx](examples/buy-button.tsx) (synchronous handler). Keep every unit inside the limits from the start.
4. **Errors.** Find the rule in [references/forbidden-patterns.md](references/forbidden-patterns.md) and write the replacement it names. For a limit, read [references/limits-and-splitting.md](references/limits-and-splitting.md) and follow [examples/splitting-a-long-function.md](examples/splitting-a-long-function.md). Never edit the config to make an error go away.
5. **Exception.** Only for a tool or library contract. Follow "Adding an exception, step by step" in [references/eslint-config-guide.md](references/eslint-config-guide.md): a file-exact block, rebuilt from the shared lists, a reason comment, `--print-config` proof, the `quality-gates.json` guardrail still green, and a `Gate-Change:` trailer. A limit or baseline change: stop and ask the owner.
6. **Check (validation loop).** From the repo root, when `node_modules` exist: `npm run typecheck`, `npm run lint`, `npm run format:check` (before the scripts exist: `npx tsc --noEmit -p <each project>`, `npx eslint . --max-warnings 0`, `npx prettier --check .`). Always: `node ${CLAUDE_SKILL_DIR}/scripts/check-source.mjs .` and `node ${CLAUDE_SKILL_DIR}/scripts/check-configs.mjs .`. Fix every `FAIL` line (each names the file, the rule and the fix) and rerun until all print `RESULT: PASS`.

Template destinations (the templates are the verified files; the monorepo-bootstrap skill writes the same bytes, because every template below is synced from one canonical copy in the skill library: never edit a copy here, edit the canonical file and run `node skills/_library/sync-shared.mjs`). The only thing to fill: the pre-existing top-level folders and files that are not monorepo code (knowledge folders, design exports, notes) go into `PRE_EXISTING` in `eslint.config.mjs` (`'handbook/**'`) and replace `__PRE_EXISTING__` in `.prettierignore` (`handbook/`); delete the placeholder line when there are none.

| Template | Destination in the app repo |
|---|---|
| `templates/tsconfig.base.json` | `tsconfig.base.json` |
| `templates/tsconfig.root.json` | `tsconfig.json` |
| `templates/tsconfig.game-kit.json` | `packages/game-kit/tsconfig.json` |
| `templates/tsconfig.shell.json` | `packages/shell/tsconfig.json` |
| `templates/tsconfig.tooling.json` | `packages/tooling/tsconfig.json` |
| `templates/tsconfig.app.json` | `apps/<game-id>/tsconfig.json` (every app) |
| `templates/eslint.config.mjs` | `eslint.config.mjs` |
| `templates/.prettierrc.json`, `templates/.prettierignore` | `.prettierrc.json`, `.prettierignore` |
| `templates/app-env.d.ts` | `packages/shell/src/app-env.d.ts` |
| `templates/result.ts` | `packages/game-kit/src/contract/result.ts` |

## Definition of done

- [ ] `npm run typecheck` passes for every project (or `npx tsc --noEmit -p` on the root and each `packages/*`, `apps/*`).
- [ ] `npm run lint` passes with `--max-warnings 0`, and `npm run format:check` passes.
- [ ] No new `eslint-disable`, `@ts-ignore` or `@ts-nocheck`; any `@ts-expect-error` names a third-party cause.
- [ ] No file over 250 code lines (400 for tests), no function over 40 lines (80 for a component); every split was made by responsibility.
- [ ] Every new exported API in game-kit, ports, stores and hooks has a one-sentence TSDoc summary; no TODOs; no commented-out code.
- [ ] Every expected failure is a `Result` (or `null`) with a `kind` union; every `catch` maps, records or rethrows with `cause`; no floating promise, no `async` handler.
- [ ] Any config exception is a named, commented, file-exact block committed with a `Gate-Change:` trailer.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-configs.mjs .` prints `RESULT: PASS` (the configs match the canonical set).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-source.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Adding `eslint-disable` or `@ts-ignore` "just this once".** Inline config is inert and reported; the error is still there. Fix the code, or make a file-exact exception block for a real tool contract.
- **Raising a limit or turning a rule off in a later block.** `check-configs.mjs` reports `eslint-limit-changed` and `eslint-rule-off`. Split the code instead; limit changes are the owner's call.
- **Writing a fresh short list in an exception block.** `'no-restricted-imports': ['error', { paths: [x] }]` drops every other ban for those files. Rebuild from `RUNTIME_PATHS` with `without(...)` and `restrictedImports(...)`.
- **Compressing code to get under a limit.** Joined lines, removed blank lines and nested ternaries make it worse and trip `no-nested-ternary`. Extract named functions or a lookup table.
- **`import type` from a Node-world file into app code.** It still drags `process` and `node:fs` into the app program. Put shared types in a neutral file.
- **`onPress={async () => ...}` because it type-checks.** The Strict API hides the rejection. Keep the handler synchronous and end the task with `.catch(reportError)`.
- **Throwing for a corrupt save or bad outside input.** Callers forget to catch. Return a `Result` with a `kind` union (a move `listMoves` does not list is the exception: the engine contract throws a `RangeError`).
- **Rewording a lint message or reformatting an option list in the config.** The `quality-gates.json` guardrail compares resolved values, including the `RESTRICTED_PROPERTIES` messages, verbatim; copy the template exactly.
- **Declaring "the checkers pass" without running ESLint and tsc.** The scripts mirror the rules most often broken; `npm run lint` and `npm run typecheck` are still the full gate.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/tsconfig-set.md](references/tsconfig-set.md) | Two worlds, the six tsconfig files, every compiler option, `app-env.d.ts`, Node-world rules | Workflow step 2; a missing global or wrong program |
| [references/eslint-config-guide.md](references/eslint-config-guide.md) | Versions and install, the blocks, file groups, shared lists, exemptions, adding an exception, message codes, Prettier | Workflow steps 2 and 5; an unclear lint message |
| [references/limits-and-splitting.md](references/limits-and-splitting.md) | The limits table with rationale, how lines are counted, the move for each tripped limit | Workflow step 4 for a limit; before a large module |
| [references/forbidden-patterns.md](references/forbidden-patterns.md) | Every rejected pattern, why, which rule, and what to write instead | Workflow step 4 |
| [references/code-policies.md](references/code-policies.md) | Comments, error handling, async, immutability, dependency injection, imports | Workflow step 3 |
| `templates/tsconfig.base.json` | The shared strict compiler options (all `templates/` files are synced from the library) | Workflow step 2 |
| `templates/tsconfig.root.json` | Root program: tests and Node-side config (`jest`, `node`) | Workflow step 2 |
| `templates/tsconfig.game-kit.json` | game-kit program (`jest`, `lib: ESNext`) | Workflow step 2 |
| `templates/tsconfig.shell.json` | Shell program, without the Node-world `src/config` | Workflow step 2 |
| `templates/tsconfig.tooling.json` | Tooling program (`node`, `jest`) | Workflow step 2 |
| `templates/tsconfig.app.json` | Program of every game app, with `app-env.d.ts` and the Shell's route types `react-navigation.d.ts` (TS2769 "parameter of type never" without it) | Workflow step 2; a new app |
| `templates/eslint.config.mjs` | The complete, verified ESLint 9 flat config | Workflow steps 2 and 5 |
| `templates/.prettierrc.json` | Prettier options | Workflow step 2 |
| `templates/.prettierignore` | Prettier ignore list (generated folders, snapshots, `skills/`, `.claude/`, the `__PRE_EXISTING__` entries) | Workflow step 2 |
| `templates/app-env.d.ts` | `process` and `EXPO_PUBLIC_*` declarations for app programs | Workflow step 2; a new runtime env variable |
| `templates/result.ts` | The shared `Result` type with `ok`/`err` | Workflow step 2 (game-kit setup) |
| [examples/parse-level-param.ts](examples/parse-level-param.ts) | A parser of outside input returning `Result` instead of throwing (rules throw instead: the engine contract) | Workflow step 3 |
| [examples/parse-level-param.test.ts](examples/parse-level-param.test.ts) | Its test: success and each expected failure | Workflow step 3 |
| [examples/with-timeout.ts](examples/with-timeout.ts) | A timeout as an expected failure | Workflow step 3 (async adapters) |
| [examples/with-timeout.test.ts](examples/with-timeout.test.ts) | Fake-timer tests for it (the `// allow-fake-timers:` marker names why a logic test may use them) | Workflow step 3 |
| [examples/use-report-error.ts](examples/use-report-error.ts) | The rejection handler hook for fire-and-forget work | Workflow step 3 (handlers) |
| [examples/buy-button.tsx](examples/buy-button.tsx) | A synchronous handler that starts async work | Workflow step 3 (handlers) |
| [examples/splitting-a-long-function.md](examples/splitting-a-long-function.md) | A 44-line, complexity-12 function, its four lint errors, and the split | Workflow step 4 for a limit |
| [examples/score-level.ts](examples/score-level.ts) | The split result: options object, lookup tables, named steps | Workflow step 4 |
| [examples/score-level.test.ts](examples/score-level.test.ts) | Tests for each extracted piece | Workflow step 4 |
| `scripts/check-configs.mjs` | Checks tsconfigs, the ESLint config (with the guardrail-compared messages), Prettier and its ignore list, pre-existing top-level folders, pins and lint scripts against the baseline | Workflow steps 2, 5 and 6 |
| `scripts/check-source.mjs` | Checks every `.ts`/`.tsx` for silenced gates, limits, non-erasable syntax, exports, imports, handlers, errors | Workflow step 6 |
| `scripts/lib/source-scan.mjs` | Dependency-free lexer: comments, strings, imports, functions, parameter lists (synced from the library, shared with naming-conventions and architecture-and-boundaries) | Only when changing a checker |
| `scripts/lib/workspaces.mjs` | Reads the workspace package names, for import-extension checks (synced from the library) | Only when changing a checker |
| `scripts/selftest.mjs` | Proves both checkers pass good fixtures and catch every planted bug | After changing a checker, the baseline or a template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/ts-lint-baseline.json` | The canonical compiler options, workspace worlds, required ESLint settings, limit values, pins | When a verified setting changes (owner decision) |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs for the self-test (`check-configs/good` mirrors the templates) | When adding a rule to a checker |

## Related skills

- `naming-conventions` - file, identifier, testID and key names (the naming rules inside this ESLint config).
- `architecture-and-boundaries` - which package may import which, app zones, ports and file placement.
- `quality-gates` - the npm scripts, hooks and the config guardrail that run these checks.
- `react-components-and-hooks` - the UI lint rules (primitives, memo, styles) in more depth.
- `unit-and-component-tests` - writing the tests that go with split-out functions.
