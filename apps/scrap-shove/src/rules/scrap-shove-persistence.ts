// apps/scrap-shove/src/rules/scrap-shove-persistence.ts
// Saved runs come back from disk as unknown JSON: every field is checked (type, range, no extra
// field) and rebuilt, never cast. A run that fails is dropped alone; the player's results stay.
import { TUNING } from './scrap-shove-tuning.ts';
import { ROBOT_KINDS } from './scrap-shove-types.ts';

import type {
  Cell,
  Floor,
  Heap,
  Robot,
  ScrapShoveMove,
  ScrapShoveState,
} from './scrap-shove-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';

/** Bump when the shape of ScrapShoveState or ScrapShoveMove changes, and add a migrateState step. */
export const SCRAP_SHOVE_STATE_VERSION = 1;

type Json = Readonly<Record<string, unknown>>;

const STATE_KEYS = [
  'caughtBy',
  'cols',
  'hasContinued',
  'heaps',
  'nextId',
  'player',
  'rescue',
  'robots',
  'robotsTotal',
  'rows',
];
const FLOOR_KEYS = ['heaps', 'nextId', 'player', 'robots'];

function isRecord(json: unknown): json is Json {
  return typeof json === 'object' && json !== null && !Array.isArray(json);
}

/** True for a plain object with exactly these keys (an extra or a missing field is refused). */
function hasKeys(json: unknown, keys: readonly string[]): json is Json {
  return isRecord(json) && Object.keys(json).sort().join() === [...keys].sort().join();
}

function isWhole(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function parseCell(json: unknown): Cell | null {
  if (!hasKeys(json, ['col', 'row'])) return null;
  const { col, row } = json;
  return isWhole(col, 0, TUNING.side - 1) && isWhole(row, 0, TUNING.side - 1) ? { col, row } : null;
}

function isRobotKind(value: unknown): value is Robot['kind'] {
  return ROBOT_KINDS.some((kind) => kind === value);
}

function parseRobot(json: unknown): Robot | null {
  if (!hasKeys(json, ['col', 'id', 'kind', 'row'])) return null;
  const { id, kind } = json;
  const cell = parseCell({ col: json['col'], row: json['row'] });
  return cell !== null && isWhole(id, 1, Number.MAX_SAFE_INTEGER) && isRobotKind(kind)
    ? { id, kind, ...cell }
    : null;
}

function parseHeap(json: unknown): Heap | null {
  if (!hasKeys(json, ['col', 'id', 'isShoved', 'row'])) return null;
  const { id, isShoved } = json;
  const cell = parseCell({ col: json['col'], row: json['row'] });
  return cell !== null && isWhole(id, 1, Number.MAX_SAFE_INTEGER) && typeof isShoved === 'boolean'
    ? { id, ...cell, isShoved }
    : null;
}

/** Every item parsed, or null when one of them fails. */
function parseList<T>(json: unknown, parseItem: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(json)) return null;
  const items: readonly unknown[] = json;
  const parsed = items.map(parseItem);
  return parsed.every((item): item is T => item !== null) ? parsed : null;
}

function parseFloor(json: unknown): Floor | null {
  if (!hasKeys(json, FLOOR_KEYS)) return null;
  const player = parseCell(json['player']);
  const robots = parseList(json['robots'], parseRobot);
  const heaps = parseList(json['heaps'], parseHeap);
  const { nextId } = json;
  if (
    player === null ||
    robots === null ||
    heaps === null ||
    !isWhole(nextId, 1, Number.MAX_SAFE_INTEGER)
  )
    return null;
  return { player, robots, heaps, nextId };
}

/** The saved rescue floor: null when there is none, undefined when it is broken. */
function parseRescue(value: unknown): Floor | null | undefined {
  if (value === null) return null;
  return parseFloor(value) ?? undefined;
}

/** The run bookkeeping around the floor, or null when a value is out of range. */
function parseRun(json: Json, floor: Floor): Omit<ScrapShoveState, keyof Floor> | null {
  const { cols, rows, robotsTotal, caughtBy, hasContinued } = json;
  const isSide = cols === TUNING.side && rows === TUNING.side;
  const isTotal = isWhole(robotsTotal, floor.robots.length, Number.MAX_SAFE_INTEGER);
  // The catcher must be a robot of the floor; undefined means a caughtBy that names none.
  const catcher = caughtBy === null ? null : floor.robots.find((robot) => robot.id === caughtBy);
  const rescue = parseRescue(json['rescue']);
  const isFlag = typeof hasContinued === 'boolean';
  if (!isSide || !isTotal || catcher === undefined || rescue === undefined || !isFlag) return null;
  const caught = catcher === null ? null : catcher.id;
  return {
    cols: TUNING.side,
    rows: TUNING.side,
    robotsTotal,
    caughtBy: caught,
    rescue,
    hasContinued,
  };
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): ScrapShoveState | null {
  if (!hasKeys(json, STATE_KEYS)) return null;
  const floor = parseFloor({
    player: json['player'],
    robots: json['robots'],
    heaps: json['heaps'],
    nextId: json['nextId'],
  });
  if (floor === null) return null;
  const run = parseRun(json, floor);
  if (run === null) return null;
  // The key order create() writes, so the saved JSON text comes back byte for byte.
  const { cols, rows, robotsTotal, caughtBy, rescue, hasContinued } = run;
  return { cols, rows, ...floor, robotsTotal, caughtBy, rescue, hasContinued };
}

/** One logged move -> a typed move, or null (the Shell then drops only the undo history). */
export function parseMove(json: unknown): ScrapShoveMove | null {
  if (hasKeys(json, ['kind'])) return json['kind'] === 'wait' ? { kind: 'wait' } : null;
  if (!hasKeys(json, ['col', 'kind', 'row'])) return null;
  const { kind } = json;
  const cell = parseCell({ col: json['col'], row: json['row'] });
  if (cell === null) return null;
  if (kind === 'step') return { kind: 'step', ...cell };
  return kind === 'shove' ? { kind: 'shove', ...cell } : null;
}

export const SCRAP_SHOVE_PERSISTENCE: PersistenceSpec<ScrapShoveState, ScrapShoveMove> = {
  stateVersion: SCRAP_SHOVE_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
