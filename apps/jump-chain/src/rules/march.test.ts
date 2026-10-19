// apps/jump-chain/src/rules/march.test.ts
// The enemy ranks advance one row (two squares straight down) every marchEvery moves; an empty
// board pulls the next waiting rank in at once; the endless run always keeps one rank waiting.
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { create } from './create.ts';
import { knobsFor } from './jump-chain-tuning.ts';
import { WAITING_ROW, advanceRanks, marchRanks } from './march.ts';

import type { JumpChainState, Square } from './jump-chain-types.ts';

type EnemySpec = readonly [col: number, row: number, rank?: number];

function position(
  piece: Square,
  enemySquares: readonly EnemySpec[],
  overrides: Partial<JumpChainState> = {},
): JumpChainState {
  const enemies = enemySquares.map(([col, row, rank = 0], id) => ({ id, rank, col, row }));
  return {
    ...create(1, 0),
    piece,
    enemies,
    total: enemies.length,
    nextId: enemies.length,
    ...overrides,
  };
}

describe('marchRanks', () => {
  it('moves the front enemies first so the ones behind follow into their squares', () => {
    const { state, shifts } = marchRanks(
      position({ col: 0, row: 0 }, [
        [1, 3],
        [1, 5],
      ]),
    );
    expect(state.enemies.map((enemy) => enemy.row)).toStrictEqual([5, 7]);
    expect(shifts.map((shift) => shift.enemyId)).toStrictEqual([1, 0]);
  });

  it('lets an enemy wait when your piece holds its square', () => {
    const { state, shifts } = marchRanks(
      position({ col: 1, row: 7 }, [
        [1, 5],
        [3, 5],
      ]),
    );
    expect(state.enemies.map((enemy) => enemy.row)).toStrictEqual([5, 7]);
    expect(shifts).toStrictEqual([{ enemyId: 1, col: 3, fromRow: 5, toRow: 7 }]);
  });
});

describe('advanceRanks', () => {
  it('leaves the ranks where they are while the march clock still runs', () => {
    const state = position({ col: 0, row: 0 }, [[1, 5]], { marchIn: 2 });
    expect(advanceRanks(state)).toStrictEqual({ state, events: [] });
  });

  it('pulls the next waiting rank onto an empty board at once', () => {
    const state = position({ col: 0, row: 8 }, [[3, -3, 2]], { marchIn: 2 });
    const { state: next, events } = advanceRanks(state);
    expect(next.enemies[0]?.row).toBe(1);
    expect(events.map((event) => event.kind)).toStrictEqual(['ranks-advanced', 'ranks-advanced']);
    expect(next.marchIn).toBe(knobsFor(0).marchEvery);
  });

  it('stops pulling when nothing can move: your piece holds the way in', () => {
    const state = position(
      { col: 3, row: 1 },
      [
        [3, -1, 1],
        [3, -3, 2],
      ],
      { marchIn: 2 },
    );
    const { state: next, events } = advanceRanks(state);
    expect(next.enemies.map((enemy) => enemy.row)).toStrictEqual([-1, -3]);
    expect(events).toStrictEqual([]);
  });

  it('keeps one rank waiting above the board in the endless run', () => {
    const start = create(3, ENDLESS_DIFFICULTY);
    const { state: next, events } = advanceRanks({
      ...start,
      piece: { col: 0, row: 8 },
      marchIn: 0,
    });
    expect(next.enemies.filter((enemy) => enemy.row === WAITING_ROW).length).toBeGreaterThan(0);
    expect(events.map((event) => event.kind)).toStrictEqual(['ranks-advanced', 'rank-spawned']);
    expect(WAITING_ROW).toBe(-1);
  });

  it('keeps every enemy on its column and an odd row, and the ids unique', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 100 }), (seed, difficulty) => {
        const start = create(seed, difficulty);
        const { state } = advanceRanks({ ...start, marchIn: 0 });
        const columns = new Map(start.enemies.map((enemy) => [enemy.id, enemy.col]));
        expect(state.enemies.every((enemy) => Math.abs(enemy.row % 2) === 1)).toBe(true);
        expect(
          state.enemies.every((enemy) => (columns.get(enemy.id) ?? enemy.col) === enemy.col),
        ).toBe(true);
        expect(new Set(state.enemies.map((enemy) => enemy.id)).size).toBe(state.enemies.length);
      }),
    );
  });
});
