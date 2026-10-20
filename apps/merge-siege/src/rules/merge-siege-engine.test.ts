// apps/merge-siege/src/rules/merge-siege-engine.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';
import { buildTimeline } from '@e07/merge-siege/board/build-timeline.ts';
import { MERGE_SIEGE_LEVELS } from '@e07/merge-siege/levels/merge-siege-levels.ts';

import { COLS, DIRECTIONS, ROWS } from './board-cells.ts';
import { parseBoard } from './board-text.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { MERGE_SIEGE_ENGINE, MERGE_SIEGE_RULES } from './merge-siege-engine.ts';
import { MERGE_SIEGE_PERSISTENCE } from './merge-siege-persistence.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

const BOARD = Array.from({ length: COLS * ROWS }, (_, index): BoardTarget => ({
  regionId: 'board',
  col: index % COLS,
  row: Math.floor(index / COLS),
}));
const GATE = Array.from({ length: COLS }, (_, col): BoardTarget => ({
  regionId: 'gate',
  col,
  row: 0,
}));

/** What the board sends: the four swipes, and a tap on every gate and board cell. */
function everyIntent(): InputIntent[] {
  const swipes = DIRECTIONS.map((direction): InputIntent => ({
    kind: 'swipe',
    direction,
    from: null,
  }));
  const taps = [...GATE, ...BOARD].map((target): InputIntent => ({
    kind: 'tap',
    target,
    selected: null,
  }));
  return [...swipes, ...taps];
}

describe('MERGE_SIEGE_ENGINE', () => {
  it('keeps the engine contract over seeded games at every level row and endless', () => {
    const problems = engineContractProblems({
      gameId: 'merge-siege',
      engine: MERGE_SIEGE_ENGINE,
      persistence: MERGE_SIEGE_PERSISTENCE,
      starts: [0, 25, 50, 75, 100].flatMap((difficulty) =>
        [1, 2].map((seed) => ({ seed: seed + difficulty, difficulty })),
      ),
      maxMoves: 40,
      intents: everyIntent,
      endless: MERGE_SIEGE_LEVELS.endless,
    });
    expect(problems).toStrictEqual([]);
  });

  it('takes swipes, every tap acts, and its moves come from intentToMove and buildTimeline', () => {
    expect(MERGE_SIEGE_ENGINE).toMatchObject({
      panMode: 'swipe',
      selectRegions: [],
      intentToMove,
      buildTimeline,
    });
  });
});

describe('MERGE_SIEGE_RULES', () => {
  it('shows the score and the smashed enemies against the wave in the top bar', () => {
    const state = { ...create(1, 0), smashed: 3, score: 90 };
    expect(MERGE_SIEGE_RULES.hud(state)).toStrictEqual({
      score: 90,
      goal: { id: 'merge-siege.progress', values: { smashed: 3, total: 8 } },
    });
  });

  it('shows only the smashed enemies in the endless run, which has no wave to count against', () => {
    const state = { ...create(1, ENDLESS_DIFFICULTY), smashed: 12, score: 400 };
    expect(MERGE_SIEGE_RULES.hud(state)).toStrictEqual({
      score: 400,
      goal: { id: 'merge-siege.progress.endless', values: { smashed: 12 } },
    });
  });

  it('allows unlimited undo, no hints and one continue that pushes the enemies back', () => {
    expect(MERGE_SIEGE_RULES.undo).toStrictEqual({ kind: 'unlimited' });
    expect(MERGE_SIEGE_RULES.hints).toStrictEqual({ kind: 'none' });
    expect(MERGE_SIEGE_RULES.continueRun).toMatchObject({
      kind: 'once',
      descriptionId: 'merge-siege.continue.push-back',
    });
  });

  it('turns a lost run back into a playing one with the single continue', () => {
    const lost = {
      ...create(1, 0),
      cells: parseBoard([
        '. . . . .',
        '. . . . .',
        '. . . . .',
        '. . . . .',
        '2 . . . .',
        'e8 . . . .',
      ]),
    };
    if (MERGE_SIEGE_RULES.continueRun.kind !== 'once') throw new Error('continue expected');
    const { state, events } = MERGE_SIEGE_RULES.continueRun.apply(lost);
    expect(MERGE_SIEGE_ENGINE.outcome(state)).toStrictEqual({ kind: 'playing' });
    expect(events[0]?.kind).toBe('enemies-pushed-back');
  });
});
