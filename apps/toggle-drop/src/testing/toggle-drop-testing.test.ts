// apps/toggle-drop/src/testing/toggle-drop-testing.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';
import { listMoves } from '@e07/toggle-drop/rules/list-moves.ts';
import { outcome } from '@e07/toggle-drop/rules/outcome.ts';

import { toggleDropBot } from './toggle-drop-bot.ts';
import { TOGGLE_DROP_TESTING } from './toggle-drop-testing.ts';

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
