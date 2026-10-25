// apps/swap-guard/src/rules/swap-guard-types.ts
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';

/** The four directions an enemy can face, physical (the board never mirrors, spec 7.5). */
export type Facing = 'up' | 'right' | 'down' | 'left';

/**
 * The three enemy kinds (the v1 cap): a spear strikes the square in front of it, an archer every
 * square in front up to and including the first piece in the way, a brute the four squares beside it.
 */
export type EnemyKind = 'spear' | 'archer' | 'brute';

/** One standing enemy. A brute strikes all around, so it always faces 'up'. */
export type Enemy = {
  readonly id: number;
  readonly kind: EnemyKind;
  readonly facing: Facing;
  /** Row-major square index: row * size + col. */
  readonly cell: number;
};

/** What the last swap did, kept so the one continue can undo it exactly (spec 8.10). */
export type LastSwap = {
  /** The guard's square before the swap (the swapped enemy, if any, stands there after it). */
  readonly from: number;
  /** The square the guard swapped to. */
  readonly to: number;
  /** The enemies the volley knocked out, where they stood when it landed. */
  readonly defeated: readonly Enemy[];
  /** The points the volley earned. */
  readonly points: number;
};

/**
 * Everything a run needs, JSON-safe. Nothing is drawn after create(): the whole future of a level
 * is fixed by its seed and difficulty, so the state carries no RNG.
 */
export type SwapGuardState = {
  /** Squares per side of the square board. */
  readonly size: number;
  /** The guard's square. */
  readonly guard: number;
  /** The standing enemies, sorted by id. */
  readonly enemies: readonly Enemy[];
  /** How many enemies the level started with (the progress line's total). */
  readonly enemyCount: number;
  readonly swaps: number;
  /** The swap budget: with enemies left after this many swaps the run is lost. */
  readonly maxSwaps: number;
  readonly score: number;
  /** A strike landed on the guard: the run is lost. */
  readonly isHit: boolean;
  readonly lastSwap: LastSwap | null;
  /** The one continue of the run was used. */
  readonly hasContinued: boolean;
};

/** The only move: the guard swaps places with a square next to it (an enemy or an empty tile). */
export type SwapGuardMove = {
  readonly kind: 'swap';
  readonly cell: number;
};

/** The squares one enemy strikes. */
export type Strike = {
  readonly enemyId: number;
  readonly cells: readonly number[];
};

/** Past tense, kebab-case, with every square and id the animation and the counters need. */
export type SwapGuardEvent =
  | {
      readonly kind: 'pieces-swapped';
      readonly from: number;
      readonly to: number;
      readonly enemyId: number | null;
    }
  | { readonly kind: 'strikes-landed'; readonly strikes: readonly Strike[] }
  | {
      readonly kind: 'enemies-defeated';
      readonly enemyIds: readonly number[];
      readonly cells: readonly number[];
    }
  | { readonly kind: 'guard-hit'; readonly cell: number; readonly enemyIds: readonly number[] }
  | {
      readonly kind: 'swap-reversed';
      readonly from: number;
      readonly to: number;
      readonly enemyId: number | null;
      readonly restoredIds: readonly number[];
    };

export type SwapGuardResult = ApplyResult<SwapGuardState, SwapGuardEvent>;
