// packages/shell/src/theme/theme-provider.test.tsx
import { act, screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import { useTheme } from './use-theme.ts';

import type { ReactNode } from 'react';
import type { ColorSchemeName } from 'react-native';

const mockScheme: { current: ColorSchemeName } = { current: 'light' };
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockScheme.current,
}));

function ThemeKeyProbe(): ReactNode {
  return <AppText testID="theme-probe.key" text={useTheme().key} />;
}

describe('ThemeProvider', () => {
  afterEach(() => {
    mockScheme.current = 'light';
  });

  it('switches the theme and the colour-blind colours at once (spec S11, 8.11, 8.12)', async () => {
    const { stores } = await renderWithShell(<ThemeKeyProbe />, { settings: { theme: 'light' } });
    expect(screen.getByTestId('theme-probe.key')).toHaveTextContent('standard.light');

    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-theme', theme: 'dark' });
      stores.settings.getState().dispatch({ type: 'set-color-blind', enabled: true });
    });

    expect(screen.getByTestId('theme-probe.key')).toHaveTextContent('colorBlind.dark');
  });

  it("follows the phone's colour scheme while the theme is System", async () => {
    mockScheme.current = 'dark';
    await renderWithShell(<ThemeKeyProbe />, { settings: { theme: 'system' } });
    expect(screen.getByTestId('theme-probe.key')).toHaveTextContent('standard.dark');
  });
});
