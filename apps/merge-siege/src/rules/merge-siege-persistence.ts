// apps/merge-siege/src/rules/merge-siege-persistence.ts
// Spec 8.6 and N10: a run is saved as JSON after every move and read back after a kill or an
// update. parseState and parseMove rebuild exactly the shapes the rules produce (same keys, whole
// numbers in range, powers of two on the board) and return null for anything else, so a damaged
// save drops only that run and is logged (spec 8.14), never a crash.
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { CELL_COUNT, COLS } from './board-cells.ts';
import { knobsFor } from './merge-siege-tuning.ts';

import type {
  Cell,
  MergeSiegeMove,
  MergeSiegeState,
  NextEnemy,
  Piece,
} from './merge-siege-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { SwipeDirection } from '@e07/game-kit/geom/classify-swipe.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** Bump when the shape of MergeSiegeState or MergeSiegeMove changes, and add a migrateState step. */
export const MERGE_SIEGE_STATE_VERSION = 1;

const STATE_KEYS = [
  'cells',
  'difficulty',
  'entered',
  'hasContinued',
  'next',
  'nextId',
  'rng',
  'score',
  'smashed',
  'swipes',
];
const DIRECTIONS: readonly SwipeDirection[] = ['up', 'down', 'left', 'right'];
const MAX_UINT32 = 4_294_967_295;
/** The largest piece number a run can reach (2^20): far above any tile or enemy the rules make. */
const MAX_VALUE = 1_048_576;

type Json = Readonly<Record<string, unknown>>;

function recordWith(json: unknown, keys: readonly string[]): Json | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null;
  const actual = Object.keys(json).sort();
  return actual.length === keys.length &&
    actual.every((key, index) => key === [...keys].sort()[index])
    ? (json as Json)
    : null;
}

function isWhole(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** 2, 4, 8, ... up to MAX_VALUE. */
function isPieceValue(value: unknown): value is number {
  if (!isWhole(value, 2, MAX_VALUE)) return false;
  let power = 2;
  while (power < value) power *= 2;
  return power === value;
}

function parsePiece(json: unknown): Piece | null {
  const record = recordWith(json, ['id', 'kind', 'value']);
  if (record === null) return null;
  const { id, kind, value } = record;
  const isKind = kind === 'tile' || kind === 'enemy';
  return isWhole(id, 1, MAX_UINT32) && isKind && isPieceValue(value) ? { id, kind, value } : null;
}

function parseCells(json: unknown): Cell[] | null {
  if (!Array.isArray(json) || json.length !== CELL_COUNT) return null;
  const cells: Cell[] = [];
  for (const item of json as readonly unknown[]) {
    const piece = item === null ? null : parsePiece(item);
    if (item !== null && piece === null) return null;
    cells.push(piece);
  }
  return cells;
}

/** The enemy waiting to enter; undefined when the JSON is not one (null is a valid "none"). */
function parseNext(json: unknown): NextEnemy | null | undefined {
  if (json === null) return null;
  const record = recordWith(json, ['col', 'value']);
  if (record === null) return undefined;
  const { col, value } = record;
  return isWhole(col, 0, COLS - 1) && isPieceValue(value) ? { col, value } : undefined;
}

function parseRng(json: unknown): RngState | null {
  if (!Array.isArray(json) || json.length !== 4) return null;
  const words = (json as readonly unknown[]).filter((word): word is number =>
    isWhole(word, 0, MAX_UINT32),
  );
  if (words.length !== 4) return null;
  return [pickAt(words, 0), pickAt(words, 1), pickAt(words, 2), pickAt(words, 3)];
}

/** The whole-number counters of a state, or null when one is missing, negative or fractional. */
function parseCounts(
  record: Json,
): Pick<MergeSiegeState, 'swipes' | 'entered' | 'smashed' | 'score' | 'nextId'> | null {
  const { swipes, entered, smashed, score, nextId } = record;
  const isValid =
    isWhole(swipes, 0, MAX_UINT32) &&
    isWhole(entered, 0, MAX_UINT32) &&
    isWhole(smashed, 0, MAX_UINT32) &&
    isWhole(score, 0, Number.MAX_SAFE_INTEGER) &&
    isWhole(nextId, 1, MAX_UINT32);
  return isValid ? { swipes, entered, smashed, score, nextId } : null;
}

/** Every piece id is unique and below nextId (the next piece gets nextId, so it must be new). */
function hasFreshIds(cells: readonly Cell[], nextId: number): boolean {
  const ids = cells.flatMap((cell) => (cell === null ? [] : [cell.id]));
  return new Set(ids).size === ids.length && ids.every((id) => id < nextId);
}

/**
 * The wave agrees with the difficulty: the endless run always has an enemy waiting; a level has one
 * waiting exactly while fewer than its wave's goal have entered, and never more than the goal.
 */
function isWaveConsistent(difficulty: number, entered: number, next: NextEnemy | null): boolean {
  if (isEndlessDifficulty(difficulty)) return next !== null;
  const { goal } = knobsFor(difficulty);
  return entered <= goal && (next === null) === (entered === goal);
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): MergeSiegeState | null {
  const record = recordWith(json, STATE_KEYS);
  if (record === null) return null;
  const { difficulty, hasContinued } = record;
  const cells = parseCells(record['cells']);
  const next = parseNext(record['next']);
  const rng = parseRng(record['rng']);
  const counts = parseCounts(record);
  if (!isWhole(difficulty, 0, 100) || typeof hasContinued !== 'boolean') return null;
  if (cells === null || next === undefined || rng === null || counts === null) return null;
  if (!hasFreshIds(cells, counts.nextId)) return null;
  if (!isWaveConsistent(difficulty, counts.entered, next)) return null;
  return { difficulty, cells, next, ...counts, hasContinued, rng };
}

/** One logged move -> a typed move, or null (the Shell then drops only the move log). */
export function parseMove(json: unknown): MergeSiegeMove | null {
  const record = recordWith(json, ['direction', 'kind']);
  if (record?.['kind'] !== 'swipe') return null;
  const direction = DIRECTIONS.find((known) => known === record['direction']);
  return direction === undefined ? null : { kind: 'swipe', direction };
}

export const MERGE_SIEGE_PERSISTENCE: PersistenceSpec<MergeSiegeState, MergeSiegeMove> = {
  stateVersion: MERGE_SIEGE_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
