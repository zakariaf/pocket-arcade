// apps/line-siege/src/rules/line-siege-persistence.ts
// Spec 8.4 / N10: a saved run is JSON from disk; rebuild a fresh typed state with explicit checks
// and return null on anything unexpected (the Shell then drops only the run). Never cast.
import { TUNING } from './line-siege-tuning.ts';
import { PIECES, TRAY_SIZE } from './pieces.ts';

import type {
  Cell,
  LineSiegeMove,
  LineSiegeState,
  Monster,
  MonsterKind,
} from './line-siege-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** Bump when the shape of LineSiegeState or LineSiegeMove changes, and add a migrateState step. */
export const LINE_SIEGE_STATE_VERSION = 1;

const SIZE = TUNING.boardSize;
const UINT32_MAX = 4_294_967_295;
const KINDS: readonly MonsterKind[] = ['normal', 'armoured', 'fast'];

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(json: unknown): json is JsonRecord {
  return typeof json === 'object' && json !== null && !Array.isArray(json);
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

const parseCell = (item: unknown): Cell | null => (item === 0 || item === 1 ? item : null);
function parseSlot(item: unknown): number | null | 'empty' {
  if (item === null) return 'empty';
  return isWhole(item, 0, PIECES.length - 1) ? item : null;
}
const parseWord = (item: unknown): number | null => (isWhole(item, 0, UINT32_MAX) ? item : null);

function parseMonster(json: unknown): Monster | null {
  if (!isRecord(json)) return null;
  const { id, kind, lane, row, hp } = json;
  const known = KINDS.find((item) => item === kind);
  const isValid =
    isWhole(id, 1, UINT32_MAX) &&
    isWhole(lane, 0, SIZE - 1) &&
    isWhole(row, 0, TUNING.laneRows - 1) &&
    isWhole(hp, 1, UINT32_MAX);
  return isValid && known !== undefined ? { id, kind: known, lane, row, hp } : null;
}

function parseTray(json: unknown): (number | null)[] | null {
  const slots = listOf(json, parseSlot);
  if (slots?.length !== TRAY_SIZE) return null;
  return slots.map((slot) => (slot === 'empty' ? null : slot));
}

function parseRng(json: unknown): RngState | null {
  const words = listOf(json, parseWord);
  if (words?.length !== 4) return null;
  const [a = 0, b = 0, c = 0, d = 0] = words;
  return [a, b, c, d];
}

function parseCounts(json: JsonRecord) {
  const { difficulty, hearts, placements, spawned, defeated, score, nextId } = json;
  const isValid =
    isWhole(difficulty, 0, 100) &&
    isWhole(hearts, 0, TUNING.hearts) &&
    isWhole(placements, 0, UINT32_MAX) &&
    isWhole(spawned, 0, UINT32_MAX) &&
    isWhole(defeated, 0, UINT32_MAX) &&
    isWhole(score, 0, UINT32_MAX) &&
    isWhole(nextId, 1, UINT32_MAX);
  return isValid ? { difficulty, hearts, placements, spawned, defeated, score, nextId } : null;
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): LineSiegeState | null {
  if (!isRecord(json)) return null;
  const counts = parseCounts(json);
  const cells = listOf(json['cells'], parseCell);
  const tray = parseTray(json['tray']);
  const monsters = listOf(json['monsters'], parseMonster);
  const rng = parseRng(json['rng']);
  if (counts === null || cells?.length !== SIZE * SIZE || tray === null) return null;
  if (monsters === null || rng === null) return null;
  const { difficulty, hearts, placements, spawned, defeated, score, nextId } = counts;
  return {
    difficulty,
    cells,
    tray,
    monsters,
    hearts,
    placements,
    spawned,
    defeated,
    score,
    nextId,
    rng,
  };
}

/** One logged move -> a typed move, or null (the Shell then drops only the undo history). */
export function parseMove(json: unknown): LineSiegeMove | null {
  if (!isRecord(json) || json['kind'] !== 'place-block') return null;
  const { trayIndex, col, row } = json;
  const isValid =
    isWhole(trayIndex, 0, TRAY_SIZE - 1) && isWhole(col, 0, SIZE - 1) && isWhole(row, 0, SIZE - 1);
  return isValid ? { kind: 'place-block', trayIndex, col, row } : null;
}

export const LINE_SIEGE_PERSISTENCE: PersistenceSpec<LineSiegeState, LineSiegeMove> = {
  stateVersion: LINE_SIEGE_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
