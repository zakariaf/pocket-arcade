// apps/merge-siege/src/levels/merge-siege-describe.ts
// A level start as readable text for the data goldens: the wave (enemies in the level, or endless)
// and the enemy waiting to enter, then the board ('.' empty, a tile's number, 'e' and an enemy's).
import { boardText } from '@e07/merge-siege/rules/board-text.ts';
import { knobsFor } from '@e07/merge-siege/rules/merge-siege-tuning.ts';

import type { MergeSiegeState } from '@e07/merge-siege/rules/merge-siege-types.ts';

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: MergeSiegeState): string {
  const goal = knobsFor(state.difficulty).goal;
  const wave = goal === 0 ? 'endless' : String(goal);
  const next =
    state.next === null
      ? 'none'
      : `e${String(state.next.value)} in column ${String(state.next.col + 1)}`;
  return [`wave ${wave} next ${next}`, boardText(state.cells)].join('\n');
}
