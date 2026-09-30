// packages/shell/src/theme/use-theme.ts
import { use } from 'react';

import { ThemeContext } from './theme-context.ts';

import type { Theme } from './theme-types.ts';

export function useTheme(): Theme {
  const theme = use(ThemeContext);
  if (theme === null) throw new Error('useTheme() outside ThemeProvider');
  return theme;
}
