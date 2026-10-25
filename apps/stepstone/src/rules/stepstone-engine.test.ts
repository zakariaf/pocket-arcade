// apps/stepstone/src/rules/stepstone-engine.test.ts
// Spec 10: the game fits the Shell's engine contract; spec 8.5: the hint is the solver's next hop
// (1 free a day); spec 8.10: no continue (undo is the way out of a stranded frog).
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';
import { suggestHop } from '@e07/stepstone/levels/stepstone-solver.ts';

import { STEPSTONE_ENGINE, STEPSTONE_RULES } from './stepstone-engine.ts';
import { STEPSTONE_PERSISTENCE } from './stepstone-persistence.ts';

import type { StepstoneState } from './stepstone-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/** A tap on every cell of the pond plus a row outside it: each move they yield must be legal. */
function everyTap(state: StepstoneState): InputIntent[] {
  const taps: InputIntent[] = [];
  for (let row = 0; row <= state.side; row += 1) {
    for (let col = 0; col < state.side; col += 1) {
      taps.push({ kind: 'tap', target: { regionId: 'board', col, row }, selected: null });
    }
  }
  return taps;
}

describe('STEPSTONE_ENGINE', () => {
  it('keeps the engine contract over seeded random games at every difficulty band', () => {
    const problems = engineContractProblems({
      gameId: 'stepstone',
      engine: STEPSTONE_ENGINE,
      persistence: STEPSTONE_PERSISTENCE,
      starts: [0, 25, 50, 75, 99].flatMap((difficulty) =>
        [1, 2, 3].map((seed) => ({ seed, difficulty })),
      ),
      maxMoves: 60,
      intents: everyTap,
    });
    expect(problems).toStrictEqual([]);
  });

  it('plays by taps alone: no pan gesture and no region that only selects', () => {
    expect([STEPSTONE_ENGINE.panMode, STEPSTONE_ENGINE.selectRegions]).toStrictEqual(['none', []]);
  });
});

describe('STEPSTONE_RULES', () => {
  it('shows the hops made against par in the top bar, the hops as the score', () => {
    const state = { ...STEPSTONE_ENGINE.create(1, 0), moves: 2 };
    expect(STEPSTONE_RULES.hud(state)).toStrictEqual({
      score: 2,
      goal: { id: 'stepstone.progress', values: { moves: 2, par: 3 } },
    });
  });

  it("allows unlimited undo, gives the solver's next hop as the hint and offers no continue", () => {
    const start = STEPSTONE_ENGINE.create(1, 0);
    if (STEPSTONE_RULES.hints.kind !== 'solver') throw new Error('a solver hint expected');
    expect(STEPSTONE_RULES.undo).toStrictEqual({ kind: 'unlimited' });
    expect(STEPSTONE_RULES.hints.suggest(start)).toStrictEqual(suggestHop(start));
    expect(STEPSTONE_RULES.hints.suggest(start)).toStrictEqual({ kind: 'hop', to: 12 });
    expect(STEPSTONE_RULES.continueRun).toStrictEqual({ kind: 'none' });
  });
});
