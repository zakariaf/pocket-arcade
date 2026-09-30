// apps/__GAME_ID__/src/rules/__GAME_ID__-engine.ts
import { buildTimeline } from '@e07/__GAME_ID__/board/build-timeline.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { TUNING } from './__GAME_ID__-tuning.ts';

import type {
  __GAME_PASCAL__Event,
  __GAME_PASCAL__Move,
  __GAME_PASCAL__State,
} from './__GAME_ID__-types.ts';
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules } from '@e07/game-kit/contract/game-rules.ts';

/** The engine members: six pure functions and the board's pan mode. Assembly only. */
export const __GAME_CONST___ENGINE: GameEngine<
  __GAME_PASCAL__State,
  __GAME_PASCAL__Move,
  __GAME_PASCAL__Event
> = {
  create,
  listMoves,
  applyMove,
  outcome,
  // Taps only: the board sends no pan intents ('swipe', 'drag' or 'aim' for games that use them).
  panMode: 'none',
  // Every tap acts: no region selects first (Line Siege's tray does: ['tray']).
  selectRegions: [],
  intentToMove,
  buildTimeline,
};

/** The rules beyond the engine: the top-bar line, undo, hints and the one continue. */
export const __GAME_CONST___RULES: GameRules<
  __GAME_PASCAL__State,
  __GAME_PASCAL__Move,
  __GAME_PASCAL__Event
> = {
  hud: (state) => ({
    score: 0,
    goal: {
      id: '__GAME_ID__.hud.moves',
      values: { moves: state.moves, maxMoves: state.maxMoves },
    },
  }),
  undo: { kind: 'unlimited' },
  hints: { kind: 'none' },
  continueRun: {
    kind: 'once',
    descriptionId: '__GAME_ID__.continue.more-moves',
    apply: (lost) => ({
      state: { ...lost, maxMoves: lost.moves + TUNING.continueMoves },
      events: [{ kind: 'moves-added', count: TUNING.continueMoves }],
    }),
  },
};
