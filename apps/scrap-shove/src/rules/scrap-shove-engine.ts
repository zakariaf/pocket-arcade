// apps/scrap-shove/src/rules/scrap-shove-engine.ts
import { buildTimeline } from '@e07/scrap-shove/board/build-timeline.ts';

import { applyMove } from './apply-move.ts';
import { continueRun } from './continue-run.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome, robotsScrapped } from './outcome.ts';
import { TUNING } from './scrap-shove-tuning.ts';
import { suggestMove } from './suggest-move.ts';

import type { ScrapShoveEvent, ScrapShoveMove, ScrapShoveState } from './scrap-shove-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules, Hud } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions and the board's pan mode. Assembly only. */
export const SCRAP_SHOVE_ENGINE: GameEngine<ScrapShoveState, ScrapShoveMove, ScrapShoveEvent> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // Taps only: a tap next to the player steps or shoves, a tap on the player waits.
  panMode: 'none',
  // Every tap acts: no region selects first.
  selectRegions: [],
  intentToMove,
  buildTimeline,
};

/** The top bar: the points so far, and the robots scrapped against the robots on the floor. */
export function scrapShoveHud(state: ScrapShoveState): Hud {
  const wrecked = robotsScrapped(state);
  return {
    score: wrecked * TUNING.pointsPerRobot,
    goal: { id: 'scrap-shove.progress', values: { wrecked, total: state.robotsTotal } },
  };
}

/** The rules beyond the engine: the top-bar line, undo, hints and the one continue. */
export const SCRAP_SHOVE_RULES: GameRules<ScrapShoveState, ScrapShoveMove, ScrapShoveEvent> = {
  hud: scrapShoveHud,
  // A puzzle: every step can be taken back (8.5).
  undo: { kind: 'unlimited' },
  // The solver searches the floor from where the player stands (8.5: solver hints).
  hints: { kind: 'solver', suggest: suggestMove },
  // Spec 8.10: one continue per run; the step that let the robot reach the player is undone.
  continueRun: {
    kind: 'once',
    descriptionId: 'scrap-shove.continue.step-back',
    apply: continueRun,
  },
};
