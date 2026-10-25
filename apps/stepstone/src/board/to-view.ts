// apps/stepstone/src/board/to-view.ts
import { targetsOf } from '@e07/stepstone/rules/hops.ts';

import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';
import type { Cell, StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

/** Cell codes the draw worklet compares: water, sunk, flag, then the four hop kinds. */
export const CELL_CODE = {
  water: 0,
  sunk: 1,
  flag: 2,
  king: 3,
  rook: 4,
  bishop: 5,
  knight: 6,
} as const satisfies Readonly<Record<Cell, number>>;

/** The hop kind each cell code gives the frog standing on it ('none' off a stone of a kind). */
export const KIND_OF_CODE = ['none', 'none', 'none', 'king', 'rook', 'bishop', 'knight'] as const;

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type StepstoneView = {
  readonly side: number;
  /** Row-major cell codes (CELL_CODE). */
  readonly cells: readonly number[];
  readonly frog: number;
  /** The live stones the frog's hop reaches: each gets a ring. */
  readonly reach: readonly number[];
  /** Hops made, digits already localised (shown on the flag when the frog lands). */
  readonly movesText: string;
};

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: StepstoneState, format: ViewFormat): StepstoneView {
  return {
    side: state.side,
    cells: state.cells.map((cell) => CELL_CODE[cell]),
    frog: state.frog,
    reach: targetsOf(state),
    movesText: format.formatNumber(state.moves),
  };
}
