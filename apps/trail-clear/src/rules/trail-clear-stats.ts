// apps/trail-clear/src/rules/trail-clear-stats.ts
// Spec S10 game card for Trail Clear: "Loops closed", "Tiles placed", "Biggest loop".
import type { TrailClearEvent } from './trail-clear-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

function countOf(events: readonly TrailClearEvent[], kind: TrailClearEvent['kind']): number {
  return events.filter((event) => event.kind === kind).length;
}

/** The tiles of the biggest loop the move closed (0 when it closed none). */
function biggestLoopOf(events: readonly TrailClearEvent[]): number {
  let biggest = 0;
  for (const event of events)
    if (event.kind === 'loop-closed') biggest = Math.max(biggest, event.cells.length);
  return biggest;
}

/**
 * 2 to 4 counters for the S10 game card. `measure` sees ONE move's events; the Shell folds the
 * values over the kept move line of a finished run (the continue places no tile and closes no
 * loop). Ids are kebab-case and permanent: they are keys in the save document.
 */
export const TRAIL_CLEAR_STATS: StatsSpec<TrailClearEvent> = {
  counters: [
    {
      id: 'loops-closed',
      labelId: 'trail-clear.stats.loops-closed',
      aggregate: 'sum',
      measure: (events) => countOf(events, 'loop-closed'),
    },
    {
      id: 'tiles-placed',
      labelId: 'trail-clear.stats.tiles-placed',
      aggregate: 'sum',
      measure: (events) => countOf(events, 'tile-placed'),
    },
    {
      id: 'biggest-loop',
      labelId: 'trail-clear.stats.biggest-loop',
      aggregate: 'max',
      measure: biggestLoopOf,
    },
  ],
};
