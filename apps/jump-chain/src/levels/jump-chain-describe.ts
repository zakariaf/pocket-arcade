// apps/jump-chain/src/levels/jump-chain-describe.ts
// A level start as readable text for the data goldens: the counts and the march, then the board row
// by row ('P' your piece, 'x' an enemy, '.' a free dark square, ' ' a light one), starting with the
// ranks that wait above the board (negative rows).
import { isDark } from '@e07/jump-chain/rules/board-squares.ts';
import { TUNING } from '@e07/jump-chain/rules/jump-chain-tuning.ts';

import type { JumpChainState } from '@e07/jump-chain/rules/jump-chain-types.ts';

function squareText(state: JumpChainState, col: number, row: number): string {
  if (state.piece.col === col && state.piece.row === row) return 'P';
  if (state.enemies.some((enemy) => enemy.col === col && enemy.row === row)) return 'x';
  return isDark(col, row) ? '.' : ' ';
}

function rowText(state: JumpChainState, row: number): string {
  const squares = Array.from({ length: TUNING.cols }, (_, col) => squareText(state, col, row));
  return `${String(row).padStart(2)}  ${squares.join('')}`;
}

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: JumpChainState): string {
  const top = Math.min(0, ...state.enemies.map((enemy) => enemy.row));
  const rows = Array.from({ length: TUNING.rows - top }, (_, index) => rowText(state, top + index));
  const header = `enemies ${String(state.enemies.length)} ranks ${String(state.nextRank)} march every ${String(state.marchIn)}`;
  return [header, ...rows].join('\n');
}
