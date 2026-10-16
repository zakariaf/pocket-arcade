// packages/shell/src/testing/platform.android.test.ts
// Probe of the unit-android Jest project: its tests run where React Native reports Android.
import { Platform } from 'react-native';

describe('Platform', () => {
  it('reports android in the unit-android project', () => {
    expect(Platform.OS).toBe('android');
  });
});
