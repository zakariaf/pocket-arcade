// apps/stepstone/src/testing/stepstone-testing.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/stepstone/rules/apply-move.ts';
import { create } from '@e07/stepstone/rules/create.ts';
import { listMoves } from '@e07/stepstone/rules/list-moves.ts';
import { outcome } from '@e07/stepstone/rules/outcome.ts';
import { parseState } from '@e07/stepstone/rules/stepstone-persistence.ts';

import { stepstoneBot } from './stepstone-bot.ts';
import { STEPSTONE_TESTING } from './stepstone-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('STEPSTONE_TESTING', () => {
  it('gives every example state the outcome its name promises (spec 10 TESTING)', () => {
    const { examples } = STEPSTONE_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose()).kind).toBe('lost');
  });

  it('builds every example state through the rules, so a save of it reads back (spec 8.14)', () => {
    for (const make of Object.values(STEPSTONE_TESTING.examples)) {
      const state = make();
      expect(parseState(JSON.parse(JSON.stringify(state)))).toStrictEqual(state);
    }
  });

  it('shows the frog one hop into the golden route in the middle example, the old stone sunk', () => {
    const middle = STEPSTONE_TESTING.examples.middle();
    expect(middle.moves).toBe(1);
    expect(middle.frog).toBe(12);
    expect(middle.cells[2]).toBe('sunk');
  });

  it('wins the golden route at par in the win example', () => {
    const win = STEPSTONE_TESTING.examples.win();
    expect(outcome(win)).toStrictEqual({ kind: 'won', score: 3 });
    expect(win.par).toBe(3);
  });

  it('uses the greedy reasonable player as its bot, which picks a legal move', () => {
    expect(STEPSTONE_TESTING.bot).toBe(stepstoneBot);
    const state = create(4, 20);
    const choice = STEPSTONE_TESTING.bot(state, listMoves(state), seedRng(4));
    expect(listMoves(state)).toContainEqual(choice.move);
  });

  it('finishes every bot game within the move limit', () => {
    for (const difficulty of [0, 45, 99]) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const run = playBot(GAME, {
          seed,
          difficulty,
          policy: STEPSTONE_TESTING.bot,
          maxMoves: 200,
        });
        expect(run.outcome.kind).not.toBe('playing');
      }
    }
  });
});
