// packages/shell/src/screens/stats/stats-cards.test.ts
import { buildStatsSummary } from '@e07/shell/screens/stats/stats-summary.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { dailyCells, levelCells, overviewCells } from './stats-cards.ts';

const doc = createDefaultSaveDoc('line-siege');
const view = buildStatsSummary({
  stats: { ...doc.stats, gamesPlayed: 8, wins: 6, playMs: 8_040_000 },
  progress: doc.progress,
  daily: { ...doc.daily, completed: 3, bestStreak: 3 },
  today: '2026-09-26',
  levelCount: 90,
  hasEndless: false,
  counterIds: [],
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
});
