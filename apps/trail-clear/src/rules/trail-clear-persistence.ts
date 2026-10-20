// apps/trail-clear/src/rules/trail-clear-persistence.ts
// Spec 8.6 / N10: a saved run is JSON from disk; rebuild a fresh typed state with explicit checks
// and return null on anything unexpected (the Shell then drops only the run). Never cast.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { isTileKind } from './tiles.ts';
import { TUNING } from './trail-clear-tuning.ts';

import type { PlacedTile, TrailClearMove, TrailClearState } from './trail-clear-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** Bump when the shape of TrailClearState or TrailClearMove changes, and add a migrateState step. */
export const TRAIL_CLEAR_STATE_VERSION = 1;

const SIZE = TUNING.boardSize;
const UINT32_MAX = 4_294_967_295;
const STATE_KEYS = [
  'cells',
  'difficulty',
  'hasContinued',
  'loopsClosed',
  'offered',
  'placements',
  'rng',
  'score',
];
const TILE_KEYS = ['kind', 'placedAt', 'turns'];
const MOVE_KEYS = ['col', 'kind', 'row', 'turns'];

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(json: unknown): json is JsonRecord {
  return typeof json === 'object' && json !== null && !Array.isArray(json);
}

/** True when the object has exactly these keys (an extra or a missing field is refused). */
function hasExactly(json: JsonRecord, keys: readonly string[]): boolean {
  const own = Object.keys(json).sort();
  return own.length === keys.length && own.every((key, index) => key === keys[index]);
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

function parseTile(json: unknown): PlacedTile | null {
  if (!isRecord(json) || !hasExactly(json, TILE_KEYS)) return null;
  const { kind, turns, placedAt } = json;
  const isValid = isTileKind(kind) && isWhole(turns, 0, 3) && isWhole(placedAt, 0, UINT32_MAX);
  return isValid ? { kind, turns, placedAt } : null;
}

/** A cell: an empty one ('empty', so listOf can tell it from a bad tile) or a tile. */
function parseCell(json: unknown): PlacedTile | 'empty' | null {
  return json === null ? 'empty' : parseTile(json);
}

function parseCells(json: unknown): (PlacedTile | null)[] | null {
  const cells = listOf(json, parseCell);
  if (cells?.length !== SIZE * SIZE) return null;
  return cells.map((cell) => (cell === 'empty' ? null : cell));
}

function parseRng(json: unknown): RngState | null {
  const words = listOf(json, (item) => (isWhole(item, 0, UINT32_MAX) ? item : null));
  if (words?.length !== 4) return null;
  return [pickAt(words, 0), pickAt(words, 1), pickAt(words, 2), pickAt(words, 3)];
}

function parseCounts(json: JsonRecord) {
  const { difficulty, placements, score, loopsClosed, hasContinued } = json;
  const isValid =
    isWhole(difficulty, 0, 100) &&
    isWhole(placements, 0, UINT32_MAX) &&
    isWhole(score, 0, UINT32_MAX) &&
    isWhole(loopsClosed, 0, UINT32_MAX) &&
    typeof hasContinued === 'boolean';
  return isValid ? { difficulty, placements, score, loopsClosed, hasContinued } : null;
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): TrailClearState | null {
  if (!isRecord(json) || !hasExactly(json, STATE_KEYS)) return null;
  const counts = parseCounts(json);
  const cells = parseCells(json['cells']);
  const rng = parseRng(json['rng']);
  const offered = json['offered'];
  const isOfferedValid = offered === null || isTileKind(offered);
  if (counts === null || cells === null || rng === null || !isOfferedValid) return null;
  const { difficulty, placements, score, loopsClosed, hasContinued } = counts;
  // The keys in the state's own order, so a saved run gives back the same bytes.
  return { difficulty, cells, offered, placements, score, loopsClosed, hasContinued, rng };
}

/** One logged move -> a typed move, or null (the Shell then drops only the undo history). */
export function parseMove(json: unknown): TrailClearMove | null {
  if (!isRecord(json) || !hasExactly(json, MOVE_KEYS) || json['kind'] !== 'place-tile') return null;
  const { turns, col, row } = json;
  const isValid = isWhole(turns, 0, 3) && isWhole(col, 0, SIZE - 1) && isWhole(row, 0, SIZE - 1);
  return isValid ? { kind: 'place-tile', turns, col, row } : null;
}

export const TRAIL_CLEAR_PERSISTENCE: PersistenceSpec<TrailClearState, TrailClearMove> = {
  stateVersion: TRAIL_CLEAR_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
