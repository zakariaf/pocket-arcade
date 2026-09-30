// packages/shell/src/services/clock/system-clock-adapter.ts
import type { ClockPort } from './clock-port.ts';

/** The device clock. */
export function createSystemClockAdapter(): ClockPort {
  return { nowMs: () => Date.now(), today: () => '2026-09-28' };
}
