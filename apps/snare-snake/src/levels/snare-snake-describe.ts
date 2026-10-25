// apps/snare-snake/src/levels/snare-snake-describe.ts
// A level start as readable text for the data goldens: the moves and the critters to catch, then
// the board ('H' the head, 's' the body, 'c' a critter, '.' empty), one line per row.
import type { SnareSnakeState } from '@e07/snare-snake/rules/snare-snake-types.ts';

function cellText(state: SnareSnakeState, cell: number): string {
  const segment = state.snake.indexOf(cell);
  if (segment === 0) return 'H';
  if (segment > 0) return 's';
  return state.critters.some((critter) => critter.cell === cell) ? 'c' : '.';
}

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: SnareSnakeState): string {
  const rowText = (row: number): string =>
    Array.from({ length: state.cols }, (_cell, col) =>
      cellText(state, row * state.cols + col),
    ).join('');
  const board = Array.from({ length: state.rows }, (_row, row) => rowText(row));
  const header = `moves ${String(state.maxMoves)} critters ${String(state.total)} board ${String(state.cols)}x${String(state.rows)}`;
  return [header, ...board].join('\n');
}
