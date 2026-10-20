// apps/toggle-drop/src/board/to-view.ts
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';
import type { ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type ToggleDropView = {
  readonly cols: number;
  readonly rows: number;
  /** Row-major peg rows: -1 no switch, 0 a switch pointing left, 1 pointing right. */
  readonly pegs: readonly number[];
  /** Per column: the balls its cup needs (0 = the gutter). */
  readonly needs: readonly number[];
  /** Per column: the balls its cup holds. */
  readonly filled: readonly number[];
  /** Per column: the balls its cup still needs, digits localised ('' for the gutter and full cups). */
  readonly needTexts: readonly string[];
  /**
   * Per column: the balls its cup needed before its last ball, digits localised. The view is the
   * final state, so while the move's ball still falls toward a cup, that cup shows this instead.
   */
  readonly pendingTexts: readonly string[];
  /** The balls still to drop, shown in the rack above the columns. */
  readonly ballsLeft: number;
};

/** The balls a cup still needs, localised, or '' when there is nothing to say. */
function needText(left: number, format: ViewFormat): string {
  return left > 0 ? format.formatNumber(left) : '';
}

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: ToggleDropState, format: ViewFormat): ToggleDropView {
  const left = state.needs.map((need, col) => need - (state.filled[col] ?? 0));
  return {
    cols: state.cols,
    rows: state.rows,
    pegs: state.pegs,
    needs: state.needs,
    filled: state.filled,
    needTexts: left.map((count) => needText(count, format)),
    pendingTexts: left.map((count, col) =>
      (state.filled[col] ?? 0) > 0 ? needText(count + 1, format) : '',
    ),
    ballsLeft: state.ballsLeft,
  };
}
