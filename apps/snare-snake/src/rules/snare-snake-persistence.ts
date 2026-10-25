// apps/snare-snake/src/rules/snare-snake-persistence.ts
// Spec 8.6 and N10: a saved run is JSON from disk; rebuild a fresh typed state with explicit checks
// and return null on anything unexpected (the Shell then drops only the run and logs it, 8.14).
// Never cast. Every move is written before it is shown (after-every-move).
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { neighboursOf } from './board-grid.ts';
import { TUNING } from './snare-snake-tuning.ts';

import type { Grid } from './board-grid.ts';
import type { Critter, Direction, SnareSnakeMove, SnareSnakeState } from './snare-snake-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** Bump when the shape of SnareSnakeState or SnareSnakeMove changes, and add a migrateState step. */
export const SNARE_SNAKE_STATE_VERSION = 1;

const UINT32_MAX = 4_294_967_295;
const DIRECTION_NAMES: readonly Direction[] = ['up', 'right', 'down', 'left'];
const STATE_KEYS = [
  'difficulty',
  'cols',
  'rows',
  'snake',
  'critters',
  'total',
  'caught',
  'growth',
  'moves',
  'maxMoves',
  'score',
  'heading',
  'hasContinued',
  'rng',
] as const;
/** The first build saved no heading; such a run still loads, its head looking from its neck. */
const FIRST_BUILD_KEYS = STATE_KEYS.filter((key) => key !== 'heading');
/** The largest side any tuning row draws: a saved board must fit the game's rows. */
const MAX_SIDE = Math.max(...TUNING.levelRows.flatMap((row) => [row.cols, row.rows]));

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(json: unknown): json is JsonRecord {
  return typeof json === 'object' && json !== null && !Array.isArray(json);
}

function hasExactly(json: JsonRecord, keys: readonly string[]): boolean {
  const own = Object.keys(json);
  return own.length === keys.length && keys.every((key) => own.includes(key));
}

function isWhole(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function listOf<T>(json: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(json)) return null;
  const items: readonly unknown[] = json;
  const parsed = items.map(parse);
  return parsed.every((item): item is T => item !== null) ? parsed : null;
}

const parseWord = (item: unknown): number | null => (isWhole(item, 0, UINT32_MAX) ? item : null);

function parseRng(json: unknown): RngState | null {
  const words = listOf(json, parseWord);
  if (words?.length !== 4) return null;
  return [pickAt(words, 0), pickAt(words, 1), pickAt(words, 2), pickAt(words, 3)];
}

/** The snake: distinct cells on the board, each next to the one before. */
function parseSnake(json: unknown, grid: Grid): number[] | null {
  const snake = listOf(json, (item) => (isWhole(item, 0, grid.cols * grid.rows - 1) ? item : null));
  if (snake === null || snake.length === 0 || new Set(snake).size !== snake.length) return null;
  const isChain = snake.every(
    (cell, index) => index === 0 || neighboursOf(grid, cell).includes(pickAt(snake, index - 1)),
  );
  return isChain ? snake : null;
}

/** The critters: distinct ids on distinct cells of the board, none on the snake. */
function parseCritters(json: unknown, grid: Grid, snake: readonly number[]): Critter[] | null {
  const critters = listOf(json, (item): Critter | null => {
    if (!isRecord(item) || !hasExactly(item, ['id', 'cell'])) return null;
    const { id, cell } = item;
    const isOnBoard = isWhole(cell, 0, grid.cols * grid.rows - 1) && !snake.includes(cell);
    return isWhole(id, 0, UINT32_MAX) && isOnBoard ? { id, cell } : null;
  });
  if (critters === null) return null;
  const cells = new Set(critters.map((critter) => critter.cell));
  const ids = new Set(critters.map((critter) => critter.id));
  return cells.size === critters.length && ids.size === critters.length ? critters : null;
}

/** The scalar fields, each a whole number in its range (and the continue flag a boolean). */
function isShaped(json: JsonRecord): boolean {
  const { difficulty, cols, rows, total, caught, growth, moves, maxMoves, score } = json;
  return (
    isWhole(difficulty, 0, 100) &&
    isWhole(cols, 3, MAX_SIDE) &&
    isWhole(rows, 3, MAX_SIDE) &&
    isWhole(total, 1, UINT32_MAX) &&
    isWhole(caught, 0, UINT32_MAX) &&
    isWhole(growth, 0, UINT32_MAX) &&
    isWhole(moves, 0, UINT32_MAX) &&
    isWhole(maxMoves, 1, UINT32_MAX) &&
    isWhole(score, 0, UINT32_MAX) &&
    typeof json['hasContinued'] === 'boolean'
  );
}

/** This build's keys, or the first build's (no heading). */
function hasStateKeys(json: JsonRecord): boolean {
  return hasExactly(json, STATE_KEYS) || hasExactly(json, FIRST_BUILD_KEYS);
}

/** A saved heading: one of the four directions, or null (or absent in a first-build save). */
function parseHeading(json: JsonRecord): Direction | null | undefined {
  const saved = json['heading'] ?? null;
  return saved === null ? null : DIRECTION_NAMES.find((name) => name === saved);
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): SnareSnakeState | null {
  if (!isRecord(json) || !hasStateKeys(json) || !isShaped(json)) return null;
  const heading = parseHeading(json);
  if (heading === undefined) return null;
  const grid = { cols: Number(json['cols']), rows: Number(json['rows']) };
  const snake = parseSnake(json['snake'], grid);
  const critters = snake === null ? null : parseCritters(json['critters'], grid, snake);
  const rng = parseRng(json['rng']);
  if (snake === null || critters === null || rng === null) return null;
  const counts = {
    total: Number(json['total']),
    caught: Number(json['caught']),
    growth: Number(json['growth']),
    moves: Number(json['moves']),
    maxMoves: Number(json['maxMoves']),
    score: Number(json['score']),
  };
  if (counts.caught + critters.length !== counts.total) return null;
  const difficulty = Number(json['difficulty']);
  const hasContinued = json['hasContinued'] === true;
  return { difficulty, ...grid, snake, critters, ...counts, heading, hasContinued, rng };
}

/** One logged move -> a typed move, or null (the Shell then drops only the move log). */
export function parseMove(json: unknown): SnareSnakeMove | null {
  if (!isRecord(json) || !hasExactly(json, ['kind', 'direction']) || json['kind'] !== 'steer') {
    return null;
  }
  const direction = DIRECTION_NAMES.find((name) => name === json['direction']);
  return direction === undefined ? null : { kind: 'steer', direction };
}

export const SNARE_SNAKE_PERSISTENCE: PersistenceSpec<SnareSnakeState, SnareSnakeMove> = {
  stateVersion: SNARE_SNAKE_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
