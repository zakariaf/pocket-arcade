// apps/trail-clear/src/testing/trail-clear-testing.test.ts
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { continueAfterLoss } from '@e07/trail-clear/rules/continue-run.ts';
import { create } from '@e07/trail-clear/rules/create.ts';
import { listMoves } from '@e07/trail-clear/rules/list-moves.ts';
import { outcome } from '@e07/trail-clear/rules/outcome.ts';
import { parseState } from '@e07/trail-clear/rules/trail-clear-persistence.ts';

import { trailClearBot } from './trail-clear-bot.ts';
import { TRAIL_CLEAR_TESTING } from './trail-clear-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('TRAIL_CLEAR_TESTING', () => {
  it('gives every example state the outcome its name promises (spec 10 TESTING)', () => {
    const { examples } = TRAIL_CLEAR_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose()).kind).toBe('lost');
  });

  it('shows a board after the opening double in the middle example', () => {
    const middle = TRAIL_CLEAR_TESTING.examples.middle();
    expect(middle.loopsClosed).toBe(2);
    expect(middle.placements).toBe(2);
  });

  it('uses the greedy reasonable player as its bot, which picks a legal move', () => {
    expect(TRAIL_CLEAR_TESTING.bot).toBe(trailClearBot);
    const state = create(4, 20);
    const choice = TRAIL_CLEAR_TESTING.bot(state, listMoves(state), seedRng(4));
    expect(listMoves(state)).toContainEqual(choice.move);
  });

  it('finishes every bot game within the move limit, endless runs included', () => {
    for (const difficulty of [40, 100]) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const run = playBot(GAME, {
          seed,
          difficulty,
          policy: TRAIL_CLEAR_TESTING.bot,
          maxMoves: 400,
        });
        expect(run.outcome.kind).not.toBe('playing');
      }
    }
  });

  it.each(['start', 'middle', 'win', 'lose'] as const)(
    'keeps the %s example reachable through the rules: its save parses unchanged',
    (name) => {
      const example = TRAIL_CLEAR_TESTING.examples[name]();
      expect(parseState(JSON.parse(JSON.stringify(example)))).toStrictEqual(example);
    },
  );

  it("plays on after the lose example's continue: the next listed move does not lose (spec 8.10)", () => {
    const rescued = continueAfterLoss(TRAIL_CLEAR_TESTING.examples.lose()).state;
    const next = applyMove(rescued, pickAt(listMoves(rescued), 0)).state;
    expect(outcome(next).kind).not.toBe('lost');
  });
});
