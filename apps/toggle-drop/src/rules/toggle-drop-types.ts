// apps/toggle-drop/src/rules/toggle-drop-types.ts
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';

/** The way a switch points: 0 sends the ball one column left, 1 one column right. */
export type Side = 0 | 1;

/** A cell of a peg row: -1 holds no switch, otherwise the side its switch points to. */
export type PegCell = -1 | Side;

/**
 * Everything a run needs, JSON-safe (plain arrays and numbers). Nothing is drawn at random after
 * create(), so the state keeps no RNG: the same drops always give the same falls.
 */
export type ToggleDropState = {
  /** Drop columns (5 to 7). */
  readonly cols: number;
  /** Peg rows the ball falls through (3 to 5). */
  readonly rows: number;
  /** Row-major (index = row * cols + col): the switch of each cell, -1 where there is none. */
  readonly pegs: readonly PegCell[];
  /** Row-major, like pegs: how often a ball has flipped each switch in this run (0 elsewhere). */
  readonly flips: readonly number[];
  /** Per column: how many balls its cup needs; 0 is the gutter (no cup). */
  readonly needs: readonly number[];
  /** Per column: how many balls its cup holds (never more than it needs). */
  readonly filled: readonly number[];
  /** Balls the player may still drop. */
  readonly ballsLeft: number;
  /** Balls dropped in this run so far. */
  readonly drops: number;
};

/** A move says which column the ball is dropped from; applyMove decides where it goes. */
export type ToggleDropMove = { readonly kind: 'drop'; readonly col: number };

/**
 * Past tense, kebab-case, timed on the move's timeline (atMs) and placed in board units (x across,
 * y down: one column or one peg row is 120 units): the drop, every peg row the ball passed, every
 * switch it flipped, where it landed and the cup it filled.
 */
export type ToggleDropEvent =
  | {
      readonly kind: 'ball-dropped';
      readonly col: number;
      readonly x: number;
      readonly y: number;
      readonly atMs: number;
    }
  | {
      readonly kind: 'ball-passed';
      readonly col: number;
      readonly row: number;
      readonly x: number;
      readonly y: number;
      readonly atMs: number;
    }
  | {
      readonly kind: 'switch-flipped';
      readonly col: number;
      readonly row: number;
      /** The side the switch points to after the flip. */
      readonly side: Side;
      readonly x: number;
      readonly y: number;
      readonly atMs: number;
    }
  | {
      readonly kind: 'ball-landed';
      readonly col: number;
      readonly x: number;
      readonly y: number;
      /** True when the ball went into a cup that still needed it, false in the gutter. */
      readonly isInCup: boolean;
      /** True when a switch earlier balls left pointing away from its starting side sent it on. */
      readonly wasRedirected: boolean;
      readonly atMs: number;
    }
  | { readonly kind: 'cup-filled'; readonly col: number; readonly atMs: number };

/** The kinds of every event (the timeline and the sounds switch over them). */
export type ToggleDropEventKind = ToggleDropEvent['kind'];

export type ToggleDropResult = ApplyResult<ToggleDropState, ToggleDropEvent>;
