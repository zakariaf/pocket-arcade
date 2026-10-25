// apps/poker-drop/src/rules/cards.ts
// Cards as numbers (suit * 13 + rank - 2) and the seeded deck: a level deals from a shuffled deck
// of the ranks its tuning row allows, and shuffles a fresh one from the same RNG stream when the
// pile runs out. Pure: every shuffle threads the RNG state it was given.
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import type { Card } from './poker-drop-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** Ranks run from 2 to 14 (the ace is high, and also low in A-2-3-4-5). */
export const LOWEST_RANK = 2;
export const ACE = 14;
/** Spades, hearts, diamonds, clubs. */
export const SUIT_COUNT = 4;
const RANKS_PER_SUIT = ACE - LOWEST_RANK + 1;

/** The card at `index` of a list; an index outside the list is a bug in the rules (RangeError). */
export function cardAt(cards: readonly Card[], index: number): Card {
  const card = cards[index];
  if (card === undefined)
    throw new RangeError(`no card at ${String(index)} of ${String(cards.length)}`);
  return card;
}

/** The card of a rank (2..14) and a suit (0..3). */
export function cardOf(rank: number, suit: number): Card {
  return suit * RANKS_PER_SUIT + rank - LOWEST_RANK;
}

/** A card's rank, 2..14. */
export function rankOf(card: Card): number {
  return (card % RANKS_PER_SUIT) + LOWEST_RANK;
}

/** A card's suit, 0..3. */
export function suitOf(card: Card): number {
  return Math.floor(card / RANKS_PER_SUIT);
}

/** Every card from minRank to the ace in the four suits, in suit then rank order. */
export function deckOf(minRank: number): Card[] {
  const cards: Card[] = [];
  for (let suit = 0; suit < SUIT_COUNT; suit += 1) {
    for (let rank = minRank; rank <= ACE; rank += 1) cards.push(cardOf(rank, suit));
  }
  return cards;
}

/** A Fisher-Yates shuffle of `cards` with the seeded RNG; the input is never changed. */
export function shuffled(
  cards: readonly Card[],
  rng: RngState,
): { readonly cards: Card[]; readonly rng: RngState } {
  const out = [...cards];
  let state = rng;
  for (let i = out.length - 1; i > 0; i -= 1) {
    const draw = nextInt(state, i + 1);
    state = draw.state;
    const picked = cardAt(out, draw.value);
    out[draw.value] = cardAt(out, i);
    out[i] = picked;
  }
  return { cards: out, rng: state };
}

/** A dealt card and what is left: the pile's first card, or the first of a fresh shuffle. */
export type Dealt = { readonly card: Card; readonly pile: Card[]; readonly rng: RngState };

/** Deals one card from the front of the pile, shuffling a new deck of minRank..ace when empty. */
export function dealCard(pile: readonly Card[], rng: RngState, minRank: number): Dealt {
  if (pile.length > 0) return { card: cardAt(pile, 0), pile: pile.slice(1), rng };
  const fresh = shuffled(deckOf(minRank), rng);
  return { card: cardAt(fresh.cards, 0), pile: fresh.cards.slice(1), rng: fresh.rng };
}
