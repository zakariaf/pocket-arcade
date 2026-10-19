// apps/flock-tilt/src/rules/flock-tilt-rules.golden.test.ts
// DATA GOLDEN. A diff here means the rules changed: every saved run, replay and level plays
// differently. Update only on purpose with
// `npx jest apps/flock-tilt/src/rules/flock-tilt-rules.golden.test.ts --selectProjects golden -u`
// and a `Gate-Change:` commit trailer.
import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { fieldText } from './field-text.ts';
import { outcome } from './outcome.ts';

import type { Direction, FlockTiltEvent } from './flock-tilt-types.ts';

/** Plays a fixed line from seed 1 at difficulty 0 and writes every tilt's map and events. */
function playedLine(line: readonly Direction[]): string {
  let state = create(1, 0);
  const parts = [`seed 1 difficulty 0 par ${String(state.par)}`, fieldText(state)];
  for (const direction of line) {
    const result = applyMove(state, { kind: 'tilt', direction });
    state = result.state;
    parts.push(`tilt ${direction}`, ...result.events.map(eventLine), fieldText(state));
  }
  parts.push(`outcome ${JSON.stringify(outcome(state))} tilts ${String(state.tilts)}`);
  return parts.join('\n');
}

function eventLine(event: FlockTiltEvent): string {
  return `  ${JSON.stringify(event)}`;
}

describe('flock-tilt rules golden', () => {
  it('keeps the event stream of a won line (down, left, down, left)', () => {
    expect(playedLine(['down', 'left', 'down', 'left'])).toMatchSnapshot();
  });

  it('keeps the event stream of a line the wolf ends (up, right, up, left)', () => {
    expect(playedLine(['up', 'right', 'up', 'left'])).toMatchSnapshot();
  });
});
