// packages/shell/src/game-host/pan-intent.ts
'worklet';

import { hitTest } from '@e07/game-kit/geom/board-layout.ts';
import { classifySwipe } from '@e07/game-kit/geom/classify-swipe.ts';

import type { PointerSample } from './board-types.ts';
import type { PanMode } from '@e07/game-kit/contract/game-engine.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';

/**
 * How a game uses pan gestures: 'none' | 'swipe' | 'drag' | 'aim'. The game declares it once as
 * GameEngine.panMode (the game-kit contract); it is re-exported here so the gesture files keep
 * one import and the Shell never declares a second copy of the union.
 */
export type { PanMode } from '@e07/game-kit/contract/game-engine.ts';

/** Extra hit area (pt) around regions, so edge taps still land (touch targets are at least 44 pt). */
export const HIT_SLOP = 8;

type Point = { readonly x: number; readonly y: number };

/**
 * The point a drag aims at: `dragLiftPt` above the finger, so the thumb does not hide the ghost.
 * Applied once, here in the gesture layer, to the hover, the drawn ghost and the drop target alike;
 * intentToMove and draw() never add a lift of their own.
 */
export function liftedPoint(point: Point, dragLiftPt: number): Point {
  return { x: point.x, y: point.y - dragLiftPt };
}

export type PanRelease = {
  readonly x: number;
  readonly y: number;
  readonly translationX: number;
  readonly translationY: number;
  readonly velocityX: number;
  readonly velocityY: number;
};

export type PanIntentInput = {
  readonly mode: PanMode;
  readonly pointer: PointerSample;
  readonly release: PanRelease;
  readonly layout: BoardLayout;
  /** Lift of the drag pointer above the finger, in points (GameBoard.dragLiftPt, default 0). */
  readonly dragLiftPt: number;
};

/** Turns a finished pan into at most ONE intent, so a gesture can never produce two moves. */
export function panIntent(input: PanIntentInput): InputIntent | null {
  const { mode, pointer, release, layout, dragLiftPt } = input;
  switch (mode) {
    case 'none':
      return null;
    case 'swipe': {
      const swipe = {
        dx: release.translationX,
        dy: release.translationY,
        vx: release.velocityX,
        vy: release.velocityY,
      };
      const direction = classifySwipe(swipe);
      return direction === null ? null : { kind: 'swipe', direction, from: pointer.dragFrom };
    }
    case 'drag':
      return pointer.dragFrom === null
        ? null
        : {
            kind: 'drag-end',
            from: pointer.dragFrom,
            to: hitTest(layout, liftedPoint(release, dragLiftPt), HIT_SLOP),
          };
    case 'aim':
      return { kind: 'aim', dx: release.translationX, dy: release.translationY };
  }
}
