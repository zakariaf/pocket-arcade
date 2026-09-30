// packages/shell/src/screens/levels/tile-width.ts
import { CONTENT_MAX_WIDTH, LAYOUT } from '@e07/shell/theme/tokens.ts';

/** S8's grid: six columns 8 pt apart. */
export const LEVEL_COLUMNS = 6;
export const LEVEL_COLUMN_GAP = 8;

/**
 * One level tile's width: six equal columns inside the body, floored to the device pixel grid
 * (useWindowDimensions().scale), never to whole points. 53.67 pt on a 402 pt phone at 3x, as the
 * design's grid; whole points (53) put tiles 5, 6, 11 ... up to 4 pt off.
 */
export function tileWidthFor(windowWidth: number, pixelRatio: number): number {
  const body = Math.min(windowWidth, CONTENT_MAX_WIDTH) - 2 * LAYOUT.screenGutter;
  const column = (body - (LEVEL_COLUMNS - 1) * LEVEL_COLUMN_GAP) / LEVEL_COLUMNS;
  return Math.floor(column * pixelRatio) / pixelRatio;
}
