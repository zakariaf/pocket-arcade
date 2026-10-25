// apps/trail-clear/src/rules/trail-clear-persistence.ts
// Spec 8.6 / N10: a saved run is JSON from disk; rebuild a fresh typed state with explicit checks
// and return null on anything unexpected (the Shell then drops only the run). Never cast.
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { EVERY_OPENING, openingCells } from './opening.ts';
import { edgesOf, isTileKind } from './tiles.ts';
import { TUNING, knobsFor, loopPoints } from './trail-clear-tuning.ts';
import { closedLoopsAt, fits } from './trails.ts';

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

/** The opening deals two tiles before the first placement (placedAt 0). */
const OPENING_TILES = 2;
/** One placement closes at most a road and a river. */
const MOST_LOOPS_PER_PLACEMENT = 2;

const isSameTile = (a: PlacedTile | null, b: PlacedTile | null): boolean =>
  a?.kind === b?.kind && a?.turns === b?.turns && a?.placedAt === b?.placedAt;

/**
 * The tiles at placement 0 are what is left of one opening create() can deal (its road end and its
 * river end, facing their inner gap from opposite sides), and before the first placement they are
 * that whole opening, with its first tile offered.
 */
function isOpeningReachable(state: TrailClearState): boolean {
  const kept = state.cells.map((tile) => (tile?.placedAt === 0 ? tile : null));
  return EVERY_OPENING.some((opening) => {
    const cells = openingCells(opening);
    if (state.placements === 0) {
      return (
        state.offered === opening.firstTile &&
        state.cells.every((tile, cell) => isSameTile(tile, cells[cell] ?? null))
      );
    }
    return kept.every((tile, cell) => tile === null || isSameTile(tile, cells[cell] ?? null));
  });
}

/** Each tile's placement number: the opening's at 0, the others once each, none ahead. */
function areTileIdsReachable(state: TrailClearState): boolean {
  const placed = state.cells.flatMap((tile) =>
    tile === null || tile.placedAt === 0 ? [] : [tile.placedAt],
  );
  return (
    isOpeningReachable(state) &&
    new Set(placed).size === placed.length &&
    placed.every((id) => id <= state.placements)
  );
}

/** Every tile fits its neighbours and the rim, and no closed loop is left (it is wiped as it closes). */
function isBoardReachable(cells: readonly (PlacedTile | null)[]): boolean {
  return cells.every((tile, cell) => {
    if (tile === null) return true;
    const without = cells.map((old, index) => (index === cell ? null : old));
    return (
      fits(without, cell, edgesOf(tile.kind, tile.turns)) && closedLoopsAt(cells, cell).length === 0
    );
  });
}

/**
 * The bag agrees with the offered tile: a level offers none exactly once its last tile is placed
 * (placements === bag, the level is won); the endless run's bag never empties, so it always offers.
 */
function isBagReachable(state: TrailClearState): boolean {
  if (isEndlessDifficulty(state.difficulty)) return state.offered !== null;
  const { bag } = knobsFor(state.difficulty);
  return state.placements <= bag && (state.offered === null) === (state.placements === bag);
}

/** The smallest loop: two end pieces facing each other. */
const SMALLEST_LOOP = 2;
/** A tile sits in at most two loops: a road and a river, closed together. */
const MOST_LOOPS_PER_TILE = 2;

/**
 * The score its loops can make. Every loop scores loopPoints of its size (a whole number of tile
 * points), at least the smallest loop's. A loop holds at most every tile ever placed (the opening's
 * and the placements', never more than the board), and a tile is in at most two loops (a road and
 * a river closed together), so the loops' sizes sum to at most twice the tiles; with every loop as
 * large as it can be and doubled, the score cannot pass the bound.
 */
function isScoreReachable(state: TrailClearState): boolean {
  const { score, loopsClosed, placements } = state;
  const tiles = placements + OPENING_TILES;
  const largestLoop = Math.min(SIZE * SIZE, tiles);
  const loopTiles = Math.min(MOST_LOOPS_PER_TILE * tiles, largestLoop * loopsClosed);
  const most = TUNING.doubleMultiplier * TUNING.tilePoints * largestLoop * loopTiles;
  return (
    score % TUNING.tilePoints === 0 &&
    score >= loopsClosed * loopPoints(SMALLEST_LOOP) &&
    score <= most
  );
}

/** The counters agree: a score exactly when a loop closed, at most two loops a placement, the bag. */
function areCountsReachable(state: TrailClearState): boolean {
  return (
    (state.score === 0) === (state.loopsClosed === 0) &&
    state.loopsClosed <= MOST_LOOPS_PER_PLACEMENT * state.placements &&
    isScoreReachable(state) &&
    isBagReachable(state)
  );
}

/** True when legal play from some start can reach the state (N10: a damaged save is dropped). */
function isReachable(state: TrailClearState): boolean {
  return areCountsReachable(state) && areTileIdsReachable(state) && isBoardReachable(state.cells);
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
  const state = { difficulty, cells, offered, placements, score, loopsClosed, hasContinued, rng };
  return isReachable(state) ? state : null;
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
