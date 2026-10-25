// apps/trail-clear/src/rules/trail-clear-engine.ts
// Spec 10 (the game contract): the engine and the rules beyond it, assembled from the pure parts.
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { buildTimeline } from '@e07/trail-clear/board/build-timeline.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { TRAIL_CLEAR_SELECT_REGIONS, intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { knobsFor } from './trail-clear-tuning.ts';

import type { TrailClearEvent, TrailClearMove, TrailClearState } from './trail-clear-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules, Hud } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions, the board's pan mode and its select regions. */
export const TRAIL_CLEAR_ENGINE: GameEngine<TrailClearState, TrailClearMove, TrailClearEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // The offered tile is dragged from its tray slot (one per turn) onto the board (spec 13).
  panMode: 'drag',
  // Tap-then-tap: a tray tap selects a turn (UI state), the next board tap places it.
  selectRegions: TRAIL_CLEAR_SELECT_REGIONS,
  intentToMove,
  buildTimeline,
};

/** The top bar: the score, and the tiles placed against the bag (endless: placed only). */
export function trailClearHud(state: TrailClearState): Hud {
  const placed = state.placements;
  if (isEndlessDifficulty(state.difficulty)) {
    return { score: state.score, goal: { id: 'trail-clear.progress.endless', values: { placed } } };
  }
  const total = knobsFor(state.difficulty).bag;
  return { score: state.score, goal: { id: 'trail-clear.progress', values: { placed, total } } };
}

/** The rules beyond the engine: the top-bar line, undo, hints and the one continue. */
export const TRAIL_CLEAR_RULES: GameRules<TrailClearState, TrailClearMove, TrailClearEvent> = {
  hud: trailClearHud,
  // Every placement is final: the next tile is drawn from the seed (design notes 7).
  undo: { kind: 'none' },
  // No exact solver can suggest a move in a game that draws its future from the RNG (L8).
  hints: { kind: 'none' },
  // Spec 8.10: one rescue per run; the oldest row of tiles is cleared.
  continueRun: {
    kind: 'once',
    descriptionId: 'trail-clear.continue.clear-row',
    apply: continueAfterLoss,
  },
};
