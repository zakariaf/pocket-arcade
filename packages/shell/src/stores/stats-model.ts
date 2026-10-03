// packages/shell/src/stores/stats-model.ts
import { daysBetween } from '@e07/game-kit/dates/date-key.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type StatsSection = SaveDoc['stats'];

/** One counter value measured over a run's final move line. */
export type CounterValue = { readonly value: number; readonly aggregate: 'sum' | 'max' };

/** Summary of one finished (won or lost) non-tutorial run. */
export type FinishedRun = {
  readonly mode: 'level' | 'daily' | 'endless';
  readonly isWon: boolean;
  readonly score: number;
  readonly playMs: number;
  /** CounterSpec.id -> value measured over this run's final move line. */
  readonly counters: Readonly<Record<string, CounterValue>>;
};

/** The part of a game's CounterSpec the Shell needs to measure a run. */
export type CounterMeasure<TEvent> = {
  readonly id: string;
  readonly aggregate: 'sum' | 'max';
  readonly measure: (events: readonly TEvent[]) => number;
};

/** Games and time per local day are kept for this many days (the S10 chart shows 7). */
export const STATS_KEEP_DAYS = 14;

/**
 * Measures each counter over the events of every move on the run's FINAL line (undone moves
 * are not in it). 'sum' adds the per-move values up, 'max' keeps the largest one.
 */
export function measureRunCounters<TEvent>(
  counters: readonly CounterMeasure<TEvent>[],
  eventsPerMove: readonly (readonly TEvent[])[],
): Readonly<Record<string, CounterValue>> {
  const result: Record<string, CounterValue> = {};
  for (const counter of counters) {
    const values = eventsPerMove.map((events) => counter.measure(events));
    const value =
      counter.aggregate === 'sum'
        ? values.reduce((total, next) => total + next, 0)
        : Math.max(0, ...values);
    result[counter.id] = { value, aggregate: counter.aggregate };
  }
  return result;
}

function foldCounters(
  current: StatsSection['counters'],
  run: FinishedRun,
): StatsSection['counters'] {
  const next: Record<string, number> = { ...current };
  for (const [id, { value, aggregate }] of Object.entries(run.counters)) {
    const previous = next[id] ?? 0;
    next[id] = aggregate === 'sum' ? previous + value : Math.max(previous, value);
  }
  return next;
}

function addDay(days: StatsSection['days'], today: DateKey, playMs: number): StatsSection['days'] {
  const day = days[today] ?? { games: 0, playMs: 0 };
  const merged = { ...days, [today]: { games: day.games + 1, playMs: day.playMs + playMs } };
  return Object.fromEntries(
    Object.entries(merged).filter(([date]) => daysBetween(date, today) < STATS_KEEP_DAYS),
  );
}

/** Written in the SAME save update as the level result, before S7 appears. */
export function recordFinishedRun(
  stats: StatsSection,
  run: FinishedRun,
  today: DateKey,
): StatsSection {
  const currentWinStreak = run.isWon ? stats.currentWinStreak + 1 : 0;
  return {
    ...stats,
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + (run.isWon ? 1 : 0),
    losses: stats.losses + (run.isWon ? 0 : 1),
    playMs: stats.playMs + run.playMs,
    bestScore: { ...stats.bestScore, [run.mode]: Math.max(stats.bestScore[run.mode], run.score) },
    currentWinStreak,
    longestWinStreak: Math.max(stats.longestWinStreak, currentWinStreak),
    days: addDay(stats.days, today, run.playMs),
    counters: foldCounters(stats.counters, run),
  };
}
