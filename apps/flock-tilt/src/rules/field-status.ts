// apps/flock-tilt/src/rules/field-status.ts
import { DIRECTIONS, tiltField } from './tilt-field.ts';

import type { Field } from './flock-tilt-types.ts';

/** How a run stands: still playing, won, or lost one of the two ways. */
export type FieldStatus = 'playing' | 'won' | 'wolf-got-sheep' | 'out-of-tilts';

/** The part of the state the status reads. */
export type StatusInput = Field & { readonly tilts: number; readonly tiltLimit: number };

/** True when at least one tilt would move an animal (stops at the first one that does). */
export function hasAnyTilt(field: Field): boolean {
  return DIRECTIONS.some((direction) => tiltField(field, direction).slides.length > 0);
}

/** The ends that need no tilt to be tried (won, a lost sheep, a spent budget), else null. */
export function endedStatus(input: StatusInput): Exclude<FieldStatus, 'playing'> | null {
  if (input.sheep.every((sheep) => sheep.status === 'penned')) return 'won';
  if (input.sheep.some((sheep) => sheep.status === 'lost')) return 'wolf-got-sheep';
  return input.tilts >= input.tiltLimit ? 'out-of-tilts' : null;
}

/**
 * Won beats lost (the last sheep can drop in on the last tilt); a lost sheep beats a spent
 * budget; a field where no tilt moves anything has no tilts left either, so a run always ends.
 */
export function fieldStatus(input: StatusInput): FieldStatus {
  const ended = endedStatus(input);
  if (ended !== null) return ended;
  return hasAnyTilt(input) ? 'playing' : 'out-of-tilts';
}
