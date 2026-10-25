// apps/snare-snake/src/rules/list-moves.ts
// Spec 10 RULES "The list of moves allowed in a state": the directions the head may take, in the
// fixed order up, right, down, left (bots, solvers and replays depend on it); none once it is over.
import { outcome } from './outcome.ts';
import { openDirections } from './steering.ts';

import type { SnareSnakeMove, SnareSnakeState } from './snare-snake-types.ts';

export function listMoves(state: SnareSnakeState): SnareSnakeMove[] {
  if (outcome(state).kind !== 'playing') return [];
  return openDirections(state).map((direction) => ({ kind: 'steer', direction }));
}
