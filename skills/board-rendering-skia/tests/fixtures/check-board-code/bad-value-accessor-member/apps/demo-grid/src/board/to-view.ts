// apps/demo-grid/src/board/to-view.ts
import type { DemoGridState } from '@e07/demo-grid/rules/demo-grid-types.ts';
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

/** One piece as draw() needs it: position plus its label, digits already localised. */
export type PieceView = {
  readonly id: number;
  readonly col: number;
  readonly row: number;
  readonly label: string;
};

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type DemoGridView = {
  readonly cols: number;
  readonly rows: number;
  /** Row-major cell kinds, 0 = empty. */
  readonly cells: readonly number[];
  readonly pieces: readonly PieceView[];
};

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: DemoGridState, format: ViewFormat): DemoGridView {
  return {
    cols: state.cols,
    rows: state.rows,
    cells: state.cells,
    pieces: state.pieces.map((piece) => ({
      id: piece.id,
      col: piece.col,
      row: piece.row,
      label: format.formatNumber(piece.value),
    })),
  };
}
