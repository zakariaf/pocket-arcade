// apps/poker-drop/src/testing/poker-drop-testing.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { create } from '@e07/poker-drop/rules/create.ts';
import { listMoves } from '@e07/poker-drop/rules/list-moves.ts';
import { outcome } from '@e07/poker-drop/rules/outcome.ts';

import { POKER_DROP_TESTING } from './poker-drop-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('POKER_DROP_TESTING', () => {
  // spec 10, TESTING: "A simple bot that can play the game"; "Example states for automatic
  // screenshots (start, middle, win, lose)".
  it('gives every example state the outcome its name promises', () => {
    const { examples } = POKER_DROP_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose()).kind).toBe('lost');
  });

  it('shows a burst opening in the middle example', () => {
    expect(POKER_DROP_TESTING.examples.middle().handsMade).toBe(2);
  });

  it('lets the bot pick a legal move', () => {
    const state = create(4, 20);
    const choice = POKER_DROP_TESTING.bot(state, listMoves(state), seedRng(4));
    expect(listMoves(state)).toContainEqual(choice.move);
  });

  it('finishes every bot game within the move limit', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const run = playBot(GAME, {
        seed,
        difficulty: 40,
        policy: POKER_DROP_TESTING.bot,
        maxMoves: 200,
      });
      expect(run.outcome.kind).not.toBe('playing');
    }
  });
});
