---
name: skill-template
description: Adds a pure TypeScript helper module (named exports, kebab-case file, no side effects) to Pocket Arcade and checks it. Use when creating or reviewing a helper in packages/game-kit, or when starting a new skill from this model folder.
---

# Pure helper module

Every helper in `packages/game-kit/src/` is a pure, deterministic module with named exports and a kebab-case file name, and a script proves it. This folder is also the library's model skill: a new skill starts as a copy of it.

## Rules that must hold

1. **Named exports only.** A default export lets each importer rename the function, so searches and refactors miss call sites.
2. **Kebab-case file names.** `clamp-value.ts`, never `ClampValue.ts`: macOS ignores case and Linux CI does not, so a case slip passes locally and fails in CI.
3. **Pure and deterministic.** No React, React Native, Expo or Shell imports, no clock and no `Math.random()`: helpers run in plain Node tests and give the same answer on every device.
4. **One job per module.** One exported function (plus its types) per file keeps modules small enough to test completely.

## Workflow

1. Read [references/module-rules.md](references/module-rules.md) for the rules and the worked example.
2. Copy [templates/pure-module.ts](templates/pure-module.ts) to `packages/game-kit/src/<area>/<kebab-name>.ts` and replace every `__PLACEHOLDER__`.
3. Write the test first in `<kebab-name>.test.ts` next to it, watch it fail, then make it pass.
4. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-exports.mjs packages/game-kit/src` from the repo root.
5. Fix every `FAIL` line (each names the file, the rule and the fix) and rerun until it prints `RESULT: PASS`.

## Definition of done

- [ ] The module and its test sit in `packages/game-kit/src/<area>/` with kebab-case names.
- [ ] No `__PLACEHOLDER__` text is left in the copied template.
- [ ] The test covers the normal case and each thrown error.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-exports.mjs packages/game-kit/src` prints `RESULT: PASS`.

## Anti-patterns

- **Default exports for "just one function".** The rename problem starts with the second importer; export by name from the start.
- **Reading the clock or a global random source inside a helper.** Pass time and randomness in as arguments so tests and replays stay deterministic.
- **Silencing the checker by moving files out of the scanned folder.** Fix the module instead; the check exists because the mistake is easy to make.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/module-rules.md](references/module-rules.md) | The module rules, why they exist, and a worked example | Workflow step 1, before writing a helper |
| [templates/pure-module.ts](templates/pure-module.ts) | Compiling starting point with `__PLACEHOLDER__` names | Workflow step 2 |
| `scripts/check-exports.mjs` | Checker for named exports and kebab-case names | Workflow step 4, and at the end |
| `scripts/selftest.mjs` | Proves the checker passes good input and catches each planted bug | After changing the checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Self-test inputs: `good/`, planted bugs `bad-*/` (exit 1), passing cases `pass-*/` (exit 0) and bad input `error-*/` (exit 2, with an optional `ARGS.txt`), each case with its `EXPECT.txt` | When adding a rule to the checker |

## Related skills

- `typescript-and-lint-rules` - the full compiler and lint settings every module must pass.
- `naming-conventions` - names for files, functions and types beyond helpers.
- `unit-and-component-tests` - how to write the test that goes with the module.
