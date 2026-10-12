// packages/shell/src/navigation/navigation-theme.ts
import { DarkTheme, DefaultTheme } from '@react-navigation/native';

import type { Theme as ShellTheme } from '@e07/shell/theme/theme-types.ts';
import type { Theme as NavigationTheme } from '@react-navigation/native';

/**
 * React Navigation paints the screen container behind every route (and during a push) with
 * `colors.background`. With headerShown false the Shell draws everything else, so only the
 * ground colour matters: take it from the game's palette so dark mode never flashes white.
 * Pure: call it once per Shell theme (4 per app), never during render.
 */
export function toNavigationTheme(theme: ShellTheme): NavigationTheme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}
