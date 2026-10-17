// packages/shell/src/ui/quiet-button.android.test.tsx
// Runs in the unit-android project. Spec 8.11: text grows up to 200 %. Android 14 and later draw
// the nudge's 15 sp Rubik on its 18 2/3 sp line along AOSP's font scale curve (27 dp on a 31 1/3
// dp line at 2.0), so the drawn underline follows that size, not twice the 100 % one.
import { fireEvent, screen } from '@testing-library/react-native';
import { PixelRatio, Platform, StyleSheet } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { QuietButton } from './quiet-button.tsx';

import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

const mockWindow: { current: WindowMetrics } = {
  current: { width: 411, height: 914, fontScale: 2, scale: 3 },
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

/** The underline bar under a one-line "Restore purchase": its top in pixels at 3x, its height. */
async function barTop(): Promise<{ readonly top: number; readonly height: unknown } | null> {
  const text = 'Restore purchase';
  await renderWithShell(
    <QuietButton
      label={text}
      icon="restore"
      onPress={jest.fn()}
      testID="premium.restore-button"
      isReducedMotion
    />,
  );
  await fireEvent(screen.getByText(text).parent ?? screen.getByText(text), 'layout', {
    nativeEvent: { layout: { width: 260, height: 32 } },
  });
  await fireEvent(screen.getByText(text), 'textLayout', {
    nativeEvent: { lines: [{ x: 0, y: 0, width: 260, height: 32, text }] },
  });
  const bars = (screen.getByText(text).parent?.children ?? []).filter(
    (child) => typeof child !== 'string' && child.props['accessibilityElementsHidden'] === true,
  );
  const [bar] = bars;
  if (typeof bar === 'string' || bar === undefined) return null;
  const style = StyleSheet.flatten(bar.props['style']);
  return { top: Math.round(Number(style.top) * 3), height: style.height };
}

describe('QuietButton at 200 % text on Android', () => {
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('draws the underline where Android 14 draws the label (spec 8.11)', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(35);

    // Rubik 27 on a 31 1/3 line: ascent 25, descent 7, so (31 1/3 - 32) / 2 + 25 + 5 = 29 2/3.
    expect(await barTop()).toStrictEqual({ top: 89, height: 2 });
  });

  it('draws it at twice the 100 % size before Android 14', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);

    // Rubik 30 on a 37 1/3 line: ascent 28, descent 8, so (37 1/3 - 36) / 2 + 28 + 5 = 33 2/3.
    expect(await barTop()).toStrictEqual({ top: 101, height: 2 });
  });
});
