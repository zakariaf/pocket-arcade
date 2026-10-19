// apps/flock-tilt/src/testing/flock-tilt-testing.test.ts
import { applyMove } from '@e07/flock-tilt/rules/apply-move.ts';
import { create } from '@e07/flock-tilt/rules/create.ts';
import { listMoves } from '@e07/flock-tilt/rules/list-moves.ts';
import { outcome } from '@e07/flock-tilt/rules/outcome.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';

import { flockTiltBot } from './flock-tilt-bot.ts';
import { FLOCK_TILT_TESTING } from './flock-tilt-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('FLOCK_TILT_TESTING', () => {
  it('gives every example state the outcome its name promises', () => {
    const { examples } = FLOCK_TILT_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose())).toStrictEqual({
      kind: 'lost',
      reasonKey: 'flock-tilt.lose.wolf-got-sheep',
    });
  });

  it('uses the greedy reasonable player as the bot, and it picks a legal move', () => {
    expect(FLOCK_TILT_TESTING.bot).toBe(flockTiltBot);
    const state = create(4, 20);
    const choice = FLOCK_TILT_TESTING.bot(state, listMoves(state), seedRng(4));
    expect(listMoves(state)).toContainEqual(choice.move);
  });

  it('finishes every bot game within the move limit', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const run = playBot(GAME, {
        seed,
        difficulty: 40,
        policy: FLOCK_TILT_TESTING.bot,
        maxMoves: 200,
      });
      expect(run.outcome.kind).not.toBe('playing');
    }
  });
});
