// apps/swap-guard/src/rules/swap-board.test.ts
// Spec 13: the guard swaps places, then the strikes shown before the swap land. swapBoard is that
// move of the pieces alone, without applyMove's events, score and memory of the swap, for the
// searches that try every swap of a position (the planner, the par solver and the hint).
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { strikesOf, struckSquares } from './strikes.ts';
import { swapBoard } from './swap-board.ts';

import type { Enemy, EnemyKind, Facing, SwapGuardState } from './swap-guard-types.ts';

type Piece = readonly [kind: EnemyKind, facing: Facing, cell: number];

const RULES = { listMoves, applyMove };

/** A 5 x 5 board (squares 0..24, row-major) with the guard and these enemies (ids in order). */
function board(guard: number, pieces: readonly Piece[]): SwapGuardState {
  const enemies: Enemy[] = pieces.map(([kind, facing, cell], id) => ({ id, kind, facing, cell }));
  return {
    size: 5,
    guard,
    enemies,
    enemyCount: enemies.length,
    swaps: 0,
    maxSwaps: 12,
    score: 0,
    isHit: false,
    lastSwap: null,
    hasContinued: false,
  };
}

/** The guard (12) in the strike of the spear on 11, which the spear on 6 strikes; a spear on 9. */
const OPENING = board(12, [
  ['spear', 'right', 11],
  ['spear', 'down', 6],
  ['spear', 'right', 9],
]);

function struckOf(state: SwapGuardState): ReadonlySet<number> {
  return struckSquares(strikesOf(state));
}

/** applyMove's state for every listed swap, with the score and the last swap left as they were. */
function matchesApplyMove(state: SwapGuardState): boolean {
  const struck = struckOf(state);
  return listMoves(state).every((move) => {
    const played = applyMove(state, move).state;
    const expected = { ...played, score: state.score, lastSwap: state.lastSwap };
    return JSON.stringify(swapBoard(state, move.cell, struck)) === JSON.stringify(expected);
  });
}

describe('swapBoard (spec 13: the swap, then the strikes shown before it land)', () => {
  it('moves the enemy to the guard square and knocks out every enemy on a struck square', () => {
    expect(swapBoard(OPENING, 6, struckOf(OPENING))).toStrictEqual(GOLDEN_DOUBLE_HIT_BOARD);
  });

  it('steps onto an empty square and still lands the strikes', () => {
    const next = swapBoard(OPENING, 13, struckOf(OPENING));
    expect(next.guard).toBe(13);
    expect(next.isHit).toBe(false);
    expect(next.enemies.map((enemy) => enemy.id)).toStrictEqual([1, 2]);
  });

  it('hits the guard who ends the swap on a struck square', () => {
    expect(swapBoard(OPENING, 11, struckOf(OPENING)).isHit).toBe(true);
  });

  it('keeps the score and the last swap, and never changes its input', () => {
    const frozen = JSON.stringify(OPENING);
    const next = swapBoard(OPENING, 6, struckOf(OPENING));
    expect(next.score).toBe(0);
    expect(next.lastSwap).toBeNull();
    expect(JSON.stringify(OPENING)).toBe(frozen);
  });

  it('gives applyMove state for every listed swap of a played run, but for score and memory', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.nat(), { maxLength: 30 }),
        (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          expect(states.every(matchesApplyMove)).toBe(true);
        },
      ),
    );
  });
});

const GOLDEN_DOUBLE_HIT_BOARD: SwapGuardState = {
  size: 5,
  guard: 6,
  enemies: [{ id: 2, kind: 'spear', facing: 'right', cell: 9 }],
  enemyCount: 3,
  swaps: 1,
  maxSwaps: 12,
  score: 0,
  isHit: false,
  lastSwap: null,
  hasContinued: false,
};
