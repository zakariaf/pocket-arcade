// apps/scrap-shove/src/board/to-view.ts
import { signOf } from '@e07/scrap-shove/rules/floor-squares.ts';
import { robotsScrapped } from '@e07/scrap-shove/rules/outcome.ts';

import type { RobotKindName } from './board-ids.ts';
import type { ScrapShoveState } from '@e07/scrap-shove/rules/scrap-shove-types.ts';
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

export type CellView = { readonly col: number; readonly row: number };

export type RobotView = {
  readonly id: number;
  readonly kind: RobotKindName;
  readonly col: number;
  readonly row: number;
  /** The robot's next step (-1, 0 or 1 per axis): the arrow the player reads; 0, 0 on the player. */
  readonly stepCol: number;
  readonly stepRow: number;
};

export type HeapView = { readonly id: number; readonly col: number; readonly row: number };

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type ScrapShoveView = {
  readonly cols: number;
  readonly rows: number;
  readonly player: CellView;
  readonly robots: readonly RobotView[];
  readonly heaps: readonly HeapView[];
  readonly isCaught: boolean;
  /** Robots scrapped and on the floor at the start, for the spoken summary. */
  readonly scrapped: number;
  readonly total: number;
  /** Crash sizes in the chosen digits (index = robots in one crash), for the crash badge. */
  readonly countTexts: readonly string[];
};

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: ScrapShoveState, format: ViewFormat): ScrapShoveView {
  const { player } = state;
  return {
    cols: state.cols,
    rows: state.rows,
    player: { col: player.col, row: player.row },
    robots: state.robots.map((robot) => ({
      id: robot.id,
      kind: robot.kind,
      col: robot.col,
      row: robot.row,
      stepCol: signOf(player.col - robot.col),
      stepRow: signOf(player.row - robot.row),
    })),
    heaps: state.heaps.map((heap) => ({ id: heap.id, col: heap.col, row: heap.row })),
    isCaught: state.caughtBy !== null,
    scrapped: robotsScrapped(state),
    total: state.robotsTotal,
    countTexts: Array.from({ length: state.robotsTotal + 1 }, (_, count) =>
      format.formatNumber(count),
    ),
  };
}
