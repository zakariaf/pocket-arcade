// packages/shell/src/screens/debug/use-font-test-window.test.ts
// no-shell-context: the hook holds only its own count.
import { act, renderHook } from '@testing-library/react-native';
import fc from 'fast-check';

import {
  FIRST_ROWS,
  ROW_STEP,
  mountedRowsAfter,
  useFontTestWindow,
} from './use-font-test-window.ts';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

function scrollTo(offsetY: number, contentHeight: number): NativeSyntheticEvent<NativeScrollEvent> {
  const nativeEvent = {
    contentOffset: { x: 0, y: offsetY },
    layoutMeasurement: { width: 402, height: 800 },
    contentSize: { width: 402, height: contentHeight },
  };
  return { nativeEvent } as NativeSyntheticEvent<NativeScrollEvent>;
}

describe('mountedRowsAfter (spec 7.6: the S15 font page draws every row, a few at a time)', () => {
  it('mounts the next rows once less than a screen is left below the view', () => {
    const view = { count: 7, total: 40, viewportHeight: 800, contentHeight: 4000 };
    expect(mountedRowsAfter({ ...view, offsetY: 2500 })).toBe(14);
  });

  it('keeps the rows it has while more than a screen is left below', () => {
    const view = { count: 7, total: 40, viewportHeight: 800, contentHeight: 4000 };
    expect(mountedRowsAfter({ ...view, offsetY: 2300 })).toBe(7);
  });

  it('stops at the rows the page has', () => {
    const view = { count: 38, total: 40, viewportHeight: 800, contentHeight: 4000 };
    expect(mountedRowsAfter({ ...view, offsetY: 3200 })).toBe(40);
  });

  it('grows only, by at most one step, up to the whole page', () => {
    fc.assert(
      fc.property(
        fc.record({
          total: fc.integer({ min: 1, max: 80 }),
          start: fc.integer({ min: 0, max: 80 }),
          offsetY: fc.integer({ min: 0, max: 20_000 }),
          viewportHeight: fc.integer({ min: 1, max: 2000 }),
          contentHeight: fc.integer({ min: 0, max: 20_000 }),
        }),
        ({ total, start, offsetY, viewportHeight, contentHeight }) => {
          const count = Math.min(start, total);
          const next = mountedRowsAfter({ count, total, offsetY, viewportHeight, contentHeight });
          return next >= count && next <= Math.min(total, count + ROW_STEP);
        },
      ),
    );
  });
});

describe('useFontTestWindow', () => {
  it('starts with the seven type roles and adds rows as the page scrolls to its end', async () => {
    const { result } = await renderHook(() => useFontTestWindow(40));
    expect(result.current.count).toBe(FIRST_ROWS);

    await act(() => {
      result.current.handleScroll(scrollTo(2500, 4000));
    });
    expect(result.current.count).toBe(FIRST_ROWS + ROW_STEP);

    await act(() => {
      result.current.handleScroll(scrollTo(0, 4000));
    });
    expect(result.current.count).toBe(FIRST_ROWS + ROW_STEP);
  });

  it('mounts a short page whole', async () => {
    const { result } = await renderHook(() => useFontTestWindow(3));
    expect(result.current.count).toBe(3);
  });
});
