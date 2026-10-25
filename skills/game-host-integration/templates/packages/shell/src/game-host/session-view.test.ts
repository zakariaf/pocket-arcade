// packages/shell/src/game-host/session-view.test.ts
import { isRunLive } from './session-view.ts';

import type { SessionStatus } from './game-session-types.ts';

describe('isRunLive', () => {
  it('counts a playing and a paused run as live, a won or lost one as over (spec S5, S6, S7)', () => {
    const statuses: readonly SessionStatus[] = ['playing', 'paused', 'won', 'lost'];
    expect(statuses.map(isRunLive)).toStrictEqual([true, true, false, false]);
  });

  it('counts no open run (missing) as not live', () => {
    expect(isRunLive('missing')).toBe(false);
  });
});
