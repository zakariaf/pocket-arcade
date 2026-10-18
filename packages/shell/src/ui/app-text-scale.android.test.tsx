// packages/shell/src/ui/app-text-scale.android.test.tsx
// Runs in the unit-android project. Spec 8.11: "Text grows with the phone's text-size setting up
// to 200%, and layouts reflow rather than cut off." Android 14 and later draw a line along AOSP's
// font scale curve: at 200 % the hero key's 36 1/3 sp Sorani line is 43.6 dp, not 72 2/3. Counted
// linearly, AppText's room kept an empty band under a wrapped label (E18-T25, Home in ckb).
import { fireEvent, screen } from '@testing-library/react-native';
import { PixelRatio, Platform, StyleSheet } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { AppText } from './app-text.tsx';

import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

const mockWindow: { current: WindowMetrics } = {
  current: { width: 411, height: 914, fontScale: 2, scale: 3 },
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

const LABEL = 'یاریکردن – ئاستی ١٢';

/** The room's height above its pads, in pixels at 3x, after a two-line layout. */
async function roomOfTwoLines(): Promise<number> {
  await renderWithShell(<AppText text={LABEL} variant="heroKeyLabel" testID="home.play-key" />, {
    language: 'ckb',
  });
  await fireEvent(screen.getByText(LABEL), 'textLayout', {
    nativeEvent: { lines: [{ width: 250 }, { width: 60 }] },
  });
  const style = StyleSheet.flatten(screen.getByText(LABEL).props['style']);
  const pads = Number(style.paddingTop ?? 0) + Number(style.paddingBottom ?? 0);
  return Math.round((Number(style.minHeight) - pads) * 3);
}

describe('AppText at 200 % text on Android', () => {
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockWindow.current = { width: 411, height: 914, fontScale: 2, scale: 3 };
  });

  it('holds a wrapped label in the lines Android 14 draws, with no band below (spec 8.11)', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(35);

    // Two 43.61 dp lines (36 1/3 sp at 2.0: 38 + 6 1/3 / 70 x 62) and one pixel: 263 px, not 437.
    expect(await roomOfTwoLines()).toBe(263);
  });

  it('counts the lines linearly before Android 14, as React Native draws them there', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);

    expect(await roomOfTwoLines()).toBe(2 * 218 + 1);
  });

  it('keeps the room of a 100 % text as it was', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(35);
    mockWindow.current = { width: 411, height: 914, fontScale: 1, scale: 3 };

    expect(await roomOfTwoLines()).toBe(2 * 109 + 1);
  });
});
