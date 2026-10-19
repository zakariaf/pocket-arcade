// apps/merge-siege/src/rules/create.test.ts
// Merge Siege is turn-based (design notes, classification): create builds the start state, then
// each swipe is applied and its events animated. Spec 10 RULES: "Start state for a level (from its
// seed and difficulty)"; spec 8.1: "The same seed always makes the same level."
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { boardText } from './board-text.ts';
import { create } from './create.ts';
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
