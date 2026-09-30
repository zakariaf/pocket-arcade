// apps/line-siege/src/rules/placement.ts
// Where the offered blocks fit, in the fixed order bots, solvers and replays rely on:
// tray slot by slot, then row by row, then column by column.
import { coveredCells } from './board-lines.ts';
import { TUNING } from './line-siege-tuning.ts';
import { pieceAt } from './pieces.ts';

import type { LineSiegeMove, LineSiegeState } from './line-siege-types.ts';

const SIZE = TUNING.boardSize;

function movesOfSlot(
  state: LineSiegeState,
  trayIndex: number,
  pieceIndex: number,
): LineSiegeMove[] {
  const piece = pieceAt(pieceIndex);
  const moves: LineSiegeMove[] = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (coveredCells(state.cells, piece, { col, row }) !== null)
        moves.push({ kind: 'place-block', trayIndex, col, row });
    }
  }
  return moves;
}

/** Every placement of every offered block that fits on the board. */
export function fittingMoves(state: LineSiegeState): LineSiegeMove[] {
  return state.tray.flatMap((pieceIndex, trayIndex) =>
    pieceIndex === null ? [] : movesOfSlot(state, trayIndex, pieceIndex),
  );
}

/** True as soon as one offered block fits somewhere (cheaper than listing every move). */
export function hasAnyMove(state: LineSiegeState): boolean {
  return state.tray.some((pieceIndex) => {
    if (pieceIndex === null) return false;
    const piece = pieceAt(pieceIndex);
    for (let index = 0; index < SIZE * SIZE; index += 1) {
      const anchor = { col: index % SIZE, row: Math.floor(index / SIZE) };
      if (coveredCells(state.cells, piece, anchor) !== null) return true;
    }
    return false;
  });
}
