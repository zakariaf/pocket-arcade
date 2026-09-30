// packages/shell/src/screens/debug/debug-overrides.test.ts
import {
  decodeDebugOverrides,
  encodeDebugOverrides,
  isDateKey,
  NO_DEBUG_OVERRIDES,
} from './debug-overrides.ts';

import type { DebugOverrides } from './debug-overrides.ts';

const SET: DebugOverrides = {
  date: '2026-09-26',
  isOffline: true,
  isBoardLayoutOn: true,
  ads: 'never',
  seed: 42,
};

describe('debug overrides in the test-only key-value store', () => {
  it('reads back exactly what it wrote', () => {
    expect(decodeDebugOverrides(encodeDebugOverrides(SET))).toStrictEqual(SET);
  });

  it('starts with no overrides when nothing was stored', () => {
    expect(decodeDebugOverrides(null)).toStrictEqual(NO_DEBUG_OVERRIDES);
  });

  it('drops a damaged record, and each bad field on its own', () => {
    expect(decodeDebugOverrides('{not json')).toStrictEqual(NO_DEBUG_OVERRIDES);
    expect(decodeDebugOverrides('[]')).toStrictEqual(NO_DEBUG_OVERRIDES);
    const partlyBad = JSON.stringify({ ...SET, date: '2026-13-45', ads: 'sometimes', seed: -1 });
    expect(decodeDebugOverrides(partlyBad)).toStrictEqual({
      ...SET,
      date: null,
      ads: null,
      seed: null,
    });
  });

  it('accepts only real calendar days', () => {
    expect(isDateKey('2026-02-28')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-9-28')).toBe(false);
    expect(isDateKey(20260928)).toBe(false);
  });
});
