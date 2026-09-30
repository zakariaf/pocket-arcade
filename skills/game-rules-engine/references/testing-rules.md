# Testing a rules engine

How the rules are proven: the test-first loop, what every rules module is tested with, the property checklist, the pinned golden, the contract test, and the numbers the gates require.

## Contents

- The loop
- Files and names
- Example tests
- Property tests with fast-check
- The property checklist
- The pinned golden value
- The engine contract test
- Coverage and mutation gates
- Commands
- Traps

## The loop

1. Pick the next behaviour and quote its spec line in the test title or a comment.
2. Write one failing test: `npx jest apps/<game-id>/src/rules/<file>.test.ts --ci --selectProjects unit`.
3. Read the failure. The right reason is an assertion diff (`Expected ... Received ...`); an import, type or syntax error is the wrong reason: fix the test first.
4. Write the minimum code, run again: green.
5. Refactor by responsibility (size limits), tests stay green.
6. `npm run -s check:fast`, then commit test and code together.

Never edit an existing assertion to make it pass unless the spec changed (then a `Spec-Change:` commit trailer names the spec line), and never add `.skip`, `.only` or `eslint-disable`.

## Files and names

- Tests sit next to the unit: `create.test.ts`, `apply-move.test.ts`, `outcome.test.ts`, `<game-id>-engine.test.ts`, `<game-id>-persistence.test.ts`, `<game-id>-stats.test.ts`, `testing/<game-id>-testing.test.ts`.
- `describe('<exported name>')`, optional `describe('when ...')`, then `it('<third-person verb> ...')`: titles must match `^(can|[a-z]+s)\b` ("flips the tapped cell", "throws for a cell outside the grid", not "should flip" or "never starts").
- A helper used inside property callbacks sits outside the `it`, so callbacks stay within 4 nesting levels (`expectInvariants(states)` in the template).

## Example tests

One behaviour per `it`, with hand-built states: a 3x3 board with exactly these cells lit (`board([8])`), Line Siege's opening with its prepared column one placement from full (`create(1, 0)` and the move `{ kind: 'place-block', trayIndex: 1, col: 7, row: 3 }` in `examples/line-siege/rules/apply-move.test.ts`). Assert with `toStrictEqual` on the whole result (state and events), and test every thrown error with `toThrow(RangeError)`.

## Property tests with fast-check

`playChoices(rules, start, choices)` (`testing/play-choices.ts`) turns a list of integers into a legal move sequence for any engine (`choice % legalMoves.length` picks the move), so fast-check explores move sequences without knowing the game:

```ts
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const choicesArb = fc.array(fc.nat(), { maxLength: 40 });

it('replays identically for the same seed, difficulty and move choices', () => {
  fc.assert(
    fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
      const first = playChoices(RULES, create(seed, difficulty), choices);
      expect(playChoices(RULES, create(seed, difficulty), choices)).toStrictEqual(first);
    }),
  );
});
```

When fast-check finds a counterexample, copy the printed input into an example test first, see it fail, then fix the code. Reproduce with the printed `{ seed, path }`.

## The property checklist

Every rules module is covered by examples and by properties:

| Property | Shape |
|---|---|
| Determinism | same seed, difficulty and choices give deep-equal states and events |
| Invariants after any legal sequence | e.g. one move per applyMove, never past the move limit, a free cell in every column, score never decreases |
| Start in play | `outcome(create(seed, d)).kind === 'playing'` for any seed and difficulty 0..100 |
| End state | `listMoves(state).length === 0` exactly when `outcome(state).kind !== 'playing'`, for every visited state |
| Save round trip | `JSON.parse(JSON.stringify(state))` deep-equals the state after random play; `parseState` returns it unchanged |
| Game-specific algebra | a flip applied twice is the identity; a merge conserves the total; a reflection keeps the speed |

Undo properties (undoing k moves equals the state k moves earlier) and replaying a saved log are the Shell session's tests (game-host-integration and state-stores).

## The pinned golden value

Properties alone let real bugs survive (in the project's probes, determinism and range properties left 3 of 8 RNG mutants alive). So every rules module pins at least one exact value next to its properties, in a constant named `GOLDEN_*` at the bottom of the test file:

```ts
it('keeps the pinned board for seed 1 at difficulty 0 (a changed board breaks saved levels)', () => {
  const state = create(1, 0);
  expect(boardText(state.cells, state.cols)).toBe(GOLDEN_SEED_1_BOARD);
});

const GOLDEN_SEED_1_BOARD = ['###', '###', '..#'].join('\n');
```

A golden changes only on purpose, with a `Gate-Change:` commit trailer that says why. The RNG's own goldens (`GOLDEN_SEED_1`, `GOLDEN_DAILY_HASH` in `rng/sfc32.test.ts`) never change.

## The engine contract test

`<game-id>-engine.test.ts` runs `engineContractProblems` (`testing/engine-contract.ts`) over several seeds and difficulty bands, with the intents the game's board produces:

```ts
const problems = engineContractProblems({
  gameId: 'tap-flip',
  engine: TAP_FLIP_ENGINE,
  persistence: TAP_FLIP_PERSISTENCE,
  starts: [0, 25, 50, 100].flatMap((difficulty) => [1, 2, 3].map((seed) => ({ seed, difficulty }))),
  maxMoves: 60,
  intents: everyTap,
  // Only for a game with an endless mode: endless: LINE_SIEGE_LEVELS.endless (or the literal
  // { kind: 'endless', difficulty: ENDLESS_DIFFICULTY }, as in the Line Siege example).
});
expect(problems).toStrictEqual([]);
```

Taps are built with `selected: null` (the gesture layer never fills it in). A game with `selectRegions` also lists taps on those regions (Line Siege: every tray slot); the contract test then retries every other tap with each of them as the selection.

It plays seeded random games and reports: `create` not deterministic, state or move not JSON-safe (`jsonShapeProblems` names the path: "state.hp is NaN"), parsers that do not return saved values unchanged, `applyMove` changing its input, events without kebab-case kinds, `listMoves` not empty exactly at the end, lose reasons outside the game's catalog, fractional win scores, `intentToMove` returning a move `listMoves` does not list, a `panMode` outside the four modes, `selectRegions` that is not a list, a tap inside a select region that makes a move, a move made from a tap with a selection that `listMoves` does not list, `intentToMove` accepting an intent the pan mode never sends (a swipe on a `'none'` board), replays that differ, and, with `endless`, a seeded run from the endless difficulty that ends `won`. `check-rules-engine.mjs` runs the same kind of seeded check on the four rules modules directly, so it also works before the engine is assembled.

## Coverage and mutation gates

- Coverage for `apps/*/src/rules/**` and `packages/game-kit/src/` is at least 95 % statements, lines and functions and 90 % branches (global: 90/90/90/85). Cover the unreachable-looking branches with example tests (a corrupted save for `parseState`, the version-1 `migrateState`).
- When a rules module is finished, run Stryker on it (`npx stryker run --mutate apps/<game-id>/src/rules/apply-move.ts`); the break threshold is 75 %. Kill surviving mutants with boundary examples (exactly at the move limit, the last cell of a row), never by lowering a threshold.

## Commands

| Need | Command |
|---|---|
| One file | `npx jest apps/<game-id>/src/rules/apply-move.test.ts --ci --selectProjects unit` |
| One title | `npx jest apps/<game-id>/src/rules --ci -t 'flips the tapped cell' --selectProjects unit` |
| The rules folder with coverage | `npx jest apps/<game-id>/src/rules apps/<game-id>/src/testing --ci --selectProjects unit --coverage --collectCoverageFrom='apps/<game-id>/src/rules/**/*.ts' --collectCoverageFrom='apps/<game-id>/src/testing/**/*.ts' --coverageThreshold='{}'` |
| The thresholds (the whole repo) | `npm run test:coverage` |
| Types | `npx tsc --noEmit -p apps/<game-id>` and `npx tsc --noEmit -p packages/game-kit` |
| Lint and format | `npx eslint --max-warnings 0 apps/<game-id>/src/rules` and `npx prettier --check apps/<game-id>/src` |
| The skill's check | `node ${CLAUDE_SKILL_DIR}/scripts/check-rules-engine.mjs . --game <game-id>` |

## Traps

- **A subset run with `--coverage` fails the global threshold.** Without `--coverageThreshold='{}'` Jest judges the root config's global numbers against a run that only loaded a few files and exits 1 (`Jest: "global" coverage threshold for statements (90%) not met: 0%`) even when every file passes. Subset runs therefore print the table with `--coverageThreshold='{}'` and read it; only `npm run test:coverage` judges the thresholds.
- **`--selectProjects` takes several values.** `npx jest --selectProjects unit apps/x` and `npx jest --selectProjects=unit apps/x` both read `apps/x` as a second project name and run the whole unit suite (verified with `--listTests`: 92 files instead of 6). Put the paths first and `--selectProjects unit` last: `npx jest apps/x --ci --selectProjects unit`.
- **Tests that read the clock or `Math.random`** are banned like the rules themselves; build states by hand or from seeds.
- **Snapshots of large objects** are not goldens: pin a small readable text (`'###\n..#'`) or a short JSON string in a `GOLDEN_*` constant.
- **`toEqual` hides `undefined` keys**; use `toStrictEqual` (the lint rule enforces it), which is also what the JSON round trip needs.
