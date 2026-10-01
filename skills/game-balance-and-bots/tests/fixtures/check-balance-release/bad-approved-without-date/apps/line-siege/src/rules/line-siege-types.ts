// apps/line-siege/src/rules/line-siege-types.ts
// Line Siege v1 (spec 13): place one of three offered blocks on the 8x8 board; full rows and
// columns clear. A cleared column fires a beam up its lane (8 damage to the monster nearest the
// wall); the cleared rows send one shockwave (2 per row to every monster but the armoured); then
// the monsters march toward the wall, and each one that breaks through costs a heart.
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** 0 = empty, 1 = block. Numbers, not booleans: compact in saves and readable in goldens. */
export type Cell = 0 | 1;

/** A piece is a list of [dx, dy] offsets from its anchor cell (the anchor is the top-start cell). */
export type Piece = readonly (readonly [number, number])[];

/**
 * normal: the plain monster. armoured: shockwaves bounce off (only beams hurt it).
 * fast: steps two lane rows per march.
 */
export type MonsterKind = 'normal' | 'armoured' | 'fast';

export type Monster = {
  readonly id: number;
  readonly kind: MonsterKind;
  /** The lane is the board column below it (0..boardSize-1). */
  readonly lane: number;
  /** 0 = the far end of the lane; a monster reaching laneRows (6) breaks the wall. */
  readonly row: number;
  readonly hp: number;
};

export type LineSiegeState = {
  /** 0..100 as passed to create (clamped); ENDLESS_DIFFICULTY is the endless run. */
  readonly difficulty: number;
  /** boardSize x boardSize, row-major (index = row * boardSize + col). */
  readonly cells: readonly Cell[];
  /** Index into PIECES per tray slot; null = already placed. All three refill once all are used. */
  readonly tray: readonly (number | null)[];
  readonly monsters: readonly Monster[];
  readonly hearts: number;
  readonly placements: number;
  /** Monsters that have entered so far (the wave of a level has knobsFor(difficulty).goal). */
  readonly spawned: number;
  readonly defeated: number;
  readonly score: number;
  readonly nextId: number;
  readonly rng: RngState;
};

export type LineSiegeMove = {
  readonly kind: 'place-block';
  readonly trayIndex: number;
  readonly col: number;
  readonly row: number;
};

/**
 * Past tense, kebab-case, with every id and from/to value the board and the counters need.
 * Only the continue emits heart-restored, monsters-pushed-back and rows-emptied.
 */
export type LineSiegeEvent =
  | {
      readonly kind: 'block-placed';
      readonly trayIndex: number;
      readonly piece: number;
      readonly cells: readonly number[];
    }
  | { readonly kind: 'row-cleared'; readonly row: number }
  | { readonly kind: 'column-cleared'; readonly col: number }
  | { readonly kind: 'beam-fired'; readonly lane: number; readonly targetId: number | null }
  | { readonly kind: 'shockwave-sent'; readonly rows: number; readonly damage: number }
  | {
      readonly kind: 'monster-hit';
      readonly monsterId: number;
      readonly damage: number;
      readonly hpLeft: number;
    }
  | {
      readonly kind: 'monster-defeated';
      readonly monsterId: number;
      readonly monsterKind: MonsterKind;
      readonly lane: number;
      readonly row: number;
    }
  | {
      readonly kind: 'monster-moved';
      readonly monsterId: number;
      readonly fromRow: number;
      readonly toRow: number;
    }
  | {
      readonly kind: 'wall-breached';
      readonly monsterId: number;
      readonly monsterKind: MonsterKind;
      readonly lane: number;
      readonly heartsLeft: number;
    }
  | {
      readonly kind: 'monster-spawned';
      readonly monsterId: number;
      readonly monsterKind: MonsterKind;
      readonly lane: number;
      readonly hp: number;
    }
  | { readonly kind: 'score-added'; readonly points: number; readonly total: number }
  | { readonly kind: 'tray-refilled'; readonly tray: readonly number[] }
  | { readonly kind: 'heart-restored'; readonly hearts: number }
  | { readonly kind: 'monsters-pushed-back'; readonly rows: number }
  | { readonly kind: 'rows-emptied'; readonly rows: readonly number[] };

export type LineSiegeResult = ApplyResult<LineSiegeState, LineSiegeEvent>;
