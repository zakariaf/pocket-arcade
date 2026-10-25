// apps/stepstone/src/rules/hop-distance.ts
import { targetsOf } from './hops.ts';

import type { StepstoneState } from './stepstone-types.ts';

type Pond = Pick<StepstoneState, 'side' | 'cells' | 'frog'>;

/**
 * The fewest hops from the frog to the flag, or null when no route is left. A breadth-first walk
 * over stones: a shortest route never visits a stone twice, so stones sinking behind the frog
 * never block it, and the walk needs each stone only once.
 */
export function hopDistance(pond: Pond): number | null {
  const seen = new Set<number>([pond.frog]);
  let frontier = [pond.frog];
  for (let depth = 0; frontier.length > 0; depth += 1) {
    if (frontier.some((cell) => pond.cells[cell] === 'flag')) return depth;
    const next: number[] = [];
    for (const cell of frontier) {
      const fresh = targetsOf({ ...pond, frog: cell }).filter((target) => !seen.has(target));
      fresh.forEach((target) => seen.add(target));
      next.push(...fresh);
    }
    frontier = next;
  }
  return null;
}
