// apps/swap-guard/src/rules/swap-guard-stats.ts
// Spec S10 game card for Swap Guard: "Enemies defeated", "Swaps made", "Double hits".
import type { SwapGuardEvent } from './swap-guard-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

/** The enemies one move's volley knocked out. */
function defeatedIn(events: readonly SwapGuardEvent[]): number {
  let defeated = 0;
  for (const event of events)
    if (event.kind === 'enemies-defeated') defeated += event.enemyIds.length;
  return defeated;
}

/**
 * 2 to 4 counters for the S10 game card. `measure` sees ONE move's events; the Shell folds the
 * values over the kept move line of a finished run (undone moves never count). Ids are
 * kebab-case and permanent: they are keys in the save document.
 */
export const SWAP_GUARD_STATS: StatsSpec<SwapGuardEvent> = {
  counters: [
    {
      id: 'enemies-defeated',
      labelId: 'swap-guard.stats.enemies-defeated',
      aggregate: 'sum',
      measure: defeatedIn,
    },
    {
      id: 'swaps-made',
      labelId: 'swap-guard.stats.swaps-made',
      aggregate: 'sum',
      measure: (events) => events.filter((event) => event.kind === 'pieces-swapped').length,
    },
    {
      id: 'double-hits',
      labelId: 'swap-guard.stats.double-hits',
      aggregate: 'sum',
      // Two or more enemies knocked out by one volley (spec 13: the double hit).
      measure: (events) => (defeatedIn(events) >= 2 ? 1 : 0),
    },
  ],
};
