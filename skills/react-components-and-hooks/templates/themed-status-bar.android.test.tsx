// packages/shell/src/app/themed-status-bar.android.test.tsx
// Runs in the unit-android project (Platform.OS === 'android'). Expo's prebuild writes a
// light-content status bar (white text and icons) for the whole app, and the theme is an in-app
// setting (System, Light, Dark): on the light theme Android drew 9:41 and the icons white on the
// sky-blue ground (E18-T23). The bar follows the theme the player sees.
import { act } from '@testing-library/react-native';
import { StatusBar } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { ThemedStatusBar } from './themed-status-bar.tsx';

describe('ThemedStatusBar on Android', () => {
  it('draws dark status bar text and icons on the light theme (spec 8.11, O5)', async () => {
    const setBarStyle = jest.spyOn(StatusBar, 'setBarStyle');
    await renderWithShell(<ThemedStatusBar />, { settings: { theme: 'light' } });

    expect(setBarStyle).toHaveBeenLastCalledWith('dark-content', false);
  });

  it('draws light status bar text and icons on the dark theme', async () => {
    const setBarStyle = jest.spyOn(StatusBar, 'setBarStyle');
    await renderWithShell(<ThemedStatusBar />, { settings: { theme: 'dark' } });

    expect(setBarStyle).toHaveBeenLastCalledWith('light-content', false);
  });

  it('follows a theme change made in Settings', async () => {
    const setBarStyle = jest.spyOn(StatusBar, 'setBarStyle');
    const { stores } = await renderWithShell(<ThemedStatusBar />, { settings: { theme: 'light' } });

    await act(async () => {
      stores.settings.getState().dispatch({ type: 'set-theme', theme: 'dark' });
      await Promise.resolve();
    });

    expect(setBarStyle).toHaveBeenLastCalledWith('light-content', false);
  });
});
