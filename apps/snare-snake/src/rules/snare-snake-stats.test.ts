// apps/snare-snake/src/rules/snare-snake-stats.test.ts
// Spec 10 STATISTICS and S10: the game card shows Critters caught (sum), Loops closed (sum) and
// Longest snake (max), measured from each kept move's events.
import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { SNARE_SNAKE_STATS } from './snare-snake-stats.ts';

import type { Direction, SnareSnakeEvent } from './snare-snake-types.ts';

/** A loop of four cells: three segments spent, two critters snared, seven segments left. */
const LOOP_MOVE: readonly SnareSnakeEvent[] = [
  { kind: 'loop-closed', loop: [38, 39, 32, 25], enclosed: [], spent: 3, length: 7 },
  { kind: 'critters-caught', critterIds: [0, 1], cells: [24, 31], count: 2, points: 40 },
];
const PLAIN_STEP: readonly SnareSnakeEvent[] = [
  { kind: 'snake-moved', from: 32, to: 39, vacated: null, length: 11 },
  { kind: 'critters-moved', hops: [{ critterId: 3, from: 46, to: 45 }] },
];

/** Measures each move of a kept move line and folds it as the Shell does (sum or max). */
function countersOfLine(seed: number, line: readonly Direction[]): Record<string, number> {
  let state = create(seed, 0);
  const tally: Record<string, number> = {};
  for (const direction of line) {
    const { state: next, events } = applyMove(state, { kind: 'steer', direction });
    for (const counter of SNARE_SNAKE_STATS.counters) {
      const measured = counter.measure(events);
      const previous = tally[counter.id] ?? 0;
      tally[counter.id] =
        counter.aggregate === 'sum' ? previous + measured : Math.max(previous, measured);
    }
    state = next;
  }
  return tally;
}

/** The tutorial's line (a loop of ten cells that leaves a one-segment snake), then three steps. */
const KEPT_LINE: readonly Direction[] = ['down', 'left', 'left', 'down', 'down', 'right'];

describe('SNARE_SNAKE_STATS', () => {
  it('declares the three counters of the S10 card with their labels and aggregates', () => {
    const declared = SNARE_SNAKE_STATS.counters.map(({ id, labelId, aggregate }) => [
      id,
      labelId,
      aggregate,
    ]);
    expect(declared).toStrictEqual([
      ['critters-caught', 'snare-snake.stats.critters-caught', 'sum'],
      ['loops-closed', 'snare-snake.stats.loops-closed', 'sum'],
      ['longest-snake', 'snare-snake.stats.longest-snake', 'max'],
    ]);
  });

  it('measures one loop: the critters it snared, one loop, and the snake left after it', () => {
    const measured = SNARE_SNAKE_STATS.counters.map((counter) => counter.measure(LOOP_MOVE));
    expect(measured).toStrictEqual([2, 1, 7]);
  });

  it('measures one plain step: no catch, no loop, the snake as long as it grew', () => {
    const measured = SNARE_SNAKE_STATS.counters.map((counter) => counter.measure(PLAIN_STEP));
    expect(measured).toStrictEqual([0, 0, 11]);
  });

  it('measures nothing for a move without snake events', () => {
    const measured = SNARE_SNAKE_STATS.counters.map((counter) => counter.measure([]));
    expect(measured).toStrictEqual([0, 0, 0]);
  });

  it('counts a kept line once and keeps the longest snake, even after a loop shortens it', () => {
    expect(countersOfLine(1, KEPT_LINE)).toStrictEqual({
      'critters-caught': 3,
      'loops-closed': 1,
      'longest-snake': 10,
    });
  });

  it('gives the same counters when the kept line is replayed', () => {
    expect(countersOfLine(1, KEPT_LINE)).toStrictEqual(countersOfLine(1, KEPT_LINE));
  });
});
