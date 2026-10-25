// apps/merge-siege/src/rules/merge-siege-types.ts
// Merge Siege v1 (spec 13, catalogue entry 5): "2048-style swipe merging while numbered enemies
// march in; bigger tiles smash smaller enemies." Turn-based: a swipe slides every tile, then the
// enemies march, the next enemy enters and a new tile appears; the events explain each step.
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';
import type { SwipeDirection } from '@e07/game-kit/geom/classify-swipe.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** A player's tile (slides and merges) or an enemy (marches down from the top row). */
export type PieceKind = 'tile' | 'enemy';

/** One numbered piece; its number is a power of two (2, 4, 8, ...). */
export type Piece = {
  readonly id: number;
  readonly kind: PieceKind;
  readonly value: number;
};

/** A board cell: a piece or null. */
export type Cell = Piece | null;

/** The enemy shown above the board ("Next"): it enters the top row of its column. */
export type NextEnemy = {
  readonly col: number;
  readonly value: number;
};

export type MergeSiegeState = {
  /** 0..100 as passed to create (clamped); ENDLESS_DIFFICULTY is the endless run. */
  readonly difficulty: number;
  /** TUNING.cols x TUNING.rows, row-major (index = row * cols + col); row 0 is the top. */
  readonly cells: readonly Cell[];
  /** The enemy waiting to enter, or null once the level's whole wave has entered. */
  readonly next: NextEnemy | null;
  readonly swipes: number;
  /** Enemies that have entered so far (a level's wave has knobsFor(difficulty).goal). */
  readonly entered: number;
  readonly smashed: number;
  readonly score: number;
  readonly nextId: number;
  /** True once the run's one continue (spec 8.10) was used. */
  readonly hasContinued: boolean;
  readonly rng: RngState;
};

/** A swipe slides every tile one way (physical directions: the board never mirrors). */
export type MergeSiegeMove = {
  readonly kind: 'swipe';
  readonly direction: SwipeDirection;
};

/** A piece moving from one cell to another (cell indexes). */
export type Step = {
  readonly id: number;
  readonly from: number;
  readonly to: number;
};

/** A tile merged into its equal neighbour; value is the new number. */
export type Merge = {
  readonly id: number;
  readonly intoId: number;
  readonly cell: number;
  readonly value: number;
};

/** An enemy smashed by a tile (id is the enemy's, value its number). */
export type Smash = {
  readonly id: number;
  readonly tileId: number;
  readonly cell: number;
  readonly value: number;
};

/** A tile lost to a bigger enemy (id is the tile's, value its number). */
export type Loss = {
  readonly id: number;
  readonly enemyId: number;
  readonly cell: number;
  readonly value: number;
};

/** When a clash happened: the player's slide, the enemies' march, or an enemy entering. */
export type ClashPhase = 'slide' | 'march' | 'gate';

/**
 * Past tense, kebab-case, with every id and cell the board and the counters need. Only the
 * continue emits enemies-pushed-back.
 */
export type MergeSiegeEvent =
  | { readonly kind: 'tiles-slid'; readonly steps: readonly Step[] }
  | { readonly kind: 'tiles-merged'; readonly merges: readonly Merge[] }
  | {
      readonly kind: 'enemies-smashed';
      readonly phase: ClashPhase;
      readonly smashes: readonly Smash[];
    }
  | { readonly kind: 'tiles-lost'; readonly phase: ClashPhase; readonly losses: readonly Loss[] }
  | { readonly kind: 'enemies-marched'; readonly steps: readonly Step[] }
  | {
      readonly kind: 'enemy-entered';
      readonly id: number;
      readonly cell: number;
      readonly value: number;
    }
  | {
      readonly kind: 'tile-spawned';
      readonly id: number;
      readonly cell: number;
      readonly value: number;
    }
  | {
      readonly kind: 'enemies-pushed-back';
      readonly steps: readonly Step[];
      readonly drivenOff: readonly number[];
    }
  | { readonly kind: 'score-added'; readonly points: number; readonly total: number };

export type MergeSiegeResult = ApplyResult<MergeSiegeState, MergeSiegeEvent>;
