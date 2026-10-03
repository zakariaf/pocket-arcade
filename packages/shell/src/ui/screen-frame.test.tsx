// packages/shell/src/ui/screen-frame.test.tsx
import { screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from './screen-frame.tsx';

// SafeAreaProvider renders nothing until it has metrics; tests pass the baseline phone's
// (iPhone 16 Pro: 402 x 874 pt, 62 pt status bar, 34 pt home indicator).
const PHONE_METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

describe('ScreenFrame', () => {
  it('paints the ground and carries the screen testID', async () => {
    await renderWithShell(
      <SafeAreaProvider initialMetrics={PHONE_METRICS}>
        <ScreenFrame testID="settings.screen">
          <View testID="settings.top-bar" />
        </ScreenFrame>
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('settings.screen')).toHaveStyle({
      backgroundColor: TEST_PALETTE.standard.light.background,
    });
    expect(screen.getByTestId('settings.top-bar')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.screen')).toHaveProp('edges', {
      top: 'additive',
      bottom: 'additive',
      left: 'additive',
      right: 'additive',
    });
  });

  it('leaves the home indicator to a tall body that scrolls under it', async () => {
    await renderWithShell(
      <SafeAreaProvider initialMetrics={PHONE_METRICS}>
        <ScreenFrame testID="settings.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
          <View testID="settings.top-bar" />
        </ScreenFrame>
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('settings.screen')).toHaveProp('edges', {
      top: 'additive',
      bottom: 'off',
      left: 'additive',
      right: 'additive',
    });
  });
});
