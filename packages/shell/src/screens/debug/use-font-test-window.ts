// packages/shell/src/screens/debug/use-font-test-window.ts
// The S15 font page's rows, a few at a time (spec 7.6; test builds only). About 570 texts drawn at
// once kept the main thread busy 30 s and timed out XCUITest's hierarchy query, so no Maestro flow
// could scroll or capture the page (E17, f44be6da). The page is a ScrollView, never a virtualized
// list (react-components-and-hooks rule 11): the seven type roles mount first (every bundled face),
// and rows join as the page nears its end. A row never leaves, so every row is drawn in the end.
import { useState } from 'react';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/** The seven type roles: Lilita One, Rubik Regular and Bold, Vazirmatn Regular and Bold. */
export const FIRST_ROWS = 7;

/** Rows added each time the page nears its end. */
export const ROW_STEP = 7;

type FontTestScroll = {
  readonly count: number;
  readonly total: number;
  readonly offsetY: number;
  readonly viewportHeight: number;
  readonly contentHeight: number;
};

/** The rows to mount after a scroll: one more step once less than a screen is left below. */
export function mountedRowsAfter(scroll: FontTestScroll): number {
  const below = scroll.contentHeight - (scroll.offsetY + scroll.viewportHeight);
  if (below >= scroll.viewportHeight) return scroll.count;
  return Math.min(scroll.total, scroll.count + ROW_STEP);
}

type FontTestWindow = {
  /** How many of the page's rows are mounted. */
  readonly count: number;
  /** onScroll for the page's ScrollView. */
  readonly handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

/** The mounted rows of a page of `total` rows; they only grow as the page scrolls. */
export function useFontTestWindow(total: number): FontTestWindow {
  const [count, setCount] = useState(Math.min(FIRST_ROWS, total));
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    setCount((current) =>
      mountedRowsAfter({
        count: current,
        total,
        offsetY: contentOffset.y,
        viewportHeight: layoutMeasurement.height,
        contentHeight: contentSize.height,
      }),
    );
  };
  return { count, handleScroll };
}
