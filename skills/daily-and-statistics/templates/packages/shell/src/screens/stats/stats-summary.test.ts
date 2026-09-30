// packages/shell/src/screens/stats/stats-summary.test.ts
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { applyRunEnd } from '@e07/shell/stores/run-end.ts';

import { buildStatsSummary, splitDuration } from './stats-summary.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { RunEnd } from '@e07/shell/stores/run-end.ts';

const TODAY = '2026-09-26';
const GAME = {
  levelCount: 90,
  hasEndless: true,
  counterIds: ['monsters-defeated', 'biggest-combo'],
};
const BASE = { isWon: true, moves: 8, playMs: 1_800_000, counters: {} } as const;

function viewOf(doc: SaveDoc): ReturnType<typeof buildStatsSummary> {
  const { stats, progress, daily } = doc;
  return buildStatsSummary({ ...GAME, stats, progress, daily, today: TODAY });
}

function played(ends: readonly RunEnd[]): SaveDoc {
  return ends.reduce(
    (doc, end) => applyRunEnd(doc, end, TODAY),
    createDefaultSaveDoc('line-siege'),
  );
}

describe('buildStatsSummary', () => {
  it('shows the empty state to a new player', () => {
    const view = viewOf(createDefaultSaveDoc('line-siege'));
    expect(view.isEmpty).toBe(true);
    expect(view.overview.winRate).toBe(0);
    expect(view.week.max).toBe(1);
  });

  it('derives every S10 card from the save sections', () => {
    const doc = played([
      { ...BASE, mode: 'level', level: 1, stars: 3, score: 500 },
      { ...BASE, mode: 'level', level: 2, stars: 2, score: 800 },
      { ...BASE, mode: 'level', level: 3, stars: 1, score: 100, isWon: false },
      { ...BASE, mode: 'daily', date: TODAY, score: 300 },
    ]);
    const view = viewOf(doc);
    expect(view.isEmpty).toBe(false);
    expect(view.overview).toStrictEqual({
      gamesPlayed: 4,
      wins: 3,
      winRate: 0.75,
      playTime: { hours: 2, minutes: 0 },
    });
    expect(view.levels).toStrictEqual({
      completed: 2,
      starsEarned: 5,
      starsTotal: 270,
      threeStarLevels: 1,
    });
    expect(view.best.bestLevel).toStrictEqual({ level: 2, score: 800 });
    expect(view.best.endlessScore).toBe(0);
    expect(view.daily).toStrictEqual({ completed: 1, currentStreak: 1, bestStreak: 1 });
    expect(view.week.days.at(-1)).toStrictEqual({ date: TODAY, weekday: 6, games: 4 });
    expect(view.week.max).toBe(4);
    expect(view.counters).toStrictEqual([
      { id: 'monsters-defeated', value: 0 },
      { id: 'biggest-combo', value: 0 },
    ]);
  });

  it('hides the Endless best for games without Endless', () => {
    const doc = createDefaultSaveDoc('line-siege');
    const { stats, progress, daily } = doc;
    const view = buildStatsSummary({
      ...GAME,
      hasEndless: false,
      stats,
      progress,
      daily,
      today: TODAY,
    });
    expect(view.best.endlessScore).toBeNull();
  });

  it('splits play time into whole hours and minutes', () => {
    expect(splitDuration(0)).toStrictEqual({ hours: 0, minutes: 0 });
    expect(splitDuration(8_040_000)).toStrictEqual({ hours: 2, minutes: 14 });
    expect(splitDuration(59_999)).toStrictEqual({ hours: 0, minutes: 0 });
  });
});
