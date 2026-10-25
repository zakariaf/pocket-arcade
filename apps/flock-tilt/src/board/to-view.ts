// apps/flock-tilt/src/board/to-view.ts
import { pennedCount as countPenned } from '@e07/flock-tilt/rules/tilt-field.ts';

import type { Field, FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

/**
 * Flat and serialisable: it is copied into the scene shared value once per move. The field as the
 * rules keep it (penned sheep are drawn only while they slide into the pen), plus the pen's count.
 */
export type FlockTiltView = Field & {
  /** Sheep in the pen, digits already localised (drawn on the pen). */
  readonly pennedText: string;
  readonly pennedCount: number;
};

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: FlockTiltState, format: ViewFormat): FlockTiltView {
  const pennedCount = countPenned(state.sheep);
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
