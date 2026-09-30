// apps/line-siege/src/board/to-view.ts
import { TUNING } from '@e07/line-siege/rules/line-siege-tuning.ts';
import { pieceAt } from '@e07/line-siege/rules/pieces.ts';

import type { MonsterKindName } from './board-ids.ts';
import type { LineSiegeState } from '@e07/line-siege/rules/line-siege-types.ts';
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

export type MonsterView = {
  readonly id: number;
  readonly kind: MonsterKindName;
  readonly lane: number;
  readonly row: number;
  /** Health, digits already localised. */
  readonly hpText: string;
};

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type LineSiegeView = {
  /** Board cells per side; every column is a lane. */
  readonly size: number;
  /** Lane rows above the board; a monster reaching row laneRows breaks the wall. */
  readonly laneRows: number;
  /** Row-major, 0 = empty, 1 = block. */
  readonly cells: readonly number[];
  readonly monsters: readonly MonsterView[];
  /** Per tray slot the offered block as flat [dx, dy, dx, dy, ...]; [] once placed. */
  readonly tray: readonly (readonly number[])[];
  readonly hearts: number;
  /** Heart slots on the wall (a lost heart stays as an empty outline). */
  readonly maxHearts: number;
};

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: LineSiegeState, format: ViewFormat): LineSiegeView {
  return {
    size: TUNING.boardSize,
    laneRows: TUNING.laneRows,
    cells: state.cells,
    monsters: state.monsters.map((monster) => ({
      id: monster.id,
      kind: monster.kind,
      lane: monster.lane,
      row: monster.row,
      hpText: format.formatNumber(monster.hp),
    })),
    tray: state.tray.map((piece) => (piece === null ? [] : pieceAt(piece).flat())),
    hearts: state.hearts,
    maxHearts: TUNING.hearts,
  };
}
