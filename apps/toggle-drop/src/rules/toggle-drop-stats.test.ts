// apps/toggle-drop/src/rules/toggle-drop-stats.test.ts
import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { TOGGLE_DROP_STATS } from './toggle-drop-stats.ts';

import type { ToggleDropEvent, ToggleDropMove, ToggleDropState } from './toggle-drop-types.ts';

/** A drop through two switches into a cup it fills. */
const FILLING_DROP: readonly ToggleDropEvent[] = [
  { kind: 'ball-dropped', col: 1, x: 180, y: 0, atMs: 0 },
  { kind: 'switch-flipped', col: 1, row: 0, side: 1, x: 180, y: 120, atMs: 167 },
  { kind: 'switch-flipped', col: 0, row: 1, side: 0, x: 60, y: 240, atMs: 333 },
  { kind: 'ball-landed', col: 1, x: 180, y: 360, isInCup: true, wasRedirected: true, atMs: 500 },
  { kind: 'cup-filled', col: 1, atMs: 500 },
];

type Tally = Readonly<Record<string, number>>;

/** Folds every counter over each kept move's events, as the Shell does at a run's end (sums). */
function tallyOf(start: ToggleDropState, line: readonly ToggleDropMove[]): Tally {
  const tally: Record<string, number> = {};
  let state = start;
  for (const move of line) {
    const result = applyMove(state, move);
    for (const counter of TOGGLE_DROP_STATS.counters) {
      tally[counter.id] = (tally[counter.id] ?? 0) + counter.measure(result.events);
    }
    state = result.state;
  }
  return tally;
}

/** The first legal drop again and again until the run ends: a whole kept move line. */
function wholeRun(start: ToggleDropState): ToggleDropMove[] {
  const line: ToggleDropMove[] = [];
  let state = start;
  for (let move = listMoves(state)[0]; move !== undefined; move = listMoves(state)[0]) {
    line.push(move);
    state = applyMove(state, move).state;
  }
  return line;
}

describe('TOGGLE_DROP_STATS', () => {
  it('measures one drop: one ball, every switch it flipped and the cup it filled', () => {
    const measured = TOGGLE_DROP_STATS.counters.map((counter) => [
      counter.id,
      counter.measure(FILLING_DROP),
    ]);
    expect(measured).toStrictEqual([
      ['balls-dropped', 1],
      ['switches-flipped', 2],
      ['cups-filled', 1],
    ]);
  });

  it('counts a whole run once per event, and a replay of the kept line counts the same', () => {
    const start = create(7, 40);
    const line = wholeRun(start);
    const events = line.reduce<{ state: ToggleDropState; all: ToggleDropEvent[] }>(
      (acc, move) => {
        const result = applyMove(acc.state, move);
        return { state: result.state, all: [...acc.all, ...result.events] };
      },
      { state: start, all: [] },
    ).all;
    const count = (kind: ToggleDropEvent['kind']): number =>
      events.filter((event) => event.kind === kind).length;
    expect(tallyOf(start, line)).toStrictEqual({
      'balls-dropped': line.length,
      'switches-flipped': count('switch-flipped'),
      'cups-filled': count('cup-filled'),
    });
    expect(tallyOf(start, line)).toStrictEqual(tallyOf(create(7, 40), [...line]));
  });

  it('declares 3 summed counters with unique kebab-case ids and their labels', () => {
    const { counters } = TOGGLE_DROP_STATS;
    const ids = counters.map((counter) => counter.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true);
    expect(counters.every((counter) => counter.aggregate === 'sum')).toBe(true);
    expect(counters.map((counter) => counter.labelId)).toStrictEqual(
      ids.map((id) => `toggle-drop.stats.${id}`),
    );
  });
});
