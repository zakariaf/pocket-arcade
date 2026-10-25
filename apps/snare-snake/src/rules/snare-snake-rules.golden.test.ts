// apps/snare-snake/src/rules/snare-snake-rules.golden.test.ts
// RULES GOLDEN. One seeded game's event stream and final board: a diff here means the rules play
// differently (spec 8.13: a pure next state from this state and this move). Update only on purpose
// with `npx jest <this file> --ci --selectProjects golden -u` and a `Gate-Change:` commit trailer.
import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { SnareSnakeEvent, SnareSnakeState } from './snare-snake-types.ts';

/** One cell of the board text: 'H' the head, 's' the body, 'c' a critter, '.' empty. */
function cellText(state: SnareSnakeState, cell: number): string {
  const segment = state.snake.indexOf(cell);
  if (segment === 0) return 'H';
  if (segment > 0) return 's';
  return state.critters.some((critter) => critter.cell === cell) ? 'c' : '.';
}

function boardText(state: SnareSnakeState): string {
  const rowText = (row: number): string =>
    Array.from({ length: state.cols }, (_cell, col) =>
      cellText(state, row * state.cols + col),
    ).join('');
  return Array.from({ length: state.rows }, (_row, row) => rowText(row)).join('\n');
}

/** An event as one short phrase: its kind and the numbers the board and counters read. */
function eventText(event: SnareSnakeEvent): string {
  switch (event.kind) {
    case 'snake-moved':
      return `moved ${String(event.from)}>${String(event.to)} len ${String(event.length)}`;
    case 'loop-closed':
      return `loop of ${String(event.loop.length)} spent ${String(event.spent)} inside [${event.enclosed.join(' ')}]`;
    case 'critters-caught':
      return `caught [${event.critterIds.join(' ')}] +${String(event.points)}`;
    case 'critters-moved':
      return `hops ${event.hops.map((hop) => `${String(hop.critterId)}:${String(hop.from)}>${String(hop.to)}`).join(' ')}`;
    case 'bonus-added':
      return `bonus +${String(event.points)} = ${String(event.total)}`;
    case 'snake-stepped-back':
      return `stepped back to ${String(event.to)}`;
    case 'moves-added':
      return `moves +${String(event.count)}`;
  }
}

/** The fixed line: the last listed move each turn (left before down before right before up). */
function playLine(
  start: SnareSnakeState,
  turns: number,
): { lines: string[]; final: SnareSnakeState } {
  let state = start;
  const lines: string[] = [];
  for (let turn = 1; turn <= turns; turn += 1) {
    const move = listMoves(state).at(-1);
    if (move === undefined) break;
    const result = applyMove(state, move);
    lines.push(`${String(turn)} ${move.direction}: ${result.events.map(eventText).join('; ')}`);
    state = result.state;
  }
  return { lines, final: state };
}

describe('snare-snake rules golden', () => {
  it('keeps the event stream and the final board of seed 1 at difficulty 0', () => {
    const { lines, final } = playLine(create(1, 0), 40);
    const header = `seed 1 difficulty 0 caught ${String(final.caught)}/${String(final.total)} score ${String(final.score)} moves ${String(final.moves)}/${String(final.maxMoves)} ${JSON.stringify(outcome(final))}`;
    expect([header, ...lines, boardText(final)].join('\n')).toMatchSnapshot();
  });
});
