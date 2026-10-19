// apps/jump-chain/src/rules/jump-chain-types.ts
// Jump Chain v1 (spec 13: "Solo checkers: one piece against advancing enemy ranks; only multi-jump
// chains clear them"). Everything stands on the dark squares of a 7 x 10 checkerboard. Your piece
// jumps a diagonal neighbour onto the free square behind it, which captures that enemy, and a chain
// keeps jumping the same way (every jump up, or every jump down). Every few moves the enemy ranks
// advance one row (two squares straight down); an enemy that reaches the bottom row overruns your
// side and the run is lost.
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** A square of the board: column 0..6 from the left, row 0..9 from the top (row 9 is your side). */
export type Square = { readonly col: number; readonly row: number };

/** An enemy piece. Its row is negative while its rank still waits above the board. */
export type Enemy = {
  readonly id: number;
  /** The rank it came in with (0 = the level's front rank); a rank is cleared when none is left. */
  readonly rank: number;
  readonly col: number;
  readonly row: number;
};

/** Everything a run needs, JSON-safe. The RNG is kept because the endless run spawns new ranks. */
export type JumpChainState = {
  /** 0..100 as passed to create (clamped); ENDLESS_DIFFICULTY is the endless run. */
  readonly difficulty: number;
  readonly piece: Square;
  /** In id order. */
  readonly enemies: readonly Enemy[];
  /** Enemies of the level (in the endless run: every enemy that has appeared so far). */
  readonly total: number;
  readonly captured: number;
  /** Ranks made so far: the next rank's id. */
  readonly nextRank: number;
  readonly ranksCleared: number;
  readonly moves: number;
  /** Moves until the ranks advance: 1 means right after the next move. */
  readonly marchIn: number;
  readonly score: number;
  /** The one continue of the run was used (spec 8.10). */
  readonly hasContinued: boolean;
  readonly nextId: number;
  readonly rng: RngState;
};

/**
 * A step one square diagonally (only when no jump exists), or a jump chain: the landing squares in
 * order, each two squares diagonally from the one before, all up or all down.
 */
export type JumpChainMove =
  | { readonly kind: 'step'; readonly to: Square }
  | { readonly kind: 'jump'; readonly path: readonly Square[] };

/** One enemy moved by a march or by the continue. */
export type EnemyShift = {
  readonly enemyId: number;
  readonly col: number;
  readonly fromRow: number;
  readonly toRow: number;
};

/** Past tense, kebab-case, with every id and square the board and the counters need. */
export type JumpChainEvent =
  | { readonly kind: 'piece-stepped'; readonly from: Square; readonly to: Square }
  | {
      readonly kind: 'piece-jumped';
      readonly from: Square;
      readonly to: Square;
      readonly enemyId: number;
      /** 1 for the first jump of the chain, 2 for the second, and so on. */
      readonly jump: number;
    }
  | {
      readonly kind: 'enemies-captured';
      readonly enemyIds: readonly number[];
      /** Jumps in the chain (= enemies captured by this move). */
      readonly chain: number;
      readonly points: number;
    }
  | { readonly kind: 'rank-cleared'; readonly rank: number; readonly points: number }
  | { readonly kind: 'ranks-advanced'; readonly shifts: readonly EnemyShift[] }
  | { readonly kind: 'rank-spawned'; readonly rank: number; readonly enemies: readonly Enemy[] }
  | { readonly kind: 'side-reached'; readonly enemyIds: readonly number[] }
  | { readonly kind: 'ranks-stepped-back'; readonly shifts: readonly EnemyShift[] };

export type JumpChainResult = ApplyResult<JumpChainState, JumpChainEvent>;
