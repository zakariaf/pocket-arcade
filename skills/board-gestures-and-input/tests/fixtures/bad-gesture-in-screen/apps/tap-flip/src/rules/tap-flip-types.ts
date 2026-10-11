// apps/tap-flip/src/rules/tap-flip-types.ts
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';

/** 0 = dark, 1 = lit. Numbers, not booleans: compact in saves and readable in goldens. */
export type Cell = 0 | 1;

/**
 * Everything a run needs and nothing else, JSON-safe (plain arrays and numbers). A game that
 * draws random numbers after create() (refills, spawns) also keeps its `rng: RngState` here.
 */
export type TapFlipState = {
  readonly cols: number;
  readonly rows: number;
  /** Row-major: index = row * cols + col. */
  readonly cells: readonly Cell[];
  readonly moves: number;
  readonly maxMoves: number;
};

/** A move says what the player chose, in board terms; applyMove decides what it does. */
export type TapFlipMove = {
  readonly kind: 'flip';
  readonly col: number;
  readonly row: number;
};

/** Past tense, kebab-case, with every index the animation and the counters need. */
export type TapFlipEvent =
  | { readonly kind: 'cells-flipped'; readonly cells: readonly number[] }
  | { readonly kind: 'board-cleared' }
  | { readonly kind: 'moves-added'; readonly count: number };

export type TapFlipResult = ApplyResult<TapFlipState, TapFlipEvent>;
