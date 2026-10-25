// apps/stepstone/src/rules/stepstone-stats.test.ts
// Spec 10 STATISTICS and S10: the game card counts stones stepped, levels finished at par and the
// most hop kinds used in one run; each counter is measured from the kept move line exactly once.
import fc from 'fast-check';

import en from '@e07/stepstone/i18n/en.json';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { STEPSTONE_STATS } from './stepstone-stats.ts';

import type { StepstoneEvent, StepstoneMove, StepstoneState } from './stepstone-types.ts';

/** The golden route of seed 1 at difficulty 0: rook to the king at 12, the king at 18, the flag. */
const GOLDEN_ROUTE: readonly StepstoneMove[] = [12, 18, 14].map((to) => ({ kind: 'hop', to }));

/** The events of each move of a line, played from the start. */
function eventsPerMove(start: StepstoneState, line: readonly StepstoneMove[]): StepstoneEvent[][] {
  const perMove: StepstoneEvent[][] = [];
  line.reduce((state, move) => {
    const result = applyMove(state, move);
    perMove.push([...result.events]);
    return result.state;
  }, start);
  return perMove;
}

/** A run's counters: each move measured once, folded by the counter's aggregate. */
function countersOf(perMove: readonly (readonly StepstoneEvent[])[]): Record<string, number> {
  return Object.fromEntries(
    STEPSTONE_STATS.counters.map((counter) => {
      const values = perMove.map((events) => counter.measure(events));
      const folded =
        counter.aggregate === 'sum'
          ? values.reduce((sum, value) => sum + value, 0)
          : Math.max(0, ...values);
      return [counter.id, folded];
    }),
  );
}

/** A seeded line of legal hops (choice % listMoves picks each hop). */
function lineOf(start: StepstoneState, choices: readonly number[]): StepstoneMove[] {
  const line: StepstoneMove[] = [];
  let state = start;
  for (const choice of choices) {
    const moves = listMoves(state);
    const move = moves[choice % Math.max(moves.length, 1)];
    if (move === undefined) break;
    line.push(move);
    state = applyMove(state, move).state;
  }
  return line;
}

describe('STEPSTONE_STATS', () => {
  it('counts the golden route: 3 stones stepped, 1 level at par, 2 hop kinds used', () => {
    expect(countersOf(eventsPerMove(create(1, 0), GOLDEN_ROUTE))).toStrictEqual(GOLDEN_COUNTERS);
  });

  it('counts no level at par when the flag is reached in more hops than par', () => {
    const over = eventsPerMove({ ...create(1, 0), par: 2 }, GOLDEN_ROUTE);
    expect(countersOf(over)['levels-at-par']).toBe(0);
  });

  it('measures a move without a hop as nothing at all', () => {
    expect(STEPSTONE_STATS.counters.map((counter) => counter.measure([]))).toStrictEqual([0, 0, 0]);
  });

  it('gives the same counters when the kept move line is replayed', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 99 }),
        fc.array(fc.nat({ max: 40 }), { maxLength: 10 }),
        (seed, difficulty, choices) => {
          const start = create(seed, difficulty);
          const line = lineOf(start, choices);
          const counters = countersOf(eventsPerMove(start, line));
          expect(countersOf(eventsPerMove(start, line))).toStrictEqual(counters);
          expect(counters['tiles-stepped']).toBe(line.length);
          expect(counters['kinds-used']).toBeLessThanOrEqual(4);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('declares 3 counters with unique kebab-case ids and labels in the catalog', () => {
    const ids = STEPSTONE_STATS.counters.map((counter) => counter.id);
    expect(
      STEPSTONE_STATS.counters.map((counter) => [counter.id, counter.aggregate]),
    ).toStrictEqual([
      ['tiles-stepped', 'sum'],
      ['levels-at-par', 'sum'],
      ['kinds-used', 'max'],
    ]);
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true);
    expect(STEPSTONE_STATS.counters.every((counter) => counter.labelId in en)).toBe(true);
  });
});

const GOLDEN_COUNTERS = { 'tiles-stepped': 3, 'levels-at-par': 1, 'kinds-used': 2 };
