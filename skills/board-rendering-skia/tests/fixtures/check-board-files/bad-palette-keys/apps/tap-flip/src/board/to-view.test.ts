// apps/tap-flip/src/board/to-view.test.ts
import { toView } from './to-view.ts';

import type { TapFlipState } from '@e07/tap-flip/rules/tap-flip-types.ts';

const STATE: TapFlipState = {
  cols: 3,
  rows: 3,
  cells: [0, 1, 0, 1, 1, 1, 0, 1, 0],
  moves: 2,
  maxMoves: 14,
};
const PERSIAN = { formatNumber: (value: number) => new Intl.NumberFormat('fa').format(value) };

describe('toView', () => {
  it('keeps the grid and localises the moves left', () => {
    expect(toView(STATE, PERSIAN)).toStrictEqual({
      cols: 3,
      rows: 3,
      cells: STATE.cells,
      movesLeftText: '۱۲',
    });
  });

  it('clamps the moves left at zero', () => {
    expect(toView({ ...STATE, moves: 15 }, { formatNumber: String }).movesLeftText).toBe('0');
  });
});
