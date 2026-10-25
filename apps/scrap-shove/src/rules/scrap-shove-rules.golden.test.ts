// apps/scrap-shove/src/rules/scrap-shove-rules.golden.test.ts
// The rules golden: seed 1 at difficulty 0 played along a fixed legal line. Its event stream and
// final floor change only on purpose (a rules change), in a commit with a Gate-Change: trailer.
import { applyMove } from './apply-move.ts';
import { boardText } from './board-text.ts';
import { create } from './create.ts';
import { outcome } from './outcome.ts';

import type { ScrapShoveEvent, ScrapShoveMove, ScrapShoveState } from './scrap-shove-types.ts';

/**
 * A shortest winning line of create(1, 0) (par 5, found by breadth-first search): the wait lets
 * the crash pair meet and lines the heavy robot up behind the heap, the shove crushes it, and three
 * steps lead the last robots into each other and into scrap.
 */
const LINE: readonly ScrapShoveMove[] = [
  { kind: 'wait' },
  { kind: 'shove', col: 4, row: 3 },
  { kind: 'step', col: 3, row: 2 },
  { kind: 'step', col: 4, row: 1 },
  { kind: 'step', col: 4, row: 0 },
];

function eventLine(event: ScrapShoveEvent): string {
  const { kind, ...rest } = event;
  return `${kind} ${JSON.stringify(rest)}`;
}

function play(): { readonly states: readonly ScrapShoveState[]; readonly text: string } {
  let state = create(1, 0);
  const states = [state];
  const lines = [
    `seed 1, difficulty 0, ${String(state.robotsTotal)} robots`,
    boardText(state, state.cols),
  ];
  LINE.forEach((move, index) => {
    const result = applyMove(state, move);
    state = result.state;
    states.push(state);
    lines.push(
      `move ${String(index + 1)}: ${JSON.stringify(move)}`,
      ...result.events.map(eventLine),
    );
    lines.push(boardText(state, state.cols));
  });
  lines.push(`outcome ${JSON.stringify(outcome(state))}`);
  return { states, text: lines.join('\n') };
}

describe('the rules golden', () => {
  it('keeps the event stream and the floors of seed 1 along the fixed line', () => {
    expect(play().text).toMatchSnapshot();
  });
});
