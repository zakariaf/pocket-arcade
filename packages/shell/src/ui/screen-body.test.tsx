// packages/shell/src/ui/screen-body.test.tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { AppText } from './app-text.tsx';
import { ScreenBody, ScreenScrollTargetContext } from './screen-body.tsx';

import type { ScreenBodyProps } from './screen-body.tsx';

/** iPhone 16 Pro: 62 pt status bar, 34 pt home indicator. */
const PHONE_METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

type BodyStyles = {
  readonly marginTop: unknown;
  readonly paddingTop: unknown;
  readonly paddingBottom: unknown;
};

async function bodyStylesFor(
  props: Omit<ScreenBodyProps, 'children' | 'testID'>,
): Promise<BodyStyles> {
  await renderWithShell(
    <SafeAreaProvider initialMetrics={PHONE_METRICS}>
      <ScreenBody testID="home.body" {...props}>
        <AppText text="Block" />
      </ScreenBody>
    </SafeAreaProvider>,
  );
  const body = screen.getByTestId('home.body');
  const style = StyleSheet.flatten(body.props['style']);
  const content = StyleSheet.flatten(body.props['contentContainerStyle']);
  return {
    marginTop: style.marginTop,
    paddingTop: content.paddingTop,
    paddingBottom: content.paddingBottom,
  };
}

describe('ScreenBody', () => {
  it('starts under the top bar with the 6 pt top padding and leaves the home indicator to the frame', async () => {
    await expect(bodyStylesFor({})).resolves.toStrictEqual({
      marginTop: undefined,
      paddingTop: 6,
      paddingBottom: 0,
    });
  });

  it('scrolls on under the home indicator and ends with the 34 pt page padding on tall screens', async () => {
    await expect(bodyStylesFor({ isUnderHomeIndicator: true })).resolves.toMatchObject({
      paddingBottom: 34,
    });
  });

  it('moves the clip edge up for a first block that pokes into the top bar, content unmoved', async () => {
    await expect(bodyStylesFor({ hasTopOverhang: true })).resolves.toMatchObject({
      marginTop: -10,
      paddingTop: 16,
    });
  });

  it('scrolls to the target again on layout, after the insets shrink the frame', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    await bodyStylesFor({ scrollToY: 573 });
    const body = screen.getByTestId('home.body');

    await fireEvent(body, 'contentSizeChange', 402, 2074);
    await fireEvent(body, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 712 } },
    });

    expect(scrollTo.mock.calls).toStrictEqual([
      [{ y: 573, animated: false }],
      [{ y: 573, animated: false }],
    ]);
  });

  it('takes the scroll target from the test-build context when no prop is given', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    await renderWithShell(
      <ScreenScrollTargetContext value={1170}>
        <ScreenBody testID="settings.body">
          <AppText text="Block" />
        </ScreenBody>
      </ScreenScrollTargetContext>,
    );

    await fireEvent(screen.getByTestId('settings.body'), 'contentSizeChange', 402, 2074);

    expect(scrollTo).toHaveBeenCalledWith({ y: 1170, animated: false });
  });

  it('leaves a body without a scroll target where it starts', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    await bodyStylesFor({});

    await fireEvent(screen.getByTestId('home.body'), 'contentSizeChange', 402, 2074);

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
