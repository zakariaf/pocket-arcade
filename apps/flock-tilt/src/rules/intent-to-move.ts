// apps/flock-tilt/src/rules/intent-to-move.ts
// Spec 13 controls: "swipe in 4 directions (or tap a side)". A swipe anywhere on the board tilts
// the field that way; a tap on one of the four tilt keys beside the field tilts towards that key's
// side (VoiceOver and one-handed play). Directions are physical: they never mirror in fa or ckb.
import { endedStatus } from './field-status.ts';
import { DIRECTIONS, tiltField } from './tilt-field.ts';

import type { Direction, FlockTiltMove, FlockTiltState } from './flock-tilt-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/**
 * The four tilt keys' region ids. Rules never import the board; the board's TILT_KEY_REGIONS
 * (board/board-ids.ts) is this table.
 */
export const TILT_KEY_IDS: Readonly<Record<Direction, string>> = {
  up: 'tilt-up',
  right: 'tilt-right',
  down: 'tilt-down',
  left: 'tilt-left',
};

/** The tilt a key region stands for, or null for the field and anything else. */
function keyDirection(regionId: string): Direction | null {
  return DIRECTIONS.find((direction) => TILT_KEY_IDS[direction] === regionId) ?? null;
}

/** The tilt an intent points at, before legality. */
function candidate(intent: InputIntent): Direction | null {
  switch (intent.kind) {
    case 'swipe':
      return intent.direction;
    case 'tap':
      return keyDirection(intent.target.regionId);
    case 'long-press':
    case 'drag-end':
    case 'aim':
      return null;
  }
}

/**
 * Pure: an intent becomes a legal tilt or nothing. Legality is what listMoves lists (the run is
 * not over and the tilt moves an animal), checked for this one direction only, so a tilt that
 * would move nothing and a finished run both give null.
 */
export function intentToMove(state: FlockTiltState, intent: InputIntent): FlockTiltMove | null {
  const direction = candidate(intent);
  if (direction === null) return null;
  const isLegal = endedStatus(state) === null && tiltField(state, direction).slides.length > 0;
  return isLegal ? { kind: 'tilt', direction } : null;
}
