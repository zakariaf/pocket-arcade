// apps/poker-drop/src/rules/create.test.ts
// Poker Drop is a simulate-then-replay game (the cascade runs inside applyMove and is replayed as
// a timeline) played with a tap on the column to drop into (panMode 'none').
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { rankOf } from './cards.ts';
import { FALLBACK_SEED, create, createWithin, drawStart } from './create.ts';
import { outcome } from './outcome.ts';
import { TUNING, knobsFor } from './poker-drop-tuning.ts';
import { POKER_DROP_WITNESS, WITNESS_MAX_NODES } from './poker-drop-witness.ts';
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

  // spec 8.1: "each level is checked by a solver before it ships, so no level is impossible";
  // spec 8.3: the daily is a level made from the date's seed, so create() proves it too.
  describe('every board it hands out is proven winnable', () => {
    const CREATE_BUDGET = { attempts: TUNING.createAttempts, maxNodes: WITNESS_MAX_NODES };
    const isProven = (state: PokerDropState): boolean =>
      POKER_DROP_WITNESS.solve(state, WITNESS_MAX_NODES).kind === 'solved';

    it('draws again from the seed when the witness loses its first board', () => {
      // Seed 0 at 99: the witness loses its first board, so one attempt ends in the fallback...
      expect(isProven(drawStart(0, 99))).toBe(false);
      const fallback = createWithin(FALLBACK_SEED, 99, CREATE_BUDGET);
      expect(createWithin(0, 99, { attempts: 1, maxNodes: WITNESS_MAX_NODES })).toStrictEqual(
        fallback,
      );
      // ...while the full budget finds a proven board of seed 0's own stream.
      expect(create(0, 99)).not.toStrictEqual(fallback);
      expect(isProven(create(0, 99))).toBe(true);
    });

    it('proves the daily difficulty board of a seed whose first board the witness loses', () => {
      expect(isProven(drawStart(34, 45))).toBe(false);
      expect(isProven(create(34, 45))).toBe(true);
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

    it("keeps the seed's first board when the witness wins it", () => {
      expect(create(1, 0)).toStrictEqual(drawStart(1, 0));
    });

    it('keeps the endless run (never won, so never proven) on its first board', () => {
      expect(createWithin(9, ENDLESS_DIFFICULTY, { attempts: 1, maxNodes: 1 })).toStrictEqual(
        drawStart(9, ENDLESS_DIFFICULTY),
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
