// apps/poker-drop/src/rules/continue-run.ts
// Spec 8.10: the one continue after a loss. The top `continueRows` rows of the well are emptied
// (every column gets room again) and the run goes on with the same card in hand. A run continues
// once: a second continue, or a continue of a run that is not lost, is refused with a RangeError.
import { outcome } from './outcome.ts';
import { TUNING } from './poker-drop-tuning.ts';
import { ROWS, cardIn, cellIndex, isCard } from './well.ts';

import type { PokerDropResult, PokerDropState } from './poker-drop-types.ts';

/** The cells of the top `rows` rows, bottom-up and left to right. */
export function topCells(rows: number): number[] {
  const cells: number[] = [];
  for (let row = ROWS - rows; row < ROWS; row += 1) {
    for (let col = 0; col < TUNING.wellCols; col += 1) cells.push(cellIndex(col, row));
  }
  return cells;
}

/** rules.continueRun.apply: a lost run made playable again, with the event that explains it. */
export function continueAfterLoss(lost: PokerDropState): PokerDropResult {
  if (lost.hasContinued || outcome(lost).kind !== 'lost') {
    throw new RangeError('a run continues once, and only after a loss');
  }
  const cleared = topCells(TUNING.continueRows).filter((index) => isCard(lost.cells[index]));
  const cards = cleared.map((index) => cardIn(lost.cells, index));
  const cells = lost.cells.map((card, index) => (cleared.includes(index) ? null : card));
  return {
    state: { ...lost, cells, hasOverflowed: false, hasContinued: true },
    events: [{ kind: 'top-row-cleared', cells: cleared, cards, atMs: 0 }],
  };
}
