// apps/snare-snake/src/rules/snare-snake-engine.test.ts
// Spec 10 THE GAME CONTRACT: the engine members, the board's pan gesture, the top-bar line, undo,
// hints and the one continue (spec 8.5, 8.10).
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';
import { buildTimeline } from '@e07/snare-snake/board/build-timeline.ts';

import { intentToMove } from './intent-to-move.ts';
import { SNARE_SNAKE_ENGINE, SNARE_SNAKE_RULES } from './snare-snake-engine.ts';
import { SNARE_SNAKE_PERSISTENCE } from './snare-snake-persistence.ts';

import type { SnareSnakeState } from './snare-snake-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/** The four swipes, then a tap on every cell of the grid plus one row outside it. */
function everyIntent(state: SnareSnakeState): InputIntent[] {
  const intents: InputIntent[] = (['up', 'right', 'down', 'left'] as const).map((direction) => ({
    kind: 'swipe',
    direction,
    from: null,
  }));
  for (let row = 0; row <= state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      intents.push({ kind: 'tap', target: { regionId: 'board', col, row }, selected: null });
    }
  }
  return intents;
}

describe('SNARE_SNAKE_ENGINE', () => {
  it('keeps the engine contract over seeded random games at every difficulty band', () => {
    const problems = engineContractProblems({
      gameId: 'snare-snake',
      engine: SNARE_SNAKE_ENGINE,
      persistence: SNARE_SNAKE_PERSISTENCE,
      starts: [0, 25, 50, 99].flatMap((difficulty) =>
        [1, 2, 3].map((seed) => ({ seed, difficulty })),
      ),
      maxMoves: 60,
      intents: everyIntent,
      endless: { kind: 'none' },
    });
    expect(problems).toStrictEqual([]);
  });

  it('steers by swipe on a board that selects nothing first', () => {
    expect(SNARE_SNAKE_ENGINE.panMode).toBe('swipe');
    expect(SNARE_SNAKE_ENGINE.selectRegions).toStrictEqual([]);
    expect(SNARE_SNAKE_ENGINE.intentToMove).toBe(intentToMove);
    expect(SNARE_SNAKE_ENGINE.buildTimeline).toBe(buildTimeline);
  });
});

describe('SNARE_SNAKE_RULES', () => {
  it('shows the score and the critters caught of the total in the top bar', () => {
    const state = { ...SNARE_SNAKE_ENGINE.create(1, 0), caught: 1, score: 15 };
    expect(SNARE_SNAKE_RULES.hud(state)).toStrictEqual({
      score: 15,
      goal: { id: 'snare-snake.progress', values: { caught: 1, total: 4 } },
    });
  });

  it('keeps every move final and offers no hints (design notes: undo none, hints none)', () => {
    expect(SNARE_SNAKE_RULES.undo).toStrictEqual({ kind: 'none' });
    expect(SNARE_SNAKE_RULES.hints).toStrictEqual({ kind: 'none' });
  });

  it('turns a lost run back into a playing one with the single continue', () => {
    const start = SNARE_SNAKE_ENGINE.create(1, 0);
    const lost = { ...start, moves: start.maxMoves };
    expect(SNARE_SNAKE_ENGINE.outcome(lost).kind).toBe('lost');
    if (SNARE_SNAKE_RULES.continueRun.kind !== 'once') throw new Error('continue expected');
    expect(SNARE_SNAKE_RULES.continueRun.descriptionId).toBe('snare-snake.continue.step-back');
    const { state, events } = SNARE_SNAKE_RULES.continueRun.apply(lost);
    expect(SNARE_SNAKE_ENGINE.outcome(state)).toStrictEqual({ kind: 'playing' });
    expect(events).toStrictEqual([{ kind: 'moves-added', count: 3 }]);
  });
});
