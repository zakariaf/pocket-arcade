# Examples, fast-check properties and pinned values

How pure logic (rules, generators, game-kit, reducers, policies, migrations) is proven: examples for the spec sentences, properties for everything else, and at least one pinned exact value. Also where the other logic-level tests (sims, save SQL) run.

## Contents

- Why all three
- fast-check in this repo
- playChoices: properties for any game's rules
- The property checklist for every game
- When fast-check finds a counterexample
- Pinned values for pure infrastructure
- Bot simulations (the sim config)
- Save and migration tests on node:sqlite

## Why all three

Examples read as the spec and pin exact behaviour; properties explore inputs nobody thought of; a pinned value (a golden number, sequence or layout) catches a change that keeps every property true. In the probes, determinism and range properties alone left 3 of 8 mutants of the random-number generator alive; the pinned sequence killed them. So every pure module gets examples AND properties AND one pinned value in its test file.

## fast-check in this repo

- `fc.assert(fc.property(arbA, arbB, (a, b) => { expect(...); }))`. `jest/expect-expect` accepts `fc.assert` as an assertion.
- Arbitraries used everywhere: `fc.integer({ min: 0, max: 2 ** 31 - 1 })` for seeds, `fc.integer({ min: 0, max: 3 })` for difficulty, `fc.array(fc.nat(), { maxLength: 60 })` for move choices.
- `{ numRuns: 200 }` for the invariant property (default is 100).
- A failure prints `{ seed, path }`; replay with `fc.assert(property, { seed, path, endOnFailure: true })` while debugging, then turn the shrunk input into an example test.
- Fixed seeds (`{ seed: 42 }`) are fine for pure infrastructure tests whose inputs must be stable; rules properties run unseeded so each run explores new inputs. They are never flaky: a new failure is a real counterexample.
- Keep helpers (invariant checks, state builders) outside the `it` callbacks so files stay within `max-nested-callbacks` 4; `make<Thing>(overrides)` builders beat 40-line literals.

## playChoices: properties for any game's rules

`packages/game-kit/src/testing/play-choices.ts` (template) turns a list of integers into a legal move sequence for any pure rules module (`choice % legalMoves.length` picks the move; no legal move ends the play). fast-check then explores move sequences without knowing the game:

```ts
const RULES = { listMoves, applyMove };
it('replays identically for the same seed and move choices', () => {
  fc.assert(
    fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
      const first = playChoices(RULES, create(seed, difficulty), choices);
      const second = playChoices(RULES, create(seed, difficulty), choices);
      expect(second).toStrictEqual(first);
    }),
  );
});
```

`examples/apply-move.test.ts` is the verified Line Siege rules test (examples, illegal moves, determinism, invariants, JSON round trip); `templates/rules.test.ts` is the template game's (Tap Flip) rules test, the one game-rules-engine's templates ship, to copy for a new game.

## The property checklist for every game

- Determinism: same seed and moves give the same states and events.
- Invariants after any legal sequence (score never drops, the board stays playable, counts stay in range).
- Save round trip: the state survives `JSON.parse(JSON.stringify(state))` unchanged.
- Migration of any valid old save (in the save tests).
- Solver soundness: a level declared winnable has a replayable winning line, and the line is checked with `applyMove`, never trusted.

## When fast-check finds a counterexample

1. Copy the shrunk input from the failure into a new example test with a title that states the rule.
2. Run it and see it fail on an assertion.
3. Fix the code; both the example and the property turn green.

Never widen the arbitrary or lower `numRuns` to make the failure go away.

## Pinned values for pure infrastructure

The model is `packages/game-kit/src/rng/sfc32.test.ts`: an independent transcription of the reference C code as the oracle, the pinned seed-1 sequence (a daily-challenge compatibility contract: every app version must produce it), and determinism and range properties with fixed fast-check seeds. It is the only RNG test; extend it rather than writing a second one.

Put the `noUncheckedIndexedAccess` guard for "index out of range" in one tested helper (`pickAt(list, index)` in `packages/game-kit/src/rng/`) instead of repeating an unreachable `if (x === undefined) throw` in every rules file: unreachable branches otherwise cap branch coverage below 90%.

## Bot simulations (the sim config)

A bot is a pure policy `(state, legalMoves, rng) → { move, rng }`; the harness is `packages/game-kit/src/testing/play-bot.ts` (`playBot(game, { seed, difficulty, policy, maxMoves })`). Sims assert properties of many games, not single outcomes: no exception and no endless game within the cap, identical results on replay, a sensible difficulty curve, every shipped level solvable. They live in `test/sims/<game-id>/<name>.sim.test.ts` (they write `reports/sim/<game-id>.json` with `node:fs`), run only through `jest.sim.config.js` (`npm run test:sim`, part of `verify`, never pre-commit) in plain Node, which also proves the rules need no React Native mock. Keep one file under about 60 s. Designing bots and balance bands is the `game-balance-and-bots` work.

## Save and migration tests on node:sqlite

The real save SQL is tested on Node's built-in `node:sqlite` through the `SqlDriver` interface (`test/integration/save/node-sqlite-sql-driver.ts`, `createNodeSqliteSqlDriver(path)`): fresh, round trip, backup restore with quarantine, every frozen fixture, a newer version left untouched, rollback, WAL checkpoint. Those tests sit under `test/integration/save/` because they import `node:sqlite`; they run in the `unit` project and count toward the save folder's coverage. `node:sqlite` rows have a null prototype, so the driver copies them before `toStrictEqual`. Every save-format change adds frozen fixtures `fixtures/save-vN.minimal.json` and `save-vN.full.json` and a migration test; shipped fixtures are never edited. The save work owns those files; this skill only fixes where and how they run.
