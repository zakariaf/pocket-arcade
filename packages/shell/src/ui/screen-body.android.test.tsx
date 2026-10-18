// packages/shell/src/ui/screen-body.android.test.tsx
// Runs in the unit-android project (Platform.OS === 'android'). On Android, Fabric runs view
// commands before the mount items of the same batch, and the native ScrollView clamps scrollTo to the
// content height it has at that moment. A scrollTo sent from onContentSizeChange therefore ran before
// the content had grown, and the S10 capture asked for scrollY 768 stayed at 624 (E18-T21). The body
// scrolls one frame later, when the grown content is mounted.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Platform, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { AppText } from './app-text.tsx';
import { ScreenBody } from './screen-body.tsx';

/** The Android parity phone: 44 dp status bar (with the cutout), 24 dp gesture bar. */
const ANDROID_PHONE = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 44, left: 0, right: 0, bottom: 24 },
};

async function renderBodyScrolledTo(scrollToY: number): Promise<void> {
  await renderWithShell(
    <SafeAreaProvider initialMetrics={ANDROID_PHONE}>
      <ScreenBody testID="stats.body" scrollToY={scrollToY}>
        <AppText text="Block" />
      </ScreenBody>
    </SafeAreaProvider>,
  );
}

describe('ScreenBody on Android', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it('scrolls to the target a frame after the content grows, once it is mounted', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    await renderBodyScrolledTo(768);

    await fireEvent(screen.getByTestId('stats.body'), 'contentSizeChange', 402, 1444);
    const sentAtOnce = scrollTo.mock.calls.length;
    await act(() => {
      jest.runOnlyPendingTimers();
    });

    expect({ sentAtOnce, calls: scrollTo.mock.calls }).toStrictEqual({
      sentAtOnce: 0,
      calls: [[{ y: 768, animated: false }]],
    });
  });
});
