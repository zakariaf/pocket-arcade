// apps/stepstone/src/rules/stepstone-rules.golden.test.ts
// RULES GOLDEN. A diff here means the rules changed: a seeded level plays differently, which
// changes saved runs, replays and every level behind the same seed. Update only on purpose with
// `npx jest <this file> --ci --selectProjects golden -u` and a `Gate-Change:` commit trailer.
import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { outcome } from './outcome.ts';
import { pondText } from './pond-text.ts';

import type { StepstoneEvent } from './stepstone-types.ts';

/** Seed 1 at difficulty 0, played along its shortest route: rook, king, king, flag. */
const LINE = [12, 18, 14] as const;

function playLine(): {
  events: StepstoneEvent[];
  final: string;
  result: ReturnType<typeof outcome>;
} {
  let state = create(1, 0);
  const events: StepstoneEvent[] = [];
  for (const to of LINE) {
    const step = applyMove(state, { kind: 'hop', to });
    events.push(...step.events);
    state = step.state;
  }
  return { events, final: pondText(state), result: outcome(state) };
}

describe('the rules golden of stepstone', () => {
  it('keeps the event stream and the final pond of seed 1 at difficulty 0', () => {
    expect(playLine()).toMatchSnapshot();
  });
});
