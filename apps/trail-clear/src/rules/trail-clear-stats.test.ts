// apps/trail-clear/src/rules/trail-clear-stats.test.ts
// Spec S10: each game card shows the game's own counters; the run end counts them by replaying
// the kept move line, so a counter must come from one move's events alone.
import { applyMove } from './apply-move.ts';
import { drawStart } from './create.ts';
import { listMoves } from './list-moves.ts';
import { TRAIL_CLEAR_STATS } from './trail-clear-stats.ts';

import type { TrailClearEvent } from './trail-clear-types.ts';

/** A placement that closes a road of four and a river of three at once. */
const DOUBLE_MOVE: readonly TrailClearEvent[] = [
  { kind: 'tile-placed', tile: 'ford', turns: 0, cell: 12 },
  { kind: 'loop-closed', terrain: 'road', cells: [2, 7, 8, 12], points: 160 },
  { kind: 'loop-closed', terrain: 'river', cells: [12, 17, 22], points: 90 },
  { kind: 'double-closed', bonus: 250 },
  { kind: 'tiles-wiped', cells: [2, 7, 8, 12, 17, 22] },
  { kind: 'score-added', points: 500, total: 500 },
  { kind: 'tile-dealt', tile: 'bridge' },
];
const PLAIN_MOVE: readonly TrailClearEvent[] = [
  { kind: 'tile-placed', tile: 'road-bend', turns: 1, cell: 6 },
  { kind: 'tile-dealt', tile: 'road-end' },
];
/** The continue's own events: it clears a row and places nothing. */
const CONTINUE: readonly TrailClearEvent[] = [{ kind: 'rows-cleared', rows: [0], cells: [1, 3] }];

type Totals = Readonly<Record<string, number>>;

/** Folds counters over a move line the way the Shell does: sums add up, maxima keep the best. */
function fold(moves: readonly (readonly TrailClearEvent[])[]): Totals {
  const totals: Record<string, number> = {};
  for (const counter of TRAIL_CLEAR_STATS.counters) {
    const values = moves.map((events) => counter.measure(events));
    totals[counter.id] =
      counter.aggregate === 'sum'
        ? values.reduce((sum, value) => sum + value, 0)
        : Math.max(0, ...values);
  }
  return totals;
}

/** A seeded run played by its choices: the event line of each move and the final state. */
function run(seed: number, choices: readonly number[]) {
  const lines: (readonly TrailClearEvent[])[] = [];
  let state = drawStart(seed, 0);
  for (const choice of choices) {
    const moves = listMoves(state);
    const move = moves[choice % Math.max(moves.length, 1)];
    if (move === undefined) break;
    const result = applyMove(state, move);
    lines.push(result.events);
    state = result.state;
  }
  return { lines, state };
}

describe('TRAIL_CLEAR_STATS', () => {
  it('measures one move: the loops it closed, the tile it placed and its biggest loop', () => {
    const measured = TRAIL_CLEAR_STATS.counters.map((counter) => [
      counter.id,
      counter.measure(DOUBLE_MOVE),
    ]);
    expect(measured).toStrictEqual([
      ['loops-closed', 2],
      ['tiles-placed', 1],
      ['biggest-loop', 4],
    ]);
  });

  it('counts each loop and tile once per run, keeps the biggest loop, and skips the continue', () => {
    expect(fold([PLAIN_MOVE, DOUBLE_MOVE, CONTINUE, PLAIN_MOVE])).toStrictEqual({
      'loops-closed': 2,
      'tiles-placed': 3,
      'biggest-loop': 4,
    });
  });

  it('counts what the run did, the same again when the kept move line is replayed', () => {
    const choices = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4];
    const { lines, state } = run(7, choices);
    expect(fold(lines)).toMatchObject({
      'loops-closed': state.loopsClosed,
      'tiles-placed': state.placements,
    });
    expect(state.loopsClosed).toBeGreaterThan(0);
    expect(fold(run(7, choices).lines)).toStrictEqual(fold(lines));
  });

  it('declares 2 to 4 counters with unique kebab-case ids and their labels', () => {
    const ids = TRAIL_CLEAR_STATS.counters.map((counter) => counter.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true);
    expect(TRAIL_CLEAR_STATS.counters.map((counter) => counter.labelId)).toStrictEqual(
      ids.map((id) => `trail-clear.stats.${id}`),
    );
  });
});
