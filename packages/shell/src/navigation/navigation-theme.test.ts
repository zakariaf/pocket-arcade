// packages/shell/src/navigation/navigation-theme.test.ts
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';
import { createThemeSet, selectTheme } from '@e07/shell/theme/theme-set.ts';

import { toNavigationTheme } from './navigation-theme.ts';

describe('toNavigationTheme', () => {
  const themes = createThemeSet(TEST_PALETTE);

  it('paints the navigator background with the ground colour of the scheme', () => {
    const dark = selectTheme(themes, { scheme: 'dark', mode: 'standard' });
    const result = toNavigationTheme(dark);
    expect(result.dark).toBe(true);
    expect(result.colors.background).toBe(TEST_PALETTE.standard.dark.background);
  });

  it('keeps the React Navigation fonts of the light base theme', () => {
    const light = selectTheme(themes, { scheme: 'light', mode: 'standard' });
    const result = toNavigationTheme(light);
    expect(result.dark).toBe(false);
    expect(result.fonts.regular.fontWeight).toBe('400');
  });
});
