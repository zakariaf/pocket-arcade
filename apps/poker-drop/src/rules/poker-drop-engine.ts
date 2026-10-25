// apps/poker-drop/src/rules/poker-drop-engine.ts
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { buildTimeline } from '@e07/poker-drop/board/build-timeline.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { PokerDropEvent, PokerDropMove, PokerDropState } from './poker-drop-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules, Hud } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions, the board's pan mode and its select regions. */
export const POKER_DROP_ENGINE: GameEngine<PokerDropState, PokerDropMove, PokerDropEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // Taps only: a tap on a column drops the card in hand into it (design notes 3).
  panMode: 'none',
  // Every tap acts: no region selects first.
  selectRegions: [],
  intentToMove,
  buildTimeline,
};

/** The top bar: the score, and the hands made against the level's goal (endless: made only). */
export function pokerDropHud(state: PokerDropState): Hud {
  const made = state.handsMade;
  if (isEndlessDifficulty(state.difficulty)) {
    return { score: state.score, goal: { id: 'poker-drop.progress.endless', values: { made } } };
  }
  return {
    score: state.score,
    goal: { id: 'poker-drop.progress', values: { made, total: state.goal } },
  };
}

/** The rules beyond the engine: the top-bar line, undo, hints and the one continue. */
export const POKER_DROP_RULES: GameRules<PokerDropState, PokerDropMove, PokerDropEvent> = {
  hud: pokerDropHud,
  // Every drop is final: the next card is visible, and the score stays honest (design notes 7).
  undo: { kind: 'none' },
  // The witness bot's move is a greedy guess, not a solver's proven move (design notes 8).
  hints: { kind: 'none' },
  // Spec 8.10: one continue per run; it clears the top row of the full well (design notes 9).
  continueRun: {
    kind: 'once',
    descriptionId: 'poker-drop.continue.clear-top',
    apply: continueAfterLoss,
  },
};
