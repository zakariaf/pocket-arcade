// apps/tap-flip/src/rules/tap-flip-persistence.ts
import type { Cell, TapFlipMove, TapFlipState } from './tap-flip-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';

/** Bump when the shape of TapFlipState or TapFlipMove changes, and add a migrateState step. */
export const TAP_FLIP_STATE_VERSION = 1;

function isRecord(json: unknown): json is Readonly<Record<string, unknown>> {
  return typeof json === 'object' && json !== null && !Array.isArray(json);
}

function isCount(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min;
}

function parseCells(json: unknown, size: number): Cell[] | null {
  if (!Array.isArray(json) || json.length !== size) return null;
  const items: readonly unknown[] = json;
  const cells = items.filter((item): item is Cell => item === 0 || item === 1);
  return cells.length === size ? cells : null;
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): TapFlipState | null {
  if (!isRecord(json)) return null;
  const { cols, rows, moves, maxMoves } = json;
  if (!isCount(cols, 1) || !isCount(rows, 1) || !isCount(moves, 0) || !isCount(maxMoves, 1)) {
    return null;
  }
  const cells = parseCells(json['cells'], cols * rows);
  return cells === null ? null : { cols, rows, cells, moves, maxMoves };
}

/** One logged move -> a typed move, or null (the Shell then drops only the undo history). */
export function parseMove(json: unknown): TapFlipMove | null {
  if (!isRecord(json) || json['kind'] !== 'flip') return null;
  const { col, row } = json;
  return isCount(col, 0) && isCount(row, 0) ? { kind: 'flip', col, row } : null;
}

export const TAP_FLIP_PERSISTENCE: PersistenceSpec<TapFlipState, TapFlipMove> = {
  stateVersion: TAP_FLIP_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
