// packages/shell/src/app/use-game-extra.test.tsx
// no-shell-context: the hook reads only expo.extra (mocked below), no store, port or catalog.
import { renderHook } from '@testing-library/react-native';

import { TEST_GAME_EXTRA } from '@e07/shell/testing/test-game-extra.ts';

import { levelCountOf, useGameExtra } from './use-game-extra.ts';

jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

describe('useGameExtra', () => {
  it('returns the embedded game config, validated, and keeps it across renders', async () => {
    const { result, rerender } = await renderHook(() => useGameExtra());
    const first = result.current;
    await rerender({});

    expect(first).toStrictEqual(TEST_GAME_EXTRA);
    expect(result.current).toBe(first);
  });

  it('counts every shipped level', () => {
    expect(levelCountOf(TEST_GAME_EXTRA)).toBe(90);
  });
});
