# Worked slice: stars for a finished puzzle level (spec 8.1)

One complete behaviour slice, from the spec line to the commit, as it actually ran (Jest 29.7 with jest-expo 57, fast-check 4.10.2, TypeScript 6.0.3, the project ESLint config). The module is small on purpose; the level skill decides where the real stars logic finally lives. Copy the shape, not the file.

## Contents

- 1. The plan
- 2. The first failing test, and its red run
- 3. The minimum code, then the rest of the rule
- 4. Refactor and the fast gate
- 5. The commit
- 6. What goes into the report

## 1. The plan

```text
Spec 8.1: "Puzzle games: 3 stars at or under par, 2 stars at par +2, 1 star for finishing."
Behaviour: a finished puzzle level earns 3, 2 or 1 stars from its move count and par.
First test: packages/game-kit/src/levels/stars-for-moves.test.ts
            it('gives 3 stars at par (spec 8.1)')
Code: packages/game-kit/src/levels/stars-for-moves.ts
Layer: pure logic (game-kit) - nothing below it to test first.
Evidence: red run, examples + properties + a pinned value, check:fast green.
```

## 2. The first failing test, and its red run

The test comes first, with the spec quoted at the top. The unit exists only as a stub that returns a wrong but well-typed value, so the run reaches the assertion:

```ts
// packages/game-kit/src/levels/stars-for-moves.ts (stub)

/** A finished level earns one to three stars (spec 8.1). */
export type StarCount = 1 | 2 | 3;

/** Returns the stars a finished puzzle level earns for its move count and par. */
export function starsForMoves(moves: number, par: number): StarCount {
  return 1; // stub: wrong on purpose so the first run reaches the assertion
}
```

(The edit hook reports the stub's unused parameters as lint errors. That is expected for the minute until the real code uses them; never silence it, and never commit a stub. Jest does not run the linter, so the red run still reaches the assertion.)

```ts
// packages/game-kit/src/levels/stars-for-moves.test.ts
// Spec 8.1: puzzle games give 3 stars at or under par, 2 stars at par + 2, 1 star for finishing.
import { starsForMoves } from './stars-for-moves.ts';

describe('starsForMoves', () => {
  it('gives 3 stars at par (spec 8.1)', () => {
    expect(starsForMoves(7, 7)).toBe(3);
  });
});
```

`npx jest --ci packages/game-kit/src/levels/stars-for-moves.test.ts` - red for the right reason (an assertion diff, not an import or type error):

```text
FAIL unit packages/game-kit/src/levels/stars-for-moves.test.ts
  starsForMoves
    ✕ gives 3 stars at par (spec 8.1) (2 ms)

  ● starsForMoves › gives 3 stars at par (spec 8.1)

    expect(received).toBe(expected) // Object.is equality

    Expected: 3
    Received: 1
```

## 3. The minimum code, then the rest of the rule

Make that one test pass with the least code, rerun, then add the next example (under par, the two-star band, the one-star case, impossible input) one at a time, each seen red first. The finished test file has examples, a table for the band edges, the impossible inputs and two properties:

```ts
// packages/game-kit/src/levels/stars-for-moves.test.ts
// Spec 8.1: puzzle games give 3 stars at or under par, 2 stars at par + 2, 1 star for finishing.
import fc from 'fast-check';

import { starsForMoves } from './stars-for-moves.ts';

const parArb = fc.integer({ min: 1, max: 60 });
const extraArb = fc.integer({ min: 0, max: 200 });

describe('starsForMoves', () => {
  it('gives 3 stars at par (spec 8.1)', () => {
    expect(starsForMoves(7, 7)).toBe(3);
  });

  it('gives 3 stars under par', () => {
    expect(starsForMoves(5, 7)).toBe(3);
  });

  it.each([
    [8, 2],
    [9, 2],
    [10, 1],
    [40, 1],
  ] as const)('gives the right stars for %i moves at par 7', (moves, stars) => {
    expect(starsForMoves(moves, 7)).toBe(stars);
  });

  describe('when the input is impossible', () => {
    it.each([
      [0, 7],
      [7, 0],
      [2.5, 7],
    ] as const)('throws for %d moves at par %d', (moves, par) => {
      expect(() => starsForMoves(moves, par)).toThrow(RangeError);
    });
  });

  describe('properties', () => {
    it('keeps stars from rising when moves grow', () => {
      fc.assert(
        fc.property(parArb, extraArb, (par, extra) => {
          const fewer = starsForMoves(par + extra, par);
          const more = starsForMoves(par + extra + 1, par);
          expect(more).toBeLessThanOrEqual(fewer);
        }),
      );
    });

    it('returns 1, 2 or 3 for every valid input', () => {
      fc.assert(
        fc.property(parArb, extraArb, (par, extra) => {
          expect([1, 2, 3]).toContain(starsForMoves(par + extra, par));
        }),
      );
    });
  });
});
```

The code that makes all of them green:

```ts
// packages/game-kit/src/levels/stars-for-moves.ts

/** A finished level earns one to three stars (spec 8.1). */
export type StarCount = 1 | 2 | 3;

/** How far above par a level still earns 2 stars (spec 8.1: "2 stars at par +2"). */
const TWO_STAR_MARGIN = 2;

/** Returns the stars a finished puzzle level earns; throws for moves or par that cannot happen. */
export function starsForMoves(moves: number, par: number): StarCount {
  if (!Number.isInteger(moves) || !Number.isInteger(par) || moves < 1 || par < 1) {
    throw new RangeError(`moves ${String(moves)} and par ${String(par)} must be positive integers`);
  }
  if (moves <= par) {
    return 3;
  }
  return moves <= par + TWO_STAR_MARGIN ? 2 : 1;
}
```

Green:

```text
      ✓ keeps stars from rising when moves grow (3 ms)
      ✓ returns 1, 2 or 3 for every valid input (3 ms)

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
```

Notes on the choices:

- The examples pin exact values (`starsForMoves(7, 7)` is 3); the properties cover the whole input space. Both are needed: properties alone let boundary mutants survive.
- The band edges (8, 9 and 10 moves at par 7) are in a table so every limit is tested at exactly its value and one past it.
- Impossible input is a programmer error, so it throws; an expected failure (an illegal move) would be a returned value instead.
- The margin is a named constant with its spec quote, not a bare `2`.

## 4. Refactor and the fast gate

Nothing to split here (one function, well under the size limits). Run the fast gate before committing:

```sh
npm run -s check:fast
```

It runs Prettier, ESLint with no warnings allowed, every TypeScript project, and the tests related to the changed files; it must exit 0. Then run this skill's checkers:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check-tests.mjs .
```

## 5. The commit

Test and code go into one commit; the body names the spec line:

```text
feat(game-kit): give stars for moves against par

Spec 8.1: 3 stars at or under par, 2 up to par + 2, 1 for finishing.
Examples cover the band edges at par 7; properties check that more
moves never earn more stars and that the result is always 1-3.
```

After committing, prove the slice kept the history rules:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check-test-edits.mjs . --range HEAD~1..HEAD
```

## 6. What goes into the report

The slice's evidence lines (the reporting skill owns the full template):

```text
- Tests: 11/11 pass in stars-for-moves.test.ts (red run seen first: Expected 3, Received 1)
- Pure logic: 6 examples, 2 properties, pinned value starsForMoves(7, 7) = 3
- check:fast: pass
```
