// apps/line-siege/src/rules/line-siege-engine.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';

import { LINE_SIEGE_ENGINE, LINE_SIEGE_RULES } from './line-siege-engine.ts';
import { LINE_SIEGE_PERSISTENCE } from './line-siege-persistence.ts';
import { TUNING } from './line-siege-tuning.ts';

import type { LineSiegeState } from './line-siege-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

const SIZE = TUNING.boardSize;
const CELLS = Array.from({ length: SIZE * SIZE }, (_, index): BoardTarget => ({
  regionId: 'board',
  col: index % SIZE,
  row: Math.floor(index / SIZE),
}));

/**
 * What the board sends: a drag from every tray slot to every cell and off the board, and a tap on
 * every slot and every cell. The contract also tries each cell tap with every tapped slot selected.
 */
function everyIntent(state: LineSiegeState): InputIntent[] {
  const slots = state.tray.map((_piece, slot): BoardTarget => ({
    regionId: 'tray',
    col: slot,
    row: 0,
  }));
  const drags = slots.flatMap((from): InputIntent[] => [
    ...CELLS.map((to): InputIntent => ({ kind: 'drag-end', from, to })),
    { kind: 'drag-end', from, to: null },
  ]);
  const taps = [...slots, ...CELLS].map((target): InputIntent => ({
    kind: 'tap',
    target,
    selected: null,
  }));
  return [...drags, ...taps];
}

describe('LINE_SIEGE_ENGINE', () => {
  it('keeps the engine contract over seeded games at every level row and endless', () => {
    const problems = engineContractProblems({
      gameId: 'line-siege',
      engine: LINE_SIEGE_ENGINE,
      persistence: LINE_SIEGE_PERSISTENCE,
      starts: [0, 25, 50, 75, 100].map((difficulty) => ({ seed: difficulty + 1, difficulty })),
      maxMoves: 40,
      intents: everyIntent,
      endless: { kind: 'endless', difficulty: ENDLESS_DIFFICULTY },
    });
    expect(problems).toStrictEqual([]);
  });
});

describe('LINE_SIEGE_RULES', () => {
  it('shows the score and the defeated monsters against the wave in the top bar', () => {
    const state = LINE_SIEGE_ENGINE.create(1, 0);
    expect(LINE_SIEGE_RULES.hud({ ...state, defeated: 2, score: 70 })).toStrictEqual({
      score: 70,
      goal: { id: 'line-siege.progress', values: { defeated: 2, total: 4 } },
    });
  });

  it('counts only the defeated monsters in the endless run, which has no wave to finish', () => {
    const state = { ...LINE_SIEGE_ENGINE.create(1, ENDLESS_DIFFICULTY), defeated: 9, score: 400 };
    expect(LINE_SIEGE_RULES.hud(state)).toStrictEqual({
      score: 400,
      goal: { id: 'line-siege.progress.endless', values: { defeated: 9 } },
    });
  });

  it('allows unlimited undo, no hints and one continue that pushes the monsters back', () => {
    expect(LINE_SIEGE_RULES.undo).toStrictEqual({ kind: 'unlimited' });
    expect(LINE_SIEGE_RULES.hints).toStrictEqual({ kind: 'none' });
    const { continueRun } = LINE_SIEGE_RULES;
    if (continueRun.kind !== 'once') throw new Error('continue expected');
    expect(continueRun.descriptionId).toBe('line-siege.continue.push-back');
    const lost = { ...LINE_SIEGE_ENGINE.create(1, 0), hearts: 0 };
    expect(LINE_SIEGE_ENGINE.outcome(continueRun.apply(lost).state)).toStrictEqual({
      kind: 'playing',
    });
  });
});
