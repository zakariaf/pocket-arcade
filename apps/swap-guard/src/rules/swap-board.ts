// apps/swap-guard/src/rules/swap-board.ts
// The move of the pieces in one swap, shared by applyMove and the searches (the planner, the par
// solver and the hint), which try every swap of a position and need no events, score or memory.
import type { Enemy, SwapGuardState } from './swap-guard-types.ts';

/** The enemies after the guard swaps to `cell`: the one there takes the guard's old square. */
export function swappedEnemies(state: SwapGuardState, cell: number): Enemy[] {
  const from = state.guard;
  return state.enemies.map((enemy) => (enemy.cell === cell ? { ...enemy, cell: from } : enemy));
}

/**
 * Pure: the board after the guard swaps to `cell` and the strikes on `struck` (read before the
 * swap) land: the swap counted, every struck enemy gone, the guard hit on a struck square. The
 * score and the last swap stay as they were; applyMove adds them.
 */
export function swapBoard(
  state: SwapGuardState,
  cell: number,
  struck: ReadonlySet<number>,
): SwapGuardState {
  return {
    ...state,
    guard: cell,
    enemies: swappedEnemies(state, cell).filter((enemy) => !struck.has(enemy.cell)),
    swaps: state.swaps + 1,
    isHit: struck.has(cell),
  };
}
