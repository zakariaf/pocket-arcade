// apps/swap-guard/src/levels/swap-guard-random-play.ts
// The naive player of the level plan: it swaps at random until the run ends. A level it wins too
// often is no puzzle (level-generation-and-solvers: naive bots should lose). Pure and seeded, so the
// tables regenerate identically everywhere; it lives in levels/ because level code never imports
// the bots of testing/.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { hashU32, nextU32, seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { applyMove } from '@e07/swap-guard/rules/apply-move.ts';
import { listMoves } from '@e07/swap-guard/rules/list-moves.ts';
import { outcome } from '@e07/swap-guard/rules/outcome.ts';

import type { RngState } from '@e07/game-kit/rng/sfc32.ts';
import type { SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';

/** One random run from `start`; true when it ends won. */
function isRandomRunWon(start: SwapGuardState, rng: RngState): boolean {
  let state = start;
  let next = rng;
  while (outcome(state).kind === 'playing') {
    const moves = listMoves(state);
    const draw = nextU32(next);
    next = draw.state;
    state = applyMove(state, pickAt(moves, draw.value % moves.length)).state;
  }
  return outcome(state).kind === 'won';
}

/** How many of `runs` random runs from `start` win, each run seeded from `seed` and its index. */
export function randomWins(start: SwapGuardState, seed: number, runs: number): number {
  let wins = 0;
  for (let run = 0; run < runs; run += 1) {
    if (isRandomRunWon(start, seedRng(hashU32(seed, run)))) wins += 1;
  }
  return wins;
}
