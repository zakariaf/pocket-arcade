// packages/shell/src/stores/stats-model.test.ts
import { DEFAULT_STATS } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { measureRunCounters, recordFinishedRun, STATS_KEEP_DAYS } from './stats-model.ts';

import type { FinishedRun } from './stats-model.ts';

const WIN: FinishedRun = { mode: 'level', isWon: true, score: 300, playMs: 60_000, counters: {} };
const LOSS: FinishedRun = { ...WIN, isWon: false, score: 50 };

describe('stats-model', () => {
  it('counts games, wins, losses and play time', () => {
    const stats = [WIN, LOSS, WIN].reduce(
      (acc, run) => recordFinishedRun(acc, run, '2026-09-26'),
      DEFAULT_STATS,
    );
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.playMs).toBe(180_000);
  });

  it('keeps the longest win streak after a loss resets the current one', () => {
    const stats = [WIN, WIN, WIN, LOSS, WIN].reduce(
      (acc, run) => recordFinishedRun(acc, run, '2026-09-26'),
      DEFAULT_STATS,
    );
    expect(stats.currentWinStreak).toBe(1);
    expect(stats.longestWinStreak).toBe(3);
  });

  it('keeps the best score per mode', () => {
    const daily = { ...WIN, mode: 'daily', score: 999 } as const;
    const stats = [WIN, daily, { ...WIN, score: 10 }].reduce(
      (acc, run) => recordFinishedRun(acc, run, '2026-09-26'),
      DEFAULT_STATS,
    );
    expect(stats.bestScore).toStrictEqual({ level: 300, daily: 999, endless: 0 });
  });

  it('keeps games per day for the last two weeks only', () => {
    const early = recordFinishedRun(DEFAULT_STATS, WIN, '2026-09-01');
    const late = recordFinishedRun(early, WIN, '2026-09-26');
    expect(Object.keys(late.days)).toStrictEqual(['2026-09-26']);
    expect(STATS_KEEP_DAYS).toBe(14);
    const twice = recordFinishedRun(late, WIN, '2026-09-26');
    expect(twice.days['2026-09-26']).toStrictEqual({ games: 2, playMs: 120_000 });
  });

  it('folds game counters by sum or max', () => {
    const run = (value: number): FinishedRun => ({
      ...WIN,
      counters: {
        'monsters-defeated': { value, aggregate: 'sum' },
        'biggest-combo': { value, aggregate: 'max' },
      },
    });
    const stats = [run(4), run(7), run(2)].reduce(
      (acc, next) => recordFinishedRun(acc, next, '2026-09-26'),
      DEFAULT_STATS,
    );
    expect(stats.counters).toStrictEqual({ 'monsters-defeated': 13, 'biggest-combo': 7 });
  });

  it('measures counters over the final move line only', () => {
    const counters = [
      {
        id: 'beams-fired',
        aggregate: 'sum',
        measure: (events: readonly string[]) => events.length,
      },
      {
        id: 'biggest-combo',
        aggregate: 'max',
        measure: (events: readonly string[]) => events.length,
      },
    ] as const;
    expect(measureRunCounters(counters, [['a'], ['a', 'b', 'c'], []])).toStrictEqual({
      'beams-fired': { value: 4, aggregate: 'sum' },
      'biggest-combo': { value: 3, aggregate: 'max' },
    });
  });
});
