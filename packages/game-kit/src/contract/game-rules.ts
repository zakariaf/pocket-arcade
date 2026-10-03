// packages/game-kit/src/contract/game-rules.ts
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';
import type { Message, MessageId } from '@e07/game-kit/contract/messages.ts';

/** Top bar (S5): the score and the goal/progress line, e.g. "Moves 5 / Par 7". */
export type Hud = {
  readonly score: number;
  readonly goal: Message;
};

export type UndoPolicy =
  | { readonly kind: 'none' }
  | { readonly kind: 'unlimited' }
  | { readonly kind: 'limited'; readonly perLevel: number };

export type HintPolicy<TState, TMove> =
  | { readonly kind: 'none' }
  | { readonly kind: 'solver'; readonly suggest: (state: TState) => TMove | null };

/** Spec 8.10: at most one continue per level or run, only after a loss. */
export type ContinuePolicy<TState, TEvent> =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'once';
      readonly descriptionId: MessageId;
      readonly apply: (lost: TState) => ApplyResult<TState, TEvent>;
    };

/** Spec 10 RULES beyond the engine functions (GameEngine holds the engine functions). Pure. */
export type GameRules<TState, TMove, TEvent> = {
  readonly hud: (state: TState) => Hud;
  readonly undo: UndoPolicy;
  readonly hints: HintPolicy<TState, TMove>;
  readonly continueRun: ContinuePolicy<TState, TEvent>;
};
