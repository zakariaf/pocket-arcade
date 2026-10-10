// packages/shell/src/screens/stats/stats-summary.test.ts
import { PARITY_FIXTURE } from '@e07/shell/app/parity/parity-fixture.ts';
import { resetStatistics } from '@e07/shell/services/save/reset-progress.ts';
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

  it('reads every Best score from the statistics, so Reset statistics zeroes Endless too', () => {
    const before = played([
      { ...BASE, mode: 'endless', isWon: false, score: 4210 },
      { ...BASE, mode: 'level', level: 1, stars: 3, score: 500 },
      { ...BASE, mode: 'daily', date: TODAY, score: 900 },
    ]);
    const after = applyRunEnd(
      resetStatistics(before),
      { ...BASE, mode: 'level', level: 2, stars: 2, score: 300 },
      TODAY,
    );
    const view = viewOf(after);

    expect(after.progress.endlessBest).toBe(4210);
    expect(view.best).toMatchObject({ levelScore: 300, dailyScore: 0, endlessScore: 0 });
  });

  it('splits play time into whole hours and minutes', () => {
    expect(splitDuration(0)).toStrictEqual({ hours: 0, minutes: 0 });
    expect(splitDuration(8_040_000)).toStrictEqual({ hours: 2, minutes: 14 });
    expect(splitDuration(59_999)).toStrictEqual({ hours: 0, minutes: 0 });
  });

  it("derives the design's player (frames.json fixtureSave) exactly (spec S10, 8.4)", () => {
    const { stats, progress, daily } = PARITY_FIXTURE;
    const view = buildStatsSummary({
      ...GAME,
      stats: { ...stats, counters: {} },
      progress,
      daily,
      today: '2026-09-27',
    });

    expect(view.overview).toStrictEqual({
      gamesPlayed: 58,
      wins: 36,
      winRate: 36 / 58,
      playTime: { hours: 2, minutes: 14 },
    });
    expect(view.levels).toStrictEqual({
      completed: 11,
      starsEarned: 28,
      starsTotal: 270,
      threeStarLevels: 7,
    });
    expect(view.daily).toStrictEqual({ completed: 19, currentStreak: 5, bestStreak: 12 });
    expect(view.best).toMatchObject({
      levelScore: stats.bestScore.level,
      dailyScore: stats.bestScore.daily,
      endlessScore: stats.bestScore.endless,
      bestLevel: { level: 9, score: 2310 },
    });
  });

  it('switches to the empty state exactly when no game was played, a lost game included', () => {
    const doc = played([{ ...BASE, mode: 'level', level: 1, stars: 1, score: 10, isWon: false }]);
    const view = viewOf(doc);

    expect(doc.stats.gamesPlayed).toBe(1);
    expect(view.isEmpty).toBe(false);
  });

  it('reads the last seven days oldest first, ending today, 0 for a day without games', () => {
    const { stats, progress, daily } = createDefaultSaveDoc('line-siege');
    const view = buildStatsSummary({
      ...GAME,
      stats: {
        ...stats,
        days: {
          '2026-09-19': { games: 9, playMs: 1 },
          '2026-09-21': { games: 2, playMs: 1 },
          '2026-09-26': { games: 4, playMs: 1 },
        },
      },
      progress,
      daily,
      today: TODAY,
    });

    expect(view.week.days.map((day) => [day.date, day.games])).toStrictEqual([
      ['2026-09-20', 0],
      ['2026-09-21', 2],
      ['2026-09-22', 0],
      ['2026-09-23', 0],
      ['2026-09-24', 0],
      ['2026-09-25', 0],
      ['2026-09-26', 4],
    ]);
    expect(view.week.max).toBe(4);
  });
});
