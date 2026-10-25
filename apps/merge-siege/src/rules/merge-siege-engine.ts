// apps/merge-siege/src/rules/merge-siege-engine.ts
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { buildTimeline } from '@e07/merge-siege/board/build-timeline.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { knobsFor } from './merge-siege-tuning.ts';
import { outcome } from './outcome.ts';

import type { MergeSiegeEvent, MergeSiegeMove, MergeSiegeState } from './merge-siege-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules, Hud } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions, the board's pan mode and its select regions. */
export const MERGE_SIEGE_ENGINE: GameEngine<MergeSiegeState, MergeSiegeMove, MergeSiegeEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // A 4-way swipe slides every tile (spec 13 controls); a tap on a side of the board does the same.
  panMode: 'swipe',
  // Every tap acts: no region selects first.
  selectRegions: [],
  intentToMove,
  buildTimeline,
};

/** The top bar: the score, and the smashed enemies against the wave (endless: smashed only). */
export function mergeSiegeHud(state: MergeSiegeState): Hud {
  const { smashed } = state;
  if (isEndlessDifficulty(state.difficulty)) {
    return {
      score: state.score,
      goal: { id: 'merge-siege.progress.endless', values: { smashed } },
    };
  }
  const total = knobsFor(state.difficulty).goal;
  return { score: state.score, goal: { id: 'merge-siege.progress', values: { smashed, total } } };
}

/** The rules beyond the engine: the top-bar line, undo, hints and the one continue. */
export const MERGE_SIEGE_RULES: GameRules<MergeSiegeState, MergeSiegeMove, MergeSiegeEvent> = {
  hud: mergeSiegeHud,
  // Every move is final (design notes, Undo): the future is drawn from the seed.
  undo: { kind: 'none' },
  // No exact solver can suggest a move in a game that draws its future from the RNG.
  hints: { kind: 'none' },
  // Spec 8.10: one rescue per run: every enemy is pushed back one row.
  continueRun: {
    kind: 'once',
    descriptionId: 'merge-siege.continue.push-back',
    apply: continueAfterLoss,
  },
};
