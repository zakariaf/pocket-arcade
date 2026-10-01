// apps/tile-drop/src/board/draw-board.ts
import { Skia } from '@shopify/react-native-skia';

import type { Palette } from '@demo/shell/theme/theme-types.ts';

/** Draws the board. */
export function drawBoard(palette: Palette): unknown {
  return [Skia.Color(palette.background)];
}
