// apps/line-siege/src/rules/line-siege-evaluate.ts
// How good a Line Siege position looks to a reasonable player. Lives in rules/ because both the
// bots (testing/) and the level witness (levels/) play with it, and levels may import only rules.
import type { LineSiegeState } from './line-siege-types.ts';

/** Weights of the evaluation: a defeat is worth most, then a heart; danger and crowding cost. */
const DEFEAT_WEIGHT = 100;
const HEART_WEIGHT = 60;
const DANGER_WEIGHT = 2;
const CROWDING_WEIGHT = 1;

/** How good a position looks to the bots (higher is better). */
export function evaluateLineSiege(state: LineSiegeState): number {
  const danger = state.monsters.reduce((sum, monster) => sum + (monster.row + 1) * monster.hp, 0);
  const crowding = state.cells.reduce<number>((sum, cell) => sum + cell, 0);
  const gains = state.defeated * DEFEAT_WEIGHT + state.hearts * HEART_WEIGHT;
  return gains - danger * DANGER_WEIGHT - crowding * CROWDING_WEIGHT;
}
