// apps/line-siege/src/rules/line-siege-engine.ts
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { buildTimeline } from '@e07/line-siege/board/build-timeline.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { LINE_SIEGE_SELECT_REGIONS, intentToMove } from './intent-to-move.ts';
import { knobsFor } from './line-siege-tuning.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { LineSiegeEvent, LineSiegeMove, LineSiegeState } from './line-siege-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules, Hud } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions, the board's pan mode and its select regions. */
export const LINE_SIEGE_ENGINE: GameEngine<LineSiegeState, LineSiegeMove, LineSiegeEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // A block is dragged from its tray slot onto the board (spec 13 controls).
  panMode: 'drag',
  // Tap-then-tap: a tray tap selects a slot (UI state), the next board tap places its block.
  selectRegions: LINE_SIEGE_SELECT_REGIONS,
  intentToMove,
  buildTimeline,
};

/** The top bar: the score, and the monsters defeated against the wave (endless: defeated only). */
export function lineSiegeHud(state: LineSiegeState): Hud {
  const { defeated } = state;
  if (isEndlessDifficulty(state.difficulty)) {
    return {
      score: state.score,
      goal: { id: 'line-siege.progress.endless', values: { defeated } },
    };
  }
  const total = knobsFor(state.difficulty).goal;
  return { score: state.score, goal: { id: 'line-siege.progress', values: { defeated, total } } };
}

/** The rules beyond the engine: the top-bar line, undo, hints and the one continue. */
export const LINE_SIEGE_RULES: GameRules<LineSiegeState, LineSiegeMove, LineSiegeEvent> = {
  hud: lineSiegeHud,
  undo: { kind: 'unlimited' },
  // No exact solver can suggest a move in a game that draws its future from the RNG.
  hints: { kind: 'none' },
  // Spec 8.10: one rescue per run from either loss (a breach or a full board).
  continueRun: {
    kind: 'once',
    descriptionId: 'line-siege.continue.push-back',
    apply: continueAfterLoss,
  },
};
