// packages/shell/src/app/themed-status-bar.test.tsx
// iOS draws the status bar from the appearance ThemeProvider sets; ThemedStatusBar leaves it be.
import { StatusBar } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { ThemedStatusBar } from './themed-status-bar.tsx';

describe('ThemedStatusBar on iOS', () => {
  it('leaves the status bar to the system appearance', async () => {
    const setBarStyle = jest.spyOn(StatusBar, 'setBarStyle');
    await renderWithShell(<ThemedStatusBar />, { settings: { theme: 'light' } });

    expect(setBarStyle).not.toHaveBeenCalled();
  });
});
