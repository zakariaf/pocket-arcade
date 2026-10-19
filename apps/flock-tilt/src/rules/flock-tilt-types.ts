// apps/flock-tilt/src/rules/flock-tilt-types.ts
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';
import type { SwipeDirection } from '@e07/game-kit/geom/classify-swipe.ts';

/** A tilt of the whole field. Physical: the board never mirrors in fa and ckb (spec 7.5). */
export type Direction = SwipeDirection;

/** Where a sheep is: still on the field, dropped into the pen, or lost to a wolf. */
export type SheepStatus = 'field' | 'penned' | 'lost';

/** One sheep; its id is stable for the whole run (the board animates by id). */
export type Sheep = { readonly id: number; readonly cell: number; readonly status: SheepStatus };

/** One wolf: it slides by the same rules as the sheep, but never enters the pen. */
export type Wolf = { readonly id: number; readonly cell: number };

/** The animals' places: the part of the field a tilt changes (rocks and the pen never move). */
export type Flock = { readonly sheep: readonly Sheep[]; readonly wolves: readonly Wolf[] };

/** The fixed ground of a field: size, rocks and the pen. Cells are row * cols + col. */
export type Terrain = {
  readonly cols: number;
  readonly rows: number;
  /** Rock cells, ascending. */
  readonly rocks: readonly number[];
  readonly pen: number;
};

/** A field: the ground plus the animals on it (what the tilt and the search work on). */
export type Field = Terrain & Flock;

/** The flock as it was before the tilt that ended the run, with the tilts made by then. */
export type FlockBefore = Flock & { readonly tilts: number };

/**
 * Everything a run needs and nothing else, JSON-safe (plain arrays, numbers, strings, booleans,
 * null). Nothing is drawn after create(), so the state keeps no RNG.
 */
export type FlockTiltState = Field & {
  /** Tilts made in this run (undo gives them back). */
  readonly tilts: number;
  /** The run ends after this many tilts; the one continue raises it. */
  readonly tiltLimit: number;
  /** Fewest tilts that pen every sheep from the start, found by create's search. */
  readonly par: number;
  /** True once the run's one continue was used (spec 8.10). */
  readonly hasContinued: boolean;
  /** The flock before the tilt that ended the run in a loss (the continue puts it back). */
  readonly beforeLoss: FlockBefore | null;
};

/** A move is what the player chose: tilt the field one way. */
export type FlockTiltMove = { readonly kind: 'tilt'; readonly direction: Direction };

/** What stopped a sliding animal. A sheep stopped by 'pen' dropped into it. */
export type Blocker = 'fence' | 'rock' | 'sheep' | 'wolf' | 'pen';

/** One animal that moved during a tilt, from where to where, and what stopped it. */
export type Slide = {
  readonly animal: 'sheep' | 'wolf';
  readonly id: number;
  readonly from: number;
  readonly to: number;
  readonly stoppedBy: Blocker;
};

/** Past tense, kebab-case, with every id and cell the animation, sounds and counters need. */
export type FlockTiltEvent =
  | {
      readonly kind: 'animals-slid';
      readonly direction: Direction;
      readonly slides: readonly Slide[];
    }
  | { readonly kind: 'sheep-penned'; readonly id: number; readonly cell: number }
  | {
      readonly kind: 'sheep-lost';
      readonly id: number;
      readonly cell: number;
      readonly wolfId: number;
      readonly wolfCell: number;
    }
  | { readonly kind: 'field-cleared'; readonly tilts: number; readonly par: number }
  | { readonly kind: 'tilts-ran-out'; readonly tilts: number }
  | { readonly kind: 'tilt-taken-back'; readonly tiltsAdded: number };

export type FlockTiltResult = ApplyResult<FlockTiltState, FlockTiltEvent>;
