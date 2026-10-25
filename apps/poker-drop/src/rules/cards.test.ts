// apps/poker-drop/src/rules/cards.test.ts
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { ACE, cardAt, cardOf, dealCard, deckOf, rankOf, shuffled, suitOf } from './cards.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const rankArb = fc.integer({ min: 2, max: ACE });
const suitArb = fc.integer({ min: 0, max: 3 });

describe('cardOf', () => {
  it('numbers the cards suit by suit from the two of spades to the ace of clubs', () => {
    expect(cardOf(2, 0)).toBe(0);
    expect(cardOf(ACE, 0)).toBe(12);
    expect(cardOf(2, 1)).toBe(13);
    expect(cardOf(ACE, 3)).toBe(51);
  });

  it('gives back its rank and suit', () => {
    fc.assert(
      fc.property(rankArb, suitArb, (rank, suit) => {
        expect(rankOf(cardOf(rank, suit))).toBe(rank);
        expect(suitOf(cardOf(rank, suit))).toBe(suit);
      }),
    );
  });
});

describe('cardAt', () => {
  it('reads a card of the list and throws for an index outside it', () => {
    expect(cardAt([7, 8, 9], 1)).toBe(8);
    expect(() => cardAt([7, 8, 9], 3)).toThrow(RangeError);
  });
});

describe('deckOf', () => {
  it('holds the ranks from minRank to the ace in four suits', () => {
    expect(deckOf(9)).toHaveLength(24);
    expect(deckOf(2)).toHaveLength(52);
    expect(new Set(deckOf(2)).size).toBe(52);
    expect(deckOf(9).every((card) => rankOf(card) >= 9)).toBe(true);
  });
});

describe('shuffled', () => {
  it('keeps the pinned order for seed 1 (a changed shuffle changes every shipped level)', () => {
    expect(shuffled(deckOf(9), seedRng(1)).cards.slice(0, 6)).toStrictEqual(GOLDEN_SEED_1_TOP_SIX);
  });

  it('is a permutation, never changes its input and is the same for the same seed', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const deck = deckOf(7);
        const once = shuffled(deck, seedRng(seed));
        expect([...once.cards].sort((a, b) => a - b)).toStrictEqual(deck);
        expect(deck).toStrictEqual(deckOf(7));
        expect(shuffled(deck, seedRng(seed))).toStrictEqual(once);
      }),
    );
  });
});

describe('dealCard', () => {
  it('deals the front card of the pile and keeps the RNG', () => {
    const rng = seedRng(3);
    expect(dealCard([5, 6, 7], rng, 2)).toStrictEqual({ card: 5, pile: [6, 7], rng });
  });

  it('shuffles a fresh deck of the allowed ranks when the pile is empty', () => {
    const dealt = dealCard([], seedRng(3), 9);
    expect(dealt.pile).toHaveLength(23);
    expect([dealt.card, ...dealt.pile].sort((a, b) => a - b)).toStrictEqual(deckOf(9));
    expect(dealt.rng).not.toStrictEqual(seedRng(3));
  });
});

/** 9h 9d Jd Kh 9c Th: the first six cards of the 9-to-ace deck shuffled with seed 1. */
const GOLDEN_SEED_1_TOP_SIX = [20, 33, 35, 24, 46, 21];
