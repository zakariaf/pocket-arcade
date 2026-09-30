// packages/game-kit/src/geom/board-layout.ts
import { useMemo } from 'react';

import type { Palette } from '@demo/shell/theme/theme-types.ts';

/** Layout. */
export function boardLayout(palette: Palette): unknown {
  return useMemo(() => palette, [palette]);
}
