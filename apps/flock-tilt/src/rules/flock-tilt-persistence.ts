// apps/flock-tilt/src/rules/flock-tilt-persistence.ts
// Spec 8.6 and N10: a run is saved as JSON after every move. parseState and parseMove rebuild a
// typed value with explicit checks (never a cast) and return null for anything the rules could not
// have produced, so the Shell drops only that run (8.14), never crashes.
import { DIRECTIONS } from './tilt-field.ts';

import type {
  Direction,
  FlockBefore,
  FlockTiltMove,
  FlockTiltState,
  Sheep,
  SheepStatus,
  Wolf,
} from './flock-tilt-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';

/** Bump when the shape of FlockTiltState or FlockTiltMove changes, and add a migrateState step. */
export const FLOCK_TILT_STATE_VERSION = 1;

/** The largest side a saved field may have (the game draws 7 x 7). */
const MAX_SIDE = 16;

const STATE_KEYS = [
  'beforeLoss',
  'cols',
  'hasContinued',
  'par',
  'pen',
  'rocks',
  'rows',
  'sheep',
  'tiltLimit',
  'tilts',
  'wolves',
] as const;

const STATUSES: readonly SheepStatus[] = ['field', 'penned', 'lost'];

type Json = Readonly<Record<string, unknown>>;

function isRecord(json: unknown): json is Json {
  return typeof json === 'object' && json !== null && !Array.isArray(json);
}

/** True when the object has exactly these keys (an extra or missing field is refused). */
function hasExactKeys(json: Json, keys: readonly string[]): boolean {
  const own = Object.keys(json).sort();
  return own.length === keys.length && [...keys].sort().every((key, index) => own[index] === key);
}

function isWhole(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function listOf<TItem>(json: unknown, parse: (item: unknown) => TItem | null): TItem[] | null {
  if (!Array.isArray(json)) return null;
  const items: readonly unknown[] = json;
  const parsed = items.map(parse);
  return parsed.every((item): item is TItem => item !== null) ? parsed : null;
}

function parseSheep(json: unknown, size: number): Sheep | null {
  if (!isRecord(json) || !hasExactKeys(json, ['cell', 'id', 'status'])) return null;
  const { id, cell, status } = json;
  const known = STATUSES.find((one) => one === status);
  if (!isWhole(id, 0, size) || !isWhole(cell, 0, size - 1) || known === undefined) return null;
  return { id, cell, status: known };
}

function parseWolf(json: unknown, size: number): Wolf | null {
  if (!isRecord(json) || !hasExactKeys(json, ['cell', 'id'])) return null;
  const { id, cell } = json;
  return isWhole(id, 0, size) && isWhole(cell, 0, size - 1) ? { id, cell } : null;
}

/** The ground: a square-cell field of a sane size with rocks and a pen inside it. */
type Ground = {
  readonly cols: number;
  readonly rows: number;
  readonly rocks: number[];
  readonly pen: number;
};

function parseGround(json: Json): Ground | null {
  const { cols, rows, pen } = json;
  if (!isWhole(cols, 1, MAX_SIDE) || !isWhole(rows, 1, MAX_SIDE)) return null;
  const size = cols * rows;
  const rocks = listOf(json['rocks'], (item) => (isWhole(item, 0, size - 1) ? item : null));
  if (rocks === null || !isWhole(pen, 0, size - 1) || rocks.includes(pen)) return null;
  const ascending = [...new Set(rocks)].sort((a, b) => a - b);
  return ascending.join() === rocks.join() ? { cols, rows, rocks, pen } : null;
}

/** The flock's places make sense: unique ids, penned sheep in the pen, nobody on a rock or shared. */
function isFlockPlaced(ground: Ground, sheep: readonly Sheep[], wolves: readonly Wolf[]): boolean {
  const standing = [
    ...sheep.filter((one) => one.status !== 'penned').map((one) => one.cell),
    ...wolves.map((wolf) => wolf.cell),
  ];
  const isClear = standing.every((cell) => cell !== ground.pen && !ground.rocks.includes(cell));
  const isPennedRight = sheep.every((one) => one.status !== 'penned' || one.cell === ground.pen);
  const sheepIds = sheep.map((one) => one.id);
  const wolfIds = wolves.map((wolf) => wolf.id);
  return (
    isClear &&
    isPennedRight &&
    new Set(standing).size === standing.length &&
    new Set(sheepIds).size === sheepIds.length &&
    new Set(wolfIds).size === wolfIds.length &&
    sheep.length > 0
  );
}

function parseFlock(ground: Ground, json: Json): { sheep: Sheep[]; wolves: Wolf[] } | null {
  const size = ground.cols * ground.rows;
  const sheep = listOf(json['sheep'], (item) => parseSheep(item, size));
  const wolves = listOf(json['wolves'], (item) => parseWolf(item, size));
  if (sheep === null || wolves === null) return null;
  return isFlockPlaced(ground, sheep, wolves) ? { sheep, wolves } : null;
}

function parseBefore(ground: Ground, json: unknown): FlockBefore | null | undefined {
  if (json === null) return null;
  if (!isRecord(json) || !hasExactKeys(json, ['sheep', 'tilts', 'wolves'])) return undefined;
  const flock = parseFlock(ground, json);
  const { tilts } = json;
  return flock === null || !isWhole(tilts, 0, Number.MAX_SAFE_INTEGER)
    ? undefined
    : { ...flock, tilts };
}

/** The run's counts and its continue flag. */
type Counts = Pick<FlockTiltState, 'tilts' | 'tiltLimit' | 'par' | 'hasContinued'>;

function parseCounts(json: Json): Counts | null {
  const { tilts, tiltLimit, par, hasContinued } = json;
  const isCounted =
    isWhole(tilts, 0, Number.MAX_SAFE_INTEGER) &&
    isWhole(tiltLimit, 1, Number.MAX_SAFE_INTEGER) &&
    isWhole(par, 0, Number.MAX_SAFE_INTEGER);
  return isCounted && typeof hasContinued === 'boolean'
    ? { tilts, tiltLimit, par, hasContinued }
    : null;
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): FlockTiltState | null {
  if (!isRecord(json) || !hasExactKeys(json, STATE_KEYS)) return null;
  const ground = parseGround(json);
  const flock = ground === null ? null : parseFlock(ground, json);
  if (ground === null || flock === null) return null;
  const counts = parseCounts(json);
  const beforeLoss = parseBefore(ground, json['beforeLoss']);
  if (counts === null || beforeLoss === undefined) return null;
  return { ...ground, ...flock, ...counts, beforeLoss };
}

/** One logged move -> a typed move, or null (the Shell then drops only the undo history). */
export function parseMove(json: unknown): FlockTiltMove | null {
  if (!isRecord(json) || !hasExactKeys(json, ['direction', 'kind']) || json['kind'] !== 'tilt') {
    return null;
  }
  const direction = DIRECTIONS.find((one): one is Direction => one === json['direction']);
  return direction === undefined ? null : { kind: 'tilt', direction };
}

export const FLOCK_TILT_PERSISTENCE: PersistenceSpec<FlockTiltState, FlockTiltMove> = {
  stateVersion: FLOCK_TILT_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
