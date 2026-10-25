// apps/poker-drop/src/board/board-ids.test.ts
import { ACE, cardOf, rankOf, suitOf } from '@e07/poker-drop/rules/cards.ts';

import {
  burstEntity,
  cellEntity,
  goneEntity,
  rankText,
  SUIT_NAMES,
  suitName,
  TURN_ENTITY,
} from './board-ids.ts';

const CARDS = Array.from({ length: 52 }, (_, card) => card);
const FACES: Readonly<Partial<Record<number, string>>> = { 11: 'J', 12: 'Q', 13: 'K', [ACE]: 'A' };

describe('cellEntity', () => {
  it('keeps cell, vanishing-card and burst entities apart from each other and the turn entity', () => {
    const ids = [
      ...Array.from({ length: 30 }, (_, index) => cellEntity(index)),
      ...Array.from({ length: 64 }, (_, order) => goneEntity(order)),
      ...Array.from({ length: 40 }, (_, order) => burstEntity(order)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(TURN_ENTITY);
  });
});

describe('rankText', () => {
  // spec 7.3: a game may declare a number a symbol that stays Latin; card indices are symbols.
  it('writes every card index as the Latin symbol of the rank the rules give it', () => {
    const texts = CARDS.map(rankText);
    expect(texts).toStrictEqual(CARDS.map((card) => FACES[rankOf(card)] ?? String(rankOf(card))));
  });

  it('pins the king of hearts and the ten of clubs', () => {
    expect(rankText(cardOf(13, 1))).toBe('K');
    expect(rankText(cardOf(10, 3))).toBe('10');
  });

  it('returns no text for a value that is no card', () => {
    expect(rankText(-1)).toBe('');
  });
});

describe('suitName', () => {
  it('names the suit the rules give every card (its path and its colour token)', () => {
    expect(CARDS.map(suitName)).toStrictEqual(CARDS.map((card) => SUIT_NAMES[suitOf(card)]));
    expect(suitName(cardOf(7, 2))).toBe('diamond');
  });

  it('falls back to spades for a value that is no card', () => {
    expect(suitName(99)).toBe('spade');
  });
});
