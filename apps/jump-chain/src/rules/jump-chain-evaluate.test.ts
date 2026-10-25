// apps/jump-chain/src/rules/jump-chain-evaluate.test.ts
// Spec 8.13: bots play the game before anyone does. A reasonable player prefers longer chains,
// fewer enemies near their side and a landing square from which the next jump is ready.
import fc from 'fast-check';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { evaluateJumpChain } from './jump-chain-evaluate.ts';

import type { JumpChainMove, JumpChainState, Square } from './jump-chain-types.ts';

/** A level-0 state with your piece and the enemies on the given squares (ids in that order). */
function position(
  piece: Square,
  enemySquares: readonly (readonly [number, number])[],
): JumpChainState {
  const enemies = enemySquares.map(([col, row], id) => ({ id, rank: id, col, row }));
  return {
    ...create(1, 0),
    piece,
    enemies,
    total: enemies.length,
    nextId: enemies.length,
    marchIn: 5,
  };
}

function jump(...squares: readonly (readonly [number, number])[]): JumpChainMove {
  return { kind: 'jump', path: squares.map(([col, row]) => ({ col, row })) };
}

describe('evaluateJumpChain', () => {
  it('prefers the longer chain from the same position', () => {
    const state = position({ col: 2, row: 6 }, [
      [3, 5],
      [5, 3],
      [1, 1],
    ]);
    const short = applyMove(state, jump([4, 4])).state;
    const long = applyMove(state, jump([4, 4], [6, 2])).state;
    expect(evaluateJumpChain(long)).toBeGreaterThan(evaluateJumpChain(short));
  });

  it('fears an enemy near your side more than one far up the board', () => {
    const near = position({ col: 0, row: 0 }, [[3, 7]]);
    const far = position({ col: 0, row: 0 }, [[3, 1]]);
    expect(evaluateJumpChain(far)).toBeGreaterThan(evaluateJumpChain(near));
  });

  it('prefers a landing square next to an enemy, where the next jump is ready', () => {
    const ready = position({ col: 2, row: 4 }, [[3, 3]]);
    const away = position({ col: 6, row: 8 }, [[3, 3]]);
    expect(evaluateJumpChain(ready)).toBeGreaterThan(evaluateJumpChain(away));
  });

  it('keeps the pinned value of the seed-1 start (the witness and the bots play with it)', () => {
    expect(evaluateJumpChain(create(1, 0))).toBe(GOLDEN_SEED_1_VALUE);
  });

  it('gives every start a finite value, the same each time', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 100 }), (seed, difficulty) => {
        const value = evaluateJumpChain(create(seed, difficulty));
        expect(Number.isFinite(value)).toBe(true);
        expect(evaluateJumpChain(create(seed, difficulty))).toBe(value);
      }),
    );
  });
});

const GOLDEN_SEED_1_VALUE = -140;
