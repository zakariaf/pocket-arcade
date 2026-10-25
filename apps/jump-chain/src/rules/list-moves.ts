// apps/jump-chain/src/rules/list-moves.ts
// Every legal move in a fixed order; empty exactly when the run is over. A capture must be taken,
// as in checkers: while any jump exists only jump chains are listed (each partial chain too, so the
// player chooses where the chain stops), and steps only when no jump exists.
import { jumpChains, steps } from './jump-chains.ts';
import { outcome } from './outcome.ts';

import type { JumpChainMove, JumpChainState } from './jump-chain-types.ts';

export function listMoves(state: JumpChainState): JumpChainMove[] {
  if (outcome(state).kind !== 'playing') return [];
  const jumps = jumpChains(state);
  return jumps.length > 0 ? jumps : steps(state);
}
