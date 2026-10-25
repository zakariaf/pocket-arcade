// apps/jump-chain/src/rules/jump-chain-persistence.ts
// Spec 8.6 and N10: a saved run is JSON from disk; rebuild a fresh typed state with explicit checks
// and return null on anything unexpected (a wrong type, a missing or extra field, a value out of
// range): the Shell then drops only the run (8.14). Never cast. Pure, like the rules.
import { isDark } from './board-squares.ts';
import { TUNING } from './jump-chain-tuning.ts';

import type { Enemy, JumpChainMove, JumpChainState, Square } from './jump-chain-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** Bump when the shape of JumpChainState or JumpChainMove changes, and add a migrateState step. */
export const JUMP_CHAIN_STATE_VERSION = 1;

const UINT32_MAX = 4_294_967_295;
/** The highest enemy row a saved run can hold before it ends (your side's row). */
const SIDE_ROW = TUNING.rows - 1;
/** Rows above the board a waiting rank can stand on (far beyond any level's queue). */
const LOWEST_WAITING_ROW = -999;
/** A chain never jumps more enemies than a board holds. */
const MAX_CHAIN = TUNING.cols * TUNING.rows;

const STATE_KEYS = [
  'captured',
  'difficulty',
  'enemies',
  'hasContinued',
  'marchIn',
  'moves',
  'nextId',
  'nextRank',
  'piece',
  'ranksCleared',
  'rng',
  'score',
  'total',
] as const;

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(json: unknown): json is JsonRecord {
  return typeof json === 'object' && json !== null && !Array.isArray(json);
}

/** Exactly these keys, no more and no fewer (an extra field means a save this version never wrote). */
function hasKeys(json: JsonRecord, keys: readonly string[]): boolean {
  const own = Object.keys(json).sort();
  return own.length === keys.length && [...keys].sort().every((key, index) => own[index] === key);
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

/** A dark square on the board. */
function parseSquare(json: unknown): Square | null {
  if (!isRecord(json) || !hasKeys(json, ['col', 'row'])) return null;
  const { col, row } = json;
  if (!isWhole(col, 0, TUNING.cols - 1) || !isWhole(row, 0, TUNING.rows - 1)) return null;
  return isDark(col, row) ? { col, row } : null;
}

/** An enemy on a dark square of the ranks' rows, on the board or waiting above it. */
function parseEnemy(json: unknown): Enemy | null {
  if (!isRecord(json) || !hasKeys(json, ['col', 'id', 'rank', 'row'])) return null;
  const { id, rank, col, row } = json;
  const isValid =
    isWhole(id, 0, UINT32_MAX) &&
    isWhole(rank, 0, UINT32_MAX) &&
    isWhole(col, 0, TUNING.cols - 1) &&
    isWhole(row, LOWEST_WAITING_ROW, SIDE_ROW) &&
    isDark(col, row) &&
    row % 2 !== 0;
  return isValid ? { id, rank, col, row } : null;
}

const parseWord = (item: unknown): number | null => (isWhole(item, 0, UINT32_MAX) ? item : null);

function parseRng(json: unknown): RngState | null {
  const words = listOf(json, parseWord);
  if (words?.length !== 4) return null;
  const [a = 0, b = 0, c = 0, d = 0] = words;
  return [a, b, c, d];
}

/** The plain numbers of a state, each in its range, or null. */
function parseCounts(json: JsonRecord) {
  const { difficulty, total, captured, nextRank, ranksCleared, moves, marchIn, score, nextId } =
    json;
  const isValid =
    isWhole(difficulty, 0, 100) &&
    isWhole(total, 0, UINT32_MAX) &&
    isWhole(captured, 0, UINT32_MAX) &&
    isWhole(nextRank, 0, UINT32_MAX) &&
    isWhole(ranksCleared, 0, UINT32_MAX) &&
    isWhole(moves, 0, UINT32_MAX) &&
    isWhole(marchIn, 0, UINT32_MAX) &&
    isWhole(score, 0, UINT32_MAX) &&
    isWhole(nextId, 0, UINT32_MAX);
  return isValid
    ? { difficulty, total, captured, nextRank, ranksCleared, moves, marchIn, score, nextId }
    : null;
}

/**
 * The run is one legal play can reach: unique enemy ids below nextId, captured + left = total, no
 * two pieces on one square (enemies or your piece), every enemy of a rank already made, and no
 * more ranks cleared than made.
 */
function isConsistent(
  enemies: readonly Enemy[],
  piece: Square,
  counts: {
    total: number;
    captured: number;
    nextId: number;
    nextRank: number;
    ranksCleared: number;
  },
): boolean {
  const ids = enemies.map((enemy) => enemy.id);
  const squares = [piece, ...enemies].map(
    (square) => `${String(square.col)},${String(square.row)}`,
  );
  return (
    new Set(ids).size === ids.length &&
    ids.every((id) => id < counts.nextId) &&
    counts.captured + enemies.length === counts.total &&
    new Set(squares).size === squares.length &&
    enemies.every((enemy) => enemy.rank < counts.nextRank) &&
    counts.ranksCleared <= counts.nextRank
  );
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): JumpChainState | null {
  if (!isRecord(json) || !hasKeys(json, STATE_KEYS)) return null;
  const counts = parseCounts(json);
  const piece = parseSquare(json['piece']);
  const enemies = listOf(json['enemies'], parseEnemy);
  const rng = parseRng(json['rng']);
  const { hasContinued } = json;
  if (counts === null || piece === null || enemies === null || rng === null) return null;
  if (typeof hasContinued !== 'boolean' || !isConsistent(enemies, piece, counts)) return null;
  return {
    difficulty: counts.difficulty,
    piece,
    enemies,
    total: counts.total,
    captured: counts.captured,
    nextRank: counts.nextRank,
    ranksCleared: counts.ranksCleared,
    moves: counts.moves,
    marchIn: counts.marchIn,
    score: counts.score,
    hasContinued,
    nextId: counts.nextId,
    rng,
  };
}

/** Each landing square of a chain lies two squares diagonally from the one before. */
function isChainPath(path: readonly Square[]): boolean {
  return path.every((square, index) => {
    const before = path[index - 1];
    if (before === undefined) return true;
    return Math.abs(square.col - before.col) === 2 && Math.abs(square.row - before.row) === 2;
  });
}

function parseStep(json: JsonRecord): JumpChainMove | null {
  if (!hasKeys(json, ['kind', 'to'])) return null;
  const to = parseSquare(json['to']);
  return to === null ? null : { kind: 'step', to };
}

function parseJump(json: JsonRecord): JumpChainMove | null {
  if (!hasKeys(json, ['kind', 'path'])) return null;
  const path = listOf(json['path'], parseSquare);
  if (path === null || path.length === 0 || path.length > MAX_CHAIN) return null;
  return isChainPath(path) ? { kind: 'jump', path } : null;
}

/** One logged move -> a typed move, or null (the Shell then drops only the undo history). */
export function parseMove(json: unknown): JumpChainMove | null {
  if (!isRecord(json)) return null;
  if (json['kind'] === 'step') return parseStep(json);
  return json['kind'] === 'jump' ? parseJump(json) : null;
}

export const JUMP_CHAIN_PERSISTENCE: PersistenceSpec<JumpChainState, JumpChainMove> = {
  stateVersion: JUMP_CHAIN_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
