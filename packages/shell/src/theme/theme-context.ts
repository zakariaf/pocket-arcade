// packages/shell/src/theme/theme-context.ts
import { createContext } from 'react';

import type { Theme } from './theme-types.ts';

export const ThemeContext = createContext<Theme | null>(null);
