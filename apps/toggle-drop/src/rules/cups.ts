// apps/toggle-drop/src/rules/cups.ts
import type { ToggleDropState } from './toggle-drop-types.ts';

type Cups = Pick<ToggleDropState, 'needs' | 'filled'>;

/** Columns that hold a cup (a need above 0), left to right. */
export function cupColumns(state: Cups): number[] {
  return state.needs.flatMap((need, col) => (need > 0 ? [col] : []));
}

/** Cups that hold every ball they need. */
export function fullCupCount(state: Cups): number {
  return cupColumns(state).filter((col) => state.filled[col] === state.needs[col]).length;
}

/** True when every cup holds every ball it needs: the board is won. */
export function areCupsFull(state: Cups): boolean {
  return state.needs.every((need, col) => state.filled[col] === need);
}
