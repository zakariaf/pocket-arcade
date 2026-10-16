// packages/shell/src/app/read-store-ids.test.ts
// no-shell-context: reads expo-constants (mocked with the pilot's test build values) and the platform.
import { Platform } from 'react-native';

import { readStoreIds } from './read-store-ids.ts';

jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

describe('readStoreIds', () => {
  it('names the platform, the App Store id and the Android package of the build (spec S11)', () => {
    expect(readStoreIds('6740000001')).toStrictEqual({
      os: 'ios',
      appStoreId: '6740000001',
      androidPackage: 'io.applander.linesiege',
    });
  });

  it('names Android on Android, so its links go to Google Play', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(readStoreIds(undefined)).toStrictEqual({
      os: 'android',
      appStoreId: undefined,
      androidPackage: 'io.applander.linesiege',
    });
  });
});
