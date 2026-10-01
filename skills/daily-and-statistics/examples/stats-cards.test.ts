// packages/shell/src/screens/stats/stats-cards.test.ts
import { buildStatsSummary } from '@e07/shell/screens/stats/stats-summary.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { dailyCells, gameCells, levelCells, overviewCells } from './stats-cards.ts';

const doc = createDefaultSaveDoc('line-siege');
const view = buildStatsSummary({
  stats: {
    ...doc.stats,
    gamesPlayed: 8,
    wins: 6,
    playMs: 8_040_000,
    counters: { 'monsters-defeated': 42, 'biggest-combo': 6 },
  },
  progress: doc.progress,
  daily: { ...doc.daily, completed: 3, bestStreak: 3 },
  today: '2026-09-26',
  levelCount: 90,
  hasEndless: false,
  counterIds: ['monsters-defeated', 'biggest-combo'],
});

describe('stats cards', () => {
  it('builds the overview cells with their formats', () => {
    expect(overviewCells(view).map((cell) => cell.value)).toStrictEqual([
      { kind: 'count', value: 8 },
      { kind: 'count', value: 6 },
      { kind: 'percent', rate: 0.75 },
      { kind: 'duration', hours: 2, minutes: 14 },
    ]);
  });

  it('uses the Toybox testIDs of the stat-grid cells', () => {
    expect(
      [...overviewCells(view), ...levelCells(view), ...dailyCells(view)].map((cell) => cell.testID),
    ).toStrictEqual([
      'stats.overview-card.games-played',
      'stats.overview-card.wins',
      'stats.overview-card.win-rate',
      'stats.overview-card.play-time',
      'stats.levels-card.completed',
      'stats.levels-card.stars',
      'stats.levels-card.three-star',
      'stats.daily-card.completed',
      'stats.daily-card.current-streak',
      'stats.daily-card.best-streak',
    ]);
  });

  it('gives streaks in days and stars as earned of total', () => {
    expect(levelCells(view)[1]?.value).toStrictEqual({ kind: 'stars', earned: 0, total: 270 });
    expect(dailyCells(view).map((cell) => cell.value)).toStrictEqual([
      { kind: 'count', value: 3 },
      { kind: 'days', daysCount: 0 },
      { kind: 'days', daysCount: 3 },
    ]);
  });

  it('shows the win rate as a bare percentage value, labelled by stats.overview.win-rate', () => {
    expect(overviewCells(view)[2]).toStrictEqual({
      testID: 'stats.overview-card.win-rate',
      labelKey: 'stats.overview.win-rate',
      value: { kind: 'percent', rate: 0.75 },
    });
  });

  it('shows a best-of counter as a multiplier and a running total as the plain number', () => {
    const cells = gameCells(view, [
      { id: 'monsters-defeated', labelId: 'line-siege.stat.monsters-defeated', aggregate: 'sum' },
      { id: 'biggest-combo', labelId: 'line-siege.stat.biggest-combo', aggregate: 'max' },
    ]);
    expect(cells).toStrictEqual([
      {
        testID: 'stats.game-card.monsters-defeated',
        labelKey: 'line-siege.stat.monsters-defeated',
        value: { kind: 'count', value: 42 },
      },
      {
        testID: 'stats.game-card.biggest-combo',
        labelKey: 'line-siege.stat.biggest-combo',
        value: { kind: 'multiplier', value: 6 },
      },
    ]);
  });
});
