// apps/swap-guard/src/rules/plan-line.ts
// A sure way through a board, used by create to keep only starts that can be won and to set their
// swap budget (spec 8.1: no level is impossible; the daily challenge is generated on the phone,
// unproven by the level tables). The simple plan takes any swap that knocks enemies out safely;
// otherwise it walks over safe empty squares to the square right behind a spear or an archer, whose
// next two swaps send that enemy into its own strike. planLine shortens that line one swap at a time
// (a swap, then the simple plan, when that wins sooner). Every step is played through applyMove, so a
// plan is a real line. It is not always the shortest: the exact par comes from the BFS solver.
import { applyMove } from './apply-move.ts';
import { oppositeOf, squaresAround, stepFrom } from './board-grid.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { strikesOf, struckSquares } from './strikes.ts';

import type { SwapGuardMove, SwapGuardState } from './swap-guard-types.ts';

/** The safe swap that knocks out the most enemies (the first in board order on a tie), or null. */
function knockOutMove(state: SwapGuardState): SwapGuardMove | null {
  let best: { readonly move: SwapGuardMove; readonly count: number } | null = null;
  for (const move of listMoves(state)) {
    const next = applyMove(state, move).state;
    const count = state.enemies.length - next.enemies.length;
    const isBetter = !next.isHit && count > 0 && (best === null || count > best.count);
    if (isBetter) best = { move, count };
  }
  return best === null ? null : best.move;
}

/** A square reached by a safe walk, and the walk's first step. */
type Reached = { readonly cell: number; readonly firstStep: number };

/** First steps of the shortest walks from the guard over safe empty squares, by target square. */
function firstSteps(state: SwapGuardState): Map<number, number> {
  const blocked = new Set([
    state.guard,
    ...state.enemies.map((enemy) => enemy.cell),
    ...struckSquares(strikesOf(state)),
  ]);
  const first = new Map<number, number>();
  let frontier: Reached[] = squaresAround(state.size, state.guard)
    .filter((cell) => !blocked.has(cell))
    .map((cell) => ({ cell, firstStep: cell }));
  while (frontier.length > 0) {
    for (const reached of frontier) {
      if (!first.has(reached.cell)) first.set(reached.cell, reached.firstStep);
      blocked.add(reached.cell);
    }
    frontier = frontier.flatMap((reached) =>
      squaresAround(state.size, reached.cell)
        .filter((cell) => !blocked.has(cell))
        .map((cell) => ({ cell, firstStep: reached.firstStep })),
    );
  }
  return first;
}

/**
 * The next move toward a self-strike: from the square right behind a spear or an archer, the swap
 * with it; otherwise the first step of the shortest safe walk to such a square (the first one the
 * walk reaches). Null when no enemy can be approached from behind.
 */
function approachMove(state: SwapGuardState): SwapGuardMove | null {
  const approachable = state.enemies.filter((enemy) => enemy.kind !== 'brute');
  for (const enemy of approachable) {
    const behind = stepFrom(state.size, enemy.cell, oppositeOf(enemy.facing));
    if (behind === state.guard) return { kind: 'swap', cell: enemy.cell };
  }
  const behinds = new Set(
    approachable.map((enemy) => stepFrom(state.size, enemy.cell, oppositeOf(enemy.facing))),
  );
  for (const [cell, firstStep] of firstSteps(state)) {
    if (behinds.has(cell)) return { kind: 'swap', cell: firstStep };
  }
  return null;
}

/** The simple plan's winning line from `start`, or null when it finds none within the swaps left. */
export function simpleLine(start: SwapGuardState): SwapGuardMove[] | null {
  let state = start;
  const line: SwapGuardMove[] = [];
  while (outcome(state).kind === 'playing') {
    const move = knockOutMove(state) ?? approachMove(state);
    if (move === null) return null;
    state = applyMove(state, move).state;
    line.push(move);
  }
  return outcome(state).kind === 'won' ? line : null;
}

/**
 * The shortest line from a playing `state` among `known` (a winning line from it) and every swap
 * followed by the simple plan; a rival counts only when strictly shorter, so the simple plan is
 * played only up to the length still worth beating.
 */
function improve(state: SwapGuardState, known: readonly SwapGuardMove[]): readonly SwapGuardMove[] {
  let best = known;
  const enemyCells = new Set(state.enemies.map((enemy) => enemy.cell));
  for (const move of listMoves(state).filter((swap) => enemyCells.has(swap.cell))) {
    const next = applyMove(state, move).state;
    const limit = Math.min(next.maxSwaps, next.swaps + best.length - 2);
    const rest = simpleLine({ ...next, maxSwaps: limit });
    if (rest !== null && rest.length + 1 < best.length) best = [move, ...rest];
  }
  return best;
}

/** How many swaps ahead a plan looks, whatever the budget: more than any row's cap. */
export const PLAN_HORIZON = 30;

/**
 * A winning line from `start` when the simple plan has one, never longer than it: before each swap
 * it takes the shortest of the line it knows and every swap followed by the simple plan. Null when
 * the simple plan finds no line, or the line does not fit the swaps left. The plan is made as if
 * PLAN_HORIZON swaps were left, so a budget changes only whether the line fits, never the line:
 * create can give a start exactly its planned line's swaps.
 */
export function planLine(start: SwapGuardState): SwapGuardMove[] | null {
  let state: SwapGuardState = { ...start, maxSwaps: start.swaps + PLAN_HORIZON };
  const simple = simpleLine(state);
  if (simple === null) return null;
  const line: SwapGuardMove[] = [];
  let known = improve(state, simple);
  for (let move = known.at(0); move !== undefined; move = known.at(0)) {
    line.push(move);
    state = applyMove(state, move).state;
    known = improve(state, known.slice(1));
  }
  return line.length <= start.maxSwaps - start.swaps ? line : null;
}
