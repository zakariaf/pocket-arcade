// apps/trail-clear/src/rules/continue-run.ts
// Spec 8.10: the one continue after a loss ("the oldest row of tiles is cleared"). The board row
// holding the earliest-placed tile is emptied (no score, no loop); while the offered tile still fits
// nowhere, the next oldest row goes too (an empty board takes every tile, so this always ends).
// Pure, like applyMove; a second continue in the same run is refused.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { outcome } from './outcome.ts';
import { hasRoomFor } from './placement.ts';
import { TUNING } from './trail-clear-tuning.ts';

import type { PlacedTile, TrailClearResult, TrailClearState } from './trail-clear-types.ts';

const SIZE = TUNING.boardSize;
type Cells = readonly (PlacedTile | null)[];

/** The rows that hold tiles, oldest first: by their earliest placedAt, then top to bottom. */
export function rowsByAge(cells: Cells): number[] {
  const oldest = Array.from({ length: SIZE }, (_, row) =>
    cells
      .slice(row * SIZE, (row + 1) * SIZE)
      .reduce((min, tile) => (tile === null ? min : Math.min(min, tile.placedAt)), Infinity),
  );
  const rows = oldest.map((_, row) => row).filter((row) => pickAt(oldest, row) !== Infinity);
  // Array.prototype.sort is stable: on a tie the upper row (listed first) stays first.
  return rows.sort((a, b) => pickAt(oldest, a) - pickAt(oldest, b));
}

/** rules.continueRun.apply: a lost run made playable again, with the event that explains it. */
export function continueAfterLoss(lost: TrailClearState): TrailClearResult {
  if (lost.hasContinued || lost.offered === null || outcome(lost).kind !== 'lost') {
    throw new RangeError('a continue needs a lost run that has not continued yet');
  }
  const offered = lost.offered;
  const rows: number[] = [];
  let cells: Cells = lost.cells;
  for (const row of rowsByAge(lost.cells)) {
    if (hasRoomFor(cells, offered)) break;
    rows.push(row);
    cells = cells.map((tile, index) => (Math.floor(index / SIZE) === row ? null : tile));
  }
  const cleared = lost.cells.flatMap((tile, index) =>
    tile !== null && rows.includes(Math.floor(index / SIZE)) ? [index] : [],
  );
  return {
    state: { ...lost, cells, hasContinued: true },
    events: [{ kind: 'rows-cleared', rows: [...rows].sort((a, b) => a - b), cells: cleared }],
  };
}
