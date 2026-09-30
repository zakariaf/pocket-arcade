// packages/shell/src/services/clock/fake-clock.ts
import { addDays } from '@e07/game-kit/dates/date-key.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';

const DAY_MS = 86_400_000;

export type FakeClockOptions = {
  readonly nowMs: number;
  readonly today: DateKey;
  /** Time left in `today` at `nowMs`, 1 to 86,400,000; default 12 h (a clock started at noon). */
  readonly msUntilNextLocalDay?: number;
};

/** A ClockPort that moves only when a test says so. Its days are 24 h long (no DST). */
export type FakeClock = ClockPort & {
  /** Moves time by `ms` (negative = the phone clock went back); crossing midnight moves today(). */
  readonly advance: (ms: number) => void;
  /** Jumps to another calendar day at the same time of day (daily, streaks, S15 set-date). */
  readonly setToday: (day: DateKey) => void;
};

export function createFakeClock(options: FakeClockOptions): FakeClock {
  let nowMs = options.nowMs;
  let today = options.today;
  let msLeft = options.msUntilNextLocalDay ?? DAY_MS / 2;
  if (!(msLeft >= 1 && msLeft <= DAY_MS)) {
    throw new RangeError(`msUntilNextLocalDay must be 1..${String(DAY_MS)}, got ${String(msLeft)}`);
  }
  return {
    nowMs: () => nowMs,
    today: () => today,
    msUntilNextLocalDay: () => msLeft,
    advance: (ms) => {
      nowMs += ms;
      msLeft -= ms;
      while (msLeft <= 0) {
        msLeft += DAY_MS;
        today = addDays(today, 1);
      }
      while (msLeft > DAY_MS) {
        msLeft -= DAY_MS;
        today = addDays(today, -1);
      }
    },
    setToday: (day) => {
      today = day;
    },
  };
}
