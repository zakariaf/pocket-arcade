// packages/shell/src/screens/debug/simulated-clock.ts
// Test builds only, created through the test-only entry. Wraps the real ClockPort so the S15 "Set
// date" row and the debug link date=YYYY-MM-DD move the calendar day for daily challenges and
// streaks. Only today() changes: nowMs() (records, ad spacing, play time) and msUntilNextLocalDay()
// (S9's countdown) stay the real clock's, so timers and durations never jump.
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';

export type SimulatedClock = ClockPort & {
  /** date=YYYY-MM-DD: today() answers this day; null follows the real calendar again. */
  readonly setSimulatedToday: (today: DateKey | null) => void;
  /** The day set with setSimulatedToday, or null while today() follows the real calendar. */
  readonly simulatedToday: () => DateKey | null;
};

export function createSimulatedClock(real: ClockPort): SimulatedClock {
  let simulatedToday: DateKey | null = null;
  return {
    nowMs: () => real.nowMs(),
    today: () => simulatedToday ?? real.today(),
    msUntilNextLocalDay: () => real.msUntilNextLocalDay(),
    setSimulatedToday: (today) => {
      simulatedToday = today;
    },
    simulatedToday: () => simulatedToday,
  };
}
