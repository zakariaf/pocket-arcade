// apps/trail-clear/src/rules/trail-clear-rules.golden.test.ts
// RULES GOLDEN. A diff here means the rules changed: the same seed and moves now play differently,
// so saved runs, levels and the daily would change too. Update only on purpose with
// `npx jest <this file> --ci --selectProjects golden -u` and a `Gate-Change:` commit trailer.
import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { TrailClearEvent, TrailClearState } from './trail-clear-types.ts';

/** Seed 1 at difficulty 0, always taking the move a fixed index into the list (a legal move line). */
function playFixedLine(): { readonly events: TrailClearEvent[]; readonly final: TrailClearState } {
  let state = create(1, 0);
  const events: TrailClearEvent[] = [];
  for (let turn = 0; turn < 16 && outcome(state).kind === 'playing'; turn += 1) {
    const moves = listMoves(state);
    const move = moves[(turn * 7) % moves.length];
    if (move === undefined) break;
    const result = applyMove(state, move);
    events.push(...result.events);
    state = result.state;
  }
  return { events, final: state };
}

describe('the rules golden of trail-clear', () => {
  it('plays seed 1 at difficulty 0 along a fixed legal move line to the same events and state', () => {
    const { events, final } = playFixedLine();
    expect(events.map((event) => JSON.stringify(event)).join('\n')).toMatchSnapshot();
    expect(JSON.stringify(final)).toMatchSnapshot();
  });
});
