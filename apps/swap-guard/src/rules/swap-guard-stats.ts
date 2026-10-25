// apps/swap-guard/src/rules/swap-guard-stats.ts
// Spec S10 game card for Swap Guard: "Enemies defeated", "Swaps made", "Double hits".
import type { SwapGuardEvent } from './swap-guard-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

/** What one step adds to the counters; a continue's 'swap-reversed' takes its swap back. */
type StepTally = { readonly defeated: number; readonly swaps: number; readonly doubles: number };

/**
 * One step's counts. A swap counts once, its volley's knock-outs, and a double hit for two or
 * more; the continue's 'swap-reversed' subtracts all three for the swap it undid (spec 8.10).
 */
function tallyOf(events: readonly SwapGuardEvent[]): StepTally {
  let defeated = 0;
  let swaps = 0;
  let doubles = 0;
  for (const event of events) {
    if (event.kind === 'pieces-swapped') swaps += 1;
    if (event.kind === 'enemies-defeated') {
      defeated += event.enemyIds.length;
      if (event.enemyIds.length >= 2) doubles += 1;
    }
    if (event.kind === 'swap-reversed') {
      swaps -= 1;
      defeated -= event.restoredIds.length;
      if (event.restoredIds.length >= 2) doubles -= 1;
    }
  }
  return { defeated, swaps, doubles };
}

/**
 * 2 to 4 counters for the S10 game card. `measure` sees ONE step's events; the Shell folds the
 * values over the kept line of a finished run, its continue included (undone moves never count).
 * The continue takes the last swap back, so its 'swap-reversed' event subtracts what that swap
 * counted (spec 8.10). Ids are kebab-case and permanent: they are keys in the save document.
 */
export const SWAP_GUARD_STATS: StatsSpec<SwapGuardEvent> = {
  counters: [
    {
      id: 'enemies-defeated',
      labelId: 'swap-guard.stats.enemies-defeated',
      aggregate: 'sum',
      measure: (events) => tallyOf(events).defeated,
    },
    {
      id: 'swaps-made',
      labelId: 'swap-guard.stats.swaps-made',
      aggregate: 'sum',
      measure: (events) => tallyOf(events).swaps,
    },
    {
      id: 'double-hits',
      labelId: 'swap-guard.stats.double-hits',
      aggregate: 'sum',
      // Two or more enemies knocked out by one volley (spec 13: the double hit).
      measure: (events) => tallyOf(events).doubles,
    },
  ],
};
