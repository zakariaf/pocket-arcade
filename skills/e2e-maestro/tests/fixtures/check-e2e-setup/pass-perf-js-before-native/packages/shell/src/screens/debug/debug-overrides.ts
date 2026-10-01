// packages/shell/src/screens/debug/debug-overrides.ts
// Test builds only. The debug state that lives outside the save document: the simulated day, the
// simulated outage, the board layout probe, the ads override and the level seed override. A
// direction reload (lang=fa from English, Force language) and a killed app restart the JS
// runtime, which would silently drop them, so debug-services.ts keeps them in the test-only
// key-value store and re-applies them when the composition root creates the services at startup.
import { dayNumber, fromDayNumber } from '@e07/game-kit/dates/date-key.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

/** S15 "Always show test ads" / "Never show ads" (debug link ads=test / ads=off). */
export type DebugAdsOverride = 'always-test' | 'never';

export type DebugOverrides = {
  readonly date: DateKey | null;
  readonly isOffline: boolean;
  readonly isBoardLayoutOn: boolean;
  readonly ads: DebugAdsOverride | null;
  readonly seed: number | null;
};

export const NO_DEBUG_OVERRIDES: DebugOverrides = {
  date: null,
  isOffline: false,
  isBoardLayoutOn: false,
  ads: null,
  seed: null,
};

/** The two keys of the test-only key-value store. */
export type DebugStoreKey = 'debug.overrides' | 'debug.pending-screen';

/**
 * The test-only key-value store: expo-sqlite/kv-store's own database in the app
 * (services/save/sqlite-kv-debug-store-adapter.ts, reached only through the test-only entry), a
 * Map in tests. Synchronous, so the overrides are back before the first render.
 */
export type DebugStore = {
  readonly get: (key: DebugStoreKey) => string | null;
  readonly set: (key: DebugStoreKey, value: string | null) => void;
};

/** A real calendar day 'YYYY-MM-DD' (2026-02-30 and 2026-13-01 are not). */
export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromDayNumber(dayNumber(value)) === value;
}

function isSeed(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff
  );
}

function parseJson(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** What the store holds; a missing, damaged or partly unknown record falls back field by field. */
export function decodeDebugOverrides(raw: string | null): DebugOverrides {
  if (raw === null) return NO_DEBUG_OVERRIDES;
  const data = parseJson(raw);
  return {
    date: isDateKey(data['date']) ? data['date'] : null,
    isOffline: data['isOffline'] === true,
    isBoardLayoutOn: data['isBoardLayoutOn'] === true,
    ads: data['ads'] === 'always-test' || data['ads'] === 'never' ? data['ads'] : null,
    seed: isSeed(data['seed']) ? data['seed'] : null,
  };
}

export function encodeDebugOverrides(overrides: DebugOverrides): string {
  return JSON.stringify(overrides);
}
