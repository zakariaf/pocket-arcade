// apps/merge-siege/src/rules/continue-run.test.ts
// Spec 8.10: "Games may allow one continue per level or run: for example the monsters are pushed
// back one row". Merge Siege's continue (design notes): every enemy is pushed back one row, an
// enemy in the top row is driven off the board, a tile in the way swaps down, and a run with no
// tile left gets a fresh 2 in the bottom row. One per run; never on a run that is still playing.
import fc from 'fast-check';

import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { applyMove } from './apply-move.ts';
import { boardText, parseBoard } from './board-text.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { MergeSiegeState } from './merge-siege-types.ts';

const EMPTY_ROW = '. . . . .';
const MAX_SWIPES = 400;
const textOf = (rows: readonly string[]): string => boardText(parseBoard(rows));

/** Seeded random play until the run ends (enemies keep coming, so a run of random swipes ends). */
function playToEnd(seed: number, difficulty: number): MergeSiegeState {
  let state = create(seed, difficulty);
  let rng = seedRng(seed);
  for (let swipe = 0; swipe < MAX_SWIPES && outcome(state).kind === 'playing'; swipe += 1) {
    const moves = listMoves(state);
    const pick = nextInt(rng, moves.length);
    rng = pick.state;
    state = applyMove(state, pickAt(moves, pick.value)).state;
  }
  return state;
}

function lostWith(
  rows: readonly string[],
  overrides: Partial<MergeSiegeState> = {},
): MergeSiegeState {
  return { ...create(1, 0), cells: parseBoard(rows), ...overrides };
}

describe('continueAfterLoss', () => {
  it('pushes every enemy back one row and swaps a tile in the way down, losing no tile', () => {
    const lost = lostWith([
      'e2 . . . .',
      '. 8 . . .',
      '. e4 . . .',
      EMPTY_ROW,
      '. . 2 . .',
      '. . e16 . .',
    ]);
    const { state, events } = continueAfterLoss(lost);
    expect(boardText(state.cells)).toBe(
      textOf([EMPTY_ROW, '. e4 . . .', '. 8 . . .', EMPTY_ROW, '. . e16 . .', '. . 2 . .']),
    );
    expect(events).toStrictEqual([
      {
        kind: 'enemies-pushed-back',
        steps: [
          { id: 3, from: 11, to: 6 },
          { id: 2, from: 6, to: 11 },
          { id: 5, from: 27, to: 22 },
          { id: 4, from: 22, to: 27 },
        ],
        drivenOff: [1],
      },
    ]);
    expect(state).toMatchObject({ hasContinued: true });
  });

  it('drops a fresh 2 into the middle of the bottom row when no tile is left', () => {
    const lost = lostWith([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, 'e4 . . . .'], {
      nextId: 40,
    });
    const { state, events } = continueAfterLoss(lost);
    expect(state.cells[27]).toStrictEqual({ id: 40, kind: 'tile', value: 2 });
    expect(events).toContainEqual({ kind: 'tile-spawned', id: 40, cell: 27, value: 2 });
    expect(state.nextId).toBe(41);
    expect(outcome(state).kind).toBe('playing');
  });

  it('refuses a second continue in the same run', () => {
    const lost = lostWith([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '2 . . . .', 'e4 . . . .'], {
      hasContinued: true,
    });
    expect(() => continueAfterLoss(lost)).toThrow(RangeError);
  });

  it('refuses a continue on a run that is still playing', () => {
    expect(() => continueAfterLoss(create(1, 0))).toThrow(RangeError);
  });

  describe('properties', () => {
    it('makes every lost run playing again, from any seed and difficulty', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4_294_967_295 }),
          fc.integer({ min: 0, max: 100 }),
          (seed, difficulty) => {
            const end = playToEnd(seed, difficulty);
            if (outcome(end).kind !== 'lost') return;
            const { state } = continueAfterLoss(end);
            expect(outcome(state)).toStrictEqual({ kind: 'playing' });
            expect(listMoves(state).length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 60 },
      );
    });
  });
});
