// apps/swap-guard/src/levels/swap-guard-solver.ts
// The exact par of a level: breadth-first over positions, swaps as the cost. The search moves the
// pieces as applyMove does but without its events and score, reading each position's strikes once
// for all its swaps (the strikes come from where everyone stands before the swap). Its line is then
// replayed through the real engine, which gives the final state; the levels contract replays it too.
import { bfsSolve } from '@e07/game-kit/solver/bfs-solve.ts';
import { applyMove } from '@e07/swap-guard/rules/apply-move.ts';
import { listMoves } from '@e07/swap-guard/rules/list-moves.ts';
import { outcome } from '@e07/swap-guard/rules/outcome.ts';
import { planLine } from '@e07/swap-guard/rules/plan-line.ts';
import { strikesOf, struckSquares } from '@e07/swap-guard/rules/strikes.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { SearchProblem } from '@e07/game-kit/solver/search-problem.ts';
import type {
  EnemyKind,
  Facing,
  SwapGuardMove,
  SwapGuardState,
} from '@e07/swap-guard/rules/swap-guard-types.ts';

/** One letter per enemy kind and facing, for the position key. */
const PIECE_LETTERS: Readonly<Record<EnemyKind, Readonly<Record<Facing, string>>>> = {
  spear: { up: 'a', right: 'b', down: 'c', left: 'd' },
  archer: { up: 'e', right: 'f', down: 'g', left: 'h' },
  brute: { up: 'i', right: 'j', down: 'k', left: 'l' },
};

/**
 * The canonical key of a position: a struck guard, the guard's square and what stands on every
 * square (kind and facing). Enemy ids, the swaps made, the score and the continue's memory never
 * change what can happen next (breadth-first search meets each position first with the fewest
 * swaps), so they are left out. A struck guard is kept apart: that run is lost.
 */
export function positionKey(state: SwapGuardState): string {
  const squares = Array.from({ length: state.size * state.size }, () => '.');
  for (const enemy of state.enemies) squares[enemy.cell] = PIECE_LETTERS[enemy.kind][enemy.facing];
  return `${state.isHit ? '!' : ''}${String(state.guard)}:${squares.join('')}`;
}

/** The pieces after the guard swaps to `move.cell`, with the strikes shown before the swap. */
function swapPieces(
  state: SwapGuardState,
  move: SwapGuardMove,
  struck: ReadonlySet<number>,
): SwapGuardState {
  const from = state.guard;
  const enemies = state.enemies
    .map((enemy) => (enemy.cell === move.cell ? { ...enemy, cell: from } : enemy))
    .filter((enemy) => !struck.has(enemy.cell));
  return {
    ...state,
    guard: move.cell,
    enemies,
    swaps: state.swaps + 1,
    isHit: struck.has(move.cell),
  };
}

/**
 * The search problem of a level: won is the goal, lost a dead end. A search expands one position
 * at a time, so its struck squares are read once and kept for its swaps.
 */
export function swapProblem(start: SwapGuardState): SearchProblem<SwapGuardState, SwapGuardMove> {
  let read: { readonly state: SwapGuardState; readonly struck: ReadonlySet<number> } | null = null;
  const struckOf = (state: SwapGuardState): ReadonlySet<number> => {
    if (read?.state !== state) read = { state, struck: struckSquares(strikesOf(state)) };
    return read.struck;
  };
  return {
    start,
    moves: listMoves,
    apply: (state, move) => swapPieces(state, move, struckOf(state)),
    isGoal: (state) => outcome(state).kind === 'won',
    isDeadEnd: (state) => outcome(state).kind === 'lost',
    key: positionKey,
  };
}

/** Exact par for levels and tests: breadth-first, with the final state from the real engine. */
export const SWAP_GUARD_SOLVER: Solver<SwapGuardState, SwapGuardMove> = {
  solve: (start, maxNodes) => {
    const result = bfsSolve(swapProblem(start), maxNodes);
    if (result.kind !== 'solved') return result;
    const final = result.line.reduce((state, move) => applyMove(state, move).state, start);
    return { kind: 'solved', par: result.par, line: result.line, final };
  },
};

/**
 * Positions the hint's fallback search may expand. Measured on every shipped level and 30 dailies
 * (720 random walks, 3,319 positions the plan has no line for): at this budget the worst search took
 * 61 ms in Node and found 163 of the 225 wins a 50,000-node search finds; the rest get no hint.
 */
export const HINT_SEARCH_NODES = 2_000;

/**
 * rules.hints.suggest: the next swap of the planned line from here (a line that wins within the
 * swaps left, so the level stays winnable). Where the plan finds no line, a breadth-first search
 * of at most HINT_SEARCH_NODES positions looks for the first swap of a winning line (deterministic:
 * the same position always gets the same hint). Null when neither finds one or the run is over.
 */
export function suggestSwap(state: SwapGuardState): SwapGuardMove | null {
  const planned = planLine(state);
  if (planned !== null) return planned[0] ?? null;
  const searched = bfsSolve(swapProblem(state), HINT_SEARCH_NODES);
  return searched.kind === 'solved' ? (searched.line[0] ?? null) : null;
}
