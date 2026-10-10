// packages/shell/src/screens/stats/stats-summary.ts
import { addDays, isoWeekday } from '@e07/game-kit/dates/date-key.ts';
import { currentDailyStreak } from '@e07/shell/stores/daily-model.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type Duration = { readonly hours: number; readonly minutes: number };

export type StatsSummaryInput = {
  readonly stats: SaveDoc['stats'];
  readonly progress: SaveDoc['progress'];
  readonly daily: SaveDoc['daily'];
  readonly today: DateKey;
  /** levels.table.length of the game (stars total = 3 per level). */
  readonly levelCount: number;
  readonly hasEndless: boolean;
  /** The game's CounterSpec ids, in the order its S10 card shows them. */
  readonly counterIds: readonly string[];
};

/** Every number S10 shows, derived; components only format (digits, ::percent, stats.duration). */
export type StatsSummary = {
  /** S10 empty state ("Play a level to see your stats here") instead of a wall of zeros. */
  readonly isEmpty: boolean;
  readonly overview: {
    readonly gamesPlayed: number;
    readonly wins: number;
    /** 0..1 for the `::percent` skeleton; 0 when no game was played. */
    readonly winRate: number;
    readonly playTime: Duration;
  };
  readonly levels: {
    readonly completed: number;
    readonly starsEarned: number;
    readonly starsTotal: number;
    readonly threeStarLevels: number;
  };
  readonly best: {
    readonly levelScore: number;
    readonly dailyScore: number;
    /** null hides the Endless row (games without Endless). */
    readonly endlessScore: number | null;
    /** "Level 12: 1,840": the level with the highest best score (ties: the lower level). */
    readonly bestLevel: { readonly level: number; readonly score: number } | null;
    readonly longestWinStreak: number;
  };
  readonly daily: {
    readonly completed: number;
    readonly currentStreak: number;
    readonly bestStreak: number;
  };
  /** Last 7 local days, oldest first (RTL mirrors the row); `max` scales the bars (>= 1). */
  readonly week: {
    readonly days: readonly {
      readonly date: DateKey;
      /** ISO weekday 1..7 (1 = Monday): the letter date.weekday-strip.<n> and the name date.weekday.<n>. */
      readonly weekday: number;
      readonly games: number;
    }[];
    readonly max: number;
  };
  readonly counters: readonly { readonly id: string; readonly value: number }[];
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** "2 h 14 min": whole hours and remaining whole minutes (the message picks the pattern). */
export function splitDuration(ms: number): Duration {
  const hours = Math.floor(ms / HOUR_MS);
  return { hours, minutes: Math.floor((ms - hours * HOUR_MS) / MINUTE_MS) };
}

function levelsCard(progress: SaveDoc['progress'], levelCount: number): StatsSummary['levels'] {
  const results = Object.values(progress.levels);
  return {
    completed: results.length,
    starsEarned: results.reduce((total, result) => total + result.stars, 0),
    starsTotal: levelCount * 3,
    threeStarLevels: results.filter((result) => result.stars === 3).length,
  };
}

function bestLevel(progress: SaveDoc['progress']): StatsSummary['best']['bestLevel'] {
  let best: { readonly level: number; readonly score: number } | null = null;
  for (const [key, result] of Object.entries(progress.levels)) {
    const level = Number(key);
    const isBetter =
      best === null ||
      result.bestScore > best.score ||
      (result.bestScore === best.score && level < best.level);
    if (isBetter) best = { level, score: result.bestScore };
  }
  return best;
}

function weekBars(stats: SaveDoc['stats'], today: DateKey): StatsSummary['week'] {
  const days = [6, 5, 4, 3, 2, 1, 0].map((back) => {
    const date = addDays(today, -back);
    return { date, weekday: isoWeekday(date), games: stats.days[date]?.games ?? 0 };
  });
  return { days, max: Math.max(1, ...days.map((day) => day.games)) };
}

/** Pure: save sections + today + the game's shape -> the S10 view model. */
export function buildStatsSummary(input: StatsSummaryInput): StatsSummary {
  const { stats, progress, daily, today } = input;
  return {
    isEmpty: stats.gamesPlayed === 0,
    overview: {
      gamesPlayed: stats.gamesPlayed,
      wins: stats.wins,
      winRate: stats.gamesPlayed === 0 ? 0 : stats.wins / stats.gamesPlayed,
      playTime: splitDuration(stats.playMs),
    },
    levels: levelsCard(progress, input.levelCount),
    best: {
      levelScore: stats.bestScore.level,
      dailyScore: stats.bestScore.daily,
      endlessScore: input.hasEndless
        ? Math.max(stats.bestScore.endless, progress.endlessBest)
        : null,
      bestLevel: bestLevel(progress),
      longestWinStreak: stats.longestWinStreak,
    },
    daily: {
      completed: daily.completed,
      currentStreak: currentDailyStreak(daily, today),
      bestStreak: daily.bestStreak,
    },
    week: weekBars(stats, today),
    counters: input.counterIds.map((id) => ({ id, value: stats.counters[id] ?? 0 })),
  };
}
