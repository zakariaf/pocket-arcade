// apps/stepstone/src/rules/stepstone-stats.ts
import type { StepstoneEvent } from './stepstone-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

/** Hops in one move's events (one per player-stepped). */
function hopsIn(events: readonly StepstoneEvent[]): number {
  return events.filter((event) => event.kind === 'player-stepped').length;
}

/** 1 when this move reached the flag at or under par (spec 8.1: the 3-star line), else 0. */
function atParIn(events: readonly StepstoneEvent[]): number {
  return events.some((event) => event.kind === 'goal-reached' && event.moves <= event.par) ? 1 : 0;
}

/** The distinct hop kinds the frog has stood on this run, as counted after this move's hop. */
function kindsIn(events: readonly StepstoneEvent[]): number {
  let kinds = 0;
  for (const event of events)
    if (event.kind === 'player-stepped') kinds = Math.max(kinds, event.kindsUsed);
  return kinds;
}

/**
 * The three counters of the S10 game card (spec 10 STATISTICS). `measure` sees ONE move's events;
 * the Shell folds the values over the kept move line of a finished run (undone moves never count).
 * Ids are kebab-case and permanent: they are keys in the save document.
 */
export const STEPSTONE_STATS: StatsSpec<StepstoneEvent> = {
  counters: [
    {
      id: 'tiles-stepped',
      labelId: 'stepstone.stats.tiles-stepped',
      aggregate: 'sum',
      measure: hopsIn,
    },
    {
      id: 'levels-at-par',
      labelId: 'stepstone.stats.levels-at-par',
      aggregate: 'sum',
      measure: atParIn,
    },
    { id: 'kinds-used', labelId: 'stepstone.stats.kinds-used', aggregate: 'max', measure: kindsIn },
  ],
};
