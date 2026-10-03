// packages/shell/src/game-host/host-counter.ts
import type { MessageId } from '@e07/game-kit/contract/messages.ts';

/** One of the game's statistics counters as screens see it (S10 cards): save key, label, kind. */
export type HostCounter = {
  readonly id: string;
  readonly labelId: MessageId;
  /** 'max' counters are a best (Biggest combo): S10 shows them as ×6. */
  readonly aggregate?: 'sum' | 'max';
};
