// apps/merge-siege/src/rules/merge-siege-stats.test.ts
// Spec 10 STATISTICS and S10: three counters for the game card, measured from one move's events;
// the Shell folds them over a finished run's kept move line (sum or max).
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import en from '@e07/merge-siege/i18n/en.json' with { type: 'json' };
import { mergeSiegeBot } from '@e07/merge-siege/testing/merge-siege-bot.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { MERGE_SIEGE_STATS } from './merge-siege-stats.ts';

import type { MergeSiegeEvent, MergeSiegeMove, MergeSiegeState } from './merge-siege-types.ts';

/** A busy swipe: two merges (an 8 and a 4), a smash in the slide and one at the gate. */
const BUSY_SWIPE: readonly MergeSiegeEvent[] = [
  { kind: 'tiles-slid', steps: [{ id: 3, from: 20, to: 0 }] },
  {
    kind: 'tiles-merged',
    merges: [
      { id: 4, intoId: 2, cell: 25, value: 8 },
      { id: 6, intoId: 5, cell: 26, value: 4 },
    ],
  },
  { kind: 'enemies-smashed', phase: 'slide', smashes: [{ id: 1, tileId: 3, cell: 5, value: 2 }] },
  { kind: 'enemies-smashed', phase: 'gate', smashes: [{ id: 9, tileId: 3, cell: 0, value: 2 }] },
  { kind: 'tile-spawned', id: 10, cell: 24, value: 2 },
  { kind: 'score-added', points: 52, total: 52 },
];
const QUIET_SWIPE: readonly MergeSiegeEvent[] = [
  { kind: 'tiles-slid', steps: [{ id: 3, from: 20, to: 15 }] },
  { kind: 'enemies-marched', steps: [{ id: 1, from: 0, to: 5 }] },
];

type Tally = Readonly<Record<string, number>>;

/** The Shell's fold: a sum adds every move, a max keeps the best move. */
function foldRun(moves: readonly (readonly MergeSiegeEvent[])[]): Tally {
  const tally: Record<string, number> = {};
  for (const counter of MERGE_SIEGE_STATS.counters) {
    const values = moves.map((events) => counter.measure(events));
    tally[counter.id] =
      counter.aggregate === 'sum'
        ? values.reduce((sum, value) => sum + value, 0)
        : values.reduce((best, value) => Math.max(best, value), 0);
  }
  return tally;
}

type Run = {
  readonly line: MergeSiegeMove[];
  readonly turns: MergeSiegeEvent[][];
  readonly end: MergeSiegeState;
};

/** The greedy bot plays a run (at most 60 swipes) and keeps its move line and each move's events. */
function playRun(seed: number, difficulty: number): Run {
  let state = create(seed, difficulty);
  let rng = seedRng(seed);
  const line: MergeSiegeMove[] = [];
  const turns: MergeSiegeEvent[][] = [];
  for (let swipe = 0; swipe < 60; swipe += 1) {
    const moves = listMoves(state);
    if (moves.length === 0) break;
    const pick = mergeSiegeBot(state, moves, rng);
    rng = pick.rng;
    const result = applyMove(state, pick.move);
    line.push(pick.move);
    turns.push([...result.events]);
    state = result.state;
  }
  return { line, turns, end: state };
}

describe('MERGE_SIEGE_STATS', () => {
  it('measures one move: enemies smashed, tiles merged and the biggest tile a merge made', () => {
    const measured = MERGE_SIEGE_STATS.counters.map((counter) => [
      counter.id,
      counter.aggregate,
      counter.measure(BUSY_SWIPE),
    ]);
    expect(measured).toStrictEqual([
      ['enemies-smashed', 'sum', 2],
      ['tiles-merged', 'sum', 2],
      ['biggest-tile', 'max', 8],
    ]);
  });

  it('measures zero for a swipe that only slides and marches', () => {
    expect(MERGE_SIEGE_STATS.counters.map((counter) => counter.measure(QUIET_SWIPE))).toStrictEqual(
      [0, 0, 0],
    );
  });

  it('counts each smash exactly once per run and keeps the best tile, over whole bot runs', () => {
    fc.assert(
      fc.property(fc.nat({ max: 9_999 }), fc.integer({ min: 0, max: 100 }), (seed, difficulty) => {
        const { turns, end } = playRun(seed, difficulty);
        const tally = foldRun(turns);
        expect(tally['enemies-smashed']).toBe(end.smashed);
        const merges = turns
          .flat()
          .flatMap((event) => (event.kind === 'tiles-merged' ? event.merges : []));
        expect(tally['tiles-merged']).toBe(merges.length);
        expect(tally['biggest-tile']).toBe(
          merges.reduce((best, merge) => Math.max(best, merge.value), 0),
        );
      }),
      { seed: 11, numRuns: 40 },
    );
  });

  it('gives the same counters when the kept move line is replayed from the seed', () => {
    const run = playRun(7, 45);
    let state = create(7, 45);
    const replayed = run.line.map((move) => {
      const result = applyMove(state, move);
      state = result.state;
      return [...result.events];
    });
    expect(foldRun(replayed)).toStrictEqual(foldRun(run.turns));
  });

  it('declares 2 to 4 counters with unique kebab-case ids and labels in the catalog', () => {
    const ids = MERGE_SIEGE_STATS.counters.map((counter) => counter.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true);
    const keys = Object.keys(en);
    expect(MERGE_SIEGE_STATS.counters.every((counter) => keys.includes(counter.labelId))).toBe(
      true,
    );
  });
});
