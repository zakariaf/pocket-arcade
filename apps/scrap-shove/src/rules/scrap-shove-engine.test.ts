// apps/scrap-shove/src/rules/scrap-shove-engine.test.ts
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';
import { buildTimeline } from '@e07/scrap-shove/board/build-timeline.ts';

import { applyMove } from './apply-move.ts';
import { stateFromText } from './board-text.ts';
import { intentToMove } from './intent-to-move.ts';
import { SCRAP_SHOVE_ENGINE, SCRAP_SHOVE_RULES } from './scrap-shove-engine.ts';
import { SCRAP_SHOVE_PERSISTENCE } from './scrap-shove-persistence.ts';

import type { ScrapShoveState } from './scrap-shove-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/** A tap on every square of the floor plus a row and a column outside it. */
function everyTap(state: ScrapShoveState): InputIntent[] {
  const taps: InputIntent[] = [];
  for (let row = -1; row <= state.rows; row += 1) {
    for (let col = -1; col <= state.cols; col += 1) {
      taps.push({ kind: 'tap', target: { regionId: 'board', col, row }, selected: null });
    }
  }
  return taps;
}

describe('SCRAP_SHOVE_ENGINE', () => {
  it('keeps the engine contract over seeded games at every level row', () => {
    const problems = engineContractProblems({
      gameId: 'scrap-shove',
      engine: SCRAP_SHOVE_ENGINE,
      persistence: SCRAP_SHOVE_PERSISTENCE,
      starts: [0, 25, 50, 75, 100].flatMap((difficulty) =>
        [1, 2].map((seed) => ({ seed, difficulty })),
      ),
      maxMoves: 40,
      intents: everyTap,
    });
    expect(problems).toStrictEqual([]);
  });

  it("is played with taps only, through the game's own intentToMove and timeline", () => {
    expect(SCRAP_SHOVE_ENGINE).toMatchObject({
      panMode: 'none',
      selectRegions: [],
      intentToMove,
      buildTimeline,
    });
  });
});

describe('SCRAP_SHOVE_RULES', () => {
  it('shows the points and the robots scrapped against the robots on the floor in the top bar', () => {
    const start = stateFromText(['n.n.', '....', '....', '.@.n']);
    const { state } = applyMove(start, { kind: 'wait' });
    expect(SCRAP_SHOVE_RULES.hud(state)).toStrictEqual({
      score: 20,
      goal: { id: 'scrap-shove.progress', values: { wrecked: 2, total: 3 } },
    });
  });

  it('allows unlimited undo and suggests a hint from the solver', () => {
    expect(SCRAP_SHOVE_RULES.undo).toStrictEqual({ kind: 'unlimited' });
    const { hints } = SCRAP_SHOVE_RULES;
    if (hints.kind !== 'solver') throw new Error('solver hints expected');
    const state = stateFromText(['n.n.', '....', '....', '.@..']);
    const hint = hints.suggest(state);
    if (hint === null) throw new Error('hint expected');
    expect(SCRAP_SHOVE_ENGINE.outcome(applyMove(state, hint).state).kind).toBe('won');
  });

  it('gives one continue that undoes the step that let a robot reach the player (spec 8.10)', () => {
    const { continueRun } = SCRAP_SHOVE_RULES;
    if (continueRun.kind !== 'once') throw new Error('continue expected');
    expect(continueRun.descriptionId).toBe('scrap-shove.continue.step-back');
    const lost = applyMove(stateFromText(['....', '.n..', '..@.', '....']), { kind: 'wait' }).state;
    expect(SCRAP_SHOVE_ENGINE.outcome(continueRun.apply(lost).state)).toStrictEqual({
      kind: 'playing',
    });
  });
});
