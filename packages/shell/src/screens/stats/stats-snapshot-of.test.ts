// packages/shell/src/screens/stats/stats-snapshot-of.test.ts
// no-shell-context: pure mapping from the S10 summary.
import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';

import { statsSnapshotOf } from './stats-snapshot-of.ts';
import { buildStatsSummary } from './stats-summary.ts';

import type { SnapshotText } from './stats-snapshot-of.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const TEXT: SnapshotText = {
  formatNumber: (value) => `n${String(value)}`,
  labelOf: (counter) => `label:${counter.labelId}`,
  weekdayOf: (date) => ({ letter: date.slice(8), weekdayName: date }),
  bestOfText: (value) => `×${String(value)}`,
};
const COUNTERS = [
  { id: 'monsters-defeated', labelId: 'line-siege.stats.monsters-defeated' },
  { id: 'beams-fired', labelId: 'line-siege.stats.beams-fired' },
];

function summaryOf(
  stats: Partial<SaveDoc['stats']>,
  counterIds: readonly string[] = COUNTERS.map((counter) => counter.id),
) {
  return buildStatsSummary({
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      playMs: 0,
      bestScore: { level: 0, daily: 0, endless: 0 },
      currentWinStreak: 0,
      longestWinStreak: 0,
      days: {},
      counters: {},
      ...stats,
    },
    progress: { levels: {}, endlessBest: 0 },
    daily: { results: {}, completed: 0, streak: { lastDate: null, length: 0 }, bestStreak: 0 },
    today: '2026-09-26',
    levelCount: 90,
    hasEndless: false,
    counterIds,
  });
}

describe('statsSnapshotOf', () => {
  it("keeps the game's counter order and labels, zero for a counter never measured", () => {
    const snapshot = statsSnapshotOf(
      summaryOf({ counters: { 'beams-fired': 12 } }),
      COUNTERS,
      TEXT,
    );
    expect(snapshot.gameStats).toStrictEqual([
      {
        key: 'monsters-defeated',
        label: 'label:line-siege.stats.monsters-defeated',
        valueText: 'n0',
      },
      { key: 'beams-fired', label: 'label:line-siege.stats.beams-fired', valueText: 'n12' },
    ]);
  });

  it('writes a best-of counter through its catalog text, and 0 before it is reached (N12)', () => {
    const counters = [
      { id: 'biggest-combo', labelId: 'line-siege.stats.biggest-combo', aggregate: 'max' as const },
      { id: 'longest-chain', labelId: 'line-siege.stats.longest-chain', aggregate: 'max' as const },
    ];
    const snapshot = statsSnapshotOf(
      summaryOf({ counters: { 'biggest-combo': 6 } }, ['biggest-combo', 'longest-chain']),
      counters,
      { ...TEXT, bestOfText: (value) => `best-of:${String(value)}` },
    );

    expect(snapshot.gameStats.map((stat) => stat.valueText)).toStrictEqual(['best-of:6', 'n0']);
  });

  it('leaves out Endless and the best level score until they exist, and names seven days', () => {
    const snapshot = statsSnapshotOf(summaryOf({}), COUNTERS, TEXT);
    expect([snapshot.bestEndless, snapshot.bestLevelScore]).toStrictEqual([null, null]);
    expect(snapshot.week.map((day) => day.letter)).toStrictEqual([
      '20',
      '21',
      '22',
      '23',
      '24',
      '25',
      '26',
    ]);
  });

  it("draws Line Siege's three counters: two running totals and the biggest combo as ×6", () => {
    const counters = [
      {
        id: 'monsters-defeated',
        labelId: 'line-siege.stats.monsters-defeated',
        aggregate: 'sum' as const,
      },
      { id: 'beams-fired', labelId: 'line-siege.stats.beams-fired', aggregate: 'sum' as const },
      { id: 'biggest-combo', labelId: 'line-siege.stats.biggest-combo', aggregate: 'max' as const },
    ];
    const ids = counters.map((counter) => counter.id);
    const summary = summaryOf(
      { counters: { 'monsters-defeated': 1284, 'beams-fired': 3907, 'biggest-combo': 6 } },
      ids,
    );
    const snapshot = statsSnapshotOf(summary, counters, {
      ...TEXT,
      formatNumber: createNumberFormatter('en'),
    });

    expect(snapshot.gameStats.map((stat) => [stat.key, stat.valueText])).toStrictEqual([
      ['monsters-defeated', '1,284'],
      ['beams-fired', '3,907'],
      ['biggest-combo', '×6'],
    ]);
    expect(ids.every((id) => /^[a-z]+(?:-[a-z]+)*$/.test(id))).toBe(true);
  });
});
