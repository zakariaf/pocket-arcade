// apps/toggle-drop/src/rules/toggle-drop-engine.test.ts
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';
import { buildTimeline } from '@e07/toggle-drop/board/build-timeline.ts';
import { suggestDrop } from '@e07/toggle-drop/levels/toggle-drop-solver.ts';

import { intentToMove } from './intent-to-move.ts';
import { TOGGLE_DROP_ENGINE, TOGGLE_DROP_RULES } from './toggle-drop-engine.ts';
import { TOGGLE_DROP_PERSISTENCE } from './toggle-drop-persistence.ts';

import type { ToggleDropState } from './toggle-drop-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/** A tap on every cell of the grid (chute, peg rows, cups) plus one row and column outside it. */
function everyTap(state: ToggleDropState): InputIntent[] {
  const taps: InputIntent[] = [];
  for (let row = 0; row <= state.rows + 2; row += 1) {
    for (let col = 0; col <= state.cols; col += 1) {
      taps.push({ kind: 'tap', target: { regionId: 'board', col, row }, selected: null });
    }
  }
  return taps;
}

describe('TOGGLE_DROP_ENGINE', () => {
  it('keeps the engine contract over seeded random games at every difficulty band', () => {
    const problems = engineContractProblems({
      gameId: 'toggle-drop',
      engine: TOGGLE_DROP_ENGINE,
      persistence: TOGGLE_DROP_PERSISTENCE,
      starts: [0, 25, 50, 99].flatMap((difficulty) =>
        [1, 2, 3].map((seed) => ({ seed, difficulty })),
      ),
      maxMoves: 60,
      intents: everyTap,
    });
    expect(problems).toStrictEqual([]);
  });

  it('takes taps only, selects nothing first and replays drops with the board timeline', () => {
    expect(TOGGLE_DROP_ENGINE.panMode).toBe('none');
    expect(TOGGLE_DROP_ENGINE.selectRegions).toStrictEqual([]);
    expect(TOGGLE_DROP_ENGINE.intentToMove).toBe(intentToMove);
    expect(TOGGLE_DROP_ENGINE.buildTimeline).toBe(buildTimeline);
  });
});

describe('TOGGLE_DROP_RULES', () => {
  it('shows the balls left as the score and the full cups in the progress line', () => {
    const state = {
      ...TOGGLE_DROP_ENGINE.create(1, 0),
      needs: [0, 2, 0, 1, 1],
      filled: [0, 1, 0, 1, 1],
    };
    expect(TOGGLE_DROP_RULES.hud(state)).toStrictEqual({
      score: state.ballsLeft,
      goal: { id: 'toggle-drop.progress', values: { filled: 2, total: 3 } },
    });
  });

  it('undoes without limit, hints with the solver and offers no continue', () => {
    const start = TOGGLE_DROP_ENGINE.create(4, 30);
    expect(TOGGLE_DROP_RULES.undo).toStrictEqual({ kind: 'unlimited' });
    expect(TOGGLE_DROP_RULES.continueRun).toStrictEqual({ kind: 'none' });
    if (TOGGLE_DROP_RULES.hints.kind !== 'solver') throw new Error('solver hints expected');
    expect(TOGGLE_DROP_RULES.hints.suggest(start)).toStrictEqual(suggestDrop(start));
  });
});
