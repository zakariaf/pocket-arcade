// packages/shell/src/services/clock/clock-port.ts
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

/**
 * The only source of wall-clock time in the app. Game rules never read time; screens
 * and services receive a ClockPort (test builds wrap it to "set the date", S15).
 * Adapter: system-clock-adapter.ts (the one file that reads Date). Fake: fake-clock.ts.
 */
export type ClockPort = {
  /** Epoch milliseconds: records, ad spacing, play-time deltas (clamped). Never rules. */
  readonly nowMs: () => number;
  /** Today's local calendar day 'YYYY-MM-DD'; changes at local midnight (spec S9). */
  readonly today: () => DateKey;
  /**
   * Milliseconds until the next local midnight, when today() changes: at least 1, at most
   * one local day (86,400,000; 90,000,000 on the day clocks fall back). Feeds S9's
   * "Next challenge in {h} h {m} min". A test build's set-date wrapper keeps this value.
   */
  readonly msUntilNextLocalDay: () => number;
};
