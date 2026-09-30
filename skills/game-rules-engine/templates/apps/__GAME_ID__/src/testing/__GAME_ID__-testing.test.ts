// apps/__GAME_ID__/src/testing/__GAME_ID__-testing.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/__GAME_ID__/rules/apply-move.ts';
import { create } from '@e07/__GAME_ID__/rules/create.ts';
import { listMoves } from '@e07/__GAME_ID__/rules/list-moves.ts';
import { outcome } from '@e07/__GAME_ID__/rules/outcome.ts';

import { __GAME_CONST___TESTING } from './__GAME_ID__-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('__GAME_CONST___TESTING', () => {
  it('gives every example state the outcome its name promises', () => {
    const { examples } = __GAME_CONST___TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose()).kind).toBe('lost');
  });

  it('lets the bot pick a legal move and pass its random state through', () => {
    const state = create(4, 20);
    const rng = seedRng(4);
    const choice = __GAME_CONST___TESTING.bot(state, listMoves(state), rng);
    expect(listMoves(state)).toContainEqual(choice.move);
    expect(choice.rng).toBe(rng);
  });

  it('finishes every bot game within the move limit', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const run = playBot(GAME, {
        seed,
        difficulty: 40,
        policy: __GAME_CONST___TESTING.bot,
        maxMoves: 200,
      });
      expect(run.outcome.kind).not.toBe('playing');
    }
  });
});
