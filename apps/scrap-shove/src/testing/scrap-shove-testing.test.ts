// apps/scrap-shove/src/testing/scrap-shove-testing.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { create } from '@e07/scrap-shove/rules/create.ts';
import { listMoves } from '@e07/scrap-shove/rules/list-moves.ts';
import { outcome } from '@e07/scrap-shove/rules/outcome.ts';

import { scrapShoveBot } from './scrap-shove-bot.ts';
import { SCRAP_SHOVE_TESTING } from './scrap-shove-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('SCRAP_SHOVE_TESTING', () => {
  it('gives every example state the outcome its name promises', () => {
    const { examples } = SCRAP_SHOVE_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose()).kind).toBe('lost');
  });

  it('starts from the seed 1 floor and keeps the twist one shove away in the middle', () => {
    const middle = SCRAP_SHOVE_TESTING.examples.middle();
    expect(SCRAP_SHOVE_TESTING.examples.start()).toStrictEqual(create(1, 0));
    expect(listMoves(middle)).toContainEqual({ kind: 'shove', col: 4, row: 3 });
  });

  it('finishes every bot game on the hardest row within the move limit (no endless standoff)', () => {
    const unfinished = Array.from({ length: 60 }, (_, index) => index + 1).filter(
      (seed) =>
        playBot(GAME, { seed, difficulty: 75, policy: SCRAP_SHOVE_TESTING.bot, maxMoves: 200 })
          .outcome.kind === 'playing',
    );
    expect(unfinished).toStrictEqual([]);
  });

  it('plays the greedy bot as the game module testing.bot, picking legal moves', () => {
    const state = create(4, 20);
    const choice = SCRAP_SHOVE_TESTING.bot(state, listMoves(state), seedRng(4));
    expect(SCRAP_SHOVE_TESTING.bot).toBe(scrapShoveBot);
    expect(listMoves(state)).toContainEqual(choice.move);
  });
});
