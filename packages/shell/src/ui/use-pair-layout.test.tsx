// packages/shell/src/ui/use-pair-layout.test.tsx
// no-shell-context: the hook reads only the window metrics.
import { renderHook } from '@testing-library/react-native';

import { usePairLayout } from './use-pair-layout.ts';

import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

const mockWindow: { current: WindowMetrics } = {
  current: { width: 402, height: 874, fontScale: 1, scale: 3 },
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

describe('usePairLayout', () => {
  it('lays the items in a row with the given gap and equal shares at normal text size', async () => {
    mockWindow.current = { width: 402, height: 874, fontScale: 1, scale: 3 };
    const { result } = await renderHook(() => usePairLayout(10));

    // allow-style-assertion: the row-or-column layout is this hook's whole contract.
    expect(result.current.row).toStrictEqual({
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
    });
    expect(result.current.item).toStrictEqual({ flex: 1, flexBasis: 0 });
  });

  it('stacks the items in a column that stretches them at 200 % text (spec 8.11)', async () => {
    mockWindow.current = { width: 402, height: 874, fontScale: 2, scale: 3 };
    const { result } = await renderHook(() => usePairLayout(12));

    // allow-style-assertion: the three Home keys stack instead of squeezing their labels.
    expect(result.current.row).toStrictEqual({
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 12,
    });
    expect(result.current.item).toStrictEqual({ alignSelf: 'stretch' });
  });
});
