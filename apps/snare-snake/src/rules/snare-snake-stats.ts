// apps/snare-snake/src/rules/snare-snake-stats.ts
// Spec S10 game card for Snare Snake: "Critters caught", "Loops closed", "Longest snake".
import type { SnareSnakeEvent } from './snare-snake-types.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';

/** Critters one move snared. */
function caughtIn(events: readonly SnareSnakeEvent[]): number {
  let caught = 0;
  for (const event of events) if (event.kind === 'critters-caught') caught += event.count;
  return caught;
}

/** The longest the snake was during one move (each snake event carries the length after it). */
function longestIn(events: readonly SnareSnakeEvent[]): number {
  let longest = 0;
  for (const event of events) {
    if ('length' in event) longest = Math.max(longest, event.length);
  }
  return longest;
}

/**
 * 2 to 4 counters for the S10 game card. `measure` sees ONE move's events; the Shell folds
 * the values over the kept move line of a finished run (undone moves never count). Ids are
 * kebab-case and permanent: they are keys in the save document.
 */
export const SNARE_SNAKE_STATS: StatsSpec<SnareSnakeEvent> = {
  counters: [
    {
      id: 'critters-caught',
      labelId: 'snare-snake.stats.critters-caught',
      aggregate: 'sum',
      measure: caughtIn,
    },
    {
      id: 'loops-closed',
      labelId: 'snare-snake.stats.loops-closed',
      aggregate: 'sum',
      measure: (events) => events.filter((event) => event.kind === 'loop-closed').length,
    },
    {
      id: 'longest-snake',
      labelId: 'snare-snake.stats.longest-snake',
      aggregate: 'max',
      measure: longestIn,
    },
  ],
};
