// packages/shell/src/testing/test-game-extra.test.ts
// no-shell-context: a fixture check; it reads no store, port or catalog.
import { readAppVersion, readGameExtra } from '@e07/shell/app/read-game-extra.ts';

import { TEST_EXPO_CONSTANTS, TEST_GAME_EXTRA, testExpoConstantsWith } from './test-game-extra.ts';

jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

describe('TEST_EXPO_CONSTANTS', () => {
  it('passes the same validation as a real build', () => {
    expect(readGameExtra(TEST_EXPO_CONSTANTS.default.expoConfig.extra)).toStrictEqual(
      TEST_GAME_EXTRA,
    );
    expect(readGameExtra()).toStrictEqual(TEST_GAME_EXTRA);
    expect(readAppVersion()).toBe('1.0.0');
  });
});

describe('testExpoConstantsWith', () => {
  it("changes only the game fields a test names, and still passes the build's validation", () => {
    const { extra } = testExpoConstantsWith({ hints: { freePerDay: 1 } }).default.expoConfig;
    expect(readGameExtra(extra)).toStrictEqual({ ...TEST_GAME_EXTRA, hints: { freePerDay: 1 } });
    expect(extra.adsMode).toBe('test');
  });
});
