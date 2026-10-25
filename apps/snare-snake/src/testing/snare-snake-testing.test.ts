// apps/snare-snake/src/testing/snare-snake-testing.test.ts
// Spec 10 TESTING: a bot that plays the game and example states for screenshots.
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/snare-snake/rules/apply-move.ts';
import { create } from '@e07/snare-snake/rules/create.ts';
import { listMoves } from '@e07/snare-snake/rules/list-moves.ts';
import { outcome } from '@e07/snare-snake/rules/outcome.ts';

import { SNARE_SNAKE_TESTING } from './snare-snake-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('SNARE_SNAKE_TESTING', () => {
  it('gives every example state the outcome its name promises', () => {
    const { examples } = SNARE_SNAKE_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose()).kind).toBe('lost');
  });

  it('shows the middle of a run: the opening coil closed and its critters caught', () => {
    const middle = SNARE_SNAKE_TESTING.examples.middle();
    expect([middle.moves, middle.caught]).toStrictEqual(GOLDEN_MIDDLE);
  });

  it('lets the bot pick a listed move', () => {
    const state = create(4, 20);
    const choice = SNARE_SNAKE_TESTING.bot(state, listMoves(state), seedRng(4));
    expect(listMoves(state)).toContainEqual(choice.move);
  });

  it('finishes every bot game within the move limit', () => {
    const outcomes = Array.from({ length: 20 }, (_slot, index) =>
      playBot(GAME, {
        seed: index + 1,
        difficulty: 40,
        policy: SNARE_SNAKE_TESTING.bot,
        maxMoves: 200,
      }),
    );
    expect(outcomes.filter((run) => run.outcome.kind === 'playing')).toStrictEqual([]);
  });
});

const GOLDEN_MIDDLE = [3, 3];
