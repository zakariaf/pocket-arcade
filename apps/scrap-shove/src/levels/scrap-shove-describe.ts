// apps/scrap-shove/src/levels/scrap-shove-describe.ts
// A level start as readable text for the data goldens: the robots by kind, the heaps, and the
// floor ('@' the player, 'n' 'f' 'h' the robots, '#' a heap).
import { boardText } from '@e07/scrap-shove/rules/board-text.ts';

import type { ScrapShoveState } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

function countOf(state: ScrapShoveState, kind: string): number {
  return state.robots.filter((robot) => robot.kind === kind).length;
}

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: ScrapShoveState): string {
  const robots = ['normal', 'fast', 'heavy'].map(
    (kind) => `${String(countOf(state, kind))} ${kind}`,
  );
  const header = `robots ${robots.join(', ')}; heaps ${String(state.heaps.length)}`;
  return [header, boardText(state, state.cols)].join('\n');
}
