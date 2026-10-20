// apps/jump-chain/src/board/to-view.ts
import { TUNING } from '@e07/jump-chain/rules/jump-chain-tuning.ts';
import { WAITING_ROW } from '@e07/jump-chain/rules/march.ts';
import { movesByEnd } from '@e07/jump-chain/rules/move-ends.ts';

import type { JumpChainState, Square } from '@e07/jump-chain/rules/jump-chain-types.ts';
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

export type EnemyView = { readonly id: number; readonly col: number; readonly row: number };

/** A square some move ends on: where a drag may drop the piece, or a tap may send it. */
export type TargetView = {
  readonly col: number;
  readonly row: number;
  /** The landing squares of the move a finger here plays, this square last (a step: just it). */
  readonly path: readonly Square[];
  /** The squares of the enemies that move captures, in order (a step: none). */
  readonly captured: readonly Square[];
};

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type JumpChainView = {
  readonly cols: number;
  readonly rows: number;
  readonly piece: Square;
  /** Enemies on the board and the rank waiting just above it (row -1), in id order. */
  readonly enemies: readonly EnemyView[];
  /** Every enemy still to capture, the ranks waiting further up included (the spoken summary). */
  readonly enemiesLeft: number;
  /** Moves until the ranks advance. */
  readonly marchIn: number;
  /** The same, digits already localised (drawn in the corner of the waiting row). */
  readonly marchInText: string;
  /** One per end square; empty once the run is over. */
  readonly targets: readonly TargetView[];
};

/** The squares a chain jumps over: each lies halfway between two landing squares. */
function capturedAlong(from: Square, path: readonly Square[]): Square[] {
  let at = from;
  return path.map((to) => {
    const over = { col: (at.col + to.col) / 2, row: (at.row + to.row) / 2 };
    at = to;
    return over;
  });
}

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: JumpChainState, format: ViewFormat): JumpChainView {
  return {
    cols: TUNING.cols,
    rows: TUNING.rows,
    piece: state.piece,
    enemies: state.enemies
      .filter((enemy) => enemy.row >= WAITING_ROW)
      .map((enemy) => ({ id: enemy.id, col: enemy.col, row: enemy.row })),
    enemiesLeft: state.enemies.length,
    marchIn: state.marchIn,
    marchInText: format.formatNumber(state.marchIn),
    targets: movesByEnd(state).map(({ square, move }) =>
      move.kind === 'step'
        ? { col: square.col, row: square.row, path: [move.to], captured: [] }
        : {
            col: square.col,
            row: square.row,
            path: move.path,
            captured: capturedAlong(state.piece, move.path),
          },
    ),
  };
}
