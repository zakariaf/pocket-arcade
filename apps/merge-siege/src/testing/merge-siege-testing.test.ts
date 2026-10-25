// apps/merge-siege/src/testing/merge-siege-testing.test.ts
// Spec 10 TESTING: "A simple bot that can play the game (for balance and winnability tests)" and
// "Example states for automatic screenshots (start, middle, win, lose)."
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/merge-siege/rules/apply-move.ts';
import { continueAfterLoss } from '@e07/merge-siege/rules/continue-run.ts';
import { create } from '@e07/merge-siege/rules/create.ts';
import { listMoves } from '@e07/merge-siege/rules/list-moves.ts';
import { hasOverrun, outcome } from '@e07/merge-siege/rules/outcome.ts';

import { LOSING_SWIPES, MERGE_SIEGE_TESTING } from './merge-siege-testing.ts';

const GAME = { create, listMoves, applyMove, outcome };

describe('MERGE_SIEGE_TESTING', () => {
  it('gives every example state the outcome its name promises', () => {
    const { examples } = MERGE_SIEGE_TESTING;
    expect(outcome(examples.start()).kind).toBe('playing');
    expect(outcome(examples.middle()).kind).toBe('playing');
    expect(outcome(examples.win()).kind).toBe('won');
    expect(outcome(examples.lose()).kind).toBe('lost');
  });

  it('reaches the lose example from the start by legal swipes, overrun on the last one', () => {
    let state = MERGE_SIEGE_TESTING.examples.start();
    for (const move of LOSING_SWIPES) {
      expect(listMoves(state)).toContainEqual(move);
      state = applyMove(state, move).state;
    }
    expect(state).toStrictEqual(MERGE_SIEGE_TESTING.examples.lose());
    expect(hasOverrun(state)).toBe(true);
  });

  it('keeps the run in play after its continue and one more swipe up (E2E flow 12)', () => {
    const rescued = continueAfterLoss(MERGE_SIEGE_TESTING.examples.lose()).state;
    const swiped = applyMove(rescued, { kind: 'swipe', direction: 'up' }).state;
    expect(swiped.swipes).toBe(rescued.swipes + 1);
    expect(outcome(swiped).kind).toBe('playing');
  });

  it('shows a middle state after the first swipe, with points on the board', () => {
    const middle = MERGE_SIEGE_TESTING.examples.middle();
    expect(middle.swipes).toBeGreaterThan(0);
    expect(middle.score).toBeGreaterThan(0);
  });

  it('lets the bot pick a legal move', () => {
    const state = create(4, 20);
    const choice = MERGE_SIEGE_TESTING.bot(state, listMoves(state), seedRng(4));
    expect(listMoves(state)).toContainEqual(choice.move);
  });

  it('finishes every bot game within the move limit', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const run = playBot(GAME, {
        seed,
        difficulty: 40,
        policy: MERGE_SIEGE_TESTING.bot,
        maxMoves: 300,
      });
      expect(run.outcome.kind).not.toBe('playing');
    }
  });
});
