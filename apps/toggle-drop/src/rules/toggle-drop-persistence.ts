// apps/toggle-drop/src/rules/toggle-drop-persistence.ts
import { TOGGLE_DROP_TEACHING } from '@e07/toggle-drop/tutorial/toggle-drop-teaching.ts';

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
 * What a board that legal play starts from looks like: its size, the switches of each peg row,
 * the cup counts it may have, the balls its cups may need at most and the balls it starts with.
 */
type RunShape = {
  readonly cols: number;
  readonly rows: number;
  readonly rowSwitches: readonly number[];
  readonly cupCounts: readonly number[];
  readonly lineDrops: number;
  readonly balls: number;
};

/** The switches in each peg row of a board. */
function switchesByRow(board: Pick<ToggleDropState, 'cols' | 'rows' | 'pegs'>): number[] {
  const { cols, rows, pegs } = board;
  return Array.from(
    { length: rows },
    (_, row) => pegs.slice(row * cols, (row + 1) * cols).filter((peg) => peg !== -1).length,
  );
}

const cupsOf = (needs: readonly number[]): number => needs.filter((need) => need > 0).length;

/** The boards create() makes: one shape per tuning row. */
const LEVEL_SHAPES: readonly RunShape[] = TUNING.levelRows.map((knobs) => ({
  cols: knobs.cols,
  rows: knobs.rows,
  rowSwitches: Array.from({ length: knobs.rows }, () => knobs.switchesPerRow),
  cupCounts: Array.from({ length: knobs.cups }, (_, index) => index + 1),
  lineDrops: knobs.witnessDrops,
  balls: knobs.witnessDrops + knobs.spareBalls,
}));

/** The scripted tutorial board (S13), which a kill may interrupt like any run. */
function shapeOfStart(start: ToggleDropState): RunShape {
  return {
    cols: start.cols,
    rows: start.rows,
    rowSwitches: switchesByRow(start),
    cupCounts: [cupsOf(start.needs)],
    lineDrops: sum(start.needs),
    balls: start.ballsLeft + start.drops,
  };
}

const SHAPES: readonly RunShape[] = [
  ...LEVEL_SHAPES,
  shapeOfStart(TOGGLE_DROP_TEACHING.tutorial.start),
];

/**
 * Whether legal play can reach this run: it starts from a board create() makes or from the
 * tutorial's (its size, each peg row's switches, its cup count, cups needing no more balls than
 * that board's winning line, balls left and dropped adding up to that board's balls), and its
 * cups and switches hold no more than its drops brought (one ball fills at most one cup and flips
 * at most one switch a row).
 */
function isReachable(state: ToggleDropState): boolean {
  const { cols, rows, needs, drops } = state;
  const shape = SHAPES.find((each) => each.cols === cols && each.rows === rows);
  if (shape === undefined) return false;
  const rowSwitches = switchesByRow(state);
  return (
    rowSwitches.every((count, row) => count === shape.rowSwitches[row]) &&
    shape.cupCounts.includes(cupsOf(needs)) &&
    sum(needs) <= shape.lineDrops &&
    state.ballsLeft + drops === shape.balls &&
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
