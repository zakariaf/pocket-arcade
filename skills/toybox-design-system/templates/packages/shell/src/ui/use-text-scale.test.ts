// packages/shell/src/ui/use-text-scale.test.ts
// no-shell-context: the hook reads only the window metrics.
import { renderHook } from '@testing-library/react-native';

import { MAX_TEXT_SCALE, useTextScale } from './use-text-scale.ts';

import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

const mockWindow: { current: WindowMetrics } = {
  current: { width: 402, height: 874, fontScale: 1, scale: 3 },
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

describe('useTextScale (spec 8.11: text grows up to 200 % and no further)', () => {
  it('follows the phone text size up to 200 %', async () => {
    mockWindow.current = { width: 402, height: 874, fontScale: 1.5, scale: 3 };
    const { result, rerender } = await renderHook(() => useTextScale());
    expect(result.current).toBe(1.5);

    mockWindow.current = { width: 402, height: 874, fontScale: 3.571, scale: 3 };
    await rerender({});
    expect(result.current).toBe(2);
  });

  it('caps at the same 200 % as maxFontSizeMultiplier', () => {
    expect(MAX_TEXT_SCALE).toBe(2);
  });
});
