// apps/swap-guard/src/testing/swap-guard-testing.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/swap-guard/rules/apply-move.ts';
import { create } from '@e07/swap-guard/rules/create.ts';
import { listMoves } from '@e07/swap-guard/rules/list-moves.ts';
import { outcome } from '@e07/swap-guard/rules/outcome.ts';

import { SWAP_GUARD_TESTING } from './swap-guard-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('SWAP_GUARD_TESTING (spec 10 TESTING: a bot and example states)', () => {
  it('gives every example state the outcome its name promises', () => {
    const { examples } = SWAP_GUARD_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose())).toStrictEqual({
      kind: 'lost',
      reasonKey: 'swap-guard.lose.hit',
    });
  });

  it('shows the double hit in the middle example and a played loss in the lose example', () => {
    const { examples } = SWAP_GUARD_TESTING;
    expect(examples.middle().enemies).toHaveLength(examples.start().enemies.length - 2);
    expect(examples.lose().lastSwap).not.toBeNull();
  });

  it('lets the bot pick a legal move', () => {
    const state = create(4, 20);
    const choice = SWAP_GUARD_TESTING.bot(state, listMoves(state), seedRng(4));
    expect(listMoves(state)).toContainEqual(choice.move);
  });

  it('finishes every bot game within the swap budget', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const run = playBot(GAME, {
        seed,
        difficulty: 40,
        policy: SWAP_GUARD_TESTING.bot,
        maxMoves: 200,
      });
      expect(run.outcome.kind).not.toBe('playing');
    }
  });
});
