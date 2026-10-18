// packages/shell/src/app/shell-providers.android.test.tsx
// Runs in the unit-android project: the provider stack draws the status bar in the theme's
// colours (dark text and icons on the light theme, E18-T23).
import { render } from '@testing-library/react-native';
import { StatusBar, View } from 'react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';
import { createThemeSet } from '@e07/shell/theme/theme-set.ts';

import { ShellProviders } from './shell-providers.tsx';

jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

describe('ShellProviders on Android', () => {
  it('draws the status bar for the light theme the player chose (spec 8.11, O5)', async () => {
    const setBarStyle = jest.spyOn(StatusBar, 'setBarStyle');
    const { wrapper } = createShellWrapper({ settings: { theme: 'light' } });
    await render(
      <ShellProviders
        themes={createThemeSet(TEST_PALETTE)}
        onError={jest.fn()}
        renderFallback={() => <View />}
      >
        <View />
      </ShellProviders>,
      { wrapper },
    );

    expect(setBarStyle).toHaveBeenLastCalledWith('dark-content', false);
  });
});
