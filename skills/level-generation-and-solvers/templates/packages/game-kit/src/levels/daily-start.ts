// packages/game-kit/src/levels/daily-start.ts
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';

import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

/** Seed and difficulty of one daily challenge: the input of engine.create. */
export type DailyStart = { readonly seed: number; readonly difficulty: number };

/**
 * Spec 8.3: today's local date plus the game's salt, through the same generator as normal
 * levels, at the daily difficulty. null when the game has no daily mode.
 */
export function dailyStart<TState, TMove>(
  levels: Pick<LevelsSpec<TState, TMove>, 'daily'>,
  date: DateKey,
): DailyStart | null {
  if (levels.daily.kind === 'none') return null;
  return { seed: dailySeed(date, levels.daily.salt), difficulty: levels.daily.difficulty };
}
