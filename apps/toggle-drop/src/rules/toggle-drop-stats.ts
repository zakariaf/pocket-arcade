// apps/toggle-drop/src/rules/toggle-drop-stats.ts
// Spec S10 game card for Toggle Drop: "Balls dropped", "Switches flipped", "Cups filled".
import type { ToggleDropEvent } from './toggle-drop-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

function countOf(events: readonly ToggleDropEvent[], kind: ToggleDropEvent['kind']): number {
  return events.filter((event) => event.kind === kind).length;
}

/**
 * 3 counters for the S10 game card. `measure` sees ONE move's events; the Shell folds the values
 * over the kept move line of a finished run (undone moves never count). Ids are kebab-case and
 * permanent: they are keys in the save document.
 */
export const TOGGLE_DROP_STATS: StatsSpec<ToggleDropEvent> = {
  counters: [
    {
      id: 'balls-dropped',
      labelId: 'toggle-drop.stats.balls-dropped',
      aggregate: 'sum',
      measure: (events) => countOf(events, 'ball-dropped'),
    },
    {
      id: 'switches-flipped',
      labelId: 'toggle-drop.stats.switches-flipped',
      aggregate: 'sum',
      measure: (events) => countOf(events, 'switch-flipped'),
    },
    {
      id: 'cups-filled',
      labelId: 'toggle-drop.stats.cups-filled',
      aggregate: 'sum',
      measure: (events) => countOf(events, 'cup-filled'),
    },
  ],
};
