# The TDD loop

How every behaviour in Pocket Arcade gets built: one failing test, the minimum code, a refactor, the fast gate, one commit. The owner does not read code; the tests are the specification Claude builds against and the evidence the owner signs off.

## Contents

- Why the loop is strict here
- The loop, step by step
- Red for the right reason
- Commands used all day
- Discipline rules
- Pure logic: examples, properties and one pinned golden value
- Determinism inside tests
- When fast-check finds a counterexample

## Why the loop is strict here

- One agent writes both the code and the tests. A test written after the code tends to assert what the code does, not what the spec says. Seeing it fail first is the only proof the test can catch the bug.
- Coverage alone cannot show that tests would catch a bug, so mutation testing (Stryker) audits the logic tests, and pixel and screenshot goldens catch what assertions forget.
- Determinism is a product feature (spec 8.3, 8.13): seeded random numbers, an injected clock, no transcendental maths in rules. Tests enforce it; they never add randomness of their own.

## The loop, step by step

```text
1. Pick the next behaviour from the spec (quote the spec line in the test title or a comment).
2. Write ONE failing test.                    npx jest --ci <path>
3. Read the failure. Right reason = an assertion diff. Wrong reason = import/type/syntax error: fix the test.
4. Write the minimum code.                    npx jest --ci <path>   -> green
5. Refactor by responsibility (size limits), tests stay green.
6. npm run -s check:fast                      (also the Stop hook)
7. Commit the slice (red and green together). Pre-commit reruns related tests.
```

A slice is one behaviour a player or the Shell can observe: "a full column clears and emits column-cleared", "the first completion of the day counts for the streak". One slice = one commit.

Before step 2, write down the plan in a few lines (the `templates/slice-plan.md` shape): the spec lines, the behaviour in one sentence, the first test's title, the files the code will touch, and the evidence the slice needs.

## Red for the right reason

A red run for the right reason fails on an assertion and shows the difference between expected and received:

```text
● applyMove › when a placement completes a column › clears the column and emits a column-cleared event
  expect(received).toStrictEqual(expected) // deep equality
  - Expected  - 4
  + Received  + 0
  -   Object {
  -     "col": 2,
  -     "kind": "column-cleared",
  -   },
```

Wrong reasons, which prove nothing about the behaviour:

- `Cannot find module './apply-move.ts'` or `SyntaxError`: the test never reached an assertion. Create an empty stub that exports the function with the right type and returns a wrong value (`return 0`, `return []`), then rerun until the failure is an assertion.
- A TypeScript error: fix the types in the test or the stub first.
- A test that passes immediately: the behaviour already exists, or the test asserts nothing that matters. Check with a quick deliberate break of the code, then choose a sharper test.

Copy the relevant red lines into the slice notes; they are part of the evidence.

## Commands used all day

| Need | Command |
|---|---|
| One file | `npx jest --ci apps/line-siege/src/rules/apply-move.test.ts` |
| One title | `npx jest --ci -t 'clears the column'` |
| Tests related to changed files | `npx jest --ci --findRelatedTests <files>` |
| The fast gate (format, lint, types, changed tests) | `npm run -s check:fast` |
| Only goldens | `npm run test:golden` |
| Coverage with the gate (prints the random seed) | `npm run test:coverage` |
| Coverage of one slice, no verdict (paths first) | `npx jest apps/line-siege/src/rules --ci --selectProjects unit --coverage --collectCoverageFrom='apps/line-siege/src/rules/**/*.ts' --coverageThreshold='{}'` |
| Replay an order-dependent failure | `npx jest --ci --randomize --seed=<printed seed> -i` |
| Bot simulations | `npm run test:sim` |
| Mutants of one file | `npx stryker run --mutate packages/shell/src/services/ads/ad-policy.ts` |

Run Jest from the repo root only: the root Babel config is found from the working directory, and without it every suite fails on Flow syntax.

Only `npm run test:coverage` judges the coverage thresholds. A subset run with plain `--coverage` counts every file the root config collects, so the global threshold fails ("not met: 0%" or "6.18%") even when every file of the subset passes. For a subset, put the paths first (`--selectProjects` reads every following word as a project name), limit `--collectCoverageFrom` to the slice's folder and switch the thresholds off with `--coverageThreshold='{}'`; read the per-file numbers, then run `npm run test:coverage` for the verdict.

## Discipline rules

1. **One failing test first, run, read.** Never write product code for a behaviour that has no red test.
2. **Red and green in the same commit.** Never commit a failing test; never use `it.skip`, `it.only`, `it.failing`, `it.todo`, `xit`, `xdescribe`, `fit` or `jest.retryTimes`. Skipped tests rot, and pre-commit runs the related tests anyway.
3. **Never edit an existing assertion to make it pass** unless the spec changed. When it did, say which spec line changed in a `Spec-Change: <spec section and what changed>` commit trailer. "The test was wrong" is never a Spec-Change; it means the test was written without reading the spec, so reread the spec and discuss with the owner if they disagree.
4. **Never weaken a gate to go green:** no lowered threshold, tolerance or lint rule, no `eslint-disable`, `@ts-ignore`, `--no-verify`, `jest -u` without a reason. If a gate looks wrong, stop and ask.
5. **Finish every slice with `npm run -s check:fast`**, then commit with a Conventional Commits header and the spec lines in the body.
6. **Refactor by responsibility, never by line count:** extract a named pure function, a sub-component or a module with its own test when a size or complexity limit trips.
7. **Test behaviour, not implementation:** roles, names and visible text for UI; returned values and emitted events for logic.

## Pure logic: examples, properties and one pinned golden value

Every pure module (rules, level generator, reducers, policies, game-kit) gets three kinds of test in the same file:

1. **Examples**: concrete inputs and outputs that read like the spec ("3 stars at or under par").
2. **Properties** with fast-check: determinism (same seed and moves give the same states), invariants after any legal move sequence, JSON round trip (the save stores state as JSON), migration of any valid old save, solver soundness (a level declared winnable has a winning line that `applyMove` replays).
3. **At least one pinned golden value**: one exact output for one fixed input, written as a literal.

Why all three: in the platform probes, determinism and range properties alone left 3 of 8 random-number mutants alive; the pinned value killed them. Properties find the cases nobody thought of; examples document intent; the golden value pins behaviour that properties cannot see.

The property checklist for every game: determinism, invariants after any legal sequence, save round trip, migration of any valid old save, solver soundness.

## Determinism inside tests

- Never read real time, real randomness or the machine's time zone. Inject the clock port (a fake clock in tests) and the seeded random-number generator; Jest pins `TZ=UTC`.
- `Math.random`, `Date.now`, `new Date()` and `performance.now()` stay banned in tests too.
- `jest.useFakeTimers()` is only for UI timers inside components, never for game or clock logic.
- Fixed fast-check seeds are fine for pinned cases; ordinary properties run with the default random seed, and a failure prints the seed and path to replay.

## When fast-check finds a counterexample

1. Copy the printed counterexample into a new example test (`it('keeps a free cell when the tray is empty')`) and watch it fail.
2. Fix the code; the example and the property both go green.
3. Reproduce the property run with the printed `{ seed, path }` if needed: `fc.assert(property, { seed: <seed>, path: '<path>' })` for the run only; do not commit the seed.

fast-check is never flaky by definition: a new failure is a new counterexample.
