// apps/swap-guard/src/testing/swap-guard-bot.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { create } from '@e07/swap-guard/rules/create.ts';
import { listMoves } from '@e07/swap-guard/rules/list-moves.ts';

import {
  evaluateSwapGuard,
  scoreOfSwapGuard,
  swapGuardBot,
  tagSwapGuardEvent,
} from './swap-guard-bot.ts';

import type {
  Enemy,
  EnemyKind,
  Facing,
  SwapGuardState,
} from '@e07/swap-guard/rules/swap-guard-types.ts';

type Piece = readonly [kind: EnemyKind, facing: Facing, cell: number];

/** A 5 x 5 board (squares 0..24, row-major) with the guard and these enemies (ids in order). */
function board(guard: number, pieces: readonly Piece[]): SwapGuardState {
  const enemies: Enemy[] = pieces.map(([kind, facing, cell], id) => ({ id, kind, facing, cell }));
  return {
    size: 5,
    guard,
    enemies,
    enemyCount: 3,
    swaps: 2,
    maxSwaps: 12,
    score: 100,
    isHit: false,
    lastSwap: null,
    hasContinued: false,
  };
}

/** The guard on 12; the spear on 6 strikes the spear on 11, which strikes the guard. */
const OPENING = board(12, [
  ['spear', 'right', 11],
  ['spear', 'down', 6],
]);

describe('evaluateSwapGuard', () => {
  it('ranks a win above every board and a loss below every board', () => {
    const won = { ...OPENING, enemies: [] };
    const lost = { ...OPENING, isHit: true };
    expect(evaluateSwapGuard(won)).toBeGreaterThan(evaluateSwapGuard(OPENING));
    expect(evaluateSwapGuard(lost)).toBeLessThan(evaluateSwapGuard(OPENING));
  });

  it('values enemies knocked out above everything a board only promises', () => {
    const fewer = board(0, [['spear', 'up', 24]]);
    expect(evaluateSwapGuard(fewer)).toBeGreaterThan(evaluateSwapGuard(OPENING));
  });

  it('prefers enemies standing in other enemies strikes', () => {
    const doomed = board(0, [
      ['spear', 'right', 11],
      ['spear', 'down', 6],
    ]);
    const calm = board(0, [
      ['spear', 'right', 11],
      ['spear', 'up', 6],
    ]);
    expect(evaluateSwapGuard(doomed)).toBeGreaterThan(evaluateSwapGuard(calm));
  });

  it('prefers the guard outside every strike', () => {
    const safe = board(14, [['archer', 'down', 2]]);
    const struck = board(12, [['archer', 'down', 2]]);
    expect(evaluateSwapGuard(safe)).toBeGreaterThan(evaluateSwapGuard(struck));
  });
});

describe('scoreOfSwapGuard', () => {
  it('reports the score the top bar shows', () => {
    expect(scoreOfSwapGuard(OPENING)).toBe(100);
  });
});

describe('tagSwapGuardEvent', () => {
  it('tags a knock-out as the payoff and two at once as the twist too', () => {
    expect(
      tagSwapGuardEvent({ kind: 'enemies-defeated', enemyIds: [1], cells: [3] }),
    ).toStrictEqual(['payoff']);
    expect(
      tagSwapGuardEvent({ kind: 'enemies-defeated', enemyIds: [0, 1], cells: [3, 4] }),
    ).toStrictEqual(['payoff', 'twist']);
    expect(
      tagSwapGuardEvent({ kind: 'pieces-swapped', from: 1, to: 2, enemyId: null }),
    ).toStrictEqual([]);
  });
});

describe('swapGuardBot', () => {
  it('takes the swap that makes the two enemies hit each other', () => {
    const choice = swapGuardBot(OPENING, listMoves(OPENING), seedRng(1));
    expect(choice.move).toStrictEqual({ kind: 'swap', cell: 6 });
  });

  it('plays only listed moves on a real level', () => {
    const start = create(7, 40);
    const moves = listMoves(start);
    expect(moves).toContainEqual(swapGuardBot(start, moves, seedRng(7)).move);
  });
});
