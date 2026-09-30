// packages/shell/src/services/clock/clock-port.ts
import type { DateKey } from '@demo/game-kit/dates/date-key.ts';

/** The only source of wall-clock time. */
export type ClockPort = { readonly nowMs: () => number; readonly today: () => DateKey };
