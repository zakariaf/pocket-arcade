// apps/toggle-drop/src/rules/toggle-drop-engine.ts
import { buildTimeline } from '@e07/toggle-drop/board/build-timeline.ts';
import { suggestDrop } from '@e07/toggle-drop/levels/toggle-drop-solver.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { cupColumns, fullCupCount } from './cups.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { ToggleDropEvent, ToggleDropMove, ToggleDropState } from './toggle-drop-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions and the board's pan mode. Assembly only. */
export const TOGGLE_DROP_ENGINE: GameEngine<ToggleDropState, ToggleDropMove, ToggleDropEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // Taps only: a tap on a column drops a ball there.
  panMode: 'none',
  // Every tap acts: nothing is selected first.
  selectRegions: [],
  intentToMove,
  buildTimeline,
};

/** The rules beyond the engine: the top bar, unlimited undo, solver hints and no continue. */
export const TOGGLE_DROP_RULES: GameRules<ToggleDropState, ToggleDropMove, ToggleDropEvent> = {
  // The top bar's number is the balls left; the goal line counts the full cups (the daily's line).
  hud: (state) => ({
    score: state.ballsLeft,
    goal: {
      id: 'toggle-drop.progress',
      values: { filled: fullCupCount(state), total: cupColumns(state).length },
    },
  }),
  undo: { kind: 'unlimited' },
  // The first drop of a shortest winning line from here (none on a won, lost or lost-cause board).
  hints: { kind: 'solver', suggest: suggestDrop },
  // A puzzle with unlimited undo: a rescue would add nothing (design notes, section 9).
  continueRun: { kind: 'none' },
};
