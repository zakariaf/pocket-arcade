// apps/stepstone/src/rules/stepstone-persistence.ts
// Spec 8.6: runs are saved after every move and survive kills and updates. A save that does not
// parse is refused here (null), and the Shell drops only that run (spec 8.14).
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { MOVE_KINDS } from './hops.ts';

import type { Cell, MoveKind, StepstoneMove, StepstoneState } from './stepstone-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';

/** Bump when the shape of StepstoneState or StepstoneMove changes, and add a migrateState step. */
export const STEPSTONE_STATE_VERSION = 1;

/** Pond sides a save may hold: generous bounds around the 5 to 7 the tuning lays today. */
const MIN_SIDE = 2;
const MAX_SIDE = 9;
/** Exactly these fields, sorted: a missing or extra field is not a Stepstone run. */
const STATE_KEYS = 'cells,frog,kindsUsed,moves,par,side';
const CELLS: readonly Cell[] = ['water', 'flag', 'sunk', ...MOVE_KINDS];

function isRecord(json: unknown): json is Readonly<Record<string, unknown>> {
  return typeof json === 'object' && json !== null && !Array.isArray(json);
}

function isCount(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isCell(item: unknown): item is Cell {
  return CELLS.some((cell) => cell === item);
}

function isKind(item: unknown): item is MoveKind {
  return MOVE_KINDS.some((kind) => kind === item);
}

/** side * side known cells with exactly one flag, or null. */
function parseCells(json: unknown, size: number): Cell[] | null {
  if (!Array.isArray(json) || json.length !== size) return null;
  const items: readonly unknown[] = json;
  const cells = items.filter(isCell);
  const flags = cells.filter((cell) => cell === 'flag').length;
  return cells.length === size && flags === 1 ? cells : null;
}

/** Distinct known hop kinds, or null. */
function parseKinds(json: unknown): MoveKind[] | null {
  if (!Array.isArray(json)) return null;
  const items: readonly unknown[] = json;
  const kinds = items.filter(isKind);
  return kinds.length === items.length && new Set(kinds).size === kinds.length ? kinds : null;
}

type Counts = Pick<StepstoneState, 'side' | 'frog' | 'moves' | 'par'>;

/** The whole-number fields: a side a save may hold, a frog inside the pond, counts from 0. */
function parseCounts(json: Readonly<Record<string, unknown>>): Counts | null {
  const { side, frog, moves, par } = json;
  if (!isCount(side, MIN_SIDE, MAX_SIDE) || !isCount(moves, 0) || !isCount(par, 0)) return null;
  return isCount(frog, 0, side * side - 1) ? { side, frog, moves, par } : null;
}

/**
 * True when legal play reaches this run: each hop sinks the stone it leaves (sunk stones = hops),
 * the start stone is a hop kind and each hop adds at most one new kind, the frog's own stone kind
 * is among those used, and par counts at least one hop. The frog never stands in the water.
 */
function isReachable(state: StepstoneState): boolean {
  const { cells, frog, moves, par, kindsUsed } = state;
  const under = pickAt(cells, frog);
  if (under === 'water' || under === 'sunk') return false;
  const sunk = cells.filter((cell) => cell === 'sunk').length;
  const hasKindsInReach = kindsUsed.length >= 1 && kindsUsed.length <= moves + 1;
  const isOwnKindUsed = under === 'flag' || kindsUsed.includes(under);
  return sunk === moves && hasKindsInReach && isOwnKindUsed && par >= 1;
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): StepstoneState | null {
  if (!isRecord(json) || Object.keys(json).sort().join() !== STATE_KEYS) return null;
  const counts = parseCounts(json);
  if (counts === null) return null;
  const cells = parseCells(json['cells'], counts.side * counts.side);
  const kindsUsed = parseKinds(json['kindsUsed']);
  if (cells === null || kindsUsed === null) return null;
  const { side, frog, moves, par } = counts;
  // The fields in StepstoneState's order, so a saved run writes back the same JSON text.
  const state: StepstoneState = { side, cells, frog, moves, par, kindsUsed };
  return isReachable(state) ? state : null;
}

/** One logged move -> a typed move, or null (the Shell then drops only the undo history). */
export function parseMove(json: unknown): StepstoneMove | null {
  if (!isRecord(json) || json['kind'] !== 'hop' || Object.keys(json).length !== 2) return null;
  const { to } = json;
  return isCount(to, 0, MAX_SIDE * MAX_SIDE - 1) ? { kind: 'hop', to } : null;
}

export const STEPSTONE_PERSISTENCE: PersistenceSpec<StepstoneState, StepstoneMove> = {
  stateVersion: STEPSTONE_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
