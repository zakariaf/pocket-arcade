// apps/trail-clear/src/rules/trail-clear-engine.test.ts
// Spec 10 (the game contract): the engine is the six pure functions, the board's pan mode and its
// select regions; spec 8.5 (no undo, no hints for this game, L8) and 8.10 (one continue that clears
// the oldest row of tiles).
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';
import { buildTimeline } from '@e07/trail-clear/board/build-timeline.ts';

import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { TRAIL_CLEAR_ENGINE, TRAIL_CLEAR_RULES } from './trail-clear-engine.ts';
import { TRAIL_CLEAR_PERSISTENCE } from './trail-clear-persistence.ts';
import { knobsFor } from './trail-clear-tuning.ts';

import type { TrailClearState } from './trail-clear-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/** A drag from every tray slot to every cell, and a tap on every cell: each move must be legal. */
function everyIntent(_state: TrailClearState): InputIntent[] {
  const cells = Array.from({ length: 25 }, (_, index) => ({
    regionId: 'board',
    col: index % 5,
    row: Math.floor(index / 5),
  }));
  const slots = [0, 1, 2, 3].map((col) => ({ regionId: 'tray', col, row: 0 }));
  return [
    ...slots.flatMap((from) => cells.map((to): InputIntent => ({ kind: 'drag-end', from, to }))),
    ...cells.map((target): InputIntent => ({ kind: 'tap', target, selected: null })),
    ...slots.map((target): InputIntent => ({ kind: 'tap', target, selected: null })),
  ];
}

describe('TRAIL_CLEAR_ENGINE', () => {
  it('keeps the engine contract over seeded games at every level row and endless', () => {
    const problems = engineContractProblems({
      gameId: 'trail-clear',
      engine: TRAIL_CLEAR_ENGINE,
      persistence: TRAIL_CLEAR_PERSISTENCE,
      starts: [0, 25, 50, 99, ENDLESS_DIFFICULTY].flatMap((difficulty) =>
        [1, 2].map((seed) => ({ seed, difficulty })),
      ),
      maxMoves: 40,
      intents: everyIntent,
      endless: { kind: 'endless', difficulty: ENDLESS_DIFFICULTY },
    });
    expect(problems).toStrictEqual([]);
  });

  it('names the drag, the tray as its select region, intentToMove and the timeline', () => {
    expect([
      TRAIL_CLEAR_ENGINE.panMode,
      TRAIL_CLEAR_ENGINE.selectRegions,
      TRAIL_CLEAR_ENGINE.intentToMove === intentToMove,
      TRAIL_CLEAR_ENGINE.buildTimeline === buildTimeline,
    ]).toStrictEqual(['drag', ['tray'], true, true]);
  });

  it('shows the score and the tiles placed against the bag in the top bar', () => {
    const state = { ...create(1, 0), placements: 7, score: 120 };
    expect(TRAIL_CLEAR_RULES.hud(state)).toStrictEqual({
      score: 120,
      goal: { id: 'trail-clear.progress', values: { placed: 7, total: knobsFor(0).bag } },
    });
  });

  it('counts only the tiles placed in the endless run, whose bag never empties', () => {
    const state = { ...create(1, ENDLESS_DIFFICULTY), placements: 41, score: 990 };
    expect(TRAIL_CLEAR_RULES.hud(state)).toStrictEqual({
      score: 990,
      goal: { id: 'trail-clear.progress.endless', values: { placed: 41 } },
    });
  });

  it('has no undo and no hints, and one continue that clears the oldest row (spec 8.5, 8.10)', () => {
    const { continueRun } = TRAIL_CLEAR_RULES;
    expect([
      TRAIL_CLEAR_RULES.undo,
      TRAIL_CLEAR_RULES.hints,
      continueRun.kind,
      continueRun.kind === 'once' ? continueRun.descriptionId : null,
      continueRun.kind === 'once' ? continueRun.apply === continueAfterLoss : null,
    ]).toStrictEqual([
      { kind: 'none' },
      { kind: 'none' },
      'once',
      'trail-clear.continue.clear-row',
      true,
    ]);
  });
});
