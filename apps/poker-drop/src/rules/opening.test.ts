// apps/poker-drop/src/rules/opening.test.ts
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { deckOf, rankOf, shuffled } from './cards.ts';
import { dealOpening } from './opening.ts';
import { cellIndex, COLS, heightOf } from './well.ts';

import type { DifficultyKnobs } from './poker-drop-tuning.ts';
import type { Card } from './poker-drop-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const KNOBS: DifficultyKnobs = {
  goal: 6,
  minRank: 9,
  openingRows: 3,
  preparedRows: 2,
  riseEvery: 8,
};

function opening(seed: number, knobs: DifficultyKnobs = KNOBS) {
  const deck = shuffled(deckOf(knobs.minRank), seedRng(seed));
  const [hand, ...pile] = deck.cards as [Card, ...Card[]];
  return { hand, pile, dealt: dealOpening(pile, deck.rng, { knobs, hand }) };
}

/** How many cards share each rank, smallest group first. */
function groupSizes(ranks: readonly number[]): number[] {
  const sizes = new Map<number, number>();
  for (const rank of ranks) sizes.set(rank, (sizes.get(rank) ?? 0) + 1);
  return [...sizes.values()].sort((a, b) => a - b);
}

/** The ranks of one opening row, left to right, without the gap. */
function rowRanks(cells: readonly (Card | null)[], row: number): number[] {
  const ranks: number[] = [];
  for (let col = 0; col < COLS; col += 1) {
    const card = cells[cellIndex(col, row)] ?? null;
    if (card !== null) ranks.push(rankOf(card));
  }
  return ranks;
}

describe('dealOpening', () => {
  // game-balance-and-bots, kill test: the first payoff within 1 to 3 drops on the easiest level.
  it('leaves one gap column empty and deals the opening rows into the other four', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { dealt } = opening(seed);
        for (let col = 0; col < COLS; col += 1) {
          expect(heightOf(dealt.cells, col)).toBe(col === dealt.gap ? 0 : KNOBS.openingRows);
        }
      }),
    );
  });

  it('deals each prepared row as two pair, of ranks other than the card in hand', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { hand, dealt } = opening(seed);
        for (let row = 0; row < KNOBS.preparedRows; row += 1) {
          const ranks = rowRanks(dealt.cells, row);
          expect(groupSizes(ranks)).toStrictEqual([2, 2]);
          expect(ranks).not.toContain(rankOf(hand));
        }
      }),
    );
  });

  it('deals every card once: the well and the pile left are the pile given', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { pile, dealt } = opening(seed);
        const used = dealt.cells.filter((card): card is Card => card !== null);
        expect([...used, ...dealt.pile].sort((a, b) => a - b)).toStrictEqual(
          [...pile].sort((a, b) => a - b),
        );
      }),
    );
  });

  it('deals plain rows from the front of the pile when no row is prepared', () => {
    const { pile, dealt } = opening(7, { ...KNOBS, openingRows: 1, preparedRows: 0 });
    expect(rowRanks(dealt.cells, 0)).toStrictEqual(pile.slice(0, 4).map(rankOf));
    expect(dealt.pile).toStrictEqual(pile.slice(4));
  });
});
