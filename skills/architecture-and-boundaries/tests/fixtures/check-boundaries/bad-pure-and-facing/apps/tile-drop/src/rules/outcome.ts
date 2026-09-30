// apps/tile-drop/src/rules/outcome.ts
import { Platform } from 'react-native';

import { drawBoard } from '@demo/tile-drop/board/draw-board.ts';

/** Outcome. */
export function outcome(): unknown {
  return [Platform.OS, drawBoard];
}
