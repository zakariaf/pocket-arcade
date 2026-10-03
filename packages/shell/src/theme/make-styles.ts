// packages/shell/src/theme/make-styles.ts
import { useTheme } from './use-theme.ts';

import type { Theme } from './theme-types.ts';

/**
 * const useStyles = makeStyles((theme) => StyleSheet.create({ ... }));
 * The factory calls StyleSheet.create itself: that keeps RN's excess-property check
 * (typos fail tsc) and the N11 / colour-literal lint selectors, which match StyleSheet.create.
 * Styles are built once per Theme object (4 per app), so their identity is stable.
 */
export function makeStyles<TStyles extends object>(
  factory: (theme: Theme) => TStyles,
): () => TStyles {
  const cache = new WeakMap<Theme, TStyles>();
  return function useStyles(): TStyles {
    const theme = useTheme();
    const cached = cache.get(theme);
    if (cached !== undefined) return cached;
    const created = factory(theme);
    cache.set(theme, created);
    return created;
  };
}
