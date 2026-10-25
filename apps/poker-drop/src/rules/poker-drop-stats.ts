// apps/poker-drop/src/rules/poker-drop-stats.ts
import { handStrength } from './hand-rank.ts';

import type { PokerDropEvent } from './poker-drop-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

type Burst = Extract<PokerDropEvent, { kind: 'hand-burst' }>;

/** A straight and every hand above it is a big hand (design notes 11). */
const BIG_HAND = handStrength('straight');

function burstsIn(events: readonly PokerDropEvent[]): Burst[] {
  return events.filter((event): event is Burst => event.kind === 'hand-burst');
}

/**
 * Design notes 11: 2 to 4 counters for the S10 game card. `measure` sees ONE move's events; the
 * Shell folds the values over the kept move line of a finished run. Ids are kebab-case and
 * permanent: they are keys in the save document.
 */
export const POKER_DROP_STATS: StatsSpec<PokerDropEvent> = {
  counters: [
    {
      id: 'hands-made',
      labelId: 'poker-drop.stats.hands-made',
      aggregate: 'sum',
      measure: (events) => burstsIn(events).length,
    },
    {
      id: 'big-hands',
      labelId: 'poker-drop.stats.big-hands',
      aggregate: 'sum',
      measure: (events) =>
        burstsIn(events).filter((burst) => handStrength(burst.hand) >= BIG_HAND).length,
    },
    {
      // The longest chain of cascade steps in one drop; S10 shows it as "x3".
      id: 'biggest-cascade',
      labelId: 'poker-drop.stats.biggest-cascade',
      aggregate: 'max',
      measure: (events) => Math.max(0, ...burstsIn(events).map((burst) => burst.step)),
    },
  ],
};
