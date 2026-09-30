// packages/shell/src/services/clock/clock-port.ts
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

/** Planted bug: the port has no way to tell the time to local midnight. */
export type ClockPort = {
  readonly nowMs: () => number;
  readonly today: () => DateKey;
};
