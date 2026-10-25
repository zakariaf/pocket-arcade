// apps/flock-tilt/src/rules/flock-tilt-stats.test.ts
import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { FLOCK_TILT_STATS } from './flock-tilt-stats.ts';

import type { Direction, FlockTiltEvent, FlockTiltState } from './flock-tilt-types.ts';

/** Level 1's field (seed 1, difficulty 0) and its two lines the rules golden pins. */
const WIN_LINE: readonly Direction[] = ['down', 'left', 'down', 'left'];
const LOSE_LINE: readonly Direction[] = ['up', 'right', 'up', 'left'];

type Played = { readonly state: FlockTiltState; readonly moves: FlockTiltEvent[][] };

/** Each move's events along a line from level 1's field: the kept move line of one run. */
function eventsAlong(line: readonly Direction[]): FlockTiltEvent[][] {
  const start: Played = { state: create(1, 0), moves: [] };
  return line.reduce<Played>((played, direction) => {
    const { state, events } = applyMove(played.state, { kind: 'tilt', direction });
    return { state, moves: [...played.moves, [...events]] };
  }, start).moves;
}

/** The Shell's fold at a run end: each counter measured once per move, summed or the best kept. */
function countersOf(moves: readonly (readonly FlockTiltEvent[])[]): Record<string, number> {
  return Object.fromEntries(
    FLOCK_TILT_STATS.counters.map((counter) => {
      const values = moves.map((events) => counter.measure(events));
      const value =
        counter.aggregate === 'sum'
          ? values.reduce((total, next) => total + next, 0)
          : Math.max(0, ...values);
      return [counter.id, value];
    }),
  );
}

describe('FLOCK_TILT_STATS (spec 10, S10)', () => {
  it('declares the three counters of the game card with their labels, all summed', () => {
    expect(
      FLOCK_TILT_STATS.counters.map((counter) => [counter.id, counter.labelId, counter.aggregate]),
    ).toStrictEqual([
      ['sheep-penned', 'flock-tilt.stats.sheep-penned', 'sum'],
      ['tilts-made', 'flock-tilt.stats.tilts-made', 'sum'],
      ['solved-at-par', 'flock-tilt.stats.solved-at-par', 'sum'],
    ]);
  });

  it('counts a won field: three sheep penned, four tilts, and one field solved at par', () => {
    expect(countersOf(eventsAlong(WIN_LINE))).toStrictEqual({
      'sheep-penned': 3,
      'tilts-made': 4,
      'solved-at-par': 1,
    });
  });

  it('counts a lost field: its tilts, no sheep penned and no par solve', () => {
    expect(countersOf(eventsAlong(LOSE_LINE))).toStrictEqual({
      'sheep-penned': 0,
      'tilts-made': 4,
      'solved-at-par': 0,
    });
  });

  it('counts a clear at or under par as solved at par, and one above par as not', () => {
    const solvedAtPar = FLOCK_TILT_STATS.counters.find((counter) => counter.id === 'solved-at-par');
    const clears = [3, 4, 5].map((tilts): FlockTiltEvent[] => [
      { kind: 'field-cleared', tilts, par: 4 },
    ]);
    expect(clears.map((events) => solvedAtPar?.measure(events))).toStrictEqual([1, 1, 0]);
  });

  it('gives the same counters when the kept move line is replayed', () => {
    expect(countersOf(eventsAlong(WIN_LINE))).toStrictEqual(countersOf(eventsAlong(WIN_LINE)));
  });
});
