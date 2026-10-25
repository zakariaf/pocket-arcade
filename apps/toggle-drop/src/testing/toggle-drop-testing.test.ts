// apps/toggle-drop/src/testing/toggle-drop-testing.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';
import { listMoves } from '@e07/toggle-drop/rules/list-moves.ts';
import { outcome } from '@e07/toggle-drop/rules/outcome.ts';
import { parseState } from '@e07/toggle-drop/rules/toggle-drop-persistence.ts';

import { toggleDropBot } from './toggle-drop-bot.ts';
import { TOGGLE_DROP_TESTING } from './toggle-drop-testing.ts';

import type { ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('TOGGLE_DROP_TESTING', () => {
  // Spec 10 TESTING: "A simple bot that can play the game" and "Example states ... (start, middle,
  // win, lose)".
  it('gives every example state the outcome its name promises', () => {
    const { examples } = TOGGLE_DROP_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win())).toStrictEqual({ kind: 'won', score: 4 });
    expect(outcome(examples.lose()).kind).toBe('lost');
  });

  // Spec 10 TESTING and 8.6: the Shell saves an example it stages (the debug links of the E2E
  // flows), so each one is a run legal drops reach, which a save restores.
  it('plays the win and lose examples with legal drops from the start board', () => {
    const { examples } = TOGGLE_DROP_TESTING;
    const drop = (state: ToggleDropState, col: number): ToggleDropState =>
      applyMove(state, { kind: 'drop', col }).state;
    expect(examples.win()).toStrictEqual([0, 2].reduce(drop, examples.start()));
    expect(examples.lose()).toStrictEqual([4, 4, 4, 4, 4, 4].reduce(drop, examples.start()));
  });

  it('restores every example from a save', () => {
    for (const example of Object.values(TOGGLE_DROP_TESTING.examples)) {
      const state = example();
      expect(parseState(JSON.parse(JSON.stringify(state)))).toStrictEqual(state);
    }
  });

  it('plays the greedy bot', () => {
    expect(TOGGLE_DROP_TESTING.bot).toBe(toggleDropBot);
  });

  it('lets the bot pick a legal move and keep its random state', () => {
    const state = create(4, 20);
    const rng = seedRng(4);
    const choice = TOGGLE_DROP_TESTING.bot(state, listMoves(state), rng);
    expect(listMoves(state)).toContainEqual(choice.move);
  });

  it('finishes every bot game before the move limit', () => {
    const outcomes = Array.from({ length: 30 }, (_, index) =>
      playBot(GAME, {
        seed: index + 1,
        difficulty: 40,
        policy: TOGGLE_DROP_TESTING.bot,
        maxMoves: 50,
      }),
    ).map((run) => run.outcome.kind);
    expect(outcomes.filter((kind) => kind === 'playing')).toStrictEqual([]);
  });
});
