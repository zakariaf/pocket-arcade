// apps/line-siege/src/rules/list-moves.test.ts
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';

import type { Cell, LineSiegeState } from './line-siege-types.ts';

function onlyFree(state: LineSiegeState, free: readonly number[]): LineSiegeState {
  const cells = state.cells.map((_, index): Cell => (free.includes(index) ? 0 : 1));
  return { ...state, cells };
}

describe('listMoves', () => {
  it('lists every fitting anchor of every offered block, slot by slot, row by row', () => {
    const state = onlyFree({ ...create(1, 0), tray: [0, 1, null] }, [3, 4, 20]);
    expect(listMoves(state)).toStrictEqual([
      { kind: 'place-block', trayIndex: 0, col: 3, row: 0 },
      { kind: 'place-block', trayIndex: 0, col: 4, row: 0 },
      { kind: 'place-block', trayIndex: 0, col: 4, row: 2 },
      { kind: 'place-block', trayIndex: 1, col: 3, row: 0 },
    ]);
  });

  it('lists nothing once the run is lost', () => {
    expect(listMoves({ ...create(1, 0), hearts: 0 })).toStrictEqual([]);
  });

  it('keeps the pinned move count of the seed 1 opening', () => {
    expect(listMoves(create(1, 0))).toHaveLength(GOLDEN_SEED_1_MOVE_COUNT);
  });
});

const GOLDEN_SEED_1_MOVE_COUNT = 91;
