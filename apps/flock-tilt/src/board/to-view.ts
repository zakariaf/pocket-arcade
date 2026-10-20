// apps/flock-tilt/src/board/to-view.ts
import type { FlockTiltState, SheepStatus } from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

/** One sheep as the board draws it: penned ones are drawn only while they slide into the pen. */
export type SheepView = {
  readonly id: number;
  readonly cell: number;
  readonly status: SheepStatus;
};

/** One wolf as the board draws it. */
export type WolfView = { readonly id: number; readonly cell: number };

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type FlockTiltView = {
  readonly cols: number;
  readonly rows: number;
  readonly rocks: readonly number[];
  readonly pen: number;
  readonly sheep: readonly SheepView[];
  readonly wolves: readonly WolfView[];
  /** Sheep in the pen, digits already localised (drawn on the pen). */
  readonly pennedText: string;
  readonly pennedCount: number;
};

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: FlockTiltState, format: ViewFormat): FlockTiltView {
  const pennedCount = state.sheep.filter((sheep) => sheep.status === 'penned').length;
  return {
    cols: state.cols,
    rows: state.rows,
    rocks: state.rocks,
    pen: state.pen,
    sheep: state.sheep,
    wolves: state.wolves,
    pennedText: format.formatNumber(pennedCount),
    pennedCount,
  };
}
