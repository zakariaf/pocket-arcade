---
name: tdd-workflow
description: Drives every Pocket Arcade code change test-first - one failing test seen red for the right reason, minimum code, refactor, check:fast - plus layer order and evidence. Use when writing or changing product code or deciding what to test. Not for test helpers or Jest setup (unit-and-component-tests).
---

# Test-driven workflow

Every behaviour in Pocket Arcade is built red-green-refactor: a failing test that quotes the spec, the least code that turns it green, a refactor, the fast gate, and one commit holding test and code together. The owner never reads the code, so the tests are both the specification and the evidence; two scripts prove the tree and the history follow the rules.

## Rules that must hold

1. **No product code without a red test seen failing for the right reason.** Run it and read the failure: an assertion diff (`Expected ... Received ...`), never an import, type or syntax error. A test that was never red proves nothing.
2. **Red and green in the same commit, one behaviour per commit.** Never commit a failing test; pre-commit reruns related tests and history must show test and code arriving together.
3. **Never edit an existing assertion to make it pass.** Fix the code. Only a spec change may change an expectation, and the commit then carries `Spec-Change: <spec section and what changed>`. "The test was wrong" is never a Spec-Change. A swap the build order directs is one: Shell step 8 replaces the bootstrap's phase-0 `with-shell.ts` and its test with architecture-and-boundaries' final pair, and that commit carries exactly `Spec-Change: with-shell final composer (phase 0 placeholder replaced)`.
4. **Never skip, focus, retry or weaken:** no `.skip`, `.only`, `.failing`, `.todo`, `xit`, `fit`, `jest.retryTimes`, component snapshots, lowered thresholds, `eslint-disable` or `--no-verify`. If a gate looks wrong, stop and ask the owner.
5. **Quote the spec line in the first test** (title or comment above it: `it('counts only the first completion of the day (spec S9)')`). Print it with the product-spec lookup, never from memory.
6. **Build in layer order:** rules -> level generator -> save and migrations -> services with fakes -> hooks -> screens -> end-to-end flows -> screenshot matrix. Each layer is tested before anything depends on it.
7. **Pure logic gets examples, fast-check properties and at least one pinned exact value** in the same file. Properties alone left 3 of 8 random-number mutants alive in the probes.
8. **Tests are deterministic:** no `Math.random`, `Date.now`, `new Date()`, `performance.now()`, real timers, network, locale or time zone. Inject the fake clock and the seeded random-number generator. The one exception is a perf budget test (`test/**/<name>.perf.test.ts`), which times real work with `performance` from `node:perf_hooks`.
9. **Tests live where they run:** `<unit>.test.ts(x)` next to the unit, `*.golden.test.ts` for data goldens, `*.sim.test.ts` under `test/sims/`, Node-API tests under `test/`. Titles start with a third-person verb or `can`; use `it`, never `test`.
10. **Each kind of change carries its evidence** (`references/definition-of-done.md`): UI changes also need screenshots in en and fa, light and dark, matched against the Toybox design screenshot.

## Workflow

0. **Start from green** (once per session, from the repo root): `git status` and `git log --oneline -10` (never discard work you did not make; ask about it), note `git rev-parse --short HEAD` as the session's `<base>`, then `npm run -s check:fast`. If it is red, getting back to green is the first slice, and the report says what was broken.
1. **Find the spec lines** the task serves (the `pocket-arcade-product-spec` skill prints each entry exactly; never quote from memory) and write the plan with [templates/slice-plan.md](templates/slice-plan.md): behaviour in one sentence, first test title, files, evidence.
2. **Place the slice in the build order** ([references/build-order.md](references/build-order.md)). If a lower layer it needs is untested, build that slice first.
3. **Write one failing test.** Copy [templates/logic.test.ts](templates/logic.test.ts) (pure logic) or [templates/component.test.tsx](templates/component.test.tsx) (a component) next to the unit and replace every `__PLACEHOLDER__`. Names and places follow [references/test-conventions.md](references/test-conventions.md).
4. **Run it and read the failure:** `npx jest --ci <test-file>` (to see a slice's coverage without a verdict: `npx jest <paths> --ci --selectProjects unit --coverage --collectCoverageFrom='<path>/**/*.ts' --coverageThreshold='{}'`, paths first; only `npm run test:coverage` judges the thresholds). If it fails on an import or a type, add a typed stub that returns a wrong value and rerun until the failure is an assertion diff ([references/tdd-loop.md](references/tdd-loop.md), "Red for the right reason"). Keep the red lines for the report.
5. **Write the minimum code** to turn that test green, rerun. Add the next example, see it red, make it green. For pure logic add the properties and the pinned value; turn any fast-check counterexample into an example test first.
6. **Refactor by responsibility** (split a module, extract a pure function with its own test); tests stay green.
7. **Run the fast gate and the tree check** from the repo root: `npm run -s check:fast`, then `node ${CLAUDE_SKILL_DIR}/scripts/check-tests.mjs .`. Fix every `FAIL` line and rerun until both pass.
8. **Commit the slice** (test and code together, spec lines in the body; the `git-commits-and-reporting` skill has the message format), then check the history: `node ${CLAUDE_SKILL_DIR}/scripts/check-test-edits.mjs . --range <base>..HEAD` (`<base>` from step 0). Before committing, `--staged --message <file>` checks the staged slice.
9. **Collect the evidence** the change kind needs from [references/definition-of-done.md](references/definition-of-done.md) and report it. Read [examples/slice-walkthrough.md](examples/slice-walkthrough.md) once to see a complete slice.

## Definition of done

- [ ] Every new behaviour has a test that was seen failing on an assertion before its code existed; the red lines are in the report.
- [ ] Each commit holds one behaviour with its tests and code together; no existing assertion changed without a `Spec-Change:` trailer.
- [ ] Pure logic has examples, properties and a pinned exact value; UI has component tests plus en/fa light/dark screenshots matched to the Toybox design.
- [ ] `npm run -s check:fast` is green (and `npm run verify` before any push).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-tests.mjs .` and `node ${CLAUDE_SKILL_DIR}/scripts/check-test-edits.mjs . --range <base>..HEAD` print `RESULT: PASS`

## Anti-patterns

- **Writing the code, then a test that passes first time.** It asserts what the code does, not what the spec says. Delete the code, watch the test fail, rewrite.
- **"Red" from a missing file.** `Cannot find module` is not a failing behaviour; stub the export with a wrong value and get an assertion diff.
- **Changing `toBe(3)` to `toBe(2)` because the code returns 2.** That is editing the test to pass; `check-test-edits.mjs` reports it as `assertion-changed`.
- **Parking a test with `.skip` "for later".** Finish the behaviour in the slice or delete the test.
- **A 40-line object literal in every test.** Use a `make<Thing>(overrides)` builder.
- **Snapshotting a component tree.** Assert roles, accessible names and visible text; snapshots belong only in `*.golden.test.ts`.
- **Testing through the UI what a property already proves.** One level per behaviour; the flow proves the wiring, not the rule.
- **Several behaviours in one commit** ("add stars, packs and unlocks"). The history can no longer show that each was test-first.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/tdd-loop.md](references/tdd-loop.md) | The loop, red for the right reason, commands, discipline rules, examples + properties + pinned value, determinism, counterexamples | Before the first slice of a session, and whenever a red run looks wrong |
| [references/test-conventions.md](references/test-conventions.md) | File names and places, titles, builders, banned test code, what not to test, snapshots, flaky-test policy | Workflow step 3, and when `check-tests.mjs` fails |
| [references/build-order.md](references/build-order.md) | The layer order, the Shell + pilot build order, the per-game order, first tests per layer | Workflow step 2, and when starting the Shell or a game |
| [references/definition-of-done.md](references/definition-of-done.md) | Always-true items, evidence by kind of change, the test pyramid, coverage and mutation gates, where evidence files are | Workflow step 9, before calling work done |
| [templates/slice-plan.md](templates/slice-plan.md) | The plan for one slice (spec lines, first test, files, evidence, red run) | Workflow step 1 |
| [templates/logic.test.ts](templates/logic.test.ts) | Test file for a pure unit: pinned example, rule table, impossible input, properties | Workflow step 3 for logic |
| [templates/component.test.tsx](templates/component.test.tsx) | Component test through `renderWithShell`, by role and name, async presses | Workflow step 3 for a component |
| [examples/slice-walkthrough.md](examples/slice-walkthrough.md) | One complete slice (spec 8.1 stars) with the real red and green runs and the commit | Once, to see the whole loop |
| `scripts/check-tests.mjs` | Checks the tree: disabled or retried tests, titles, snapshots, clock and randomness in tests, Node APIs in app tests, file names, assertion-free files, untested logic modules | Workflow step 7 and the definition of done |
| `scripts/check-test-edits.mjs` | Checks commits (`--range`, `--log`) or the staged slice (`--staged`): changed assertions without Spec-Change, deleted tests, feat/fix code without a test (a `// device-only: covered by ...` wrapper, a file whose first 3 lines say `GENERATED by <tool path>` and a types-only module are exempt), newly disabled tests (call sites only: comments and strings are not read) | Workflow step 8 and the definition of done |
| `scripts/selftest.mjs` | Proves both checkers pass good fixtures and catch each planted bug | After changing a checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs for the self-test (history fixtures are real `git log -p` output) | When adding a rule to a checker |

## Related skills

- `pocket-arcade-product-spec` - the exact spec lines each first test quotes.
- `unit-and-component-tests` - Jest projects, `renderWithShell`, mocks, fast-check and coverage set-up.
- `golden-tests` - data and pixel goldens and when `jest -u` is allowed.
- `e2e-maestro` - end-to-end flows and the screenshot matrix.
- `toybox-visual-parity` - matching each changed screen to its design screenshot.
- `quality-gates` - what `check:fast` and `verify` run and how to fix a failing gate.
- `git-commits-and-reporting` - the commit message and the evidence report for each slice.
