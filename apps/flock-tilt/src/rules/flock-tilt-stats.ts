// apps/flock-tilt/src/rules/flock-tilt-stats.ts
import type { FlockTiltEvent } from './flock-tilt-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

/** How many events of one kind a move made. */
function countOf(events: readonly FlockTiltEvent[], kind: FlockTiltEvent['kind']): number {
  return events.filter((event) => event.kind === kind).length;
}

/** 1 when this move cleared the field in no more tilts than its par, else 0. */
function solvedAtParIn(events: readonly FlockTiltEvent[]): number {
  return events.filter((event) => event.kind === 'field-cleared' && event.tilts <= event.par)
    .length;
}

/**
 * The three counters of the S10 game card. `measure` sees ONE move's events; the Shell folds the
 * values over the kept move line of a finished run (undone tilts never count). Ids are kebab-case
 * and permanent: they are keys in the save document.
 */
export const FLOCK_TILT_STATS: StatsSpec<FlockTiltEvent> = {
  counters: [
    {
      id: 'sheep-penned',
      labelId: 'flock-tilt.stats.sheep-penned',
      aggregate: 'sum',
      measure: (events) => countOf(events, 'sheep-penned'),
    },
    {
      // Every legal tilt slides at least one animal, so one move makes one animals-slid event.
      id: 'tilts-made',
      labelId: 'flock-tilt.stats.tilts-made',
      aggregate: 'sum',
      measure: (events) => countOf(events, 'animals-slid'),
    },
    {
      id: 'solved-at-par',
      labelId: 'flock-tilt.stats.solved-at-par',
      aggregate: 'sum',
      measure: solvedAtParIn,
    },
  ],
};
