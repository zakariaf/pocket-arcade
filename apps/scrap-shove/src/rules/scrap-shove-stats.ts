// apps/scrap-shove/src/rules/scrap-shove-stats.ts
import type { ScrapShoveEvent } from './scrap-shove-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

/** Robots one move scrapped: every robot in a crash (into a robot, scrap or a heavy one) or crushed. */
function scrappedIn(events: readonly ScrapShoveEvent[]): number {
  let total = 0;
  for (const event of events) {
    if (event.kind === 'robots-crashed') total += event.robotIds.length;
    if (event.kind === 'robot-crushed') total += 1;
  }
  return total;
}

/** Heaps the player shoved in one move (a heavy robot's shove is not the player's). */
function shovedIn(events: readonly ScrapShoveEvent[]): number {
  return events.filter((event) => event.kind === 'scrap-shoved' && event.byRobotId === null).length;
}

/**
 * The three counters of the S10 game card (design notes, section 11). `measure` sees ONE move's
 * events; the Shell folds the values over the kept move line of a finished run (undone moves
 * never count). Ids are kebab-case and permanent: they are keys in the save document.
 */
export const SCRAP_SHOVE_STATS: StatsSpec<ScrapShoveEvent> = {
  counters: [
    {
      id: 'robots-scrapped',
      labelId: 'scrap-shove.stats.robots-scrapped',
      aggregate: 'sum',
      measure: scrappedIn,
    },
    {
      id: 'scrap-shoved',
      labelId: 'scrap-shove.stats.scrap-shoved',
      aggregate: 'sum',
      measure: shovedIn,
    },
    {
      id: 'biggest-crash',
      labelId: 'scrap-shove.stats.biggest-crash',
      aggregate: 'max',
      measure: scrappedIn,
    },
  ],
};
