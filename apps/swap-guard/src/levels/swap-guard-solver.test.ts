// apps/swap-guard/src/levels/swap-guard-solver.test.ts
import fc from 'fast-check';

import { createBfsSolver } from '@e07/game-kit/solver/engine-solver.ts';
import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';
import { applyMove } from '@e07/swap-guard/rules/apply-move.ts';
import { create } from '@e07/swap-guard/rules/create.ts';
import { listMoves } from '@e07/swap-guard/rules/list-moves.ts';
import { outcome } from '@e07/swap-guard/rules/outcome.ts';
import { planLine } from '@e07/swap-guard/rules/plan-line.ts';

import { positionKey, SWAP_GUARD_SOLVER, suggestSwap, swapProblem } from './swap-guard-solver.ts';

import type {
  Enemy,
  EnemyKind,
  Facing,
  SwapGuardMove,
  SwapGuardState,
} from '@e07/swap-guard/rules/swap-guard-types.ts';

const ENGINE = { listMoves, applyMove, outcome };

/** The plain engine search: slow, but obviously right. The fast solver must agree with it. */
const ENGINE_SOLVER = createBfsSolver({ engine: ENGINE, key: positionKey });

type Piece = readonly [kind: EnemyKind, facing: Facing, cell: number];

function board(guard: number, pieces: readonly Piece[], maxSwaps = 12): SwapGuardState {
  const enemies: Enemy[] = pieces.map(([kind, facing, cell], id) => ({ id, kind, facing, cell }));
  return {
    size: 5,
    guard,
    enemies,
    enemyCount: enemies.length,
    swaps: 0,
    maxSwaps,
    score: 0,
    isHit: false,
    lastSwap: null,
    hasContinued: false,
  };
}

/** The opening pair: the spear on 11 strikes the guard on 12, the spear on 6 strikes the spear. */
const OPENING_PAIR = board(12, [
  ['spear', 'right', 11],
  ['spear', 'down', 6],
]);

function replay(start: SwapGuardState, line: readonly SwapGuardMove[]): SwapGuardState {
  return line.reduce((state, move) => applyMove(state, move).state, start);
}

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });

describe('SWAP_GUARD_SOLVER', () => {
  it('finds the double hit of the opening pair (par 1), with the state the engine reaches', () => {
    const swap: SwapGuardMove = { kind: 'swap', cell: 6 };
    expect(SWAP_GUARD_SOLVER.solve(OPENING_PAIR, 1000)).toStrictEqual({
      kind: 'solved',
      par: 1,
      line: [swap],
      final: applyMove(OPENING_PAIR, swap).state,
    });
  });

  it('solves a board with no enemy left in no swap (par 0)', () => {
    const empty = board(12, []);
    expect(SWAP_GUARD_SOLVER.solve(empty, 10)).toStrictEqual({
      kind: 'solved',
      par: 0,
      line: [],
      final: empty,
    });
  });

  it('reports a lone brute as unsolvable once every position within the budget is searched', () => {
    expect(SWAP_GUARD_SOLVER.solve(board(0, [['brute', 'up', 12]], 4), 100_000)).toStrictEqual({
      kind: 'unsolvable',
    });
  });

  it('stops at the node budget', () => {
    expect(SWAP_GUARD_SOLVER.solve(create(3, 60), 2)).toStrictEqual({ kind: 'budget-exceeded' });
  });

  describe('properties', () => {
    it('moves the pieces exactly as applyMove does', () => {
      fc.assert(
        fc.property(
          seedArb,
          fc.integer({ min: 0, max: 99 }),
          fc.nat(),
          (seed, difficulty, pick) => {
            const start = create(seed, difficulty);
            const moves = listMoves(start);
            const move = moves[pick % moves.length] ?? { kind: 'swap', cell: start.guard };
            const fast = swapProblem(start).apply(start, move);
            const real = applyMove(start, move).state;
            expect(fast).toMatchObject({
              guard: real.guard,
              enemies: real.enemies,
              swaps: real.swaps,
              isHit: real.isHit,
            });
          },
        ),
      );
    });

    it('agrees with the plain engine search on par, with a line the engine accepts', () => {
      fc.assert(
        fc.property(seedArb, fc.integer({ min: 0, max: 49 }), (seed, difficulty) => {
          const start = create(seed, difficulty);
          const fast = SWAP_GUARD_SOLVER.solve(start, 200_000);
          const plain = ENGINE_SOLVER.solve(start, 200_000);
          if (fast.kind !== 'solved' || plain.kind !== 'solved') throw new Error('not solved');
          expect(fast.par).toBe(plain.par);
          expect(verifyLine(ENGINE, start, fast.line)).toStrictEqual({
            kind: 'wins',
            moves: fast.par,
          });
        }),
        { seed: 25, numRuns: 25 },
      );
    });

    it('finds par within the planned line the budget is built on', () => {
      fc.assert(
        fc.property(seedArb, fc.integer({ min: 0, max: 49 }), (seed, difficulty) => {
          const start = create(seed, difficulty);
          const result = SWAP_GUARD_SOLVER.solve(start, 200_000);
          if (result.kind !== 'solved') throw new Error(`not solved: ${result.kind}`);
          expect(result.par).toBeLessThanOrEqual(planLine(start)?.length ?? 0);
        }),
        { seed: 26, numRuns: 25 },
      );
    });
  });
});

describe('positionKey', () => {
  it('tells a struck guard from an unhurt one on the same squares', () => {
    const state = board(12, [['spear', 'right', 3]]);
    expect(positionKey({ ...state, isHit: true })).not.toBe(positionKey(state));
  });

  it('ignores the enemies’ ids and order, the swaps made and the score', () => {
    const one = board(12, [
      ['spear', 'right', 3],
      ['archer', 'up', 20],
    ]);
    const enemies = [...one.enemies].reverse().map((enemy, id) => ({ ...enemy, id }));
    expect(positionKey({ ...one, enemies, swaps: 3, score: 250 })).toBe(positionKey(one));
  });

  it('tells two facings of the same enemy apart', () => {
    expect(positionKey(board(12, [['spear', 'up', 3]]))).not.toBe(
      positionKey(board(12, [['spear', 'down', 3]])),
    );
  });
});

describe('suggestSwap (rules.hints: the next swap of a sure line)', () => {
  it('suggests the double hit at the start of the opening pair', () => {
    expect(suggestSwap(OPENING_PAIR)).toStrictEqual({ kind: 'swap', cell: 6 });
  });

  it('keeps the level winnable from every state on the solver’s line', () => {
    const start = create(11, 30);
    const result = SWAP_GUARD_SOLVER.solve(start, 200_000);
    if (result.kind !== 'solved') throw new Error(`not solved: ${result.kind}`);
    let state = start;
    for (const move of result.line) {
      const hint = suggestSwap(state);
      expect(hint === null ? [] : [hint]).toStrictEqual(
        listMoves(state).filter((legal) => legal.cell === hint?.cell),
      );
      if (hint === null) throw new Error('no hint on the solver line');
      expect(SWAP_GUARD_SOLVER.solve(applyMove(state, hint).state, 200_000).kind).toBe('solved');
      state = applyMove(state, move).state;
    }
  });

  it('suggests the first swap of a fresh plan from a state off the solver’s line', () => {
    const start = create(11, 30);
    const detour = listMoves(start).find((move) => !applyMove(start, move).state.isHit);
    if (detour === undefined) throw new Error('no safe detour');
    const off = applyMove(start, detour).state;
    expect(suggestSwap(off)).toStrictEqual(planLine(off)?.[0] ?? null);
  });

  // Spec 8.5: "The game's solver suggests the next good move": a swap that still wins. The plan
  // cannot reach a spear on the top edge facing down from behind; the bounded search wins in four.
  it('searches for a winning swap where the plan finds no line', () => {
    const lone = board(5, [['spear', 'down', 1]]);
    expect(planLine(lone)).toBeNull();
    const hint = suggestSwap(lone);
    expect(hint).toStrictEqual({ kind: 'swap', cell: 1 });
    if (hint === null) throw new Error('no hint');
    expect(SWAP_GUARD_SOLVER.solve(applyMove(lone, hint).state, 200_000).kind).toBe('solved');
  });

  it('suggests nothing when no swap wins within the swaps left', () => {
    const tight = board(5, [['spear', 'down', 1]], 3);
    expect(suggestSwap(tight)).toBeNull();
  });

  it('suggests nothing once the level is won or lost', () => {
    const won = replay(OPENING_PAIR, [{ kind: 'swap', cell: 6 }]);
    const lost = applyMove(OPENING_PAIR, { kind: 'swap', cell: 11 }).state;
    expect(outcome(won).kind).toBe('won');
    expect(outcome(lost).kind).toBe('lost');
    expect(suggestSwap(won)).toBeNull();
    expect(suggestSwap(lost)).toBeNull();
  });
});
