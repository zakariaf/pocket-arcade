// apps/poker-drop/src/testing/poker-drop-testing.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { playBot } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { continueAfterLoss } from '@e07/poker-drop/rules/continue-run.ts';
import { create } from '@e07/poker-drop/rules/create.ts';
import { listMoves } from '@e07/poker-drop/rules/list-moves.ts';
import { outcome } from '@e07/poker-drop/rules/outcome.ts';
import { parseState } from '@e07/poker-drop/rules/poker-drop-persistence.ts';

import { POKER_DROP_TESTING, playToEnd } from './poker-drop-testing.ts';

import type { PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';

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

  // The examples are saved like any run (the debug menu, E2E setup), so each must be a state
  // legal play reaches: parseState drops a run no play can reach (spec 8.14).
  it.each(['start', 'middle', 'win', 'lose'] as const)(
    'gives a %s example that saves and loads back unchanged',
    (name) => {
      const example: PokerDropState = POKER_DROP_TESTING.examples[name]();
      expect(parseState(JSON.parse(JSON.stringify(example)))).toStrictEqual(example);
    },
  );

  it('reaches the win example from the start, dropping into the leftmost open column', () => {
    const won = playToEnd(POKER_DROP_TESTING.examples.start(), 'leftmost');
    expect(won).toStrictEqual(POKER_DROP_TESTING.examples.win());
    expect(won.drops).toBe(20);
    expect(won.score).toBe(220);
  });

  it('reaches the lose example from the start, dropping into the rightmost open column', () => {
    const lost = playToEnd(POKER_DROP_TESTING.examples.start(), 'rightmost');
    expect(lost).toStrictEqual(POKER_DROP_TESTING.examples.lose());
    expect(lost.hasOverflowed).toBe(true);
  });

  // spec 8.10: the continue brings the same run back to play, and it stays a run legal play reaches.
  it('keeps the lose example in play after its continue and one more drop', () => {
    const rescued = continueAfterLoss(POKER_DROP_TESTING.examples.lose()).state;
    expect(outcome(rescued).kind).toBe('playing');
    expect(parseState(JSON.parse(JSON.stringify(rescued)))).toStrictEqual(rescued);
    const [first] = listMoves(rescued);
    if (first === undefined) throw new Error('the rescued run has no move');
    const dropped = applyMove(rescued, first).state;
    expect(dropped.drops).toBe(rescued.drops + 1);
    expect(outcome(dropped).kind).toBe('playing');
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
