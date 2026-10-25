// apps/merge-siege/src/rules/create.test.ts
// Merge Siege is turn-based (design notes, classification): create builds the start state, then
// each swipe is applied and its events animated. Spec 10 RULES: "Start state for a level (from its
// seed and difficulty)"; spec 8.1: "The same seed always makes the same level."
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { boardText } from './board-text.ts';
import { FALLBACK_SEED, create, createWithin, drawStart } from './create.ts';
import { TUNING } from './merge-siege-tuning.ts';
import { MERGE_SIEGE_WITNESS, WITNESS_MAX_NODES } from './merge-siege-witness.ts';
import { outcome } from './outcome.ts';

import type { MergeSiegeState } from './merge-siege-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

/** The numbers of one kind of piece on the board, in reading order. */
function valuesOf(state: MergeSiegeState, kind: 'tile' | 'enemy'): number[] {
  return state.cells.flatMap((cell) => (cell !== null && cell.kind === kind ? [cell.value] : []));
}

const byValue = (a: number, b: number): number => a - b;

describe('create (turn-based: the start state of a level)', () => {
  it('keeps the pinned opening for seed 1 at difficulty 0 (a changed board breaks saved levels)', () => {
    const state = create(1, 0);
    expect(boardText(state.cells)).toBe(GOLDEN_SEED_1_BOARD);
    expect(state.next).toStrictEqual(GOLDEN_SEED_1_NEXT);
  });

  it('starts a run with no swipe, no smash, no score, no continue and the two opening enemies in', () => {
    expect(create(7, 30)).toMatchObject({
      difficulty: 30,
      swipes: 0,
      smashed: 0,
      score: 0,
      entered: 2,
      nextId: 6,
      hasContinued: false,
    });
  });

  it('clamps difficulties outside 0..100', () => {
    expect(create(5, -3)).toStrictEqual(create(5, 0));
    expect(create(5, 250)).toStrictEqual(create(5, ENDLESS_DIFFICULTY));
  });

  it('gives different seeds different openings', () => {
    const layouts = new Set(
      Array.from({ length: 40 }, (_, seed) => boardText(create(seed, 0).cells)),
    );
    expect(layouts.size).toBeGreaterThanOrEqual(20);
  });

  describe('every board it hands out is proven winnable (spec 8.1: no level is impossible)', () => {
    const CREATE_BUDGET = { attempts: TUNING.createAttempts, maxNodes: WITNESS_MAX_NODES };
    const isProven = (state: MergeSiegeState): boolean =>
      MERGE_SIEGE_WITNESS.solve(state, WITNESS_MAX_NODES).kind === 'solved';

    it('draws again from the seed when the witness loses its first board', () => {
      // Seed 0 at 99: the witness loses its first board, so one attempt ends in the fallback...
      const fallback = createWithin(FALLBACK_SEED, 99, CREATE_BUDGET);
      expect(createWithin(0, 99, { attempts: 1, maxNodes: WITNESS_MAX_NODES })).toStrictEqual(
        fallback,
      );
      // ...while the full budget finds a proven board of seed 0's own stream.
      expect(create(0, 99)).not.toStrictEqual(fallback);
      expect(isProven(create(0, 99))).toBe(true);
    });

    it('falls back to the proven fallback board when no draw can be proven within the budget', () => {
      const forced = createWithin(12_345, 45, { attempts: 3, maxNodes: 1 });
      expect(forced).toStrictEqual(createWithin(FALLBACK_SEED, 45, CREATE_BUDGET));
      expect(isProven(forced)).toBe(true);
    });

    it('proves the fallback board of every level difficulty 0..99 within the create budget', () => {
      for (let difficulty = 0; difficulty <= 99; difficulty += 1) {
        expect(isProven(createWithin(FALLBACK_SEED, difficulty, CREATE_BUDGET))).toBe(true);
      }
    });

    it("gives the sims the seed's first board, proven or not (create keeps it when proven)", () => {
      expect(drawStart(1, 0)).toStrictEqual(create(1, 0));
      expect(isProven(drawStart(0, 99))).toBe(false);
    });

    it('keeps the endless run (never won, so never proven) on its first board', () => {
      expect(createWithin(9, ENDLESS_DIFFICULTY, { attempts: 1, maxNodes: 1 })).toStrictEqual(
        create(9, ENDLESS_DIFFICULTY),
      );
    });

    it('proves the board of any level seed and difficulty', () => {
      fc.assert(
        fc.property(seedArb, fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
          expect(isProven(create(seed, difficulty))).toBe(true);
        }),
        { numRuns: 60 },
      );
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

    it('starts every run unfinished, with two 2-enemies, two 2s and a 4 and an enemy waiting', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(outcome(state).kind).toBe('playing');
          expect(valuesOf(state, 'enemy')).toStrictEqual([2, 2]);
          expect(valuesOf(state, 'tile').sort(byValue)).toStrictEqual([2, 2, 4]);
          expect(state.next).not.toBeNull();
        }),
      );
    });

    it('survives a JSON round trip unchanged (the run is saved as JSON)', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
        }),
      );
    });
  });
});

const GOLDEN_SEED_1_BOARD = [
  '.   .   .   .   .',
  '.   .   e2  .   .',
  '.   e2  .   .   .',
  '.   .   .   .   .',
  '.   .   2   .   .',
  '.   2   .   .   4',
].join('\n');
const GOLDEN_SEED_1_NEXT = { col: 4, value: 4 };
