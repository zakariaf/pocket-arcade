// apps/line-siege/src/rules/continue-run.ts
// Spec 8.10: the one continue after a loss, rescuing both ways of losing. The last heart comes
// back (hearts = max(hearts, 1)), every monster is pushed back continuePushBack rows (never past
// row 0), and after a board-full loss the continueEmptyRows fullest rows are emptied (no score, no
// beams, no shockwave). Then the tray is redrawn; if no drawn block fits, its first slot holds the
// single block, which always fits. Pure, like applyMove; the Shell allows one per run.
import { TUNING } from './line-siege-tuning.ts';
import { SINGLE_BLOCK, drawTray } from './pieces.ts';
import { hasAnyMove } from './placement.ts';

import type { Cell, LineSiegeEvent, LineSiegeResult, LineSiegeState } from './line-siege-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

const SIZE = TUNING.boardSize;

/** The `count` fullest rows (the lower row first on a tie), in board order. */
export function fullestRows(cells: readonly Cell[], count: number): number[] {
  const filled = (row: number): number =>
    cells.slice(row * SIZE, (row + 1) * SIZE).filter((cell) => cell === 1).length;
  const rows = Array.from({ length: SIZE }, (_, row) => row);
  const ranked = [...rows].sort((a, b) => {
    const byFill = filled(b) - filled(a);
    return byFill === 0 ? a - b : byFill;
  });
  return ranked.slice(0, count).sort((a, b) => a - b);
}

function emptyRows(cells: readonly Cell[], rows: readonly number[]): Cell[] {
  return cells.map((cell, index) => (rows.includes(Math.floor(index / SIZE)) ? 0 : cell));
}

/** The redrawn tray, with the single block in slot 0 when none of the drawn blocks fits. */
function redraw(state: LineSiegeState): { readonly tray: number[]; readonly rng: RngState } {
  const drawn = drawTray(state.rng);
  if (hasAnyMove({ ...state, tray: drawn.tray })) return drawn;
  return { tray: [SINGLE_BLOCK, ...drawn.tray.slice(1)], rng: drawn.rng };
}

/** rules.continueRun.apply: a lost run made playable again, with the events that explain it. */
export function continueAfterLoss(lost: LineSiegeState): LineSiegeResult {
  const events: LineSiegeEvent[] = [];
  const hearts = Math.max(lost.hearts, 1);
  if (hearts !== lost.hearts) events.push({ kind: 'heart-restored', hearts });
  const monsters = lost.monsters.map((monster) => ({
    ...monster,
    row: Math.max(monster.row - TUNING.continuePushBack, 0),
  }));
  events.push({ kind: 'monsters-pushed-back', rows: TUNING.continuePushBack });
  const emptied = hasAnyMove(lost) ? [] : fullestRows(lost.cells, TUNING.continueEmptyRows);
  if (emptied.length > 0) events.push({ kind: 'rows-emptied', rows: emptied });
  const cleared = { ...lost, hearts, monsters, cells: emptyRows(lost.cells, emptied) };
  const drawn = redraw(cleared);
  events.push({ kind: 'tray-refilled', tray: drawn.tray });
  return { state: { ...cleared, tray: drawn.tray, rng: drawn.rng }, events };
}
