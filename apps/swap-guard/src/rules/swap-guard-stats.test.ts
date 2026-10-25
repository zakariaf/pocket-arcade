// apps/swap-guard/src/rules/swap-guard-stats.test.ts
// Spec 10 STATISTICS and S10: the game card shows Enemies defeated (sum), Swaps made (sum) and
// Double hits (sum), measured from each kept move's events.

import fc from 'fast-check';

import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { SWAP_GUARD_TEACHING } from '@e07/swap-guard/tutorial/swap-guard-teaching.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { SWAP_GUARD_STATS } from './swap-guard-stats.ts';

import type { SwapGuardEvent, SwapGuardState } from './swap-guard-types.ts';

/** A double hit: the swap, the volley, two enemies knocked out. */
const DOUBLE_HIT: readonly SwapGuardEvent[] = [
  { kind: 'pieces-swapped', from: 0, to: 6, enemyId: 1 },
  {
    kind: 'strikes-landed',
    strikes: [
      { enemyId: 0, cells: [0] },
      { enemyId: 1, cells: [1] },
    ],
  },
  { kind: 'enemies-defeated', enemyIds: [0, 1], cells: [0, 1] },
];
/** A step onto an empty tile that knocks nobody out. */
const STEP: readonly SwapGuardEvent[] = [
  { kind: 'pieces-swapped', from: 6, to: 12, enemyId: null },
  { kind: 'strikes-landed', strikes: [{ enemyId: 2, cells: [14] }] },
];
/** A volley that knocks out one enemy: no double hit. */
const SINGLE: readonly SwapGuardEvent[] = [
  { kind: 'pieces-swapped', from: 13, to: 12, enemyId: 2 },
  { kind: 'strikes-landed', strikes: [{ enemyId: 2, cells: [13] }] },
  { kind: 'enemies-defeated', enemyIds: [2], cells: [13] },
];

/** Folds each step's events as the Shell's run end does: every kept move and the continue. */
function fold(steps: readonly (readonly SwapGuardEvent[])[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const events of steps) {
    for (const counter of SWAP_GUARD_STATS.counters) {
      const measured = counter.measure(events);
      const previous = tally[counter.id] ?? 0;
      tally[counter.id] =
        counter.aggregate === 'sum' ? previous + measured : Math.max(previous, measured);
    }
  }
  return tally;
}

/**
 * 5 x 5, the guard on 12. The spear on 11 strikes 12 and the spear on 6 strikes 11; the spear on 8
 * strikes the spear on 13. A swap with the spear on 11 knocks out two spears and is hit.
 */
const DOUBLE_THEN_HIT: SwapGuardState = {
  size: 5,
  guard: 12,
  enemies: [
    { id: 0, kind: 'spear', facing: 'right', cell: 11 },
    { id: 1, kind: 'spear', facing: 'down', cell: 6 },
    { id: 2, kind: 'spear', facing: 'down', cell: 8 },
    { id: 3, kind: 'spear', facing: 'right', cell: 13 },
  ],
  enemyCount: 4,
  swaps: 0,
  maxSwaps: 12,
  score: 0,
  isHit: false,
  lastSwap: null,
  hasContinued: false,
};

/** Seeded random swaps until the run ends, with the one continue taken after a loss. */
function playWithContinue(
  seed: number,
  difficulty: number,
): {
  readonly state: SwapGuardState;
  readonly steps: readonly (readonly SwapGuardEvent[])[];
} {
  let state = create(seed, difficulty);
  let rng = seedRng(seed);
  const steps: (readonly SwapGuardEvent[])[] = [];
  for (let turn = 0; turn < 200; turn += 1) {
    const result = outcome(state);
    if (result.kind === 'won' || (result.kind === 'lost' && state.hasContinued)) break;
    const next =
      result.kind === 'lost'
        ? continueAfterLoss(state)
        : (() => {
            const moves = listMoves(state);
            const pick = nextInt(rng, moves.length);
            rng = pick.state;
            return applyMove(state, pickAt(moves, pick.value));
          })();
    steps.push(next.events);
    state = next.state;
  }
  return { state, steps };
}

/** Measures each move of the tutorial's kept line and folds it as the Shell does (sum or max). */
function countersOfTutorial(): Record<string, number> {
  const { start, steps } = SWAP_GUARD_TEACHING.tutorial;
  let state = start;
  const tally: Record<string, number> = {};
  for (const step of steps) {
    if (step.expect.kind !== 'move') continue;
    const { state: next, events } = applyMove(state, step.expect.move);
    for (const counter of SWAP_GUARD_STATS.counters) {
      const measured = counter.measure(events);
      const previous = tally[counter.id] ?? 0;
      tally[counter.id] =
        counter.aggregate === 'sum' ? previous + measured : Math.max(previous, measured);
    }
    state = next;
  }
  return tally;
}

describe('SWAP_GUARD_STATS', () => {
  it('declares the three counters of the S10 card with their labels and aggregates', () => {
    const declared = SWAP_GUARD_STATS.counters.map(({ id, labelId, aggregate }) => [
      id,
      labelId,
      aggregate,
    ]);
    expect(declared).toStrictEqual([
      ['enemies-defeated', 'swap-guard.stats.enemies-defeated', 'sum'],
      ['swaps-made', 'swap-guard.stats.swaps-made', 'sum'],
      ['double-hits', 'swap-guard.stats.double-hits', 'sum'],
    ]);
  });

  it('measures a double hit: two enemies down, one swap, one double hit', () => {
    expect(SWAP_GUARD_STATS.counters.map((c) => c.measure(DOUBLE_HIT))).toStrictEqual([2, 1, 1]);
  });

  it('measures a step: one swap and nothing else', () => {
    expect(SWAP_GUARD_STATS.counters.map((c) => c.measure(STEP))).toStrictEqual([0, 1, 0]);
  });

  it('measures a single knock-out as no double hit, and nothing for no events', () => {
    expect(SWAP_GUARD_STATS.counters.map((c) => c.measure(SINGLE))).toStrictEqual([1, 1, 0]);
    expect(SWAP_GUARD_STATS.counters.map((c) => c.measure([]))).toStrictEqual([0, 0, 0]);
  });

  it('counts the tutorial line once: three enemies, four swaps, one double hit', () => {
    expect(countersOfTutorial()).toStrictEqual({
      'enemies-defeated': 3,
      'swaps-made': 4,
      'double-hits': 1,
    });
  });

  // Spec 8.10: the continue undoes the last swap, so its volley never counts (spec S10).
  it('takes back a double knockout the continue undid', () => {
    const swap = applyMove(DOUBLE_THEN_HIT, { kind: 'swap', cell: 11 });
    expect(outcome(swap.state).kind).toBe('lost');
    expect(fold([swap.events])).toStrictEqual({
      'enemies-defeated': 2,
      'swaps-made': 1,
      'double-hits': 1,
    });
    const continued = continueAfterLoss(swap.state);
    expect(fold([swap.events, continued.events])).toStrictEqual({
      'enemies-defeated': 0,
      'swaps-made': 0,
      'double-hits': 0,
    });
  });

  it('counts exactly the enemies a finished run knocked out, continue or not', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 99 }),
        (seed, difficulty) => {
          const { state, steps } = playWithContinue(seed, difficulty);
          const tally = fold(steps);
          expect(tally['enemies-defeated']).toBe(state.enemyCount - state.enemies.length);
          expect(tally['swaps-made']).toBe(state.swaps);
        },
      ),
    );
  });

  it('gives the same counters when the kept line is replayed', () => {
    expect(countersOfTutorial()).toStrictEqual(countersOfTutorial());
  });
});
