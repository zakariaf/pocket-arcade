// packages/shell/src/stores/run-end.ts
import { recordDailyResult } from '@e07/shell/stores/daily-model.ts';
import { recordEndlessScore, recordLevelResult } from '@e07/shell/stores/progress-reducer.ts';
import { recordFinishedRun } from '@e07/shell/stores/stats-model.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { LevelWin } from '@e07/shell/stores/progress-reducer.ts';
import type { FinishedRun } from '@e07/shell/stores/stats-model.ts';

type RunEndBase = {
  readonly isWon: boolean;
  readonly score: number;
  readonly moves: number;
  readonly playMs: number;
  readonly counters: FinishedRun['counters'];
};

/** How a run ended, by mode. A daily run carries the date it STARTED on (run.ref.date). */
export type RunEnd = RunEndBase &
  (
    | { readonly mode: 'level'; readonly level: number; readonly stars: LevelWin['stars'] }
    | { readonly mode: 'daily'; readonly date: DateKey }
    | { readonly mode: 'endless' }
    | { readonly mode: 'tutorial' }
  );

function finishedRun(end: RunEnd & { readonly mode: FinishedRun['mode'] }): FinishedRun {
  const { mode, isWon, score, playMs, counters } = end;
  return { mode, isWon, score, playMs, counters };
}

function withStats(doc: SaveDoc, end: RunEnd, today: DateKey): SaveDoc {
  if (end.mode === 'tutorial') return doc;
  return { ...doc, stats: recordFinishedRun(doc.stats, finishedRun(end), today) };
}

/**
 * Pure: the whole run-end write, applied in ONE save update with the backup refreshed, before
 * the result screen appears (spec S7). The run is cleared; the tutorial is not a game; a daily
 * replay (its date already recorded) changes neither the day's result nor the statistics.
 */
export function applyRunEnd(doc: SaveDoc, end: RunEnd, today: DateKey): SaveDoc {
  const cleared: SaveDoc = { ...doc, run: null };
  switch (end.mode) {
    case 'tutorial':
      return cleared;
    case 'level': {
      const { level, stars, score, moves, isWon } = end;
      const progress = isWon
        ? recordLevelResult(doc.progress, { level, stars, score, moves, date: today })
        : doc.progress;
      return withStats({ ...cleared, progress }, end, today);
    }
    case 'daily': {
      if (end.date in doc.daily.results) return cleared;
      const { isWon, score, moves, playMs } = end;
      const daily = recordDailyResult(doc.daily, end.date, { won: isWon, score, moves, playMs });
      return withStats({ ...cleared, daily }, end, today);
    }
    case 'endless':
      return withStats(
        { ...cleared, progress: recordEndlessScore(doc.progress, end.score) },
        end,
        today,
      );
  }
}
