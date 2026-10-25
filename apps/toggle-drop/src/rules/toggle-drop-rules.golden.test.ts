// apps/toggle-drop/src/rules/toggle-drop-rules.golden.test.ts
// The rules golden: seed 1 at difficulty 0 played along a fixed line of drops. Its event stream and
// final board are pinned as readable text, so any change of the rules (the board, the fall, its
// timing, the cups) shows here and is committed on purpose with a Gate-Change trailer.
import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { ToggleDropEvent, ToggleDropState } from './toggle-drop-types.ts';

/** The fixed line: drop in these columns while the run lasts. */
const LINE = [1, 4, 0, 3, 2, 2];
const SEED = 1;
const DIFFICULTY = 0;
const PEG = { '-1': '.', '0': '<', '1': '>' } as const;

/** One event per line: its time, its kind and what it carries. */
function eventLine(event: ToggleDropEvent): string {
  const at = `${String(event.atMs).padStart(4)} ms ${event.kind}`;
  switch (event.kind) {
    case 'ball-dropped':
      return `${at} col ${String(event.col)}`;
    case 'ball-passed':
      return `${at} col ${String(event.col)} row ${String(event.row)}`;
    case 'switch-flipped':
      return `${at} col ${String(event.col)} row ${String(event.row)} now ${PEG[event.side]}`;
    case 'ball-landed':
      return `${at} col ${String(event.col)} ${event.isInCup ? 'cup' : 'gutter'}${event.wasRedirected ? ' redirected' : ''}`;
    case 'cup-filled':
      return `${at} col ${String(event.col)}`;
  }
}

/** The board as rows of switches, then the cups as filled/needed per column ('_' for the gutter). */
function boardText(state: ToggleDropState): string[] {
  const rows: string[] = [];
  for (let row = 0; row < state.rows; row += 1) {
    rows.push(
      state.pegs
        .slice(row * state.cols, (row + 1) * state.cols)
        .map((peg) => PEG[peg])
        .join(''),
    );
  }
  const cups = state.needs.map((need, col) =>
    need === 0 ? '_' : `${String(state.filled[col] ?? 0)}/${String(need)}`,
  );
  return [
    ...rows,
    cups.join(' '),
    `balls left ${String(state.ballsLeft)}, drops ${String(state.drops)}`,
  ];
}

function playedText(): string {
  let state = create(SEED, DIFFICULTY);
  const lines = [
    `seed ${String(SEED)}, difficulty ${String(DIFFICULTY)}, line ${LINE.join(' ')}`,
    ...boardText(state),
  ];
  for (const col of LINE) {
    if (listMoves(state).length === 0) break;
    const result = applyMove(state, { kind: 'drop', col });
    lines.push(`drop ${String(col)}`, ...result.events.map(eventLine));
    state = result.state;
  }
  const result = outcome(state);
  lines.push(
    ...boardText(state),
    `outcome ${result.kind}${result.kind === 'won' ? ` ${String(result.score)}` : ''}`,
  );
  return lines.join('\n');
}

describe('the rules golden of toggle-drop', () => {
  it('keeps the events and the final board of seed 1 at difficulty 0 along a fixed line', () => {
    expect(playedText()).toMatchSnapshot();
  });
});
