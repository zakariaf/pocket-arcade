// apps/poker-drop/src/rules/poker-drop-persistence.ts
// Spec 8.6 / N10: a saved run is JSON from disk; rebuild a fresh typed state with explicit checks
// and return null on anything unexpected, a missing or an extra field included, or counts and
// cards no play can reach (the Shell then drops only the run, 8.14). Never cast.
import { rankOf } from './cards.ts';
import { TUNING, knobsFor } from './poker-drop-tuning.ts';

import type { Card, Cell, PokerDropMove, PokerDropState } from './poker-drop-types.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** Bump when the shape of PokerDropState or PokerDropMove changes, and add a migrateState step. */
export const POKER_DROP_STATE_VERSION = 1;

const UINT32_MAX = 4_294_967_295;
const LAST_CARD = 51;
const CELLS = TUNING.wellCols * TUNING.wellRows;
/** Every field a saved state has, no more and no fewer. */
const STATE_KEYS = [
  'difficulty',
  'cells',
  'hand',
  'next',
  'pile',
  'goal',
  'handsMade',
  'score',
  'drops',
  'hasOverflowed',
  'hasContinued',
  'rng',
] as const;

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(json: unknown): json is JsonRecord {
  return typeof json === 'object' && json !== null && !Array.isArray(json);
}

function isWhole(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

const isCardValue = (value: unknown): value is Card => isWhole(value, 0, LAST_CARD);
const isCellValue = (value: unknown): value is Cell => value === null || isCardValue(value);
const isWord = (value: unknown): value is number => isWhole(value, 0, UINT32_MAX);

/** The list when every item passes the guard, else null. */
function listOf<T>(json: unknown, guard: (item: unknown) => item is T): T[] | null {
  if (!Array.isArray(json)) return null;
  const items: readonly unknown[] = json;
  return items.every(guard) ? [...items] : null;
}

function hasExactKeys(json: JsonRecord): boolean {
  const keys = Object.keys(json);
  return keys.length === STATE_KEYS.length && STATE_KEYS.every((key) => keys.includes(key));
}

function parseRng(json: unknown): RngState | null {
  const words = listOf(json, isWord);
  if (words === null) return null;
  const [a, b, c, d, ...rest] = words;
  if (a === undefined || b === undefined || c === undefined || d === undefined) return null;
  return rest.length === 0 ? [a, b, c, d] : null;
}

function parseCounts(json: JsonRecord) {
  const { difficulty, goal, handsMade, score, drops, hand, next } = json;
  const isValid =
    isWhole(difficulty, 0, 100) &&
    isWhole(goal, 0, UINT32_MAX) &&
    isWhole(handsMade, 0, UINT32_MAX) &&
    isWhole(score, 0, UINT32_MAX) &&
    isWhole(drops, 0, UINT32_MAX) &&
    isCardValue(hand) &&
    isCardValue(next);
  return isValid ? { difficulty, goal, handsMade, score, drops, hand, next } : null;
}

function parseFlags(json: JsonRecord) {
  const { hasOverflowed, hasContinued } = json;
  const isValid = typeof hasOverflowed === 'boolean' && typeof hasContinued === 'boolean';
  return isValid ? { hasOverflowed, hasContinued } : null;
}

const HAND_POINTS: readonly number[] = Object.values(TUNING.handPoints);
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
/** Every hand scores a multiple of this (its points times its cascade step). */
const POINT_STEP = HAND_POINTS.reduce(gcd);
/** The weakest bursting hand's points: each hand made adds at least this much. */
const MIN_HAND_POINTS = Math.min(...HAND_POINTS);

/**
 * The checks only play can guarantee: the goal and the ranks of the difficulty's row, one deck in
 * the pile, and a score that the hands made can add up to (none before a drop).
 */
function isReachable(state: PokerDropState): boolean {
  const knobs = knobsFor(state.difficulty);
  const cards = [state.hand, state.next, ...state.pile, ...state.cells.filter((c) => c !== null)];
  const { handsMade, score } = state;
  return (
    state.goal === knobs.goal &&
    cards.every((card) => rankOf(card) >= knobs.minRank) &&
    new Set(state.pile).size === state.pile.length &&
    (handsMade === 0) === (score === 0) &&
    score % POINT_STEP === 0 &&
    score >= handsMade * MIN_HAND_POINTS &&
    (handsMade === 0 || state.drops > 0)
  );
}

/** JSON from disk -> a fresh, typed state, or null (the Shell then drops only the run). */
export function parseState(json: unknown): PokerDropState | null {
  if (!isRecord(json) || !hasExactKeys(json)) return null;
  const counts = parseCounts(json);
  const flags = parseFlags(json);
  const cells = listOf(json['cells'], isCellValue);
  const pile = listOf(json['pile'], isCardValue);
  const rng = parseRng(json['rng']);
  if (counts === null || flags === null || cells?.length !== CELLS) return null;
  if (pile === null || rng === null) return null;
  const { difficulty, goal, handsMade, score, drops, hand, next } = counts;
  // The field order of create(): a parsed save serialises to the same JSON again.
  const state = {
    difficulty,
    cells,
    hand,
    next,
    pile,
    goal,
    handsMade,
    score,
    drops,
    ...flags,
    rng,
  };
  return isReachable(state) ? state : null;
}

/** One logged move -> a typed move, or null (the Shell then drops only the move log). */
export function parseMove(json: unknown): PokerDropMove | null {
  if (!isRecord(json) || json['kind'] !== 'drop-card' || Object.keys(json).length !== 2)
    return null;
  const { col } = json;
  return isWhole(col, 0, TUNING.wellCols - 1) ? { kind: 'drop-card', col } : null;
}

export const POKER_DROP_PERSISTENCE: PersistenceSpec<PokerDropState, PokerDropMove> = {
  stateVersion: POKER_DROP_STATE_VERSION,
  parseState,
  parseMove,
  // Version 1 has no older shape to upgrade from.
  migrateState: () => null,
  savePolicy: { kind: 'after-every-move' },
};
