// packages/shell/src/ui/use-scaled-size.test.ts
// no-shell-context: the hook reads only the window metrics and the platform.
// Spec 8.11: "Text grows with the phone's text-size setting up to 200%." iOS draws every size
// linearly, capped at 200 %, exactly as before the Android curves.
import { renderHook } from '@testing-library/react-native';

import { useScaledSize } from './use-scaled-size.ts';

import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

const mockWindow: { current: WindowMetrics } = {
  current: { width: 402, height: 874, fontScale: 1, scale: 3 },
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

describe('useScaledSize on iOS (spec 8.11)', () => {
  it('draws a size linearly at the text size, up to 200 %', async () => {
    mockWindow.current = { width: 402, height: 874, fontScale: 1.5, scale: 3 };
    const { result, rerender } = await renderHook(() => useScaledSize());
    expect(result.current(36.25)).toBe(54.375);

    mockWindow.current = { width: 402, height: 874, fontScale: 3.571, scale: 3 };
    await rerender({});
    expect(result.current(36.25)).toBe(72.5);
  });

  it('keeps every size as it is at 100 %', async () => {
    mockWindow.current = { width: 402, height: 874, fontScale: 1, scale: 3 };
    const { result } = await renderHook(() => useScaledSize());
    expect(result.current(109 / 3)).toBe(109 / 3);
  });
});
