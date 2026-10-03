// packages/shell/src/stores/progress-selectors.ts
import { freeHintsLeft } from '@e07/shell/stores/progress-reducer.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { ProgressStoreState } from '@e07/shell/stores/progress-store.ts';

type Levels = ProgressStoreState['progress']['levels'];

// Selectors return primitives or references that already live in the state.
// A selector that builds an object or array (selectPackStars) is called through useShallow.
export const selectLevels = (state: ProgressStoreState): Levels => state.progress.levels;
export const selectEndlessBest = (state: ProgressStoreState): number => state.progress.endlessBest;
export const selectDaily = (state: ProgressStoreState): ProgressStoreState['daily'] => state.daily;
export const selectProgressDispatch = (state: ProgressStoreState): ProgressStoreState['dispatch'] =>
  state.dispatch;

/** 0 when the level was never won. */
export function selectLevelStars(state: ProgressStoreState, level: number): 0 | 1 | 2 | 3 {
  return state.progress.levels[String(level)]?.stars ?? 0;
}

/** Home "Play - Level 13": the first level (1..levelCount) that has no result yet. */
export function selectNextLevel(state: ProgressStoreState, levelCount: number): number {
  for (let level = 1; level <= levelCount; level += 1) {
    if (state.progress.levels[String(level)] === undefined) return level;
  }
  return levelCount;
}

/** freePerDay: the game's daily allowance, useGameExtra().hints.freePerDay (0 = never free). */
export function selectFreeHintsLeft(
  state: ProgressStoreState,
  today: DateKey,
  freePerDay: number,
): number {
  return freeHintsLeft(state.hints, today, freePerDay);
}

/** Spec S12: the result-screen Premium line appears at most once per local day. */
export function selectCanShowUpsell(state: ProgressStoreState, today: DateKey): boolean {
  return state.upsell.lastShownOn !== today;
}

export type PackStars = { readonly earned: number; readonly total: number };

/** Builds a new object: call it as useProgressStore(useShallow((s) => selectPackStars(s, levels))). */
export function selectPackStars(state: ProgressStoreState, levels: readonly number[]): PackStars {
  let earned = 0;
  for (const level of levels) earned += selectLevelStars(state, level);
  return { earned, total: levels.length * 3 };
}
