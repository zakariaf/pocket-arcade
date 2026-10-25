// apps/jump-chain/src/rules/jump-chain-rules.golden.test.ts
// DATA GOLDEN of the rules. A diff here means the same moves now play out differently: saved runs,
// replays and generated levels change with it. Update only with
// `npx jest <this file> --selectProjects golden -u` plus a `Gate-Change:` commit trailer.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { applyMove } from './apply-move.ts';
import { isDark } from './board-squares.ts';
import { create } from './create.ts';
import { TUNING } from './jump-chain-tuning.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { JumpChainEvent, JumpChainMove, JumpChainState, Square } from './jump-chain-types.ts';

/** The fixed move line: each number picks the listed move at (number mod the list's length). */
const CHOICES = [3, 1, 0, 5, 2, 0, 4, 1, 0, 2, 3, 0, 1, 6, 0, 2, 1, 0, 3, 0, 2, 1, 0, 4];

function squareText(square: Square): string {
  return `${String(square.col)},${String(square.row)}`;
}

function moveText(move: JumpChainMove): string {
  return move.kind === 'step'
    ? `step ${squareText(move.to)}`
    : `jump ${move.path.map(squareText).join(' ')}`;
}

/** One event as a short line with the ids and squares the board and the counters read. */
function eventText(event: JumpChainEvent): string {
  switch (event.kind) {
    case 'piece-stepped':
      return `piece-stepped ${squareText(event.from)} > ${squareText(event.to)}`;
    case 'piece-jumped':
      return `piece-jumped #${String(event.jump)} over ${String(event.enemyId)} > ${squareText(event.to)}`;
    case 'enemies-captured':
      return `enemies-captured [${event.enemyIds.join(',')}] chain ${String(event.chain)} +${String(event.points)}`;
    case 'rank-cleared':
      return `rank-cleared ${String(event.rank)} +${String(event.points)}`;
    case 'ranks-advanced':
    case 'ranks-stepped-back':
      return `${event.kind} ${event.shifts.map((s) => `${String(s.enemyId)}:${String(s.fromRow)}>${String(s.toRow)}`).join(' ')}`;
    case 'rank-spawned':
      return `rank-spawned ${String(event.rank)} at ${event.enemies.map(squareText).join(' ')}`;
    case 'side-reached':
      return `side-reached [${event.enemyIds.join(',')}]`;
  }
}

function boardText(state: JumpChainState): string {
  return Array.from({ length: TUNING.rows }, (_, row) =>
    Array.from({ length: TUNING.cols }, (_cell, col) => {
      if (state.piece.col === col && state.piece.row === row) return 'P';
      if (state.enemies.some((enemy) => enemy.col === col && enemy.row === row)) return 'x';
      return isDark(col, row) ? '.' : ' ';
    }).join(''),
  ).join('\n');
}

/** Plays the fixed line from (seed, difficulty) until it ends or the line runs out. */
function playLine(seed: number, difficulty: number): string {
  let state = create(seed, difficulty);
  const lines = [`seed ${String(seed)} difficulty ${String(difficulty)}`, boardText(state)];
  for (const [index, choice] of CHOICES.entries()) {
    if (outcome(state).kind !== 'playing') break;
    const legal = listMoves(state);
    const move = pickAt(legal, choice % legal.length);
    const result = applyMove(state, move);
    lines.push(
      `move ${String(index + 1)}: ${moveText(move)}`,
      ...result.events.map((e) => `  ${eventText(e)}`),
    );
    state = result.state;
  }
  const end = outcome(state);
  lines.push(
    `end: ${end.kind} score ${String(state.score)} captured ${String(state.captured)}/${String(state.total)} ranks ${String(state.ranksCleared)} moves ${String(state.moves)}`,
    boardText(state),
  );
  return lines.join('\n');
}

describe('the rules of Jump Chain (golden)', () => {
  it('plays the frozen move line from seed 1 at difficulty 0', () => {
    expect(playLine(1, 0)).toMatchSnapshot();
  });
});
