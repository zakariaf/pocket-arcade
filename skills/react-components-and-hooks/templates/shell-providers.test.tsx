// packages/shell/src/app/shell-providers.test.tsx
import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, View } from 'react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';
import { createThemeSet } from '@e07/shell/theme/theme-set.ts';

import { ShellProviders } from './shell-providers.tsx';
import { systemA11yStore } from './system-a11y-store.ts';

import type { ReactNode } from 'react';

// The real SafeAreaProvider renders nothing until native code reports the window metrics; the
// library's own Jest mock provides them.
jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const THEMES = createThemeSet(TEST_PALETTE);

function Crash(): ReactNode {
  throw new Error('board exploded');
}

/** The stores and i18n come from outside ShellProviders (the composition root nests them so). */
async function mount(children: ReactNode) {
  const onError = jest.fn();
  const { wrapper } = createShellWrapper();
  const view = await render(
    <ShellProviders
      themes={THEMES}
      onError={onError}
      renderFallback={() => <View testID="crash.screen" />}
    >
      {children}
    </ShellProviders>,
    { wrapper },
  );
  return { view, onError };
}

describe('ShellProviders', () => {
  it('renders the app inside the root providers', async () => {
    await mount(<View testID="home.screen" />);
    expect(screen.getByTestId('home.screen')).toBeOnTheScreen();
  });

  it('shows the crash fallback and logs the error when a screen throws', async () => {
    // React logs caught render errors to console.error; keep the test output readable.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { onError } = await mount(<Crash />);
    expect(screen.getByTestId('crash.screen')).toBeOnTheScreen();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'board exploded' }),
      expect.any(String),
    );
  });

  it('mirrors the phone accessibility switches while mounted and stops on unmount', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove });
    const { view } = await mount(<View testID="home.screen" />);
    expect(systemA11yStore.getState().isReduceMotionOn).toBe(true);

    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
