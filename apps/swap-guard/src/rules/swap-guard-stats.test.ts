// apps/swap-guard/src/rules/swap-guard-stats.test.ts
// Spec 10 STATISTICS and S10: the game card shows Enemies defeated (sum), Swaps made (sum) and
// Double hits (sum), measured from each kept move's events.
import { SWAP_GUARD_TEACHING } from '@e07/swap-guard/tutorial/swap-guard-teaching.ts';

import { applyMove } from './apply-move.ts';
import { SWAP_GUARD_STATS } from './swap-guard-stats.ts';

import type { SwapGuardEvent } from './swap-guard-types.ts';

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

  it('gives the same counters when the kept line is replayed', () => {
    expect(countersOfTutorial()).toStrictEqual(countersOfTutorial());
  });
});
