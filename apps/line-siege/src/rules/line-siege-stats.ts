// apps/line-siege/src/rules/line-siege-stats.ts
// Spec S10 game card for Line Siege: "Monsters defeated", "Beams fired", "Biggest combo".
import type { LineSiegeEvent } from './line-siege-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

function countOf(events: readonly LineSiegeEvent[], kind: LineSiegeEvent['kind']): number {
  return events.filter((event) => event.kind === kind).length;
}

/**
 * 2 to 4 counters for the S10 game card. `measure` sees ONE move's events; the Shell folds
 * the values over the kept move line of a finished run (undone moves never count). Ids are
 * kebab-case and permanent: they are keys in the save document.
 */
export const LINE_SIEGE_STATS: StatsSpec<LineSiegeEvent> = {
  counters: [
    {
      id: 'monsters-defeated',
      labelId: 'line-siege.stats.monsters-defeated',
      aggregate: 'sum',
      measure: (events) => countOf(events, 'monster-defeated'),
    },
    {
      id: 'beams-fired',
      labelId: 'line-siege.stats.beams-fired',
      aggregate: 'sum',
      measure: (events) => countOf(events, 'beam-fired'),
    },
    {
      id: 'biggest-combo',
      labelId: 'line-siege.stats.biggest-combo',
      aggregate: 'max',
      measure: (events) => countOf(events, 'row-cleared') + countOf(events, 'column-cleared'),
    },
  ],
};
