// apps/stepstone/src/rules/hop-distance.ts
// Stepstone's one shortest-route search: create's par, the save check, the par solver and the hint
// all ask it. It runs the game kit's breadth-first search over stones, so it is the same search
// the solver ran on full engine states, without a move applied per stone.
import { bfsSolve } from '@e07/game-kit/solver/bfs-solve.ts';

import { targetsOf } from './hops.ts';

import type { StepstoneState } from './stepstone-types.ts';
import type { SolveResult } from '@e07/game-kit/contract/levels.ts';
import type { SearchProblem } from '@e07/game-kit/solver/search-problem.ts';

type Pond = Pick<StepstoneState, 'side' | 'cells' | 'frog'>;

/**
 * The pond as a search over stones: a state is the frog's stone, a move the stone it hops to. A
 * shortest route never visits a stone twice, so the stones that sink behind the frog on the way
 * are stones the search has already seen: it reads the pond as it is and keys a state by its stone.
 */
function routeProblem(pond: Pond): SearchProblem<number, number> {
  return {
    start: pond.frog,
    moves: (frog) => targetsOf({ ...pond, frog }),
    apply: (_from, to) => to,
    isGoal: (frog) => pond.cells[frog] === 'flag',
    isDeadEnd: () => false,
    key: (frog) => String(frog),
  };
}

/**
 * The first shortest route breadth-first finds (moves in cell order): its line is the stones the
 * frog hops to, its par their count. Unsolvable when no route is left, budget-exceeded past
 * `maxNodes` stones expanded.
 */
export function hopRoute(pond: Pond, maxNodes: number): SolveResult<number, number> {
  return bfsSolve(routeProblem(pond), maxNodes);
}

/** The fewest hops from the frog to the flag, or null when no route is left. */
export function hopDistance(pond: Pond): number | null {
  // A search expands each stone at most once, so a budget of one per cell never runs out.
  const route = hopRoute(pond, pond.cells.length);
  return route.kind === 'solved' ? route.par : null;
}
