// apps/swap-guard/src/rules/swap-guard-engine.ts
import { buildTimeline } from '@e07/swap-guard/board/build-timeline.ts';
import { suggestSwap } from '@e07/swap-guard/levels/swap-guard-solver.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { SwapGuardEvent, SwapGuardMove, SwapGuardState } from './swap-guard-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules, Hud } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions, the board's pan mode and its select regions. */
export const SWAP_GUARD_ENGINE: GameEngine<SwapGuardState, SwapGuardMove, SwapGuardEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // Taps only: a tap on a square next to the guard swaps with it.
  panMode: 'none',
  // Every tap acts: nothing is selected first.
  selectRegions: [],
  intentToMove,
  buildTimeline,
};

/** The top bar: the score, and the enemies knocked out against the level's total. */
export function swapGuardHud(state: SwapGuardState): Hud {
  const defeated = state.enemyCount - state.enemies.length;
  return {
    score: state.score,
    goal: { id: 'swap-guard.progress', values: { defeated, total: state.enemyCount } },
  };
}

/** The rules beyond the engine: the top-bar line, undo, hints and the one continue. */
export const SWAP_GUARD_RULES: GameRules<SwapGuardState, SwapGuardMove, SwapGuardEvent> = {
  hud: swapGuardHud,
  // Nothing is drawn after create: an undo re-rolls nothing (spec 8.5, unlimited in puzzles).
  undo: { kind: 'unlimited' },
  // The planned line's next swap keeps the level winnable (8.5: solver hints).
  hints: { kind: 'solver', suggest: suggestSwap },
  // Spec 8.10: one continue per run; the losing swap is taken back.
  continueRun: {
    kind: 'once',
    descriptionId: 'swap-guard.continue.swap-back',
    apply: continueAfterLoss,
  },
};
