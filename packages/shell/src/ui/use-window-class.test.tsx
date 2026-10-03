// packages/shell/src/ui/use-window-class.test.tsx
// no-shell-context: the hook reads only the window metrics.
import { renderHook } from '@testing-library/react-native';

import { useWindowClass } from './use-window-class.ts';

import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

const mockWindow: { current: WindowMetrics } = {
  current: { width: 402, height: 874, fontScale: 1, scale: 3 },
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

describe('useWindowClass', () => {
  it('classifies the current window and follows its changes', async () => {
    const { result, rerender } = await renderHook(() => useWindowClass());
    expect(result.current).toStrictEqual({
      width: 'compact',
      isLandscape: false,
      isLargeText: false,
    });

    mockWindow.current = { width: 1032, height: 744, fontScale: 2, scale: 2 };
    await rerender({});
    expect(result.current).toStrictEqual({
      width: 'regular',
      isLandscape: true,
      isLargeText: true,
    });
  });
});
