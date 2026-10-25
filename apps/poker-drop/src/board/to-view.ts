// apps/poker-drop/src/board/to-view.ts
import { isRiseDue } from '@e07/poker-drop/rules/apply-move.ts';
import { TUNING } from '@e07/poker-drop/rules/poker-drop-tuning.ts';

import { EMPTY_CELL } from './board-ids.ts';

import type { PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

/** The cascade badge labels steps up to this one; a longer cascade shows this label. */
export const MAX_STEP_LABEL = 9;

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type PokerDropView = {
  readonly cols: number;
  readonly rows: number;
  /** Row-major with row 0 at the bottom, as in the rules: a card 0..51, or EMPTY_CELL. */
  readonly cells: readonly number[];
  /** The card the next tap drops. */
  readonly hand: number;
  /** The card after it. */
  readonly next: number;
  /** Drops left before the next rising row (the spoken summary counts them). */
  readonly riseDrops: number;
  /** The same count with its digits localised, drawn beside the rising-row arrow. */
  readonly riseText: string;
  /** The cascade badge of each step ('×۲' with Persian digits), by step; 0 and 1 are never drawn. */
  readonly stepTexts: readonly string[];
};

/** Drops from now until the drop after which the rules raise the next row (1 = the next drop). */
export function dropsBeforeRise(difficulty: number, drops: number): number {
  let ahead = 1;
  while (!isRiseDue(difficulty, drops + ahead)) ahead += 1;
  return ahead;
}

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: PokerDropState, format: ViewFormat): PokerDropView {
  const riseDrops = dropsBeforeRise(state.difficulty, state.drops);
  return {
    cols: TUNING.wellCols,
    rows: TUNING.wellRows,
    cells: state.cells.map((cell) => cell ?? EMPTY_CELL),
    hand: state.hand,
    next: state.next,
    riseDrops,
    riseText: format.formatNumber(riseDrops),
    stepTexts: Array.from(
      { length: MAX_STEP_LABEL + 1 },
      (_, step) => `×${format.formatNumber(step)}`,
    ),
  };
}
