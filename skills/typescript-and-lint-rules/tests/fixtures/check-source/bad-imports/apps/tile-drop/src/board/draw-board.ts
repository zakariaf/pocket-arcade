// apps/tile-drop/src/board/draw-board.ts
import { applyMove } from '../rules/apply-move.ts';
import { createRng } from '@demo/game-kit/rng/sfc32';
import { toView } from './to-view';
import type { View } from '@demo/tile-drop/board/view.ts';

/** Draws. */
export function drawBoard(view: View): number {
  return createRng(1) + toView(applyMove, view);
}
