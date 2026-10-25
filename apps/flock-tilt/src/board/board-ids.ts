// apps/flock-tilt/src/board/board-ids.ts
'worklet';

import { TILT_KEY_IDS } from '@e07/flock-tilt/rules/intent-to-move.ts';

import type { Direction } from '@e07/flock-tilt/rules/flock-tilt-types.ts';

/** Entity of the one-per-tilt tracks (the cleared glow, the run-out fade, the continue). */
export const TURN_ENTITY = 0;

/** The fence around the field, as a share of a cell (layout keeps room for it, draw paints it). */
export const FENCE_SHARE = 0.22;

/** The field's grid region: taps here do nothing (swipes tilt it). */
export const FIELD_REGION = 'field';

/**
 * The four tilt keys beside the field (a tap tilts that way: VoiceOver and one-handed play).
 * The rules' own ids (rules/intent-to-move.ts), so a tapped key always tilts its own way.
 */
export const TILT_KEY_REGIONS: Readonly<Record<Direction, string>> = TILT_KEY_IDS;

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
