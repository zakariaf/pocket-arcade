// apps/snare-snake/src/rules/snare-snake-engine.ts
import { buildTimeline } from '@e07/snare-snake/board/build-timeline.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { SnareSnakeEvent, SnareSnakeMove, SnareSnakeState } from './snare-snake-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules, Hud } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions, the board's pan mode and its select regions. */
export const SNARE_SNAKE_ENGINE: GameEngine<SnareSnakeState, SnareSnakeMove, SnareSnakeEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // A swipe steers the snake one cell; a tap toward a side of the head does the same.
  panMode: 'swipe',
  // Every tap acts: nothing is selected first.
  selectRegions: [],
  intentToMove,
  buildTimeline,
};

/** The top bar: the score, and the critters caught against the level's total. */
export function snareSnakeHud(state: SnareSnakeState): Hud {
  return {
    score: state.score,
    goal: { id: 'snare-snake.progress', values: { caught: state.caught, total: state.total } },
  };
}

/** The rules beyond the engine: the top-bar line, undo, hints and the one continue. */
export const SNARE_SNAKE_RULES: GameRules<SnareSnakeState, SnareSnakeMove, SnareSnakeEvent> = {
  hud: snareSnakeHud,
  // Critters hop from the run's RNG: an undo would let a player re-roll them (design notes).
  undo: { kind: 'none' },
  // The witness is a reasonable player, not a solver, so a hint could be wrong (design notes).
  hints: { kind: 'none' },
  // Spec 8.10: one rescue per run from either loss (out of moves, or tangled).
  continueRun: {
    kind: 'once',
    descriptionId: 'snare-snake.continue.step-back',
    apply: continueAfterLoss,
  },
};
