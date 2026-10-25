// apps/scrap-shove/src/levels/scrap-shove-solver.ts
import { solveFloor } from '@e07/scrap-shove/rules/solve-floor.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { ScrapShoveMove, ScrapShoveState } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

/**
 * Exact par for the level table, the levels contract and the tests: breadth-first search over the
 * real rules (rules/solve-floor.ts), so the line it returns is a shortest win and `final` the
 * cleared floor it reaches.
 */
export const SCRAP_SHOVE_SOLVER: Solver<ScrapShoveState, ScrapShoveMove> = { solve: solveFloor };
