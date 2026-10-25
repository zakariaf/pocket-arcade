// apps/poker-drop/src/rules/hand-rank.test.ts
import fc from 'fast-check';

import { cardOf } from './cards.ts';
import { HAND_KINDS, handOf, handStrength, isBurstingHand, scoringPositions } from './hand-rank.ts';

import type { Card, HandKind } from './poker-drop-types.ts';

/** Cards from short names: rank (2-9, T, J, Q, K, A) then suit (s, h, d, c). */
function cards(text: string): Card[] {
  return text
    .split(' ')
    .map((name) =>
      cardOf('..23456789TJQKA'.indexOf(name.charAt(0)), 'shdc'.indexOf(name.charAt(1))),
    );
}

/** The hands that burst only the cards that share a rank, keeping a kicker. */
const PAIRED_HANDS: readonly HandKind[] = ['two-pair', 'three-of-a-kind', 'four-of-a-kind'];

const fiveArb = fc.uniqueArray(fc.integer({ min: 0, max: 51 }), { minLength: 5, maxLength: 5 });

describe('handOf', () => {
  // spec 13: "poker hands in any line burst"; the hands are the poker hands everyone knows.
  it.each([
    ['As Ks Qs Js Ts', 'straight-flush'],
    ['5d 4d 3d 2d Ad', 'straight-flush'],
    ['9c 9d 9h 9s 2c', 'four-of-a-kind'],
    ['7h 7d 7s Kc Kd', 'full-house'],
    ['2h 9h Jh 4h Kh', 'flush'],
    ['9s Tc Jh Qd Kd', 'straight'],
    ['As 2d 3c 4h 5s', 'straight'],
    ['Ts Jd Qc Kh As', 'straight'],
    ['8s 8d 8c Kh 2s', 'three-of-a-kind'],
    ['8s 8d Kc Kh 2s', 'two-pair'],
    ['8s 8d Qc Kh 2s', 'pair'],
    ['8s 3d Qc Kh 2s', 'high-card'],
    ['Qs Kd As 2c 3h', 'high-card'],
  ])('reads %s as %s', (text, hand) => {
    expect(handOf(cards(text))).toBe(hand);
  });

  it('reads five cards of one rank as four of a kind (a fresh deck can deal a card twice)', () => {
    expect(handOf(cards('9c 9d 9h 9s 9c'))).toBe('four-of-a-kind');
    expect(handOf(cards('Ks Ks Ks Ks Ks'))).toBe('four-of-a-kind');
  });

  it('gives the same hand in any order of the line', () => {
    fc.assert(
      fc.property(fiveArb, (five) => {
        expect(handOf([...five].reverse())).toBe(handOf(five));
      }),
    );
  });
});

describe('isBurstingHand', () => {
  it('bursts two pair and better, never a pair or a high card', () => {
    const bursting = HAND_KINDS.filter((hand) => isBurstingHand(hand));
    expect(bursting).toStrictEqual(HAND_KINDS.slice(2));
    expect(handStrength('pair')).toBeLessThan(handStrength('two-pair'));
  });
});

describe('scoringPositions', () => {
  it('bursts only the paired cards of two pair, three and four of a kind', () => {
    expect(scoringPositions(cards('8s 2d 8c Kh Ks'), 'two-pair')).toStrictEqual([0, 2, 3, 4]);
    expect(scoringPositions(cards('8s 2d 8c 8h Ks'), 'three-of-a-kind')).toStrictEqual([0, 2, 3]);
    expect(scoringPositions(cards('8s 8d 8c 8h Ks'), 'four-of-a-kind')).toStrictEqual([0, 1, 2, 3]);
  });

  it('bursts all five cards of a straight, flush, full house or straight flush', () => {
    for (const hand of ['straight', 'flush', 'full-house', 'straight-flush'] as const) {
      expect(scoringPositions(cards('8s 2d 8c Kh Ks'), hand)).toStrictEqual([0, 1, 2, 3, 4]);
    }
  });

  it('keeps a kicker exactly for the hands that pair ranks', () => {
    fc.assert(
      fc.property(fiveArb, (five) => {
        const hand = handOf(five);
        const kept = 5 - scoringPositions(five, hand).length;
        const isPaired = PAIRED_HANDS.includes(hand);
        expect(!isBurstingHand(hand) || kept > 0 === isPaired).toBe(true);
      }),
    );
  });
});
