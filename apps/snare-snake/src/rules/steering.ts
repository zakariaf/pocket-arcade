// apps/snare-snake/src/rules/steering.ts
// Where the head may go (design notes, rule 3): one cell up, right, down or left, never off the
// board, back onto the neck or onto a critter. Moving onto any other segment closes a loop.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { DIRECTIONS, stepFrom } from './board-grid.ts';

import type { Direction, SnareSnakeState } from './snare-snake-types.ts';

/** The cell the head would enter steering `direction`, or null when that move is not allowed. */
export function targetOf(state: SnareSnakeState, direction: Direction): number | null {
  const target = stepFrom(state, pickAt(state.snake, 0), direction);
  if (target === null || target === state.snake[1]) return null;
  return state.critters.some((critter) => critter.cell === target) ? null : target;
}

/** The directions the head may take now, in the fixed order up, right, down, left. */
export function openDirections(state: SnareSnakeState): Direction[] {
  return DIRECTIONS.filter((direction) => targetOf(state, direction) !== null);
}
