// apps/poker-drop/src/rules/poker-drop-rules.golden.test.ts
// DATA GOLDEN of the rules: seed 1 at difficulty 0 played with a fixed legal move line. A diff here
// means the same moves now give a different run (deal, bursts, cascade, timing or score): update it
// only on purpose with `npx jest <this file> --selectProjects golden -u` and a `Gate-Change:` trailer.
import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';

import type { PokerDropEvent, PokerDropState } from './poker-drop-types.ts';

/** The fixed move line: the first listed move after each choice, cycling through the columns. */
const CHOICES = [2, 0, 4, 1, 3, 2, 0, 4, 1, 3, 2, 2];

function line(event: PokerDropEvent): string {
  const { kind, atMs, ...rest } = event;
  return `${String(atMs).padStart(5)} ${kind} ${JSON.stringify(rest)}`;
}

describe('the rules golden', () => {
  it('keeps the event stream and the final state of seed 1 at difficulty 0', () => {
    let state: PokerDropState = create(1, 0);
    const out: string[] = [];
    CHOICES.forEach((choice, index) => {
      const moves = listMoves(state);
      const move = moves[choice % moves.length];
      if (move === undefined) return;
      const result = applyMove(state, move);
      out.push(
        `move ${String(index + 1)}: drop in column ${String(move.col)}`,
        ...result.events.map(line),
      );
      state = result.state;
    });
    out.push(`final ${JSON.stringify(state)}`);
    expect(out.join('\n')).toMatchSnapshot();
  });
});
