// apps/swap-guard/src/rules/apply-move.ts
import { squaresAround } from './board-grid.ts';
import { outcome } from './outcome.ts';
import { strikesOf, struckSquares } from './strikes.ts';
import { volleyPoints } from './swap-guard-tuning.ts';

import type {
  Enemy,
  Strike,
  SwapGuardEvent,
  SwapGuardMove,
  SwapGuardResult,
  SwapGuardState,
} from './swap-guard-types.ts';

function isLegal(state: SwapGuardState, move: SwapGuardMove): boolean {
  return squaresAround(state.size, state.guard).includes(move.cell);
}

/** The events of one swap and its volley, in the order they happen. */
function volleyEvents(
  swap: { readonly from: number; readonly to: number; readonly enemyId: number | null },
  strikes: readonly Strike[],
  defeated: readonly Enemy[],
): SwapGuardEvent[] {
  const events: SwapGuardEvent[] = [
    { kind: 'pieces-swapped', ...swap },
    { kind: 'strikes-landed', strikes: strikes.filter((strike) => strike.cells.length > 0) },
  ];
  if (defeated.length > 0) {
    events.push({
      kind: 'enemies-defeated',
      enemyIds: defeated.map((enemy) => enemy.id),
      cells: defeated.map((enemy) => enemy.cell),
    });
  }
  const hitters = strikes.filter((strike) => strike.cells.includes(swap.to));
  if (hitters.length > 0) {
    events.push({ kind: 'guard-hit', cell: swap.to, enemyIds: hitters.map((s) => s.enemyId) });
  }
  return events;
}

/**
 * Pure: the guard swaps places with the square it chose (an enemy there takes the guard's old
 * square and keeps its facing), then every strike shown before the swap lands at once. Anyone on a
 * struck square is hit: an enemy is knocked out, even by its own strike; the guard loses the run.
 * An illegal move throws instead of returning a corrupted state.
 */
export function applyMove(state: SwapGuardState, move: SwapGuardMove): SwapGuardResult {
  if (outcome(state).kind !== 'playing' || !isLegal(state, move)) {
    throw new RangeError(`illegal move ${JSON.stringify(move)}`);
  }
  const strikes = strikesOf(state);
  const struck = struckSquares(strikes);
  const from = state.guard;
  const swapped = state.enemies.find((enemy) => enemy.cell === move.cell);
  const moved = state.enemies.map((enemy) =>
    enemy.cell === move.cell ? { ...enemy, cell: from } : enemy,
  );
  const defeated = moved.filter((enemy) => struck.has(enemy.cell));
  const points = volleyPoints(defeated.length);
  const enemyId = swapped === undefined ? null : swapped.id;
  return {
    state: {
      ...state,
      guard: move.cell,
      enemies: moved.filter((enemy) => !struck.has(enemy.cell)),
      swaps: state.swaps + 1,
      score: state.score + points,
      isHit: struck.has(move.cell),
      lastSwap: { from, to: move.cell, defeated, points },
    },
    events: volleyEvents({ from, to: move.cell, enemyId }, strikes, defeated),
  };
}
