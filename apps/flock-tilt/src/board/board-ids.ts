// apps/flock-tilt/src/board/board-ids.ts
'worklet';

import type { Direction } from '@e07/flock-tilt/rules/flock-tilt-types.ts';

/** Entity of the one-per-tilt tracks (the cleared glow, the run-out fade, the continue). */
export const TURN_ENTITY = 0;

/** The fence around the field, as a share of a cell (layout keeps room for it, draw paints it). */
export const FENCE_SHARE = 0.22;

/**
 * Smallest tilt key, in points (accessibility: a 44 x 44 touch target). On a short screen, where
 * the field's cells are smaller, the keys keep this size and the field shrinks to make room.
 */
export const KEY_TARGET_PT = 44;

/** The field's grid region: taps here do nothing (swipes tilt it). */
export const FIELD_REGION = 'field';

/**
 * The four tilt keys beside the field (a tap tilts that way: VoiceOver and one-handed play).
 * The same ids as rules/intent-to-move.ts, which a board test pins.
 */
export const TILT_KEY_REGIONS: Readonly<Record<Direction, string>> = {
  up: 'tilt-up',
  right: 'tilt-right',
  down: 'tilt-down',
  left: 'tilt-left',
};

/**
 * Entity ids shared by buildTimeline (JS thread) and draw (UI thread): sheep from 100, wolves
 * from 200, never the turn entity. A 'worklet' module: the draw worklet may only call worklets.
 */
export function sheepEntity(id: number): number {
  return 100 + id;
}

export function wolfEntity(id: number): number {
  return 200 + id;
}
