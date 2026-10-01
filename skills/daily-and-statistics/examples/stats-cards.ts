// packages/shell/src/screens/stats/stats-cards.ts
// Example: turning the S10 summary into the cells the Stats screen draws. Each cell carries the
// Toybox testID of its stat-grid cell, the copy-deck key of its label, and its value in the form
// the screen formats it (chosen digits; stats.duration, stats.levels.stars-value, daily.streak.days).
// Two values are bare, as the design draws them: the win rate is the percentage alone ("62%", from
// createPercentFormatter, under the label stats.overview.win-rate; never the sentence stats.win-rate,
// "Win rate 62%"), and a best-of game counter (aggregate 'max') reads as a multiplier ("×6"), while
// a running total ('sum') is the plain number. When the Toybox screen templates are in the repo,
// their stats-cells.ts and stats-snapshot-of.ts do this job; this example shows which summary field
// feeds which testID and message.
import type { StatsSummary } from '@e07/shell/screens/stats/stats-summary.ts';

export type StatValue =
  | { readonly kind: 'count'; readonly value: number }
  /** A 0..1 rate shown as the bare percentage ("62%"), never inside the stats.win-rate sentence. */
  | { readonly kind: 'percent'; readonly rate: number }
  /** A best-of counter (aggregate 'max'), shown with the multiplication sign ("×6"). */
  | { readonly kind: 'multiplier'; readonly value: number }
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

/** A game counter as the game module declares it (GameHost.counters): save key, label, fold. */
export type GameCounterMeta = {
  readonly id: string;
  readonly labelId: string;
  /** 'sum' adds every run's value (a running total); 'max' keeps the best run (a best-of). */
  readonly aggregate: 'sum' | 'max';
};

/**
 * The game's card (3 columns): one cell per counter in game order. A best-of ('max') is a
 * multiplier ("Biggest combo ×6"); a running total ('sum') the plain number ("Monsters defeated 42").
 */
export function gameCells(
  view: StatsSummary,
  counters: readonly GameCounterMeta[],
): readonly SummaryCell[] {
  return counters.map((counter) => {
    const value = view.counters.find((each) => each.id === counter.id)?.value ?? 0;
    return {
      testID: `stats.game-card.${counter.id}`,
      labelKey: counter.labelId,
      value: counter.aggregate === 'max' ? { kind: 'multiplier', value } : count(value),
    };
  });
}
