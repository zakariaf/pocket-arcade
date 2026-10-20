// apps/jump-chain/src/board/to-view.test.ts
import { create } from '@e07/jump-chain/rules/create.ts';

import { toView } from './to-view.ts';

import type { JumpChainState, Square } from '@e07/jump-chain/rules/jump-chain-types.ts';

const PLAIN = { formatNumber: String };
const PERSIAN = { formatNumber: (value: number) => new Intl.NumberFormat('fa').format(value) };

function position(
  piece: Square,
  enemySquares: readonly (readonly [number, number])[],
): JumpChainState {
  const enemies = enemySquares.map(([col, row], id) => ({ id, rank: 0, col, row }));
  return { ...create(1, 0), piece, enemies, total: enemies.length, nextId: enemies.length };
}

describe('toView', () => {
  it('keeps the piece and the enemies on the board or waiting just above it', () => {
    const view = toView(
      position({ col: 3, row: 7 }, [
        [1, 5],
        [3, -1],
        [5, -3],
      ]),
      PLAIN,
    );
    expect([view.cols, view.rows, view.piece]).toStrictEqual([7, 10, { col: 3, row: 7 }]);
    expect(view.enemies).toStrictEqual([
      { id: 0, col: 1, row: 5 },
      { id: 1, col: 3, row: -1 },
    ]);
    expect(view.enemiesLeft).toBe(3);
  });

  it('localises the moves left until the ranks advance', () => {
    const state = { ...position({ col: 3, row: 7 }, [[3, 3]]), marchIn: 12 };
    expect(toView(state, PERSIAN)).toMatchObject({ marchIn: 12, marchInText: '۱۲' });
  });

  it('offers each end square with the path and the captures of the move a finger there plays', () => {
    const state = position({ col: 2, row: 6 }, [
      [1, 5],
      [3, 5],
      [1, 3],
      [3, 3],
      [5, 3],
    ]);
    const target = toView(state, PLAIN).targets.find((end) => end.col === 2 && end.row === 6);
    expect(target).toStrictEqual({
      col: 2,
      row: 6,
      path: [
        { col: 0, row: 4 },
        { col: 2, row: 2 },
        { col: 4, row: 4 },
        { col: 2, row: 6 },
      ],
      captured: [
        { col: 1, row: 5 },
        { col: 1, row: 3 },
        { col: 3, row: 3 },
        { col: 3, row: 5 },
      ],
    });
  });

  it('offers a step as its own square with no capture', () => {
    const view = toView(position({ col: 3, row: 7 }, [[3, 3]]), PLAIN);
    expect(view.targets.map((end) => [end.col, end.row])).toStrictEqual([
      [2, 6],
      [4, 6],
      [2, 8],
      [4, 8],
    ]);
    expect(view.targets[0]).toStrictEqual({
      col: 2,
      row: 6,
      path: [{ col: 2, row: 6 }],
      captured: [],
    });
  });

  it('offers no target once the run is over', () => {
    expect(toView(position({ col: 3, row: 7 }, []), PLAIN).targets).toStrictEqual([]);
  });
});
