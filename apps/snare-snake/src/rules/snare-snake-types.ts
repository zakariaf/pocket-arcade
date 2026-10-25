// apps/snare-snake/src/rules/snare-snake-types.ts
// Snare Snake v1 (spec 13): turn-based Snake where crossing the snake's own body closes a loop,
// catches the critters inside it and spends those segments. Swipe to steer; each move the snake
// moves one cell and the critters hop. The design fix (design notes): the snake starts coiled
// around a nest, critters keep away from the snake and freeze beside it, and a loop also catches
// the critters touching it.
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** The four ways to steer, in the fixed order listMoves uses. Physical: the board never mirrors. */
export type Direction = 'up' | 'right' | 'down' | 'left';

/** A critter and its cell (row * cols + col); ids are 0.. in placement order and never reused. */
export type Critter = { readonly id: number; readonly cell: number };

export type SnareSnakeState = {
  /** 0..100 as passed to create (clamped); the tuning row comes from it. */
  readonly difficulty: number;
  readonly cols: number;
  readonly rows: number;
  /** The snake's cells (row * cols + col), from the head to the tip of the tail. */
  readonly snake: readonly number[];
  /** The critters still on the board, by id. */
  readonly critters: readonly Critter[];
  /** Critters of the level: it is won when every one is caught. */
  readonly total: number;
  readonly caught: number;
  /** Segments still to grow: the tail stays put for that many moves. */
  readonly growth: number;
  readonly moves: number;
  readonly maxMoves: number;
  readonly score: number;
  /**
   * Where the head looks when its neck does not show it: the way the player steered into a loop
   * (the bitten segment's neck points elsewhere). null when the neck shows it (every other move).
   */
  readonly heading: Direction | null;
  /** True once the run used its one continue (spec 8.10). */
  readonly hasContinued: boolean;
  /** The seeded RNG the critters' hops draw from (spec 8.13: same seed and moves, same run). */
  readonly rng: RngState;
};

/** One swipe (or tap toward a side): the head moves one cell that way. */
export type SnareSnakeMove = { readonly kind: 'steer'; readonly direction: Direction };

/** A critter's hop from one cell to the next. */
export type CritterHop = { readonly critterId: number; readonly from: number; readonly to: number };

/**
 * Past tense, kebab-case, with every cell and id the board, the sounds and the counters need.
 * Only the continue emits snake-stepped-back and moves-added.
 */
export type SnareSnakeEvent =
  | {
      readonly kind: 'snake-moved';
      readonly from: number;
      readonly to: number;
      /** The cell the tail left, or null when the snake grew instead. */
      readonly vacated: number | null;
      readonly length: number;
    }
  | {
      readonly kind: 'loop-closed';
      /** The loop's cells, from the old head to the bitten segment (the new head). */
      readonly loop: readonly number[];
      /** The cells inside the loop. */
      readonly enclosed: readonly number[];
      /** Segments the loop used up. */
      readonly spent: number;
      readonly length: number;
    }
  | {
      readonly kind: 'critters-caught';
      readonly critterIds: readonly number[];
      readonly cells: readonly number[];
      readonly count: number;
      readonly points: number;
    }
  | { readonly kind: 'critters-moved'; readonly hops: readonly CritterHop[] }
  | { readonly kind: 'bonus-added'; readonly points: number; readonly total: number }
  | {
      readonly kind: 'snake-stepped-back';
      readonly from: number;
      readonly to: number;
      readonly length: number;
    }
  | { readonly kind: 'moves-added'; readonly count: number };

export type SnareSnakeResult = ApplyResult<SnareSnakeState, SnareSnakeEvent>;
