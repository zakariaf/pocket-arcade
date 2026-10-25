// apps/swap-guard/src/rules/swap-guard-rules.golden.test.ts
// RULES GOLDEN. A diff here means the rules changed: the same swaps now give other strikes, other
// knock-outs or another outcome. Update only on purpose with
// `npx jest <this file> --selectProjects golden -u` and a `Gate-Change:` commit trailer.
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { SwapGuardEvent, SwapGuardState } from './swap-guard-types.ts';

/** A fixed line of choices (each picks one of the listed swaps, modulo their count). */
const LINE = [7, 2, 5, 0, 3, 6, 1, 4];

const LETTERS = { spear: 's', archer: 'a', brute: 'b' } as const;
const ARROWS = { up: '^', right: '>', down: 'v', left: '<' } as const;

function squareText(state: SwapGuardState, cell: number): string {
  if (cell === state.guard) return state.isHit ? 'X.' : 'G.';
  const enemy = state.enemies.find((e) => e.cell === cell);
  if (enemy === undefined) return '..';
  return `${LETTERS[enemy.kind]}${enemy.kind === 'brute' ? '+' : ARROWS[enemy.facing]}`;
}

function rowText(state: SwapGuardState, row: number): string {
  const cols = Array.from({ length: state.size }, (_, col) => col);
  return cols.map((col) => squareText(state, row * state.size + col)).join(' ');
}

function boardText(state: SwapGuardState): string {
  return Array.from({ length: state.size }, (_, row) => rowText(state, row)).join('\n');
}

function eventText(event: SwapGuardEvent): string {
  switch (event.kind) {
    case 'pieces-swapped':
      return `swapped ${String(event.from)} -> ${String(event.to)} with ${event.enemyId === null ? 'a tile' : `enemy ${String(event.enemyId)}`}`;
    case 'strikes-landed':
      return `struck ${event.strikes.map((s) => `${String(s.enemyId)}:[${s.cells.join(',')}]`).join(' ')}`;
    case 'enemies-defeated':
      return `defeated ${event.enemyIds.join(',')} on ${event.cells.join(',')}`;
    case 'guard-hit':
      return `guard hit on ${String(event.cell)} by ${event.enemyIds.join(',')}`;
    case 'swap-reversed':
      return `reversed ${String(event.from)} -> ${String(event.to)}`;
  }
}

describe('the rules golden of swap-guard', () => {
  it('keeps the event stream and the final state of seed 1 at difficulty 0', () => {
    const start = create(1, 0);
    const { states, events } = playChoices({ listMoves, applyMove }, start, LINE);
    const last = states[states.length - 1] ?? start;
    const result = outcome(last);
    const header = `seed 1 difficulty 0 swaps ${String(last.swaps)} score ${String(last.score)} outcome ${JSON.stringify(result)}`;
    expect(
      [header, boardText(start), ...events.map(eventText), boardText(last)].join('\n'),
    ).toMatchSnapshot();
  });
});
