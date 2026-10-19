// apps/jump-chain/src/rules/continue-run.test.ts
// Spec 8.10: "Games may allow one continue per level or run: for example the monsters are pushed
// back one row". Jump Chain's one continue steps the enemy ranks back one row (two squares, so
// they stay on the dark squares) and restarts the march clock.
import fc from 'fast-check';

import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { knobsFor } from './jump-chain-tuning.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { JumpChainState, Square } from './jump-chain-types.ts';

const MAX_MOVES = 300;

/** Seeded random play until the run ends (the march keeps the pressure rising, so it ends). */
function playToEnd(seed: number, difficulty: number): JumpChainState {
  let state = create(seed, difficulty);
  let rng = seedRng(seed);
  for (let moves = 0; moves < MAX_MOVES && outcome(state).kind === 'playing'; moves += 1) {
    const legal = listMoves(state);
    const pick = nextInt(rng, legal.length);
    rng = pick.state;
    state = applyMove(state, pickAt(legal, pick.value)).state;
  }
  return state;
}

function lostWith(
  piece: Square,
  enemySquares: readonly (readonly [number, number])[],
): JumpChainState {
  const enemies = enemySquares.map(([col, row], id) => ({ id, rank: 0, col, row }));
  return {
    ...create(1, 0),
    piece,
    enemies,
    total: enemies.length,
    nextId: enemies.length,
    marchIn: 0,
  };
}

describe('continueAfterLoss', () => {
  it('steps every enemy back one row, the top first, and restarts the march clock', () => {
    const lost = lostWith({ col: 0, row: 6 }, [
      [3, 9],
      [1, 7],
      [5, 3],
    ]);
    const { state, events } = continueAfterLoss(lost);
    expect(outcome(state).kind).toBe('playing');
    expect(state.enemies.map((enemy) => enemy.row)).toStrictEqual([7, 5, 1]);
    expect(state).toMatchObject({ marchIn: knobsFor(0).marchEvery, hasContinued: true });
    expect(events).toStrictEqual(GOLDEN_STEP_BACK);
  });

  it('moves an enemy further up when your piece or another enemy holds its square', () => {
    const lost = lostWith({ col: 3, row: 7 }, [
      [3, 9],
      [5, 9],
      [5, 5],
    ]);
    const { state } = continueAfterLoss(lost);
    expect(state.enemies.map((enemy) => [enemy.col, enemy.row])).toStrictEqual([
      [3, 5],
      [5, 7],
      [5, 3],
    ]);
  });

  it('refuses a second continue in the same run and a continue of a run still in play', () => {
    const once = continueAfterLoss(lostWith({ col: 0, row: 6 }, [[3, 9]])).state;
    const lostAgain = { ...once, enemies: [{ id: 0, rank: 0, col: 3, row: 9 }] };
    expect(() => continueAfterLoss(lostAgain)).toThrow(RangeError);
    expect(() => continueAfterLoss(create(1, 0))).toThrow(RangeError);
  });

  it('makes every lost run playable again, at every difficulty', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 100 }), (seed, difficulty) => {
        const lost = playToEnd(seed, difficulty);
        fc.pre(outcome(lost).kind === 'lost');
        const { state } = continueAfterLoss(lost);
        expect(outcome(state).kind).toBe('playing');
        expect(listMoves(state).length).toBeGreaterThan(0);
      }),
      { numRuns: 60 },
    );
  });
});

const GOLDEN_STEP_BACK = [
  {
    kind: 'ranks-stepped-back',
    shifts: [
      { enemyId: 2, col: 5, fromRow: 3, toRow: 1 },
      { enemyId: 1, col: 1, fromRow: 7, toRow: 5 },
      { enemyId: 0, col: 3, fromRow: 9, toRow: 7 },
    ],
  },
];
