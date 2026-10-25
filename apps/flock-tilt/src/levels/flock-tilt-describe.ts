// apps/flock-tilt/src/levels/flock-tilt-describe.ts
// A level start as readable text for the data goldens: par, the flock, then the field as a map
// ('.' grass, '#' rock, 'o' the pen, 's' a sheep, 'w' a wolf).
import { fieldText } from '@e07/flock-tilt/rules/field-text.ts';

import type { FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: FlockTiltState): string {
  const header = `par ${String(state.par)} sheep ${String(state.sheep.length)} wolves ${String(state.wolves.length)}`;
  return [header, fieldText(state)].join('\n');
}
