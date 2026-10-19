// apps/merge-siege/src/rules/continue-run.ts
// Spec 8.10: "Games may allow one continue per level or run: for example the monsters are pushed
// back one row". Merge Siege's one continue after a loss: every enemy is pushed back
// continuePushBack rows, the top row first; an enemy already in the top row is driven off the
// board, and a tile standing in the way swaps down into the enemy's old cell (no tile is lost). If
// no tile is left, a fresh 2 drops into the middle of the bottom row so the run can go on. Pure,
// like applyMove; once per run (hasContinued), never on a run that is still playing.
import { CELL_COUNT, COLS } from './board-cells.ts';
import { TUNING } from './merge-siege-tuning.ts';
import { outcome } from './outcome.ts';

import type {
  Cell,
  MergeSiegeEvent,
  MergeSiegeResult,
  MergeSiegeState,
  Step,
} from './merge-siege-types.ts';

type PushBack = {
  readonly cells: readonly Cell[];
  readonly steps: readonly Step[];
  readonly drivenOff: readonly number[];
};

/** Every enemy one row up, top row first; the top row's enemies leave; a tile in the way swaps down. */
function pushBackOnce(input: readonly Cell[]): PushBack {
  const cells = [...input];
  const steps: Step[] = [];
  const drivenOff: number[] = [];
  for (let from = 0; from < CELL_COUNT; from += 1) {
    const enemy = cells[from] ?? null;
    if (enemy?.kind !== 'enemy') continue;
    const to = from - COLS;
    const above = cells[to] ?? null;
    cells[from] = above;
    if (to < 0) drivenOff.push(enemy.id);
    else cells[to] = enemy;
    if (to >= 0) steps.push({ id: enemy.id, from, to });
    if (above !== null) steps.push({ id: above.id, from: to, to: from });
  }
  return { cells, steps, drivenOff };
}

/** rules.continueRun.apply: a lost run made playable again, with the events that explain it. */
export function continueAfterLoss(lost: MergeSiegeState): MergeSiegeResult {
  if (lost.hasContinued) throw new RangeError('merge-siege: the run has used its one continue');
  if (outcome(lost).kind !== 'lost')
    throw new RangeError('merge-siege: only a lost run can continue');
  let pushed: PushBack = { cells: lost.cells, steps: [], drivenOff: [] };
  for (let push = 0; push < TUNING.continuePushBack; push += 1) {
    const once = pushBackOnce(pushed.cells);
    pushed = {
      cells: once.cells,
      steps: [...pushed.steps, ...once.steps],
      drivenOff: [...pushed.drivenOff, ...once.drivenOff],
    };
  }
  const events: MergeSiegeEvent[] = [
    { kind: 'enemies-pushed-back', steps: pushed.steps, drivenOff: pushed.drivenOff },
  ];
  const hasTile = pushed.cells.some((cell) => cell?.kind === 'tile');
  const cell = CELL_COUNT - COLS + Math.floor(COLS / 2);
  const cells = [...pushed.cells];
  if (!hasTile) {
    cells[cell] = { id: lost.nextId, kind: 'tile', value: 2 };
    events.push({ kind: 'tile-spawned', id: lost.nextId, cell, value: 2 });
  }
  return {
    state: { ...lost, cells, nextId: lost.nextId + (hasTile ? 0 : 1), hasContinued: true },
    events,
  };
}
