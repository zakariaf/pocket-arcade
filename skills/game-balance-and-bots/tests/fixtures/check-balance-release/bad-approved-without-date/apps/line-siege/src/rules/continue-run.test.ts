// apps/line-siege/src/rules/continue-run.test.ts
import fc from 'fast-check';

import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss, fullestRows } from './continue-run.ts';
import { create } from './create.ts';
import { TUNING } from './line-siege-tuning.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { SINGLE_BLOCK } from './pieces.ts';

import type { Cell, LineSiegeState } from './line-siege-types.ts';

const SIZE = TUNING.boardSize;
const MAX_PLACEMENTS = 400;

/** Seeded random play until the run ends (a run always ends: pressure keeps rising). */
function playToEnd(seed: number, difficulty: number): LineSiegeState {
  let state = create(seed, difficulty);
  let rng = seedRng(seed);
  for (let placed = 0; placed < MAX_PLACEMENTS && outcome(state).kind === 'playing'; placed += 1) {
    const moves = listMoves(state);
    const pick = nextInt(rng, moves.length);
    rng = pick.state;
    state = applyMove(state, pickAt(moves, pick.value)).state;
  }
  return state;
}

/** Every cell filled except one per row, never two holes on top of each other. */
function oneHolePerRow(): Cell[] {
  const holes = [0, 2, 4, 6, 1, 3, 5, 7];
  return Array.from({ length: SIZE * SIZE }, (_, index): Cell =>
    index % SIZE === holes[Math.floor(index / SIZE)] ? 0 : 1,
  );
}

/** A board-full loss: rows 1-6 hold seven blocks, rows 0 and 7 four; only a 2x2 square is offered. */
function boardFull(): LineSiegeState {
  const cells = oneHolePerRow().map((cell, index): Cell => {
    const row = Math.floor(index / SIZE);
    if (row === 0) return index % 2 === 0 ? 0 : 1;
    if (row === 7) return index % 2 === 1 ? 0 : 1;
    return cell;
  });
  return { ...create(1, 0), cells, tray: [5, null, null] };
}

/** The last heart lost to a breach, with monsters close to the wall. */
function breached(): LineSiegeState {
  const start = create(1, 0);
  const monsters = start.monsters.map((monster) => ({ ...monster, row: 5 }));
  return { ...start, hearts: 0, monsters, score: 60 };
}

describe('continueAfterLoss', () => {
  describe('when the last heart was lost to a breach', () => {
    it('gives one heart back and pushes every monster three rows back', () => {
      const lost = breached();
      expect(outcome(lost).kind).toBe('lost');
      const { state, events } = continueAfterLoss(lost);
      expect(state.hearts).toBe(1);
      expect(state.monsters.map((monster) => monster.row)).toStrictEqual([2, 2, 2]);
      expect(events.slice(0, 2)).toStrictEqual([
        { kind: 'heart-restored', hearts: 1 },
        { kind: 'monsters-pushed-back', rows: 3 },
      ]);
      expect(outcome(state)).toStrictEqual({ kind: 'playing' });
    });

    it('keeps the board, the score and the placements, and never pushes past row 0', () => {
      const lost = { ...breached(), monsters: [{ id: 9, kind: 'fast', lane: 0, row: 1, hp: 4 }] };
      const { state, events } = continueAfterLoss(lost as LineSiegeState);
      expect(state.monsters[0]?.row).toBe(0);
      expect(state.cells).toStrictEqual(lost.cells);
      expect([state.score, state.placements]).toStrictEqual([60, 0]);
      expect(events.map((event) => event.kind)).not.toContain('rows-emptied');
    });
  });

  describe('when no offered block fits (board full)', () => {
    it('empties the two fullest rows without scoring, then redraws the tray', () => {
      const lost = boardFull();
      expect(outcome(lost)).toStrictEqual({
        kind: 'lost',
        reasonKey: 'line-siege.lose.board-full',
      });
      const { state, events } = continueAfterLoss(lost);
      expect(events.map((event) => event.kind)).toStrictEqual([
        'monsters-pushed-back',
        'rows-emptied',
        'tray-refilled',
      ]);
      expect(events[1]).toStrictEqual({ kind: 'rows-emptied', rows: [1, 2] });
      expect(state.cells.slice(SIZE, 3 * SIZE).every((cell) => cell === 0)).toBe(true);
      expect([state.score, state.hearts]).toStrictEqual([lost.score, lost.hearts]);
      expect(outcome(state)).toStrictEqual({ kind: 'playing' });
    });
  });

  it('puts the single block in the first slot when no redrawn block would fit', () => {
    const lost = { ...breached(), cells: oneHolePerRow(), tray: [SINGLE_BLOCK, null, null] };
    const { state, events } = continueAfterLoss(lost);
    expect(state.tray[0]).toBe(SINGLE_BLOCK);
    expect(events.at(-1)).toStrictEqual({ kind: 'tray-refilled', tray: state.tray });
    expect(outcome(state)).toStrictEqual({ kind: 'playing' });
  });

  it('turns every lost run from seeded random play into a run that is no longer lost', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 100 }), (seed, difficulty) => {
        const end = playToEnd(seed, difficulty);
        if (outcome(end).kind !== 'lost') return;
        const rescued = continueAfterLoss(end).state;
        expect(outcome(rescued).kind).not.toBe('lost');
        expect(JSON.parse(JSON.stringify(rescued))).toStrictEqual(rescued);
      }),
      { seed: 29, numRuns: 150 },
    );
  });
});

describe('fullestRows', () => {
  it('picks the rows with the most blocks, the lower row first on a tie, in board order', () => {
    expect(fullestRows(boardFull().cells, 2)).toStrictEqual(GOLDEN_FULLEST_ROWS);
  });
});

/** Rows 1-6 hold seven blocks each; rows 0 and 7 only four. */
const GOLDEN_FULLEST_ROWS = [1, 2];
