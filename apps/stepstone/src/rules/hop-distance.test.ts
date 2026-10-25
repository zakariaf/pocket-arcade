// apps/stepstone/src/rules/hop-distance.test.ts
// Spec 8.1: the solver "calculates par (the best possible result)"; hopDistance is the rules' own
// shortest route, which create() records as par.
import fc from 'fast-check';

import { create } from './create.ts';
import { hopDistance } from './hop-distance.ts';
import { pondFromText } from './pond-text.ts';

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
