// packages/shell/src/app/themed-status-bar.tsx
// Android: Expo's prebuild writes one light-content status bar (white text and icons) for the
// whole app, while the theme is an in-app setting (System, Light, Dark). On the light theme the
// bar drew white on the sky-blue ground (E18-T23). The bar follows the theme the player sees: dark
// text and icons on the light theme, light ones on the dark theme. iOS follows the appearance the
// ThemeProvider sets, so nothing changes there.
import { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import type { ReactNode } from 'react';

const IS_ANDROID = Platform.OS === 'android';

export function ThemedStatusBar(): ReactNode {
  const { scheme } = useTheme();
  // Allowed effect: keeps a NATIVE system (the status bar) in sync with the theme.
  useEffect(() => {
    if (IS_ANDROID)
      StatusBar.setBarStyle(scheme === 'dark' ? 'light-content' : 'dark-content', false);
  }, [scheme]);
  return null;
}
