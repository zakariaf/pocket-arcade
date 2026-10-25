// apps/poker-drop/src/rules/continue-run.test.ts
import fc from 'fast-check';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss, topCells } from './continue-run.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { parseState } from './poker-drop-persistence.ts';
import { COLS } from './well.ts';

import type { PokerDropState } from './poker-drop-types.ts';

/** A lost run: every cell of the well holds a card. */
function lostRun(seed: number, difficulty: number): PokerDropState {
  const start = create(seed, difficulty);
  return { ...start, cells: start.cells.map((_, index) => index % 52), drops: 25, handsMade: 1 };
}

/** A run lost to a rising row that overflowed, with room left in some column. */
function overflowedRun(seed: number): PokerDropState {
  const start = create(seed, 50);
  const cells = start.cells.map((cell, index) => (index % COLS === 4 ? index : cell));
  return { ...start, cells, hasOverflowed: true };
}

const emptyCount = (state: PokerDropState): number =>
  state.cells.filter((cell) => cell === null).length;

describe('continueAfterLoss', () => {
  // spec 8.10: "Games may allow one continue per level or run"; Poker Drop clears the top row.
  it('empties the top row of the well, keeping the hand, the score and the drops', () => {
    const lost = lostRun(1, 30);
    const { state, events } = continueAfterLoss(lost);
    expect(topCells(1)).toStrictEqual([25, 26, 27, 28, 29]);
    expect(state.cells.slice(25)).toStrictEqual([null, null, null, null, null]);
    expect(state.cells.slice(0, 25)).toStrictEqual(lost.cells.slice(0, 25));
    expect(state).toMatchObject({
      hand: lost.hand,
      score: lost.score,
      drops: 25,
      hasContinued: true,
    });
    expect(events).toStrictEqual([
      {
        kind: 'top-row-cleared',
        cells: [25, 26, 27, 28, 29],
        cards: [25, 26, 27, 28, 29],
        atMs: 0,
      },
    ]);
  });

  it('makes the run playable again, with room in every column', () => {
    const { state } = continueAfterLoss(lostRun(2, 80));
    expect(outcome(state).kind).toBe('playing');
    expect(listMoves(state)).toHaveLength(COLS);
  });

  it('rescues a run lost to an overflowing rise, clearing only the cards of the top row', () => {
    const { state, events } = continueAfterLoss(overflowedRun(4));
    expect(state.hasOverflowed).toBe(false);
    expect(outcome(state).kind).toBe('playing');
    expect(events).toStrictEqual([{ kind: 'top-row-cleared', cells: [29], cards: [29], atMs: 0 }]);
  });

  it('refuses a second continue in the same run, and a run that is not lost', () => {
    const once = continueAfterLoss(lostRun(3, 0)).state;
    const lostAgain = { ...once, cells: once.cells.map((_, index) => index % 52) };
    expect(() => continueAfterLoss(lostAgain)).toThrow(RangeError);
    expect(() => continueAfterLoss(create(3, 0))).toThrow(RangeError);
  });

  it('rescues every lost run of any seed and difficulty', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 100 }),
        (seed, difficulty) => {
          const { state } = continueAfterLoss(lostRun(seed, difficulty));
          expect(outcome(state).kind).toBe('playing');
          expect(emptyCount(state)).toBe(COLS);
        },
      ),
    );
  });

  it('leaves every run lost by real play in play, as a run that saves and loads back', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.nat(), { minLength: 200, maxLength: 200 }),
        (seed, difficulty, choices) => {
          let state = create(seed, difficulty);
          for (const choice of choices) {
            const moves = listMoves(state);
            const move = moves[choice % Math.max(moves.length, 1)];
            if (move === undefined) break;
            state = applyMove(state, move).state;
          }
          if (outcome(state).kind !== 'lost') return;
          const rescued = continueAfterLoss(state).state;
          expect(outcome(rescued).kind).toBe('playing');
          expect(parseState(JSON.parse(JSON.stringify(rescued)))).toStrictEqual(rescued);
        },
      ),
      { numRuns: 40 },
    );
  });
});
