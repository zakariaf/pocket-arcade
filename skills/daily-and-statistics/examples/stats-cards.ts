// packages/shell/src/screens/stats/stats-cards.ts
// Example: turning the S10 summary into the cells the Stats screen draws. Each cell carries the
// Toybox testID of its stat-grid cell, the copy-deck key of its label, and its value in the form
// the value message needs; the component only formats (chosen digits, ::percent, stats.duration,
// stats.levels.stars-value, daily.streak.days) and lays out the stat grid. When the Toybox screen
// templates are in the repo, their stats-cells.ts does this job from StatsSnapshot; this example
// shows which summary field feeds which testID and message.
import type { StatsSummary } from '@e07/shell/screens/stats/stats-summary.ts';

export type StatValue =
  | { readonly kind: 'count'; readonly value: number }
  | { readonly kind: 'percent'; readonly rate: number }
  | { readonly kind: 'duration'; readonly hours: number; readonly minutes: number }
  | { readonly kind: 'stars'; readonly earned: number; readonly total: number }
  | { readonly kind: 'days'; readonly daysCount: number };

export type SummaryCell = {
  /** The cell; its parts are `${testID}.value` and `${testID}.label`. */
  readonly testID: string;
  readonly labelKey: string;
  readonly value: StatValue;
};

const count = (value: number): StatValue => ({ kind: 'count', value });
const days = (daysCount: number): StatValue => ({ kind: 'days', daysCount });

/** The Overview card (2 columns): games played, wins, win rate, total play time. */
export function overviewCells(view: StatsSummary): readonly SummaryCell[] {
  const { gamesPlayed, wins, winRate, playTime } = view.overview;
  return [
    {
      testID: 'stats.overview-card.games-played',
      labelKey: 'stats.overview.games-played',
      value: count(gamesPlayed),
    },
    { testID: 'stats.overview-card.wins', labelKey: 'stats.overview.wins', value: count(wins) },
    {
      testID: 'stats.overview-card.win-rate',
      labelKey: 'stats.overview.win-rate',
      value: { kind: 'percent', rate: winRate },
    },
    {
      testID: 'stats.overview-card.play-time',
      labelKey: 'stats.overview.play-time',
      value: { kind: 'duration', ...playTime },
    },
  ];
}

/** The Levels card (3 columns): completed, stars earned / total, three-star levels. */
export function levelCells(view: StatsSummary): readonly SummaryCell[] {
  const { completed, starsEarned, starsTotal, threeStarLevels } = view.levels;
  return [
    {
      testID: 'stats.levels-card.completed',
      labelKey: 'stats.levels.completed',
      value: count(completed),
    },
    {
      testID: 'stats.levels-card.stars',
      labelKey: 'stats.levels.stars',
      value: { kind: 'stars', earned: starsEarned, total: starsTotal },
    },
    {
      testID: 'stats.levels-card.three-star',
      labelKey: 'stats.levels.three-star',
      value: count(threeStarLevels),
    },
  ];
}

/** The Daily card (3 columns): challenges completed, current streak, best streak. */
export function dailyCells(view: StatsSummary): readonly SummaryCell[] {
  const { completed, currentStreak, bestStreak } = view.daily;
  return [
    {
      testID: 'stats.daily-card.completed',
      labelKey: 'stats.daily.completed',
      value: count(completed),
    },
    {
      testID: 'stats.daily-card.current-streak',
      labelKey: 'daily.streak.current',
      value: days(currentStreak),
    },
    {
      testID: 'stats.daily-card.best-streak',
      labelKey: 'daily.streak.best',
      value: days(bestStreak),
    },
  ];
}
