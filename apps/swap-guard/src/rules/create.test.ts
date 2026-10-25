// apps/swap-guard/src/rules/create.test.ts
// Classification (new-game step 2): Swap Guard is turn-based: the swap applies, then its events
// animate. It is played with a tap on the square to swap with (engine.panMode 'none').
import fc from 'fast-check';

import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { addDays } from '@e07/game-kit/dates/date-key.ts';
import {
  SWAP_GUARD_DAILY_DIFFICULTY,
  SWAP_GUARD_DAILY_SALT,
} from '@e07/swap-guard/levels/swap-guard-levels.ts';

import { applyMove } from './apply-move.ts';
import { create, joinersOf, openingsOf, startFor } from './create.ts';
import { outcome } from './outcome.ts';
import { planLine } from './plan-line.ts';
import { strikesOf, struckSquares } from './strikes.ts';
import { knobsFor } from './swap-guard-tuning.ts';

import type { Opening } from './create.ts';
import type { DifficultyKnobs } from './swap-guard-tuning.ts';
import type { Enemy, SwapGuardState } from './swap-guard-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

/** Fixed knobs for the pinned board, so a later tuning change never moves this golden. */
const GOLDEN_KNOBS: DifficultyKnobs = {
  size: 5,
  enemies: 4,
  kinds: ['spear', 'archer'],
  maxSwaps: 12,
  spareSwaps: 2,
};

const LETTERS = { spear: 's', archer: 'a', brute: 'b' } as const;
const ARROWS = { up: '^', right: '>', down: 'v', left: '<' } as const;

function squareText(state: SwapGuardState, cell: number): string {
  if (cell === state.guard) return 'G.';
  const enemy = state.enemies.find((e) => e.cell === cell);
  if (enemy === undefined) return '..';
  return `${LETTERS[enemy.kind]}${enemy.kind === 'brute' ? '+' : ARROWS[enemy.facing]}`;
}

/** Readable board text for pinned goldens: G the guard, s/a/b an enemy and its facing. */
function boardText(state: SwapGuardState): string {
  const rows: string[] = [];
  for (let row = 0; row < state.size; row += 1) {
    const cells = Array.from({ length: state.size }, (_, col) =>
      squareText(state, row * state.size + col),
    );
    rows.push(cells.join(' '));
  }
  return rows.join('\n');
}

/** Every square a piece stands on: the guard first, then the enemies. */
function squaresOf(state: SwapGuardState): number[] {
  return [state.guard, ...state.enemies.map((e) => e.cell)];
}

/** The ids of the enemies standing on a struck square. */
function struckIdsOf(state: SwapGuardState): number[] {
  const struck = struckSquares(strikesOf(state));
  return state.enemies.filter((e) => struck.has(e.cell)).map((e) => e.id);
}

/** The outcome of the partner swap on every opening pair alone, with the row's fallback budget. */
function fallbackOutcomes(knobs: DifficultyKnobs, openings: readonly Opening[]): string[] {
  const base = startFor(1, knobs);
  return openings.map((opening) => {
    const pair: SwapGuardState = {
      ...base,
      guard: opening.guard,
      enemies: [opening.threat, opening.partner],
      enemyCount: 2,
      maxSwaps: 1 + knobs.spareSwaps,
    };
    return outcome(applyMove(pair, { kind: 'swap', cell: opening.partner.cell }).state).kind;
  });
}

/** The outcome of playing planLine's own line from a start through applyMove ('none': no line). */
function plannedOutcome(start: SwapGuardState): string {
  const line = planLine(start);
  if (line === null) return 'none';
  return outcome(line.reduce((state, move) => applyMove(state, move).state, start)).kind;
}

describe('create (turn-based: the swap applies, then its events animate)', () => {
  it('keeps the pinned board for seed 1 (a changed board breaks saved levels)', () => {
    expect(boardText(startFor(1, GOLDEN_KNOBS))).toBe(GOLDEN_SEED_1_BOARD);
  });

  it('starts every run on its row of the tuning table, with no swap made', () => {
    const state = create(7, 60);
    expect(state.size).toBe(knobsFor(60).size);
    expect(state.enemies).toHaveLength(knobsFor(60).enemies);
    expect(state.enemyCount).toBe(knobsFor(60).enemies);
    expect(state).toMatchObject({ swaps: 0, score: 0 });
    expect(state).toMatchObject({ isHit: false, lastSwap: null, hasContinued: false });
  });

  it('falls back to the opening pair when no drawn start can be won within the swaps', () => {
    const knobs = { size: 5, enemies: 3, kinds: ['spear'], maxSwaps: 1, spareSwaps: 0 } as const;
    const state = startFor(1, knobs);
    expect(state.enemies.map((e) => e.id)).toStrictEqual([0, 1]);
    expect(state.enemyCount).toBe(2);
  });

  it('proves every fallback opening pair won by its one swap, on every row (spec 8.1)', () => {
    // The fallback is any opening pair of the row with a budget of one swap plus the spare ones:
    // every opening of every board size and partner kind must win with the partner swap, so a
    // start that falls back (a daily included) is never unwinnable.
    const rows = [0, 25, 50, 75].map((difficulty) => knobsFor(difficulty));
    const won = rows.flatMap((knobs) =>
      knobs.kinds.flatMap((kind) => fallbackOutcomes(knobs, openingsOf(knobs.size, kind))),
    );
    expect(won.length).toBeGreaterThan(100);
    expect(new Set(won)).toStrictEqual(new Set(['won']));
  });

  // Spec 8.3: the daily runs "through the same generator as normal levels", and spec 8.1: no level
  // is impossible. Two years of dailies from 2026-10-01: create never throws, and planLine's line,
  // played through applyMove within the board's own budget, wins every one.
  it('hands out a board won within its budget for every daily of two years', () => {
    const outcomes = Array.from({ length: 730 }, (_, day) => {
      const seed = dailySeed(addDays('2026-10-01', day), SWAP_GUARD_DAILY_SALT);
      return plannedOutcome(create(seed, SWAP_GUARD_DAILY_DIFFICULTY));
    });
    expect(outcomes.filter((kind) => kind !== 'won')).toStrictEqual([]);
  });

  it('clamps difficulties outside 0..100', () => {
    expect(create(5, -3)).toStrictEqual(create(5, 0));
    expect(create(5, 250)).toStrictEqual(create(5, 100));
  });

  describe('openingsOf', () => {
    it('puts the guard in a spear strike, with a second enemy diagonal to it striking the spear', () => {
      expect(openingsOf(5, 'spear')[0]).toStrictEqual({
        guard: 0,
        threat: { id: 0, kind: 'spear', facing: 'left', cell: 1 },
        partner: { id: 1, kind: 'spear', facing: 'up', cell: 6 },
      });
    });

    it('turns a brute partner to face up, as every brute does', () => {
      const openings = openingsOf(5, 'brute');
      expect(openings.length).toBeGreaterThan(0);
      expect(openings.every((opening) => opening.partner.facing === 'up')).toBe(true);
    });
  });

  describe('joinersOf', () => {
    it('offers no joiner on a board without a free square', () => {
      const crowd: Enemy[] = Array.from({ length: 24 }, (_, index) => ({
        id: index,
        kind: 'spear',
        facing: 'up',
        cell: index + 1,
      }));
      expect(joinersOf({ size: 5, guard: 0, enemies: crowd }, ['spear'])).toStrictEqual([]);
    });
  });

  describe('properties', () => {
    it('gives the same state for the same seed and difficulty', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(create(seed, difficulty)).toStrictEqual(create(seed, difficulty));
        }),
      );
    });

    it('gives different layouts for different seeds', () => {
      const layouts = new Set(Array.from({ length: 60 }, (_, seed) => boardText(create(seed, 30))));
      expect(layouts.size).toBeGreaterThan(55);
    });

    it('fills every start with the enemies of its row (no fallback to the opening pair)', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(create(seed, difficulty).enemies).toHaveLength(knobsFor(difficulty).enemies);
        }),
      );
    });

    it('starts every game unfinished, every piece on its own square, kinds from its row', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(outcome(state).kind).toBe('playing');
          expect(new Set(squaresOf(state)).size).toBe(state.enemies.length + 1);
          for (const e of state.enemies) expect(knobsFor(difficulty).kinds).toContain(e.kind);
        }),
      );
    });

    it('gives each start its planned line plus the spare swaps of its row, within the cap', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          const knobs = knobsFor(difficulty);
          const planned = planLine({ ...state, maxSwaps: knobs.maxSwaps })?.length ?? Number.NaN;
          expect(state.maxSwaps).toBe(Math.min(knobs.maxSwaps, planned + knobs.spareSwaps));
        }),
      );
    });

    it('opens with the guard in a strike and only the threatening spear struck', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(struckSquares(strikesOf(state)).has(state.guard)).toBe(true);
          expect(struckIdsOf(state)).toStrictEqual([0]);
        }),
      );
    });
  });
});

const GOLDEN_SEED_1_BOARD = [
  '.. .. s> .. ..',
  '.. G. .. sv ..',
  '.. s^ s< .. ..',
  '.. .. .. .. ..',
  '.. .. .. .. ..',
].join('\n');
