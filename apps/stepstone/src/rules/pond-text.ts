// apps/stepstone/src/rules/pond-text.ts
import { MOVE_KINDS } from './hops.ts';

import type { Cell, MoveKind, StepstoneState } from './stepstone-types.ts';

/** One letter per cell: K king, R rook, B bishop, N knight, F flag, . water, ~ sunk. */
const LETTERS: Readonly<Record<Cell, string>> = {
  king: 'K',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
  flag: 'F',
  water: '.',
  sunk: '~',
};

const CELLS: Readonly<Record<string, Cell>> = {
  K: 'king',
  R: 'rook',
  B: 'bishop',
  N: 'knight',
  F: 'flag',
  '.': 'water',
  '~': 'sunk',
};

/**
 * Readable pond text for goldens and tests: one line per row, the frog's stone in lower case
 * ("r" = the frog on a rook stone).
 */
export function pondText(state: Pick<StepstoneState, 'side' | 'cells' | 'frog'>): string {
  const letters = state.cells.map((cell, index) =>
    index === state.frog ? LETTERS[cell].toLowerCase() : LETTERS[cell],
  );
  const rows: string[] = [];
  for (let start = 0; start < letters.length; start += state.side) {
    rows.push(letters.slice(start, start + state.side).join(''));
  }
  return rows.join('\n');
}

/** The pond a text draws (pondText's inverse); throws on an unknown letter or a ragged grid. */
export function pondFromText(text: string): Pick<StepstoneState, 'side' | 'cells' | 'frog'> {
  const rows = text
    .trim()
    .split('\n')
    .map((row) => row.trim());
  const side = rows.length;
  const letters = rows.join('').split('');
  if (rows.some((row) => row.length !== side))
    throw new RangeError(`pond text is not ${String(side)} x ${String(side)}`);
  const frog = letters.findIndex((letter) => letter !== letter.toUpperCase());
  const cells = letters.map((letter) => {
    const cell = CELLS[letter.toUpperCase()];
    if (cell === undefined) throw new RangeError(`unknown pond letter "${letter}"`);
    return cell;
  });
  return { side, cells, frog };
}

/** The distinct hop kinds a pond's stones carry, in MoveKind order. */
export function kindsIn(cells: readonly Cell[]): MoveKind[] {
  return MOVE_KINDS.filter((kind) => cells.includes(kind));
}
