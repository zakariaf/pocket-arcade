// apps/swap-guard/src/rules/plan-line.test.ts
// Spec 8.1: "each level is checked by a solver before it ships, so no level is impossible". The
// daily challenge is generated on the phone, so create itself only keeps a start for which this
// planner finds a winning line (the exact par still comes from the BFS solver of the levels).
import fc from 'fast-check';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { outcome } from './outcome.ts';
import { PLAN_HORIZON, planLine, simpleLine } from './plan-line.ts';

import type {
  Enemy,
  EnemyKind,
  Facing,
  SwapGuardMove,
  SwapGuardState,
} from './swap-guard-types.ts';

type Piece = readonly [kind: EnemyKind, facing: Facing, cell: number];

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

function replay(start: SwapGuardState, line: readonly SwapGuardMove[]): SwapGuardState {
  return line.reduce((state, move) => applyMove(state, move).state, start);
}

const cellsOf = (line: readonly SwapGuardMove[] | null): number[] | null =>
  line === null ? null : line.map((move) => move.cell);

describe('planLine', () => {
  it('takes the double hit, walks behind the last spear and sends it into its own strike', () => {
    const start = board(12, [
      ['spear', 'right', 11],
      ['spear', 'down', 6],
      ['spear', 'right', 3],
    ]);
    expect(cellsOf(planLine(start))).toStrictEqual(GOLDEN_OPENING_LINE);
  });

  it('wins every board it plans for', () => {
    const start = board(12, [
      ['spear', 'right', 11],
      ['spear', 'down', 6],
      ['spear', 'right', 3],
    ]);
    const line = planLine(start) ?? [];
    expect(outcome(replay(start, line)).kind).toBe('won');
  });

  it('gives up on a lone spear that faces away from an edge it stands on', () => {
    expect(planLine(board(12, [['spear', 'right', 10]]))).toBeNull();
  });

  it('gives up on a lone brute (it cannot be sent into its own strike)', () => {
    expect(planLine(board(0, [['brute', 'up', 12]]))).toBeNull();
  });

  it('gives up when the swaps run out first', () => {
    const start = { ...board(20, [['spear', 'right', 3]]), maxSwaps: 3 };
    expect(planLine(start)).toBeNull();
  });

  describe('properties', () => {
    it('wins whenever the simple plan does, never with more swaps', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4_294_967_295 }),
          fc.integer({ min: 0, max: 100 }),
          (seed, difficulty) => {
            const start = { ...create(seed, difficulty), maxSwaps: PLAN_HORIZON };
            const simple = simpleLine(start);
            const planned = planLine(start);
            if (simple === null) return;
            expect(planned).not.toBeNull();
            expect(planned?.length ?? Number.NaN).toBeLessThanOrEqual(simple.length);
          },
        ),
      );
    });

    it('plans a winning line for every start create makes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4_294_967_295 }),
          fc.integer({ min: 0, max: 100 }),
          (seed, difficulty) => {
            const start = create(seed, difficulty);
            const line = planLine(start);
            expect(line).not.toBeNull();
            expect(outcome(replay(start, line ?? [])).kind).toBe('won');
          },
        ),
      );
    });
  });
});

const GOLDEN_OPENING_LINE = [6, 2, 3, 2];
