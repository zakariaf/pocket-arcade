// apps/poker-drop/src/rules/create.test.ts
// Poker Drop is a simulate-then-replay game (the cascade runs inside applyMove and is replayed as
// a timeline) played with a tap on the column to drop into (panMode 'none').
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { rankOf } from './cards.ts';
import { create } from './create.ts';
import { outcome } from './outcome.ts';
import { TUNING, knobsFor } from './poker-drop-tuning.ts';
import { COLS, ROWS, cellIndex } from './well.ts';

import type { Card, Cell, PokerDropState } from './poker-drop-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

/** Readable well text for pinned goldens: top row first, '..' for an empty cell, else rank+suit. */
function wellText(cells: readonly Cell[]): string {
  const RANK = '..23456789TJQKA';
  const SUIT = 'shdc';
  const rows: string[] = [];
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    const line: string[] = [];
    for (let col = 0; col < COLS; col += 1) {
      const card = cells[cellIndex(col, row)] ?? null;
      line.push(
        card === null ? '..' : `${RANK[rankOf(card)] ?? '?'}${SUIT[Math.floor(card / 13)] ?? '?'}`,
      );
    }
    rows.push(line.join(' '));
  }
  return rows.join('\n');
}

/** Every card of a state: in hand, next, the pile and the well. */
function allCards(state: PokerDropState): Card[] {
  const inWell = state.cells.filter((card): card is Card => card !== null);
  return [state.hand, state.next, ...state.pile, ...inWell];
}

function lowestRank(cards: readonly Card[]): number {
  return Math.min(...cards.map(rankOf));
}

function cardCount(cells: readonly Cell[]): number {
  return cells.filter((card) => card !== null).length;
}

describe('create (simulate-then-replay rules: a tap drops a card, the cascade is replayed)', () => {
  // spec 8.1: "Levels are generated from a seed number plus a difficulty ... The same seed always
  // makes the same level."
  it('keeps the pinned well for seed 1 at difficulty 0 (a changed well breaks saved levels)', () => {
    const state = create(1, 0);
    expect(wellText(state.cells)).toBe(GOLDEN_SEED_1_WELL);
    expect([state.hand, state.next]).toStrictEqual(GOLDEN_SEED_1_HAND_NEXT);
  });

  it('starts an empty run of the level goal: no hands, no score, no drops, no continue', () => {
    const state = create(9, 30);
    expect(state).toMatchObject({
      handsMade: 0,
      score: 0,
      drops: 0,
      hasOverflowed: false,
      hasContinued: false,
      goal: 8,
      difficulty: 30,
    });
  });

  it('deals the opening rows of the tuning row into the well, beside one empty column', () => {
    expect(cardCount(create(3, 0).cells)).toBe(4 * knobsFor(0).openingRows);
    expect(cardCount(create(3, 80).cells)).toBe(4 * knobsFor(80).openingRows);
  });

  it('plays the endless run at difficulty 100 with goal 0 and the full deck', () => {
    const state = create(4, ENDLESS_DIFFICULTY);
    expect(state.goal).toBe(0);
    const ranks = new Set([state.hand, state.next, ...state.pile].map(rankOf));
    expect(Math.min(...ranks)).toBe(TUNING.endlessRow.minRank);
  });

  it('clamps difficulties outside 0..100', () => {
    expect(create(5, -3)).toStrictEqual(create(5, 0));
    expect(create(5, 250)).toStrictEqual(create(5, 100));
  });

  describe('properties', () => {
    it('gives the same state for the same seed and difficulty', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(create(seed, difficulty)).toStrictEqual(create(seed, difficulty));
        }),
      );
    });

    it('gives different seeds different deals', () => {
      fc.assert(
        fc.property(seedArb, seedArb, difficultyArb, (a, b, difficulty) => {
          fc.pre(a !== b);
          const one = create(a, difficulty);
          const two = create(b, difficulty);
          expect([one.hand, one.next, ...one.pile]).not.toStrictEqual([
            two.hand,
            two.next,
            ...two.pile,
          ]);
        }),
      );
    });

    it('holds each card of the deck once, only of the ranks the row allows', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const cards = allCards(create(seed, difficulty));
          const minRank = knobsFor(difficulty).minRank;
          expect(new Set(cards).size).toBe(cards.length);
          expect(cards).toHaveLength((15 - minRank) * 4);
          expect(lowestRank(cards)).toBe(minRank);
        }),
      );
    });

    it('starts every game unfinished, with room in the well', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(outcome(create(seed, difficulty)).kind).toBe('playing');
        }),
      );
    });
  });
});

/** Seed 1, difficulty 0: the gap is column 5, two prepared rows of two pair, the 9 of hearts in hand. */
const GOLDEN_SEED_1_WELL = [
  '.. .. .. .. ..',
  '.. .. .. .. ..',
  '.. .. .. .. ..',
  '.. .. .. .. ..',
  'Th Qc Qh Td ..',
  'Jc Kh Jd Kd ..',
].join('\n');
const GOLDEN_SEED_1_HAND_NEXT = [20, 33];
