// apps/jump-chain/src/rules/continue-run.ts
// Spec 8.10: the one continue after a loss. The enemy ranks step back one row (continueRows, two
// squares straight up, the way they came, so they stay on the dark squares), the top first; an
// enemy whose square is taken moves further up to the next free one. The march clock restarts.
// Pure, like applyMove; a second continue in the same run, or a continue of a run that was not
// lost, throws.
import { enemyAt, isSameSquare } from './board-squares.ts';
import { TUNING, marchEveryFor } from './jump-chain-tuning.ts';
import { outcome } from './outcome.ts';

import type {
  Enemy,
  EnemyShift,
  JumpChainResult,
  JumpChainState,
  Square,
} from './jump-chain-types.ts';

function isTaken(enemies: readonly Enemy[], piece: Square, square: Square): boolean {
  return isSameSquare(square, piece) || enemyAt(enemies, square) !== undefined;
}

/** rules.continueRun.apply: a lost run made playable again, with the event that explains it. */
export function continueAfterLoss(lost: JumpChainState): JumpChainResult {
  if (lost.hasContinued || outcome(lost).kind !== 'lost') {
    throw new RangeError('a run continues once, and only after a loss');
  }
  const topFirst = [...lost.enemies].sort((a, b) =>
    a.row === b.row ? a.col - b.col : a.row - b.row,
  );
  let enemies = lost.enemies;
  const shifts: EnemyShift[] = [];
  for (const enemy of topFirst) {
    let row = enemy.row - TUNING.continueRows;
    while (isTaken(enemies, lost.piece, { col: enemy.col, row })) row -= TUNING.continueRows;
    enemies = enemies.map((other) => (other.id === enemy.id ? { ...other, row } : other));
    shifts.push({ enemyId: enemy.id, col: enemy.col, fromRow: enemy.row, toRow: row });
  }
  return {
    state: {
      ...lost,
      enemies,
      marchIn: marchEveryFor(lost.difficulty, lost.nextRank),
      hasContinued: true,
    },
    events: [{ kind: 'ranks-stepped-back', shifts }],
  };
}
