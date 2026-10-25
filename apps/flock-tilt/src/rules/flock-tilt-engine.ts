// apps/flock-tilt/src/rules/flock-tilt-engine.ts
import { buildTimeline } from '@e07/flock-tilt/board/build-timeline.ts';
import { suggestTilt } from '@e07/flock-tilt/levels/flock-tilt-solver.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome, runScore } from './outcome.ts';
import { pennedCount } from './tilt-field.ts';

import type { FlockTiltEvent, FlockTiltMove, FlockTiltState } from './flock-tilt-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules, Hud } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions, the board's pan mode and its select regions. */
export const FLOCK_TILT_ENGINE: GameEngine<FlockTiltState, FlockTiltMove, FlockTiltEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // Spec 13: swipe in 4 directions; a swipe tilts the whole field (taps reach the tilt keys).
  panMode: 'swipe',
  // Every tap acts at once: no region selects first.
  selectRegions: [],
  intentToMove,
  buildTimeline,
};

/** The top bar: the score, and the sheep in the pen out of the whole flock. */
export function flockTiltHud(state: FlockTiltState): Hud {
  const penned = pennedCount(state.sheep);
  return {
    score: runScore(state),
    goal: { id: 'flock-tilt.progress', values: { penned, total: state.sheep.length } },
  };
}

/** The rules beyond the engine: the top-bar line, undo, hints and the one continue. */
export const FLOCK_TILT_RULES: GameRules<FlockTiltState, FlockTiltMove, FlockTiltEvent> = {
  hud: flockTiltHud,
  // Undo gives the tilt back (spec 13: "40-tilt budget per field (undo gives tilts back)").
  undo: { kind: 'unlimited' },
  // A 7 x 7 field solves exactly: the hint is the first tilt of a shortest winning line.
  hints: { kind: 'solver', suggest: suggestTilt },
  // Spec 8.10: one rescue per run; the losing tilt is taken back and more tilts are added.
  continueRun: {
    kind: 'once',
    descriptionId: 'flock-tilt.continue.undo-tilt',
    apply: continueAfterLoss,
  },
};
