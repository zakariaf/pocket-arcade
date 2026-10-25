// apps/stepstone/src/rules/stepstone-engine.ts
import { buildTimeline } from '@e07/stepstone/board/build-timeline.ts';
import { suggestHop } from '@e07/stepstone/levels/stepstone-solver.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { StepstoneEvent, StepstoneMove, StepstoneState } from './stepstone-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions and the board's pan mode. Assembly only. */
export const STEPSTONE_ENGINE: GameEngine<StepstoneState, StepstoneMove, StepstoneEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // Taps only: a tap on a stone in reach hops there; the board sends no pan intents.
  panMode: 'none',
  // Every tap acts: no region selects first.
  selectRegions: [],
  intentToMove,
  buildTimeline,
};

/**
 * The rules beyond the engine: the top bar shows "Moves n / par p" with the hops as the score,
 * undo is unlimited, the hint is the solver's next hop (spec 8.5: 1 free a day, then a rewarded
 * ad, free with Premium) and there is no continue (spec 8.10, L11: undo is the way out).
 */
export const STEPSTONE_RULES: GameRules<StepstoneState, StepstoneMove, StepstoneEvent> = {
  hud: (state) => ({
    score: state.moves,
    goal: { id: 'stepstone.progress', values: { moves: state.moves, par: state.par } },
  }),
  undo: { kind: 'unlimited' },
  hints: { kind: 'solver', suggest: suggestHop },
  continueRun: { kind: 'none' },
};
