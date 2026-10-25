// apps/jump-chain/src/board/to-view.test.ts
import { continueAfterLoss } from '@e07/jump-chain/rules/continue-run.ts';
import { create } from '@e07/jump-chain/rules/create.ts';
import { WAITING_ROW } from '@e07/jump-chain/rules/march.ts';

import { enemyEntity } from './board-ids.ts';
import { buildTimeline } from './build-timeline.ts';
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

  // Spec 8.10: the continue steps the ranks back one row; the waiting rank slides up out of sight.
  it('keeps the enemies the continue moves out of the waiting row, so they slide away', () => {
    const lost = position({ col: 3, row: 7 }, [
      [1, 9],
      [3, -1],
      [5, -1],
    ]);
    const stepped = continueAfterLoss(lost);
    const fromWaiting = buildTimeline(stepped.events, 'full').filter(
      (track) => track.channel === 'march' && (track.from[0] ?? 0) >= WAITING_ROW,
    );
    const shown = toView(stepped.state, PLAIN).enemies.map((enemy) => enemyEntity(enemy.id));
    expect(fromWaiting.map((track) => track.entityId)).toStrictEqual([
      enemyEntity(1),
      enemyEntity(2),
      enemyEntity(0),
    ]);
    for (const track of fromWaiting) expect(shown).toContain(track.entityId);
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
    const target = toView(state, PLAIN).targets.find((end) => end.col === 6 && end.row === 2);
    expect(target).toStrictEqual({
      col: 6,
      row: 2,
      path: [
        { col: 0, row: 4 },
        { col: 2, row: 2 },
        { col: 4, row: 4 },
        { col: 6, row: 2 },
      ],
      captured: [
        { col: 1, row: 5 },
        { col: 1, row: 3 },
        { col: 3, row: 3 },
        { col: 5, row: 3 },
      ],
    });
  });

  it('offers no target on the piece’s own square, where a released drag cancels', () => {
    const state = position({ col: 2, row: 6 }, [
      [1, 5],
      [3, 5],
      [1, 3],
      [3, 3],
      [5, 3],
    ]);
    const ends = toView(state, PLAIN).targets.map((end) => [end.col, end.row]);
    expect(ends).toStrictEqual([
      [0, 4],
      [2, 2],
      [4, 4],
      [6, 2],
    ]);
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
