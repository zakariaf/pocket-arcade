// apps/toggle-drop/src/rules/toggle-drop-persistence.ts
import { TUNING } from './toggle-drop-tuning.ts';

import type { PegCell, ToggleDropMove, ToggleDropState } from './toggle-drop-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';

/** Bump when the shape of ToggleDropState or ToggleDropMove changes, and add a migrateState step. */
export const TOGGLE_DROP_STATE_VERSION = 1;
/** No tuning row is wider or taller: a saved board beyond these is damaged. */
const MAX_COLS = 9;
const MAX_ROWS = 9;
const STATE_KEYS = ['ballsLeft', 'cols', 'drops', 'filled', 'flips', 'needs', 'pegs', 'rows'];
const MOVE_KEYS = ['col', 'kind'];

type Json = Readonly<Record<string, unknown>>;

function isRecord(json: unknown): json is Json {
  return typeof json === 'object' && json !== null && !Array.isArray(json);
}

/** Exactly these keys, no more and no fewer (a field from another version is not guessed). */
function hasKeys(json: Json, keys: readonly string[]): boolean {
  return Object.keys(json).sort().join(',') === keys.join(',');
}

function isCount(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function countsOf(
  json: unknown,
  size: number,
  isValid: (value: number, index: number) => boolean,
): number[] | null {
  if (!Array.isArray(json) || json.length !== size) return null;
  const items: readonly unknown[] = json;
  const counts = items.filter(
    (item, index): item is number => isCount(item, -1, 1000) && isValid(item, index),
  );
  return counts.length === size ? counts : null;
}

const isPeg = (value: number): value is PegCell => value === -1 || value === 0 || value === 1;

type Sizes = Pick<ToggleDropState, 'cols' | 'rows' | 'ballsLeft' | 'drops'>;

/** The board's size and the ball counts, each a whole number in range. */
function parseSizes(json: Json): Sizes | null {
  const { cols, rows, ballsLeft, drops } = json;
  if (!isCount(cols, 1, MAX_COLS) || !isCount(rows, 1, MAX_ROWS)) return null;
  return isCount(ballsLeft, 0, 1000) && isCount(drops, 0, 1000)
    ? { cols, rows, ballsLeft, drops }
    : null;
}

const sum = (counts: readonly number[]): number => counts.reduce((total, n) => total + n, 0);

/**
 * Whether legal play can reach this run: its size is a tuning row's, each peg row keeps that row's
 * switches, it has one cup up to the row's cups needing no more balls than the row's winning line,
 * its balls left and dropped add up to the row's balls, and its cups and switches hold no more
 * than its drops brought (one ball fills at most one cup and flips at most one switch a row).
 */
function isReachable(state: ToggleDropState): boolean {
  const knobs = TUNING.levelRows.find((row) => row.cols === state.cols && row.rows === state.rows);
  if (knobs === undefined) return false;
  const { cols, rows, pegs, needs, drops } = state;
  const rowSwitches = Array.from(
    { length: rows },
    (_, row) => pegs.slice(row * cols, (row + 1) * cols).filter((peg) => peg !== -1).length,
  );
  const cups = needs.filter((need) => need > 0).length;
  return (
    rowSwitches.every((count) => count === knobs.switchesPerRow) &&
    cups >= 1 &&
    cups <= knobs.cups &&
    sum(needs) <= knobs.witnessDrops &&
    state.ballsLeft + drops === knobs.witnessDrops + knobs.spareBalls &&
    sum(state.filled) <= drops &&
    sum(state.flips) <= drops * rows
  );
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): ToggleDropState | null {
  if (!isRecord(json) || !hasKeys(json, STATE_KEYS)) return null;
  const sizes = parseSizes(json);
  if (sizes === null) return null;
  const { cols, rows } = sizes;
  const pegs = countsOf(json['pegs'], cols * rows, isPeg);
  if (pegs === null) return null;
  const flips = countsOf(
    json['flips'],
    cols * rows,
    (count, index) => count >= 0 && (count === 0 || pegs[index] !== -1),
  );
  const needs = countsOf(json['needs'], cols, (need) => need >= 0);
  if (flips === null || needs === null) return null;
  const filled = countsOf(
    json['filled'],
    cols,
    (count, col) => count >= 0 && count <= (needs[col] ?? 0),
  );
  if (filled === null) return null;
  // The rules' own key order, so a saved state reads back byte for byte.
  const { ballsLeft, drops } = sizes;
  const state = { cols, rows, pegs: pegs.filter(isPeg), flips, needs, filled, ballsLeft, drops };
  return isReachable(state) ? state : null;
}

/** One logged move -> a typed move, or null (the Shell then drops only the undo history). */
export function parseMove(json: unknown): ToggleDropMove | null {
  if (!isRecord(json) || !hasKeys(json, MOVE_KEYS) || json['kind'] !== 'drop') return null;
  const { col } = json;
  return isCount(col, 0, MAX_COLS - 1) ? { kind: 'drop', col } : null;
}

export const TOGGLE_DROP_PERSISTENCE: PersistenceSpec<ToggleDropState, ToggleDropMove> = {
  stateVersion: TOGGLE_DROP_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
