// apps/scrap-shove/src/rules/scrap-shove-types.ts
// Scrap Shove v1 (spec 13): robots chase the player one step at a time and wreck themselves when
// they crash; the player steps, waits or shoves a scrap heap like a crate. Turn-based: the player
// moves, then every robot steps toward the player (nearest first), then the fast robots step again.
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';

/** A square of the floor: col 0 is the physical left edge, row 0 the top (boards never mirror). */
export type Cell = { readonly col: number; readonly row: number };

/** normal: one step a turn. fast: two steps a turn. heavy: pushes scrap, only a crush scraps it. */
export const ROBOT_KINDS = ['normal', 'fast', 'heavy'] as const;

export type RobotKind = (typeof ROBOT_KINDS)[number];

export type Robot = {
  readonly id: number;
  readonly kind: RobotKind;
  readonly col: number;
  readonly row: number;
};

export type Heap = {
  readonly id: number;
  readonly col: number;
  readonly row: number;
  /** True once the player has shoved it: a robot wrecked on it, or crushed by it, is the twist. */
  readonly isShoved: boolean;
};

/** The pieces of the floor, without the run's bookkeeping (the continue puts these back). */
export type Floor = {
  readonly player: Cell;
  readonly robots: readonly Robot[];
  readonly heaps: readonly Heap[];
  /** The id the next new heap gets (crashes make heaps during play). */
  readonly nextId: number;
};

/**
 * Everything a run needs, JSON-safe. Nothing is drawn after create(), so there is no RNG here:
 * the whole future of a floor follows from the start state and the player's moves.
 */
export type ScrapShoveState = Floor & {
  readonly cols: number;
  readonly rows: number;
  /** Robots on the floor at the start; the floor is cleared when none is left. */
  readonly robotsTotal: number;
  /** The robot that reached the player (the run is lost), or null. */
  readonly caughtBy: number | null;
  /** The floor before the move that got the player caught; the one continue puts it back. */
  readonly rescue: Floor | null;
  readonly hasContinued: boolean;
};

/** Step to a free neighbouring square, shove the heap on one, or stay put. */
export type ScrapShoveMove =
  | { readonly kind: 'step'; readonly col: number; readonly row: number }
  | { readonly kind: 'shove'; readonly col: number; readonly row: number }
  | { readonly kind: 'wait' };

/** How a robot was scrapped in a crash: into another robot, into scrap, or into a heavy robot. */
export type CrashCause = 'robot' | 'scrap' | 'heavy';

/** One robot's step of a robots' turn (from equals to when it waited). */
export type RobotStep = { readonly robotId: number; readonly from: Cell; readonly to: Cell };

/** Past tense, kebab-case, with every id and square the animation and the counters need. */
export type ScrapShoveEvent =
  | { readonly kind: 'player-stepped'; readonly from: Cell; readonly to: Cell }
  | { readonly kind: 'player-waited'; readonly at: Cell }
  | {
      readonly kind: 'scrap-shoved';
      readonly heapId: number;
      readonly from: Cell;
      readonly to: Cell;
      /** The robot whose push moved it, or null when the player shoved it. */
      readonly byRobotId: number | null;
    }
  | {
      readonly kind: 'robot-crushed';
      readonly robotId: number;
      readonly robotKind: RobotKind;
      readonly at: Cell;
      readonly heapId: number;
      readonly isByPlayer: boolean;
    }
  | { readonly kind: 'robots-stepped'; readonly steps: readonly RobotStep[] }
  | {
      readonly kind: 'robots-crashed';
      readonly robotIds: readonly number[];
      readonly at: Cell;
      readonly cause: CrashCause;
      /** The heap the crash left or hit. */
      readonly heapId: number;
      /** True when the scrap it hit had been shoved by the player (the twist). */
      readonly isShovedScrap: boolean;
    }
  | { readonly kind: 'player-caught'; readonly robotId: number; readonly at: Cell }
  | { readonly kind: 'floor-cleared' }
  | { readonly kind: 'step-reverted' };

export type ScrapShoveResult = ApplyResult<ScrapShoveState, ScrapShoveEvent>;
