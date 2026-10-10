// packages/shell/src/theme/theme-provider.tsx
import { useEffect } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { selectThemePreference } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { ThemeContext } from './theme-context.ts';
import { resolveColorScheme, selectTheme } from './theme-set.ts';

import type { ThemeSet } from './theme-set.ts';
import type { ReactNode } from 'react';

export type ThemeProviderProps = { readonly themes: ThemeSet; readonly children: ReactNode };

export function ThemeProvider({ themes, children }: ThemeProviderProps): ReactNode {
  const preference = useSettingsStore(selectThemePreference);
  const isColorBlind = useSettingsStore((state) => state.settings.colorBlind);
  const systemScheme = useColorScheme();

  // Allowed effect: keeps a NATIVE system (alerts, pickers, consent form) in sync.
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const theme = selectTheme(themes, {
    scheme: resolveColorScheme(preference, systemScheme),
    mode: isColorBlind ? 'colorBlind' : 'standard',
  });
  return <ThemeContext value={theme}>{children}</ThemeContext>;
}
