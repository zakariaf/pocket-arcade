// packages/game-kit/src/contract/teaching.ts
import type { MessageId } from '@e07/game-kit/contract/messages.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Where the tutorial hand points; 'hud' elements are the Shell's top-bar buttons. */
export type TutorialPointer =
  | { readonly kind: 'target'; readonly target: BoardTarget }
  | { readonly kind: 'drag'; readonly from: BoardTarget; readonly to: BoardTarget }
  | { readonly kind: 'hud'; readonly element: 'undo' | 'hint' | 'pause' }
  | { readonly kind: 'none' };

/** One short sentence, one pointer, one expected action (spec S13). */
export type TutorialStep<TMove> = {
  readonly messageId: MessageId;
  readonly pointer: TutorialPointer;
  readonly expect: { readonly kind: 'any-move' } | { readonly kind: 'move'; readonly move: TMove };
};

/** A how-to-play page, illustrated by drawing `example` with the game's own board. */
export type HowToPlayStep<TState> = {
  readonly titleId: MessageId;
  readonly bodyId: MessageId;
  readonly example: TState;
  readonly pointer: TutorialPointer;
};

/** Spec 10 TEACHING. Skip appears from the second step (S13). */
export type TeachingSpec<TState, TMove> = {
  readonly tutorial: { readonly start: TState; readonly steps: readonly TutorialStep<TMove>[] };
  /** 3 to 5 pages (contract test). */
  readonly howToPlay: readonly HowToPlayStep<TState>[];
};
