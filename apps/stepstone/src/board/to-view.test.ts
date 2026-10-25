// apps/stepstone/src/board/to-view.test.ts
// Spec 7.3: numbers on the board follow the chosen digits (they arrive formatted in the view).
import fc from 'fast-check';

import { create } from '@e07/stepstone/rules/create.ts';
import { targetsOf } from '@e07/stepstone/rules/hops.ts';
import { pondFromText } from '@e07/stepstone/rules/pond-text.ts';

import { CELL_CODE, KIND_OF_CODE, toView } from './to-view.ts';

import type { StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

/** The golden pond of seed 1 at difficulty 0, twelve hops into a (made-up) run. */
const STATE: StepstoneState = {
  ...pondFromText(['..r..', '.....', '..K.F', '..RK.', '.....'].join('\n')),
  moves: 12,
  par: 3,
  kindsUsed: ['rook'],
};
const PERSIAN = { formatNumber: (value: number) => new Intl.NumberFormat('fa').format(value) };
const PLAIN = { formatNumber: String };

describe('toView', () => {
  it('codes every cell, keeps the frog, lists the stones in reach and localises the hops made', () => {
    expect(toView(STATE, PERSIAN)).toStrictEqual({
      side: 5,
      cells: [0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 2, 0, 0, 4, 3, 0, 0, 0, 0, 0, 0],
      frog: 2,
      reach: [12, 17],
      movesText: '۱۲',
    });
  });

  it('gives each cell its own code and names the hop kind of each stone code', () => {
    expect(new Set(Object.values(CELL_CODE)).size).toBe(7);
    expect(KIND_OF_CODE).toStrictEqual([
      'none',
      'none',
      'none',
      'king',
      'rook',
      'bishop',
      'knight',
    ]);
  });

  it('is a pure function of the state: the rules decide which stones are in reach', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const state = create(seed, difficulty);
        const view = toView(state, PLAIN);
        expect(toView(state, PLAIN)).toStrictEqual(view);
        expect(view.reach).toStrictEqual(targetsOf(state));
        expect(view.cells).toHaveLength(state.side * state.side);
      }),
      { numRuns: 40 },
    );
  });
});
