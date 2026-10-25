// apps/scrap-shove/src/rules/scrap-shove-stats.test.ts
import en from '@e07/scrap-shove/i18n/en.json';

import { applyMove } from './apply-move.ts';
import { stateFromText } from './board-text.ts';
import { SCRAP_SHOVE_STATS } from './scrap-shove-stats.ts';

import type { ScrapShoveEvent, ScrapShoveMove, ScrapShoveState } from './scrap-shove-types.ts';

type Tally = Readonly<Record<string, number>>;

/** The Shell's fold: replay the kept move line, measure each move, sum or keep the biggest. */
function foldRun(start: ScrapShoveState, moves: readonly ScrapShoveMove[]): Tally {
  let state = start;
  const tally: Record<string, number> = {};
  for (const move of moves) {
    const { state: next, events } = applyMove(state, move);
    for (const counter of SCRAP_SHOVE_STATS.counters) {
      const value = counter.measure(events);
      const before = tally[counter.id] ?? 0;
      tally[counter.id] = counter.aggregate === 'sum' ? before + value : Math.max(before, value);
    }
    state = next;
  }
  return tally;
}

/** The busiest move: a shove crushes a robot, two robots crash, one is wrecked on scrap. */
const BUSY = applyMove(
  stateFromText([
    'h......f',
    '........',
    '........',
    '.....n..',
    'h#n#@...',
    '..#..n..',
    '.n......',
    '......n.',
  ]),
  { kind: 'shove', col: 3, row: 4 },
).events;
/** A heavy robot shoves scrap onto another robot: a robot is scrapped, but no player shove. */
const HEAVY_SHOVE = applyMove(stateFromText(['.....', '.n...', 'h#..@', '.....', '.....']), {
  kind: 'wait',
}).events;

function measured(events: readonly ScrapShoveEvent[]): (string | number)[][] {
  return SCRAP_SHOVE_STATS.counters.map((counter) => [
    counter.id,
    counter.aggregate,
    counter.measure(events),
  ]);
}

describe('SCRAP_SHOVE_STATS', () => {
  it('measures one move: robots scrapped, scrap the player shoved, the most robots one move scrapped (spec S10)', () => {
    expect(measured(BUSY)).toStrictEqual([
      ['robots-scrapped', 'sum', 4],
      ['scrap-shoved', 'sum', 1],
      ['biggest-crash', 'max', 4],
    ]);
  });

  it("counts a robot a heavy robot crushes, but not that heavy robot's shove as the player's", () => {
    expect(measured(HEAVY_SHOVE).map(([, , value]) => value)).toStrictEqual([1, 0, 1]);
  });

  it('measures zero for a move that scraps nothing', () => {
    const quiet = applyMove(
      stateFromText([
        'n.......',
        '........',
        '........',
        '...@....',
        '........',
        '........',
        '........',
        '........',
      ]),
      { kind: 'wait' },
    ).events;
    expect(measured(quiet).map(([, , value]) => value)).toStrictEqual([0, 0, 0]);
  });

  it('folds a run once per kept move, keeping the biggest crash, and replays the same counters', () => {
    const start = stateFromText([
      '........',
      '........',
      '.nn.....',
      '..n.....',
      '........',
      '.....#@.',
      '.....#..',
      '........',
    ]);
    const moves: ScrapShoveMove[] = [
      { kind: 'step', col: 7, row: 6 },
      { kind: 'step', col: 7, row: 5 },
      { kind: 'step', col: 6, row: 4 },
      { kind: 'shove', col: 5, row: 4 },
    ];
    const tally = foldRun(start, moves);
    expect(tally).toStrictEqual({ 'robots-scrapped': 3, 'scrap-shoved': 1, 'biggest-crash': 2 });
    expect(foldRun(start, moves)).toStrictEqual(tally);
  });

  it('declares 2 to 4 counters with unique kebab-case ids and labels in the catalog', () => {
    const ids = SCRAP_SHOVE_STATS.counters.map((counter) => counter.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true);
    const keys = Object.keys(en);
    expect(SCRAP_SHOVE_STATS.counters.every((counter) => keys.includes(counter.labelId))).toBe(
      true,
    );
  });
});
