// apps/__GAME_ID__/src/rules/__GAME_ID__-stats.ts
import type { __GAME_PASCAL__Event } from './__GAME_ID__-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

function flippedIn(events: readonly __GAME_PASCAL__Event[]): number {
  let total = 0;
  for (const event of events) if (event.kind === 'cells-flipped') total += event.cells.length;
  return total;
}

/**
 * 2 to 4 counters for the S10 game card. `measure` sees ONE move's events; the Shell folds
 * the values over the kept move line of a finished run (undone moves never count). Ids are
 * kebab-case and permanent: they are keys in the save document.
 */
export const __GAME_CONST___STATS: StatsSpec<__GAME_PASCAL__Event> = {
  counters: [
    {
      id: 'cells-flipped',
      labelId: '__GAME_ID__.stats.cells-flipped',
      aggregate: 'sum',
      measure: flippedIn,
    },
    {
      id: 'boards-cleared',
      labelId: '__GAME_ID__.stats.boards-cleared',
      aggregate: 'sum',
      measure: (events) => events.filter((event) => event.kind === 'board-cleared').length,
    },
    {
      id: 'biggest-flip',
      labelId: '__GAME_ID__.stats.biggest-flip',
      aggregate: 'max',
      measure: flippedIn,
    },
  ],
};
