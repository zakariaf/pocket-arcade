// apps/tap-flip/src/board/to-view.ts
import type { TapFlipState } from '@e07/tap-flip/rules/tap-flip-types.ts';
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type TapFlipView = {
  readonly cols: number;
  readonly rows: number;
  /** Row-major, 0 = dark, 1 = lit. */
  readonly cells: readonly number[];
  /** Moves left, digits already localised (the continue's bonus label shows it). */
  readonly movesLeftText: string;
};

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: TapFlipState, format: ViewFormat): TapFlipView {
  return {
    cols: state.cols,
    rows: state.rows,
    cells: state.cells,
    movesLeftText: format.formatNumber(Math.max(0, state.maxMoves - state.moves)),
  };
}
