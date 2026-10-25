// apps/stepstone/src/rules/stepstone-types.ts
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';

/**
 * The hop a stone gives the frog standing on it (spec 13: "the tile the player stands on sets the
 * next move (knight, rook, bishop...)"). v1 caps the kinds at four glyphs that read at phone size:
 * king (ring: one square any way), rook (plus: straight, any distance), bishop (×: diagonal, any
 * distance), knight (L: the chess knight's leap).
 */
export type MoveKind = 'king' | 'rook' | 'bishop' | 'knight';

/** A pond cell: open water, the flag stone, a stone that sank once the frog left it, or a stone. */
export type Cell = 'water' | 'flag' | 'sunk' | MoveKind;

/** Everything a run needs, JSON-safe. The rules draw nothing after create(), so no rng is kept. */
export type StepstoneState = {
  /** Cells per side of the square pond. */
  readonly side: number;
  /** Row-major: index = row * side + col. */
  readonly cells: readonly Cell[];
  /** The cell the frog stands on; its stone's kind is the frog's next hop. */
  readonly frog: number;
  /** Hops made so far. */
  readonly moves: number;
  /** The fewest hops from the start to the flag (the solver's par), shown in the top bar. */
  readonly par: number;
  /** The hop kinds the frog has stood on this run, in first-seen order (the start stone's first). */
  readonly kindsUsed: readonly MoveKind[];
};

/** One hop: land on this cell. applyMove decides what it does. */
export type StepstoneMove = {
  readonly kind: 'hop';
  readonly to: number;
};

/** Past tense, kebab-case, with every cell and kind the animation and the counters need. */
export type StepstoneEvent =
  | {
      readonly kind: 'player-stepped';
      readonly from: number;
      readonly to: number;
      /** The hop the frog used (its old stone's kind). */
      readonly moveKind: MoveKind;
      /** Distinct hop kinds stood on this run after this hop (the kinds-used counter). */
      readonly kindsUsed: number;
    }
  /** The stone the frog left went under; `stone` is its hop kind (the board draws it sinking). */
  | { readonly kind: 'stone-sank'; readonly cell: number; readonly stone: MoveKind }
  | {
      readonly kind: 'move-kind-changed';
      /** The stone the frog landed on, which now sets its hop. */
      readonly cell: number;
      readonly from: MoveKind;
      readonly to: MoveKind;
      /** True the first time this run the frog stands on a stone of this kind. */
      readonly isNewKind: boolean;
    }
  | {
      readonly kind: 'goal-reached';
      readonly cell: number;
      readonly moves: number;
      readonly par: number;
    }
  /** The frog landed where no stone is in reach: the run is lost unless the player undoes. */
  | { readonly kind: 'frog-stranded'; readonly cell: number };

export type StepstoneResult = ApplyResult<StepstoneState, StepstoneEvent>;
