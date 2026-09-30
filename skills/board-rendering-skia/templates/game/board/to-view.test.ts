// apps/__GAME_ID__/src/board/to-view.test.ts
import { toView } from './to-view.ts';

import type { __GAME_PASCAL__State } from '@e07/__GAME_ID__/rules/__GAME_ID__-types.ts';

const STATE: __GAME_PASCAL__State = {
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
