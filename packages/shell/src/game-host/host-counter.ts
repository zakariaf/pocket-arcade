// packages/shell/src/game-host/host-counter.ts
import type { MessageId } from '@e07/game-kit/contract/messages.ts';

/** One of the game's statistics counters as screens see it (S10 cards): save key, label, kind. */
export type HostCounter = {
  readonly id: string;
  readonly labelId: MessageId;
  /** 'max' counters are a best (Biggest combo): S10 shows them as ×6. */
  readonly aggregate?: 'sum' | 'max';
  /** How S10 writes a reached 'max' counter: 'multiplier' (×6, the default) or 'plain' (23). */
  readonly bestOfStyle?: 'multiplier' | 'plain';
};

type CounterFacts = Omit<HostCounter, 'bestOfStyle'> & {
  readonly bestOfStyle: HostCounter['bestOfStyle'] | undefined;
};

/** The game's counter without its measure, its best-of style only when the game names one. */
export function hostCounterOf({ bestOfStyle, ...counter }: CounterFacts): HostCounter {
  return bestOfStyle === undefined ? counter : { ...counter, bestOfStyle };
}
