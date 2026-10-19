// apps/toggle-drop/src/levels/toggle-drop-solver.ts
import { bfsSolve } from '@e07/game-kit/solver/bfs-solve.ts';
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { areCupsFull } from '@e07/toggle-drop/rules/cups.ts';
import { dropPath, flipPath } from '@e07/toggle-drop/rules/drop-path.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { SearchProblem } from '@e07/game-kit/solver/search-problem.ts';
import type {
  PegCell,
  ToggleDropMove,
  ToggleDropState,
} from '@e07/toggle-drop/rules/toggle-drop-types.ts';

/** A search node: what decides the rest of a run (the switches, the cups' balls, the balls left). */
type Drops = {
  readonly pegs: readonly PegCell[];
  readonly filled: readonly number[];
  readonly ballsLeft: number;
};

/**
 * The board as a graph for breadth-first search: a node changes only by the switches a ball flips
 * and the cup it fills (the discrete drop path, the same fall applyMove simulates), so its key is
 * the switches and the cups; breadth-first, the shortest line is met first and its length is par.
 */
export function dropProblem(start: ToggleDropState): SearchProblem<Drops, ToggleDropMove> {
  const { cols, rows, needs } = start;
  const isWon = (node: Drops): boolean => areCupsFull({ needs, filled: node.filled });
  return {
    start: { pegs: start.pegs, filled: start.filled, ballsLeft: start.ballsLeft },
    moves: (node) =>
      node.ballsLeft > 0 && !isWon(node)
        ? Array.from({ length: cols }, (_, col): ToggleDropMove => ({ kind: 'drop', col }))
        : [],
    apply: (node, move) => {
      const board = { cols, rows, pegs: node.pegs };
      const path = dropPath(board, move.col);
      const filled = node.filled.map((count, col) =>
        col === path.landing && count < (needs[col] ?? 0) ? count + 1 : count,
      );
      return { pegs: flipPath(board, path), filled, ballsLeft: node.ballsLeft - 1 };
    },
    isGoal: isWon,
    isDeadEnd: (node) => node.ballsLeft <= 0 && !isWon(node),
    key: (node) => `${node.pegs.join(',')}/${node.filled.join(',')}`,
  };
}

/**
 * Exact par for levels, tests and hints: breadth-first over drops. `final` is the state the line
 * ends in, replayed through applyMove (the real rules), as levelsContractProblems checks.
 */
export const TOGGLE_DROP_SOLVER: Solver<ToggleDropState, ToggleDropMove> = {
  solve: (start, maxNodes) => {
    const result = bfsSolve(dropProblem(start), maxNodes);
    if (result.kind !== 'solved') return result;
    const final = result.line.reduce((state, move) => applyMove(state, move).state, start);
    return { kind: 'solved', par: result.par, line: result.line, final };
  },
};

/** Budget for a hint on the phone: the boards solve far below it. */
export const HINT_MAX_NODES = 60_000;

/** rules.hints.suggest: the first drop of a shortest line, or null when there is none to find. */
export function suggestDrop(state: ToggleDropState): ToggleDropMove | null {
  const result = TOGGLE_DROP_SOLVER.solve(state, HINT_MAX_NODES);
  return result.kind === 'solved' ? (result.line[0] ?? null) : null;
}
