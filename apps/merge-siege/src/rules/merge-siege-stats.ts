// apps/merge-siege/src/rules/merge-siege-stats.ts
import type { Merge, MergeSiegeEvent } from './merge-siege-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

/** Enemies smashed in one move, in the slide, the march and at the gate alike. */
function smashedIn(events: readonly MergeSiegeEvent[]): number {
  let total = 0;
  for (const event of events) if (event.kind === 'enemies-smashed') total += event.smashes.length;
  return total;
}

function mergesIn(events: readonly MergeSiegeEvent[]): Merge[] {
  return events.flatMap((event) => (event.kind === 'tiles-merged' ? event.merges : []));
}

/** The biggest tile a merge made in one move (0 when nothing merged). */
function biggestMergeIn(events: readonly MergeSiegeEvent[]): number {
  return mergesIn(events).reduce((biggest, merge) => Math.max(biggest, merge.value), 0);
}

/**
 * 3 counters for the S10 game card (design notes, "Statistics"). `measure` sees ONE move's events;
 * the Shell folds the values over the kept move line of a finished run (undone moves never count).
 * Ids are kebab-case and permanent: they are keys in the save document.
 */
export const MERGE_SIEGE_STATS: StatsSpec<MergeSiegeEvent> = {
  counters: [
    {
      id: 'enemies-smashed',
      labelId: 'merge-siege.stats.enemies-smashed',
      aggregate: 'sum',
      measure: smashedIn,
    },
    {
      id: 'tiles-merged',
      labelId: 'merge-siege.stats.tiles-merged',
      aggregate: 'sum',
      measure: (events) => mergesIn(events).length,
    },
    {
      id: 'biggest-tile',
      labelId: 'merge-siege.stats.biggest-tile',
      aggregate: 'max',
      measure: biggestMergeIn,
    },
  ],
};
