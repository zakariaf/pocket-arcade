// apps/merge-siege/src/board/to-view.ts
import { COLS, ROWS } from '@e07/merge-siege/rules/board-cells.ts';

import { ENEMY_KIND, TILE_KIND } from './board-ids.ts';

import type { MergeSiegeState, NextEnemy } from '@e07/merge-siege/rules/merge-siege-types.ts';
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

/** One piece on the board: kind TILE_KIND or ENEMY_KIND (numbers, so tracks can carry it). */
export type PieceView = {
  readonly id: number;
  readonly kind: number;
  readonly value: number;
  readonly col: number;
  readonly row: number;
};

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type MergeSiegeView = {
  readonly cols: number;
  readonly rows: number;
  /** Every piece of the final state, in reading order. */
  readonly pieces: readonly PieceView[];
  /** The enemy waiting in the gate above the board, or null once the wave has entered. */
  readonly next: NextEnemy | null;
  /** 2^0 … 2^MAX_POWER in the chosen digits (spec 7.3); digitsOf reads it. */
  readonly digits: readonly string[];
};

/** The largest power of two a piece's number can show (a 1,048,576 tile is out of reach). */
const MAX_POWER = 20;

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: MergeSiegeState, format: ViewFormat): MergeSiegeView {
  const pieces = state.cells.flatMap((cell, index) =>
    cell === null
      ? []
      : [
          {
            id: cell.id,
            kind: cell.kind === 'tile' ? TILE_KIND : ENEMY_KIND,
            value: cell.value,
            col: index % COLS,
            row: Math.floor(index / COLS),
          },
        ],
  );
  const powers = Array.from({ length: MAX_POWER + 1 }, (_, power) => 2 ** power);
  return {
    cols: COLS,
    rows: ROWS,
    pieces,
    next: state.next,
    digits: powers.map((value) => format.formatNumber(value)),
  };
}
