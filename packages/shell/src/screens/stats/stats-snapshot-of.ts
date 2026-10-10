// packages/shell/src/screens/stats/stats-snapshot-of.ts
// Pure: daily-and-statistics' StatsSummary as the numbers S10 draws. The game's counters keep the
// game's order and labels (useGameHost().counters: save key and catalog key); the best level score
// stays null until a level is won, so its row is left out (never "Level 0: 0").
import type { GameStat, StatsSnapshot, StatsWeekDay } from './stats-model.ts';
import type { StatsSummary } from './stats-summary.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { HostCounter } from '@e07/shell/game-host/host-counter.ts';

/** U+00D7 MULTIPLICATION SIGN: the same glyph in every language. */
const TIMES = '\u00D7';

export type SnapshotText = {
  readonly formatNumber: (value: number) => string;
  /** The counter's label: gameMessageText(t, { id: labelId }). */
  readonly labelOf: (counter: HostCounter) => string;
  /** date.weekday-strip.<n> and date.weekday.<n> of a day (the Shell date formatter). */
  readonly weekdayOf: (date: DateKey) => Pick<StatsWeekDay, 'letter' | 'weekdayName'>;
};

function gameStatsOf(
  summary: StatsSummary,
  counters: readonly HostCounter[],
  text: SnapshotText,
): GameStat[] {
  return counters.map((counter) => {
    const value = summary.counters.find((entry) => entry.id === counter.id)?.value ?? 0;
    // A best-of counter reads as a multiplier (the design's ×6); a running total as a plain number.
    const number = text.formatNumber(value);
    const valueText = counter.aggregate === 'max' ? `${TIMES}${number}` : number;
    return { key: counter.id, label: text.labelOf(counter), valueText };
  });
}

export function statsSnapshotOf(
  summary: StatsSummary,
  counters: readonly HostCounter[],
  text: SnapshotText,
): StatsSnapshot {
  const { overview, levels, best, daily } = summary;
  return {
    gamesPlayed: overview.gamesPlayed,
    wins: overview.wins,
    winRate: overview.winRate,
    playHours: overview.playTime.hours,
    playMinutes: overview.playTime.minutes,
    levelsCompleted: levels.completed,
    starsEarned: levels.starsEarned,
    starsTotal: levels.starsTotal,
    threeStarLevels: levels.threeStarLevels,
    bestLevels: best.levelScore,
    bestDaily: best.dailyScore,
    bestEndless: best.endlessScore,
    bestLevelScore: best.bestLevel,
    bestWinStreak: best.longestWinStreak,
    dailyCompleted: daily.completed,
    currentStreak: daily.currentStreak,
    bestStreak: daily.bestStreak,
    week: summary.week.days.map((day) => ({ ...text.weekdayOf(day.date), games: day.games })),
    gameStats: gameStatsOf(summary, counters, text),
  };
}
