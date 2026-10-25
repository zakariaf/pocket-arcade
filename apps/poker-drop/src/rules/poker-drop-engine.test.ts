// apps/poker-drop/src/rules/poker-drop-engine.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';
import { buildTimeline } from '@e07/poker-drop/board/build-timeline.ts';

import { intentToMove } from './intent-to-move.ts';
import { POKER_DROP_ENGINE, POKER_DROP_RULES } from './poker-drop-engine.ts';
import { POKER_DROP_PERSISTENCE } from './poker-drop-persistence.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Every cell of the well and one column on each side of it, plus a region the board does not have. */
const TARGETS: readonly BoardTarget[] = [
  ...Array.from({ length: 7 * 6 }, (_, index) => ({
    regionId: 'well',
    col: (index % 7) - 1,
    row: Math.floor(index / 7),
  })),
  { regionId: 'strip', col: 0, row: 0 },
];

/** What the board sends: a tap anywhere (panMode none sends no pan intents). */
function everyTap(): InputIntent[] {
  return TARGETS.map((target) => ({ kind: 'tap', target, selected: null }));
}

describe('POKER_DROP_ENGINE', () => {
  it('keeps the engine contract over seeded games at every level row and endless', () => {
    const problems = engineContractProblems({
      gameId: 'poker-drop',
      engine: POKER_DROP_ENGINE,
      persistence: POKER_DROP_PERSISTENCE,
      starts: [0, 25, 50, 75, 100].flatMap((difficulty) =>
        [1, 2].map((seed) => ({ seed: seed + difficulty, difficulty })),
      ),
      maxMoves: 60,
      intents: everyTap,
      endless: { kind: 'endless', difficulty: ENDLESS_DIFFICULTY },
    });
    expect(problems).toStrictEqual([]);
  });

  // spec 13 (design notes 3): a tap on the column to drop into; no drag, no selection.
  it('takes taps only, selects nothing first, and names its input and timeline', () => {
    expect(POKER_DROP_ENGINE.panMode).toBe('none');
    expect(POKER_DROP_ENGINE.selectRegions).toStrictEqual([]);
    expect(POKER_DROP_ENGINE.intentToMove).toBe(intentToMove);
    expect(POKER_DROP_ENGINE.buildTimeline).toBe(buildTimeline);
  });
});

describe('POKER_DROP_RULES', () => {
  // spec S5: the top bar shows the goal line ("Hands 3 / 8") and the score.
  it('shows the score and the hands made against the goal in the top bar', () => {
    const state = { ...POKER_DROP_ENGINE.create(1, 0), handsMade: 2, score: 60 };
    expect(POKER_DROP_RULES.hud(state)).toStrictEqual({
      score: 60,
      goal: { id: 'poker-drop.progress', values: { made: 2, total: 6 } },
    });
  });

  it('shows the hands made alone in the endless run, which has no goal', () => {
    const state = { ...POKER_DROP_ENGINE.create(1, ENDLESS_DIFFICULTY), handsMade: 7, score: 210 };
    expect(POKER_DROP_RULES.hud(state)).toStrictEqual({
      score: 210,
      goal: { id: 'poker-drop.progress.endless', values: { made: 7 } },
    });
  });

  // design notes 7-9 and spec 8.10: no undo, no hints, one continue that clears the top row.
  it('has no undo and no hints, and one continue that clears the top row of a full well', () => {
    expect(POKER_DROP_RULES.undo).toStrictEqual({ kind: 'none' });
    expect(POKER_DROP_RULES.hints).toStrictEqual({ kind: 'none' });
    const { continueRun } = POKER_DROP_RULES;
    if (continueRun.kind !== 'once') throw new Error('continue expected');
    expect(continueRun.descriptionId).toBe('poker-drop.continue.clear-top');
    const start = POKER_DROP_ENGINE.create(1, 0);
    const lost = { ...start, cells: start.cells.map((_, index) => index % 52) };
    const { state, events } = continueRun.apply(lost);
    expect(POKER_DROP_ENGINE.outcome(state)).toStrictEqual({ kind: 'playing' });
    expect(events.map((event) => event.kind)).toStrictEqual(['top-row-cleared']);
  });
});
