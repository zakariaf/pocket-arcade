// packages/game-kit/src/contract/stats.ts
import type { MessageId } from '@e07/game-kit/contract/messages.ts';

/**
 * A game-specific statistic (S10 card; 2 to 4 per game). When a run ends the Shell
 * replays its final move line, measures each move's events and folds the numbers in.
 */
export type CounterSpec<TEvent> = {
  /** kebab-case and stable forever: it is a key in the save document. */
  readonly id: string;
  readonly labelId: MessageId;
  readonly aggregate: 'sum' | 'max';
  readonly measure: (events: readonly TEvent[]) => number;
};

export type StatsSpec<TEvent> = { readonly counters: readonly CounterSpec<TEvent>[] };
