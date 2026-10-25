// apps/swap-guard/src/rules/swap-guard-persistence.ts
// Spec 8.6 and N10: a saved run is JSON from disk; rebuild a fresh typed state with explicit checks
// and return null on anything unexpected or inconsistent (the Shell then drops only the run and
// logs it, 8.14). Never cast. Every move is written before it is shown (after-every-move).
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { applyMove } from './apply-move.ts';
import { FACINGS, squaresAround } from './board-grid.ts';
import { OPENING_ENEMIES } from './create.ts';
import { TUNING, volleyPoints } from './swap-guard-tuning.ts';

import type {
  Enemy,
  EnemyKind,
  LastSwap,
  SwapGuardMove,
  SwapGuardState,
} from './swap-guard-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';

/** Bump when the shape of SwapGuardState or SwapGuardMove changes, and add a migrateState step. */
export const SWAP_GUARD_STATE_VERSION = 1;

const STATE_KEYS = [
  'size',
  'guard',
  'enemies',
  'enemyCount',
  'swaps',
  'maxSwaps',
  'score',
  'isHit',
  'lastSwap',
  'hasContinued',
] as const;
const ENEMY_KEYS = ['id', 'kind', 'facing', 'cell'] as const;
const LAST_SWAP_KEYS = ['from', 'to', 'defeated', 'points'] as const;
const KINDS: readonly EnemyKind[] = ['spear', 'archer', 'brute'];

/** The board sizes, budgets and enemy counts the tuning rows can make. */
const ROWS = TUNING.levelRows;
const SIZES: readonly number[] = ROWS.map((row) => row.size);
const MIN_SIZE = Math.min(...SIZES);
const MAX_SIZE = Math.max(...SIZES);
const MAX_ENEMIES = Math.max(...ROWS.map((row) => row.enemies));

/** What the tuning rows of one board size allow: create never makes anything else on it. */
type SizeLimits = {
  readonly maxSwaps: number;
  readonly maxEnemies: number;
  readonly kinds: readonly EnemyKind[];
};

function limitsOf(size: number): SizeLimits {
  const rows = ROWS.filter((row) => row.size === size);
  return {
    maxSwaps: Math.max(...rows.map((row) => row.maxSwaps)),
    maxEnemies: Math.max(...rows.map((row) => row.enemies)),
    kinds: KINDS.filter((kind) => rows.some((row) => row.kinds.some((name) => name === kind))),
  };
}
/** The largest square index of the largest board: a move naming any other square is impossible. */
const MAX_CELL = Math.max(...SIZES.map((size) => size * size)) - 1;

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

/** One enemy on a board of `size`: a kind its rows draw and a facing (a brute always faces up). */
function parseEnemy(json: unknown, size: number): Enemy | null {
  if (!isRecord(json) || !hasExactly(json, ENEMY_KEYS)) return null;
  const { id, cell } = json;
  const kind = limitsOf(size).kinds.find((name) => name === json['kind']);
  const facing = FACINGS.find((name) => name === json['facing']);
  if (!isWhole(id, 0, MAX_ENEMIES - 1) || !isWhole(cell, 0, size * size - 1)) return null;
  if (kind === undefined || facing === undefined) return null;
  return kind === 'brute' && facing !== 'up' ? null : { id, kind, facing, cell };
}

/** Enemies on distinct squares with distinct ids, sorted by id when `isSorted` is asked for. */
function parseEnemies(json: unknown, size: number, isSorted: boolean): Enemy[] | null {
  const enemies = listOf(json, (item) => parseEnemy(item, size));
  if (enemies === null) return null;
  const cells = new Set(enemies.map((enemy) => enemy.cell));
  const ids = enemies.map((enemy) => enemy.id);
  const isOrdered = ids.every((id, index) => index === 0 || pickAt(ids, index - 1) < id);
  const isDistinct = new Set(ids).size === ids.length && cells.size === enemies.length;
  return isDistinct && (isOrdered || !isSorted) ? enemies : null;
}

/** The last swap: two squares next to each other, its knock-outs and the points they earned. */
function parseLastSwap(json: unknown, size: number): LastSwap | null {
  if (!isRecord(json) || !hasExactly(json, LAST_SWAP_KEYS)) return null;
  const { from, to, points } = json;
  if (!isWhole(from, 0, size * size - 1) || !isWhole(to, 0, size * size - 1)) return null;
  const defeated = parseEnemies(json['defeated'], size, false);
  if (defeated === null || !squaresAround(size, from).includes(to)) return null;
  return points === volleyPoints(defeated.length) ? { from, to, defeated, points } : null;
}

/** The scalar fields, each a whole number in the range its board size's rows allow, flags booleans. */
function isShaped(json: JsonRecord): boolean {
  const { size, swaps, maxSwaps, enemyCount, score } = json;
  if (!isWhole(size, MIN_SIZE, MAX_SIZE) || !SIZES.includes(size)) return false;
  const limits = limitsOf(size);
  return (
    isWhole(maxSwaps, 1, limits.maxSwaps) &&
    isWhole(swaps, 0, maxSwaps) &&
    isWhole(enemyCount, OPENING_ENEMIES, limits.maxEnemies) &&
    isWhole(score, 0, volleyPoints(MAX_ENEMIES)) &&
    typeof json['isHit'] === 'boolean' &&
    typeof json['hasContinued'] === 'boolean'
  );
}

/** The score is what volleys earn: 100 per knock-out plus 50 per extra enemy of a volley. */
function isScoreEarned(state: SwapGuardState): boolean {
  const knockedOut = state.enemyCount - state.enemies.length;
  const extra = state.score - knockedOut * TUNING.pointsPerEnemy;
  return (
    extra >= 0 &&
    state.score <= volleyPoints(knockedOut) &&
    extra % TUNING.pointsPerExtraEnemy === 0
  );
}

/** The record agrees: with no swap on record, a start or the board its one continue went back to. */
function isRecordOk(state: SwapGuardState): boolean {
  const { lastSwap } = state;
  if (lastSwap === null) return !state.isHit && (state.swaps === 0 || state.hasContinued);
  return isLastSwapOk(state, lastSwap) && isReplayed(state, lastSwap);
}

/** The pieces agree: nobody on the guard, ids within the level's count, the score earned. */
function isConsistent(state: SwapGuardState): boolean {
  const { guard, enemies, enemyCount, swaps } = state;
  const knockedOut = enemyCount - enemies.length;
  const isPieceOk =
    knockedOut >= 0 &&
    enemies.every((enemy) => enemy.cell !== guard && enemy.id < enemyCount) &&
    (swaps > 0 || knockedOut === 0);
  return isPieceOk && isScoreEarned(state) && isRecordOk(state);
}

/**
 * The board before the last swap, as its continue would stand it again: the guard back on `from`,
 * the swapped enemy back on `to`, the knocked-out enemies standing where they stood.
 */
function boardBefore(state: SwapGuardState, last: LastSwap): SwapGuardState {
  const standing = [...state.enemies, ...last.defeated].sort((a, b) => a.id - b.id);
  return {
    ...state,
    guard: last.from,
    enemies: standing.map((enemy) =>
      enemy.cell === last.from ? { ...enemy, cell: last.to } : enemy,
    ),
    swaps: state.swaps - 1,
    score: state.score - last.points,
    isHit: false,
    lastSwap: null,
  };
}

/** True when the last swap, played from the board before it, makes exactly this run. */
function isReplayed(state: SwapGuardState, last: LastSwap): boolean {
  const before = boardBefore(state, last);
  const cells = new Set([before.guard, ...before.enemies.map((enemy) => enemy.cell)]);
  if (cells.size !== before.enemies.length + 1) return false;
  try {
    const after = applyMove(before, { kind: 'swap', cell: last.to }).state;
    return JSON.stringify(after) === JSON.stringify(state);
  } catch {
    return false;
  }
}

/** A last swap on record: a swap was made, it ended on the guard, its knock-outs left the board. */
function isLastSwapOk(state: SwapGuardState, last: LastSwap): boolean {
  const standing = new Set(state.enemies.map((enemy) => enemy.id));
  const cells = new Set([state.guard, ...state.enemies.map((enemy) => enemy.cell)]);
  const isGone = last.defeated.every((enemy) => !standing.has(enemy.id) && !cells.has(enemy.cell));
  const isCounted = last.defeated.length <= state.enemyCount - state.enemies.length;
  return state.swaps > 0 && last.to === state.guard && isGone && isCounted;
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): SwapGuardState | null {
  if (!isRecord(json) || !hasExactly(json, STATE_KEYS) || !isShaped(json)) return null;
  const size = Number(json['size']);
  const guard = json['guard'];
  if (!isWhole(guard, 0, size * size - 1)) return null;
  const enemies = parseEnemies(json['enemies'], size, true);
  const lastSwap = json['lastSwap'] === null ? null : parseLastSwap(json['lastSwap'], size);
  if (enemies === null || (lastSwap === null && json['lastSwap'] !== null)) return null;
  const state: SwapGuardState = {
    size,
    guard,
    enemies,
    enemyCount: Number(json['enemyCount']),
    swaps: Number(json['swaps']),
    maxSwaps: Number(json['maxSwaps']),
    score: Number(json['score']),
    isHit: json['isHit'] === true,
    lastSwap,
    hasContinued: json['hasContinued'] === true,
  };
  return isConsistent(state) ? state : null;
}

/** One logged move -> a typed move, or null (the Shell then drops only the move log). */
export function parseMove(json: unknown): SwapGuardMove | null {
  if (!isRecord(json) || !hasExactly(json, ['kind', 'cell']) || json['kind'] !== 'swap') {
    return null;
  }
  const { cell } = json;
  return isWhole(cell, 0, MAX_CELL) ? { kind: 'swap', cell } : null;
}

export const SWAP_GUARD_PERSISTENCE: PersistenceSpec<SwapGuardState, SwapGuardMove> = {
  stateVersion: SWAP_GUARD_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
