// apps/swap-guard/src/rules/create.ts
// The start of a level from (seed, difficulty), built from the seeded RNG choice by choice: every
// choice is drawn from the list of choices that keep the start fair, and a drawn start is kept only
// when planLine can win it (the RNG goes on to the next draw otherwise, the same on every phone).
import { clampDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { FACINGS, oppositeOf, stepFrom } from './board-grid.ts';
import { planLine } from './plan-line.ts';
import { strikesOf, struckSquares } from './strikes.ts';
import { knobsFor } from './swap-guard-tuning.ts';

import type { DifficultyKnobs } from './swap-guard-tuning.ts';
import type {
  Enemy,
  EnemyKind,
  Facing,
  SwapGuardMove,
  SwapGuardState,
} from './swap-guard-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** The prepared opening: the guard, the spear that threatens it, the enemy that strikes the spear. */
export type Opening = {
  readonly guard: number;
  readonly threat: Enemy;
  readonly partner: Enemy;
};

type Board = Pick<SwapGuardState, 'size' | 'guard' | 'enemies'>;

/** The two directions square to `facing`. */
function sideways(facing: Facing): readonly Facing[] {
  return facing === 'up' || facing === 'down' ? ['left', 'right'] : ['up', 'down'];
}

/** The opening with its threat beside the guard (toThreat) and its partner beyond (toPartner). */
function openingAt(
  board: { readonly size: number; readonly guard: number; readonly partnerKind: EnemyKind },
  toThreat: Facing,
  toPartner: Facing,
): Opening | null {
  const threatCell = stepFrom(board.size, board.guard, toThreat);
  const partnerCell = threatCell === null ? null : stepFrom(board.size, threatCell, toPartner);
  if (threatCell === null || partnerCell === null) return null;
  const facing = board.partnerKind === 'brute' ? 'up' : oppositeOf(toPartner);
  return {
    guard: board.guard,
    threat: { id: 0, kind: 'spear', facing: oppositeOf(toThreat), cell: threatCell },
    partner: { id: 1, kind: board.partnerKind, facing, cell: partnerCell },
  };
}

/**
 * Every prepared opening of a board, in a fixed order: the guard stands in the strike of a spear
 * beside it, and a second enemy diagonal to the guard strikes that spear. Swapping the second enemy
 * into the guard's square makes the two hit each other at once (the first payoff and the twist).
 */
export function openingsOf(size: number, partnerKind: EnemyKind): Opening[] {
  const guards = Array.from({ length: size * size }, (_, guard) => guard);
  return guards
    .flatMap((guard) =>
      FACINGS.flatMap((toThreat) =>
        sideways(toThreat).map((toPartner) =>
          openingAt({ size, guard, partnerKind }, toThreat, toPartner),
        ),
      ),
    )
    .filter((opening): opening is Opening => opening !== null);
}

/** The facings an enemy of this kind may have: a brute strikes all around and always faces up. */
function facingsOf(kind: EnemyKind): readonly Facing[] {
  return kind === 'brute' ? ['up'] : FACINGS;
}

/** True when nobody but the opening's spear (id 0) stands on a struck square. */
function isCalm(board: Board): boolean {
  const struck = struckSquares(strikesOf(board));
  return board.enemies.every((enemy) => enemy.id === 0 || !struck.has(enemy.cell));
}

/**
 * The enemies that may join a start, in a fixed order: on a free square, with every enemy but the
 * opening's spear left unstruck (so nobody is knocked out before the player has chosen).
 */
export function joinersOf(board: Board, kinds: readonly EnemyKind[]): Enemy[] {
  const taken = new Set([board.guard, ...board.enemies.map((enemy) => enemy.cell)]);
  const id = board.enemies.length;
  const free = Array.from({ length: board.size * board.size }, (_, cell) => cell).filter(
    (cell) => !taken.has(cell),
  );
  return free
    .flatMap((cell) =>
      kinds.flatMap((kind) => facingsOf(kind).map((facing) => ({ id, kind, facing, cell }))),
    )
    .filter((joiner) => isCalm({ ...board, enemies: [...board.enemies, joiner] }));
}

function draw<T>(rng: RngState, items: readonly T[]): { readonly item: T; readonly rng: RngState } {
  const pick = nextInt(rng, items.length);
  return { item: pickAt(items, pick.value), rng: pick.state };
}

/** The fewest enemies a start has: the opening pair (the fallback start is that pair alone). */
export const OPENING_ENEMIES = 2;

/** Starts drawn for one seed before falling back to the opening pair alone. */
const MAX_DRAWS = 64;

/** A start with these enemies, nothing played yet. */
function startOf(knobs: DifficultyKnobs, guard: number, enemies: readonly Enemy[]): SwapGuardState {
  return {
    size: knobs.size,
    guard,
    enemies,
    enemyCount: enemies.length,
    swaps: 0,
    maxSwaps: knobs.maxSwaps,
    score: 0,
    isHit: false,
    lastSwap: null,
    hasContinued: false,
  };
}

/**
 * One drawn start: the prepared opening (its partner of any kind of the row), then calm joiners
 * (spears and archers: a brute only ever opens, as a partner, because no swap sends a lone brute
 * into its own strike).
 */
function drawStart(
  rng: RngState,
  knobs: DifficultyKnobs,
): { readonly state: SwapGuardState; readonly rng: RngState } {
  const partnerKind = draw(rng, knobs.kinds);
  const opening = draw(partnerKind.rng, openingsOf(knobs.size, partnerKind.item));
  const joinerKinds = knobs.kinds.filter((kind) => kind !== 'brute');
  let next = opening.rng;
  let enemies: Enemy[] = [opening.item.threat, opening.item.partner];
  while (enemies.length < knobs.enemies) {
    const board = { size: knobs.size, guard: opening.item.guard, enemies };
    const joiners = joinersOf(board, joinerKinds);
    if (joiners.length === 0) break;
    const joiner = draw(next, joiners);
    next = joiner.rng;
    enemies = [...enemies, joiner.item];
  }
  return { state: startOf(knobs, opening.item.guard, enemies), rng: next };
}

/** Swaps the opening pair alone needs: the double hit knocks out both at once. */
const OPENING_SWAPS = 1;

/** The start with its budget: the planned line's swaps plus the row's spare ones, within the cap. */
function withBudget(
  state: SwapGuardState,
  planned: number,
  knobs: DifficultyKnobs,
): SwapGuardState {
  return { ...state, maxSwaps: Math.min(knobs.maxSwaps, planned + knobs.spareSwaps) };
}

/**
 * The start a seed makes with these knobs: the first drawn start that planLine wins within the cap
 * (spec 8.1: no level is impossible, the daily included), with its budget. Should every draw fail,
 * the opening pair of the last start checked, alone, which its double hit always wins.
 */
export function startFor(
  seed: number,
  knobs: DifficultyKnobs,
  plan: (start: SwapGuardState) => readonly SwapGuardMove[] | null = planLine,
): SwapGuardState {
  let drawn = drawStart(seedRng(seed), knobs);
  for (let count = 1; ; count += 1) {
    const line = plan(drawn.state);
    if (line !== null) return withBudget(drawn.state, line.length, knobs);
    // The last check fails: its own opening pair is the fallback, so no further start is drawn.
    if (count === MAX_DRAWS) break;
    drawn = drawStart(drawn.rng, knobs);
  }
  const pair = startOf(knobs, drawn.state.guard, drawn.state.enemies.slice(0, OPENING_ENEMIES));
  return withBudget(pair, OPENING_SWAPS, knobs);
}

/**
 * Start state from (seed, difficulty): the same pair gives the same board on every phone. The guard
 * starts in a strike with a double hit one swap away; the other enemies stand calm.
 */
export function create(seed: number, difficulty: number): SwapGuardState {
  return startFor(seed, knobsFor(clampDifficulty(difficulty)));
}
