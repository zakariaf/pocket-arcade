// apps/jump-chain/src/rules/jump-chain-engine.ts
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { buildTimeline } from '@e07/jump-chain/board/build-timeline.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { JumpChainEvent, JumpChainMove, JumpChainState } from './jump-chain-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules, Hud } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions, the board's pan mode and its select regions. */
export const JUMP_CHAIN_ENGINE: GameEngine<JumpChainState, JumpChainMove, JumpChainEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // The piece is dragged to the square where its chain ends (a tap there plays it too).
  panMode: 'drag',
  // Every tap acts: nothing is selected first.
  selectRegions: [],
  intentToMove,
  buildTimeline,
};

/** The top bar: the score, and the enemies captured against the level's (endless: captured only). */
export function jumpChainHud(state: JumpChainState): Hud {
  const { captured } = state;
  if (isEndlessDifficulty(state.difficulty)) {
    return {
      score: state.score,
      goal: { id: 'jump-chain.progress.endless', values: { captured } },
    };
  }
  return {
    score: state.score,
    goal: { id: 'jump-chain.progress', values: { captured, total: state.total } },
  };
}

/** The rules beyond the engine: the top-bar line, undo, hints and the one continue. */
export const JUMP_CHAIN_RULES: GameRules<JumpChainState, JumpChainMove, JumpChainEvent> = {
  hud: jumpChainHud,
  // Every move is final: the march follows it at once (spec 8.5 lets a game limit undo).
  undo: { kind: 'none' },
  // No exact solver can suggest a move in a game whose endless ranks come from the RNG.
  hints: { kind: 'none' },
  // Spec 8.10: one rescue per run; the enemy ranks step back one row.
  continueRun: {
    kind: 'once',
    descriptionId: 'jump-chain.continue.step-back',
    apply: continueAfterLoss,
  },
};
