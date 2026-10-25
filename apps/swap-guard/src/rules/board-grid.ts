// apps/swap-guard/src/rules/board-grid.ts
// Square geometry of the board: row-major indexes, physical directions (never mirrored).
import type { Facing } from './swap-guard-types.ts';

/** Every facing, in the fixed order the generator draws from. */
export const FACINGS: readonly Facing[] = ['up', 'right', 'down', 'left'];

const STEPS: Readonly<Record<Facing, { readonly row: number; readonly col: number }>> = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
};

const OPPOSITES: Readonly<Record<Facing, Facing>> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

/** The facing that points the other way. */
export function oppositeOf(facing: Facing): Facing {
  return OPPOSITES[facing];
}

/** The square one step from `cell` in `facing`, or null past the edge. */
export function stepFrom(size: number, cell: number, facing: Facing): number | null {
  const row = Math.floor(cell / size) + STEPS[facing].row;
  const col = (cell % size) + STEPS[facing].col;
  return row >= 0 && row < size && col >= 0 && col < size ? row * size + col : null;
}

/** The up to eight squares around `cell` (diagonals included), in board order. */
export function squaresAround(size: number, cell: number): number[] {
  const row = Math.floor(cell / size);
  const col = cell % size;
  const out: number[] = [];
  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = col - 1; c <= col + 1; c += 1) {
      const isSelf = r === row && c === col;
      if (!isSelf && r >= 0 && r < size && c >= 0 && c < size) out.push(r * size + c);
    }
  }
  return out;
}
