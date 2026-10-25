// apps/jump-chain/src/rules/create.test.ts
// Jump Chain is turn-based (game-rules-engine's classification): create builds the start of a
// level, the daily or the endless run from (seed, difficulty) alone, the same on every phone.
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { addDays } from '@e07/game-kit/dates/date-key.ts';
import {
  JUMP_CHAIN_DAILY_DIFFICULTY,
  JUMP_CHAIN_DAILY_SALT,
  JUMP_CHAIN_LEVELS,
} from '@e07/jump-chain/levels/jump-chain-levels.ts';
import { JUMP_CHAIN_SOLVER, WITNESS_MAX_NODES } from '@e07/jump-chain/levels/jump-chain-solver.ts';

import { isDark } from './board-squares.ts';
import {
  CREATE_BUDGET,
  FALLBACK_SEED,
  create,
  createLayout,
  createWithin,
  openingRankRows,
} from './create.ts';
import { TUNING, knobsFor } from './jump-chain-tuning.ts';
import { outcome } from './outcome.ts';

import type { JumpChainMove, JumpChainState } from './jump-chain-types.ts';
import type { Solver } from '@e07/game-kit/contract/levels.ts';

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

/** The witness (the greedy bot) wins the run from this start: the proof every level ships with. */
function isProven(state: JumpChainState): boolean {
  return JUMP_CHAIN_SOLVER.solve(state, WITNESS_MAX_NODES).kind === 'solved';
}

/** The witness, counting how often create() asks it. */
function countingSolver(): {
  readonly solver: Solver<JumpChainState, JumpChainMove>;
  readonly solves: () => number;
} {
  let solves = 0;
  return {
    solver: {
      solve: (start, maxNodes) => {
        solves += 1;
        return JUMP_CHAIN_SOLVER.solve(start, maxNodes);
      },
    },
    solves: () => solves,
  };
}

/** One difficulty inside each level row (rowFor bands 0-24, 25-49, 50-74, 75-99). */
const ROW_DIFFICULTIES = [0, 24, 25, 49, 50, 74, 75, 99];

describe('create, proven winnable (spec 8.1: no level is impossible)', () => {
  // Spec 8.3: the daily comes from the date "through the same generator as normal levels", so its
  // board is proven like a level's; before, 116 of 730 daily boards from 2026-10-01 were unproven.
  it('hands out a witness-proven daily for every date of two years', () => {
    const unproven = Array.from({ length: 730 }, (_, day) => {
      const date = addDays('2026-10-01', day);
      const seed = dailySeed(date, JUMP_CHAIN_DAILY_SALT);
      return isProven(create(seed, JUMP_CHAIN_DAILY_DIFFICULTY)) ? null : date;
    }).filter((date) => date !== null);
    expect(unproven).toStrictEqual([]);
  });

  it('hands out only proven boards at every level difficulty', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        expect(isProven(create(seed, difficulty))).toBe(true);
      }),
    );
  });

  it('keeps a proven seed’s own board, so every shipped level keeps its board', () => {
    expect(isProven(createWithin(1, 0, { attempts: 1, maxNodes: WITNESS_MAX_NODES }))).toBe(true);
    expect(create(1, 0)).toStrictEqual(
      createWithin(1, 0, { attempts: 1, maxNodes: WITNESS_MAX_NODES }),
    );
  });

  it('falls back to the fallback seed’s board when no try is proven within the budget', () => {
    const fallback = createWithin(FALLBACK_SEED, 45, { attempts: 1, maxNodes: WITNESS_MAX_NODES });
    expect(createWithin(2, 45, { attempts: 3, maxNodes: 0 })).toStrictEqual(fallback);
    expect(create(2, 45)).not.toStrictEqual(fallback);
  });

  it('proves the fallback board winnable in every level row', () => {
    const budget = { attempts: 1, maxNodes: WITNESS_MAX_NODES };
    const rows = ROW_DIFFICULTIES.map((difficulty) =>
      isProven(createWithin(FALLBACK_SEED, difficulty, budget)),
    );
    expect(rows).toStrictEqual(ROW_DIFFICULTIES.map(() => true));
  });

  // Spec 15.7: every shipped level is proven when the packs are generated (the levels contract test
  // replays each witness line), so starting one need not search again.
  it('hands out a shipped level’s own board without running the witness again', () => {
    const counting = countingSolver();
    for (const entry of JUMP_CHAIN_LEVELS.table) {
      const state = createWithin(entry.seed, entry.difficulty, {
        ...CREATE_BUDGET,
        solver: counting.solver,
      });
      expect(state).toStrictEqual(createLayout(entry.seed, entry.difficulty));
    }
    expect(counting.solves()).toBe(0);
  });

  it('keeps running the witness for the daily and for any seed no pack ships', () => {
    const counting = countingSolver();
    const seed = dailySeed('2026-10-25', JUMP_CHAIN_DAILY_SALT);
    createWithin(seed, JUMP_CHAIN_DAILY_DIFFICULTY, { ...CREATE_BUDGET, solver: counting.solver });
    createWithin(2, 45, { ...CREATE_BUDGET, solver: counting.solver });
    expect(counting.solves()).toBeGreaterThanOrEqual(2);
  });

  it('leaves the endless run unsearched, as it has no win to prove', () => {
    expect(createWithin(6, ENDLESS_DIFFICULTY, { attempts: 3, maxNodes: 0 })).toStrictEqual(
      create(6, ENDLESS_DIFFICULTY),
    );
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
