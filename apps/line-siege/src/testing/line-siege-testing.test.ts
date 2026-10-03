// apps/line-siege/src/testing/line-siege-testing.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { create } from '@e07/line-siege/rules/create.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';
import { outcome } from '@e07/line-siege/rules/outcome.ts';

import { lineSiegeBot } from './line-siege-bot.ts';
import { LINE_SIEGE_TESTING } from './line-siege-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('LINE_SIEGE_TESTING', () => {
  it('gives every example state the outcome its name promises (spec 10 TESTING)', () => {
    const { examples } = LINE_SIEGE_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose()).kind).toBe('lost');
  });

  it('shows a board with a defeated monster in the middle example', () => {
    expect(LINE_SIEGE_TESTING.examples.middle().defeated).toBe(1);
  });

  it('uses the greedy reasonable player as its bot, which picks a legal move', () => {
    expect(LINE_SIEGE_TESTING.bot).toBe(lineSiegeBot);
    const state = create(4, 20);
    const choice = LINE_SIEGE_TESTING.bot(state, listMoves(state), seedRng(4));
    expect(listMoves(state)).toContainEqual(choice.move);
  });

  it('finishes every bot game within the move limit, endless runs included', () => {
    for (const difficulty of [40, 100]) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const run = playBot(GAME, {
          seed,
          difficulty,
          policy: LINE_SIEGE_TESTING.bot,
          maxMoves: 400,
        });
        expect(run.outcome.kind).not.toBe('playing');
      }
    }
  });
});
