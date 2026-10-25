// apps/stepstone/src/levels/stepstone-describe.ts
// A level start as readable text for the data goldens: par, then the pond (K king, R rook,
// B bishop, N knight, F flag, . water; the frog's stone in lower case).
import { pondText } from '@e07/stepstone/rules/pond-text.ts';

import type { StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: StepstoneState): string {
  return [`par ${String(state.par)}`, pondText(state)].join('\n');
}
