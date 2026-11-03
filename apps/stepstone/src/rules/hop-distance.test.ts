// apps/stepstone/src/rules/hop-distance.test.ts
// Spec 8.1: the solver "calculates par (the best possible result)"; hopDistance is the rules' own
// shortest route, which create() records as par.
import fc from 'fast-check';

import { create } from './create.ts';
import { hopDistance, hopRoute } from './hop-distance.ts';
import { pondFromText } from './pond-text.ts';

/** The rook at 0 reaches the king at 4 (water all round) and the rook at 10, which sees the flag. */
const FORK = pondFromText(['r...K', '.....', 'R...F', '.....', '.....'].join('\n'));

describe('hopRoute', () => {
  it('lists the stones of the first shortest route breadth-first finds, ending on the flag', () => {
    expect(hopRoute(FORK, 49)).toStrictEqual(GOLDEN_FORK_ROUTE);
  });

  it('is empty on the flag, unsolvable with no route, and stops at the stone budget', () => {
    expect(hopRoute(pondFromText(['f.', '.R'].join('\n')), 1)).toStrictEqual({
      kind: 'solved',
      par: 0,
      line: [],
      final: 0,
    });
    expect(hopRoute(pondFromText(['k..', '...', '..F'].join('\n')), 9)).toStrictEqual({
      kind: 'unsolvable',
    });
    expect(hopRoute(FORK, 1)).toStrictEqual({ kind: 'budget-exceeded' });
  });

  it('gives hopDistance its length on every generated pond (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 100 }),
        (seed, difficulty) => {
          const pond = create(seed, difficulty);
          const route = hopRoute(pond, pond.cells.length);
          expect(route.kind === 'solved' ? route.par : null).toBe(hopDistance(pond));
          expect(route.kind === 'solved' ? route.line.length : null).toBe(pond.par);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('hopDistance', () => {
  it('counts the fewest hops to the flag, changing hop on the way', () => {
    // rook to the bishop in its row, then the bishop's diagonal to the flag
    expect(
      hopDistance(pondFromText(['r.B..', '.....', '....F', '.....', '.....'].join('\n'))),
    ).toBe(2);
  });

  it('is 0 on the flag and 1 when the flag is in reach', () => {
    expect(hopDistance(pondFromText(['f.', '.R'].join('\n')))).toBe(0);
    expect(hopDistance(pondFromText(['r.F', '...', '...'].join('\n')))).toBe(1);
  });

  it('is null when no route is left', () => {
    expect(hopDistance(pondFromText(['k..', '...', '..F'].join('\n')))).toBeNull();
  });

  it('hops over water and sunk stones but never lands on them', () => {
    expect(hopDistance(pondFromText(['r~F', '~..', '...'].join('\n')))).toBe(1);
    expect(hopDistance(pondFromText(['k~.', '~~.', '..F'].join('\n')))).toBeNull();
  });

  it('is at least 1 at every start: the frog never starts on the flag', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 100 }),
        (seed, difficulty) => {
          expect(hopDistance(create(seed, difficulty))).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

const GOLDEN_FORK_ROUTE = { kind: 'solved', par: 2, line: [10, 14], final: 14 };
