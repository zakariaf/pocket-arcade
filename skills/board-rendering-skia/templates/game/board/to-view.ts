// apps/__GAME_ID__/src/board/to-view.ts
import type { __GAME_PASCAL__State } from '@e07/__GAME_ID__/rules/__GAME_ID__-types.ts';
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type __GAME_PASCAL__View = {
  readonly cols: number;
  readonly rows: number;
  /** Row-major, 0 = dark, 1 = lit. */
  readonly cells: readonly number[];
  /** Moves left, digits already localised (the continue's bonus label shows it). */
  readonly movesLeftText: string;
};

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: __GAME_PASCAL__State, format: ViewFormat): __GAME_PASCAL__View {
  return {
    cols: state.cols,
    rows: state.rows,
    cells: state.cells,
    movesLeftText: format.formatNumber(Math.max(0, state.maxMoves - state.moves)),
  };
}
