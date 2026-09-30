// apps/line-siege/src/rules/line-siege-stats.test.ts
import en from '@e07/line-siege/i18n/en.json';

import { LINE_SIEGE_STATS } from './line-siege-stats.ts';

import type { LineSiegeEvent } from './line-siege-types.ts';

const DOUBLE_CLEAR: readonly LineSiegeEvent[] = [
  { kind: 'block-placed', trayIndex: 0, piece: 3, cells: [5, 6, 7] },
  { kind: 'row-cleared', row: 0 },
  { kind: 'column-cleared', col: 7 },
  { kind: 'beam-fired', lane: 7, targetId: 4 },
  { kind: 'monster-hit', monsterId: 4, damage: 8, hpLeft: 0 },
  { kind: 'shockwave-sent', rows: 1, damage: 2 },
  { kind: 'monster-hit', monsterId: 5, damage: 2, hpLeft: 0 },
  { kind: 'monster-defeated', monsterId: 4, monsterKind: 'normal', lane: 7, row: 2 },
  { kind: 'monster-defeated', monsterId: 5, monsterKind: 'fast', lane: 1, row: 0 },
];

describe('LINE_SIEGE_STATS', () => {
  it('measures one move: monsters defeated, beams fired and lines cleared at once (spec S10)', () => {
    const measured = LINE_SIEGE_STATS.counters.map((counter) => [
      counter.id,
      counter.aggregate,
      counter.measure(DOUBLE_CLEAR),
    ]);
    expect(measured).toStrictEqual([
      ['monsters-defeated', 'sum', 2],
      ['beams-fired', 'sum', 1],
      ['biggest-combo', 'max', 2],
    ]);
  });

  it('measures zero for a placement that clears nothing', () => {
    const quiet = LINE_SIEGE_STATS.counters.map((counter) =>
      counter.measure(DOUBLE_CLEAR.slice(0, 1)),
    );
    expect(quiet).toStrictEqual([0, 0, 0]);
  });

  it('declares 2 to 4 counters with unique kebab-case ids and labels in the catalog', () => {
    const ids = LINE_SIEGE_STATS.counters.map((counter) => counter.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true);
    const keys = Object.keys(en);
    expect(LINE_SIEGE_STATS.counters.every((counter) => keys.includes(counter.labelId))).toBe(true);
  });
});
