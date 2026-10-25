// apps/stepstone/src/rules/pond-text.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { kindsIn, pondFromText, pondText } from './pond-text.ts';

describe('pondText', () => {
  it('draws one letter per cell, the frog in lower case', () => {
    const pond = {
      side: 3,
      cells: [
        'rook',
        'water',
        'flag',
        'sunk',
        'king',
        'bishop',
        'knight',
        'water',
        'rook',
      ] as const,
      frog: 4,
    };
    expect(pondText(pond)).toBe(['R.F', '~kB', 'N.R'].join('\n'));
  });
});

describe('pondFromText', () => {
  it('reads a pond back from its text', () => {
    expect(pondFromText(['R.F', '~kB', 'N.R'].join('\n'))).toStrictEqual({
      side: 3,
      cells: ['rook', 'water', 'flag', 'sunk', 'king', 'bishop', 'knight', 'water', 'rook'],
      frog: 4,
    });
  });

  it('throws on an unknown letter and on a pond that is not square', () => {
    expect(() => pondFromText(['RX', 'kF'].join('\n'))).toThrow(RangeError);
    expect(() => pondFromText(['RRR', 'kF'].join('\n'))).toThrow(RangeError);
  });

  it('reads back every created pond unchanged', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 100 }),
        (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(pondFromText(pondText(state))).toStrictEqual({
            side: state.side,
            cells: state.cells,
            frog: state.frog,
          });
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe('kindsIn', () => {
  it('lists the hop kinds the stones carry, in the order king, rook, bishop, knight', () => {
    expect(kindsIn(pondFromText(['NrF', '...', 'B.N'].join('\n')).cells)).toStrictEqual([
      'rook',
      'bishop',
      'knight',
    ]);
  });
});
