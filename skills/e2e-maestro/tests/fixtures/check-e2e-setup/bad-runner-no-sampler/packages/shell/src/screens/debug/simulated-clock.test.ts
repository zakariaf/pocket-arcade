// packages/shell/src/screens/debug/simulated-clock.test.ts
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';

import { createSimulatedClock } from './simulated-clock.ts';

const NOW_MS = 1_790_424_000_000;

function setup() {
  const real = createFakeClock({
    nowMs: NOW_MS,
    today: '2026-09-28',
    msUntilNextLocalDay: 3_600_000,
  });
  return { real, clock: createSimulatedClock(real) };
}

describe('createSimulatedClock', () => {
  it('follows the real clock until a date is set', () => {
    const { clock } = setup();

    expect([clock.today(), clock.nowMs(), clock.msUntilNextLocalDay()]).toStrictEqual([
      '2026-09-28',
      NOW_MS,
      3_600_000,
    ]);
  });

  it('moves only today() when date= is applied, and follows the calendar again after null', () => {
    const { real, clock } = setup();

    clock.setSimulatedToday('2026-09-26');
    real.advance(60_000);

    expect([clock.today(), clock.nowMs(), clock.msUntilNextLocalDay()]).toStrictEqual([
      '2026-09-26',
      NOW_MS + 60_000,
      3_540_000,
    ]);
    clock.setSimulatedToday(null);
    expect(clock.today()).toBe('2026-09-28');
  });
});
