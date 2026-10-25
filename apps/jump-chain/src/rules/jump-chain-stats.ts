// apps/jump-chain/src/rules/jump-chain-stats.ts
// Spec S10 game card for Jump Chain: "Pieces captured", "Longest chain", "Ranks cleared".
import type { JumpChainEvent } from './jump-chain-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

function countOf(events: readonly JumpChainEvent[], kind: JumpChainEvent['kind']): number {
  return events.filter((event) => event.kind === kind).length;
}

/** The jumps of the move's chain: its last jump's number (0 for a step). */
function chainOf(events: readonly JumpChainEvent[]): number {
  let longest = 0;
  for (const event of events)
    if (event.kind === 'piece-jumped') longest = Math.max(longest, event.jump);
  return longest;
}

/**
 * 2 to 4 counters for the S10 game card. `measure` sees ONE move's events; the Shell folds
 * the values over the kept move line of a finished run (undone moves never count). Ids are
 * kebab-case and permanent: they are keys in the save document.
 */
export const JUMP_CHAIN_STATS: StatsSpec<JumpChainEvent> = {
  counters: [
    {
      id: 'pieces-captured',
      labelId: 'jump-chain.stats.pieces-captured',
      aggregate: 'sum',
      measure: (events) => countOf(events, 'piece-jumped'),
    },
    {
      id: 'longest-chain',
      labelId: 'jump-chain.stats.longest-chain',
      aggregate: 'max',
      measure: chainOf,
    },
    {
      id: 'ranks-cleared',
      labelId: 'jump-chain.stats.ranks-cleared',
      aggregate: 'sum',
      measure: (events) => countOf(events, 'rank-cleared'),
    },
  ],
};
