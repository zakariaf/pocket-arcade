// packages/shell/src/ui/use-scaled-size.android.test.ts
// Runs in the unit-android project. Spec 8.11: "Text grows with the phone's text-size setting up
// to 200%." Android 14 and later draw sp sizes along AOSP's font scale curves, so a part laid out
// against a text line grows as Android draws that line (E18-T25: 25.5 sp lines 36.5 dp apart).
// no-shell-context: the hook reads only the window's font scale and the Android version.
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useScaledSize } from './use-scaled-size.ts';

import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

const mockWindow: { current: WindowMetrics } = {
  current: { width: 411, height: 914, fontScale: 2, scale: 2.625 },
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

describe('useScaledSize on Android (spec 8.11)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('draws a size along the curve on Android 14 and later', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(35);
    const { result } = await renderHook(() => useScaledSize());
    expect(result.current(25.5)).toBeCloseTo(36.5, 4);
    expect(result.current(36.25)).toBeCloseTo(38 + (6.25 / 70) * 62, 4);
  });

  it('draws a size linearly before Android 14', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
    const { result } = await renderHook(() => useScaledSize());
    expect(result.current(36.25)).toBe(72.5);
  });
});
