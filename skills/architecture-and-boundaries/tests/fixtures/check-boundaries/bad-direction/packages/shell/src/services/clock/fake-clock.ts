// packages/shell/src/services/clock/fake-clock.ts
import type { ClockPort } from './clock-port.ts';

/** A clock that stands still. */
export function createFakeClock(nowMs: number): ClockPort {
  return { nowMs: () => nowMs, today: () => '2026-09-28' };
}
