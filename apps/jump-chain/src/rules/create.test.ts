// apps/jump-chain/src/rules/create.test.ts
// Jump Chain is turn-based (game-rules-engine's classification): create builds the start of a
// level, the daily or the endless run from (seed, difficulty) alone, the same on every phone.
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { isDark } from './board-squares.ts';
import { create, openingRankRows } from './create.ts';
import { TUNING, knobsFor } from './jump-chain-tuning.ts';
import { outcome } from './outcome.ts';

import type { JumpChainState } from './jump-chain-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

/** One square as text: 'P' your piece, 'x' an enemy, '.' a free dark square, ' ' a light one. */
function squareText(state: JumpChainState, col: number, row: number): string {
  if (state.piece.col === col && state.piece.row === row) return 'P';
  if (state.enemies.some((enemy) => enemy.col === col && enemy.row === row)) return 'x';
  return isDark(col, row) ? '.' : ' ';
}

/** The board as text, one line per row from the top. */
function boardText(state: JumpChainState): string {
  return Array.from({ length: TUNING.rows }, (_, row) =>
    Array.from({ length: TUNING.cols }, (_cell, col) => squareText(state, col, row)).join(''),
  ).join('\n');
}

function expectFairStart(state: JumpChainState): void {
  expect(state.piece).toStrictEqual(TUNING.pieceStart);
  expect(state.enemies.every((enemy) => isDark(enemy.col, enemy.row))).toBe(true);
  expect(state.enemies.every((enemy) => enemy.row % 2 !== 0 && enemy.row < TUNING.rows - 1)).toBe(
    true,
  );
  expect(state.enemies.map((enemy) => enemy.id)).toStrictEqual(state.enemies.map((_, id) => id));
  expect(state).toMatchObject({ total: state.enemies.length, nextId: state.enemies.length });
}

describe('create', () => {
  it('keeps the pinned board for seed 1 at difficulty 0 (a changed board breaks saved levels)', () => {
    expect(boardText(create(1, 0))).toBe(GOLDEN_SEED_1_BOARD);
  });

  it('stores the difficulty whole and inside 0..100 (the save schema range)', () => {
    expect([-4, 37.9, 180].map((difficulty) => create(1, difficulty).difficulty)).toStrictEqual([
      0, 37, 100,
    ]);
  });

  it('starts your piece in the middle of the board, two rows below the front rank', () => {
    const state = create(4, 10);
    expect(state.piece).toStrictEqual({ col: 3, row: 7 });
    expect(Math.max(...state.enemies.map((enemy) => enemy.row))).toBe(knobsFor(10).frontRow);
  });

  it('starts a run at zero with the march clock full and no continue used', () => {
    expect(create(2, 30)).toMatchObject({
      captured: 0,
      ranksCleared: 0,
      moves: 0,
      score: 0,
      marchIn: knobsFor(30).marchEvery,
      hasContinued: false,
    });
  });

  describe('openingRankRows', () => {
    it("stacks a level's ranks two rows apart upward from the front row", () => {
      const knobs = knobsFor(60);
      expect(openingRankRows(60)).toStrictEqual(
        Array.from({ length: knobs.ranks }, (_, rank) => knobs.frontRow - rank * TUNING.rankGap),
      );
    });

    it("makes the endless run's ranks up to the first row above the board, so one waits there", () => {
      const rows = openingRankRows(ENDLESS_DIFFICULTY);
      expect(rows[0]).toBe(TUNING.endlessRow.frontRow);
      expect(rows.at(-1)).toBe(-1);
      expect(rows.filter((row) => row < 0)).toHaveLength(1);
    });
  });

  it('gives each rank its id and counts the ranks made', () => {
    const state = create(8, 80);
    const rows = openingRankRows(80);
    rows.forEach((row, rank) => {
      const ranked = state.enemies.filter((enemy) => enemy.rank === rank);
      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked.every((enemy) => enemy.row === row)).toBe(true);
    });
    expect(state.nextRank).toBe(rows.length);
  });

  it('draws different layouts from different seeds', () => {
    const layouts = new Set(Array.from({ length: 20 }, (_, seed) => boardText(create(seed, 50))));
    expect(layouts.size).toBeGreaterThan(10);
  });

  describe('properties', () => {
    it('gives the same state for the same seed and difficulty', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(create(seed, difficulty)).toStrictEqual(create(seed, difficulty));
        }),
      );
    });

    it('starts every run in play, on dark squares, with the enemies in id order', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(outcome(state).kind).toBe('playing');
          expectFairStart(state);
        }),
      );
    });

    it('survives a JSON round trip unchanged (runs are saved as JSON)', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(JSON.parse(JSON.stringify(state)) as unknown).toStrictEqual(state);
        }),
      );
    });
  });
});

const GOLDEN_SEED_1_BOARD = [
  '. . . .',
  ' x x x ',
  '. . . .',
  ' x x x ',
  '. . . .',
  ' x . x ',
  '. . . .',
  ' . P . ',
  '. . . .',
  ' . . . ',
].join('\n');
