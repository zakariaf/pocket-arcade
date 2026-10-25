// apps/poker-drop/src/rules/opening.ts
// The opening well, built from the seed for an early payoff (game-balance-and-bots: the kill
// test): one empty gap column, and `openingRows` bottom rows dealt into the four other columns.
// The lowest `preparedRows` of them hold two pair, of ranks other than the card in hand, so the
// first drop into the gap bursts them and leaves the dropped card as the kicker; with a second
// prepared row above, the fall makes the second hand at once (a cascade).
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import { cardAt, rankOf, shuffled } from './cards.ts';
import { COLS, cellIndex, emptyWell } from './well.ts';

import type { DifficultyKnobs } from './poker-drop-tuning.ts';
import type { Card, Cell } from './poker-drop-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** A dealt opening: the well, the gap column, and the pile and RNG left after it. */
export type Opening = {
  readonly cells: Cell[];
  readonly gap: number;
  readonly pile: Card[];
  readonly rng: RngState;
};

/** Takes two cards of one rank from the pile (the first rank, front first, not in `avoid` with a partner). */
function takePair(pile: Card[], avoid: ReadonlySet<number>): Card[] {
  for (let i = 0; i < pile.length; i += 1) {
    const rank = rankOf(cardAt(pile, i));
    const partner = avoid.has(rank)
      ? -1
      : pile.findIndex((card, j) => j > i && rankOf(card) === rank);
    if (partner !== -1) {
      const pair = [cardAt(pile, i), cardAt(pile, partner)];
      pile.splice(partner, 1);
      pile.splice(i, 1);
      return pair;
    }
  }
  // Every deck has four cards per rank and at least six ranks, so a pair is always found.
  throw new RangeError('no pair left in the pile');
}

/** Four cards making two pair of ranks other than `avoid`, in a seeded order. */
function preparedRow(pile: Card[], rng: RngState, avoid: number): { cards: Card[]; rng: RngState } {
  const first = takePair(pile, new Set([avoid]));
  const second = takePair(pile, new Set([avoid, rankOf(cardAt(first, 0))]));
  const mixed = shuffled([...first, ...second], rng);
  return { cards: mixed.cards, rng: mixed.rng };
}

/** Deals the opening well from the front of `pile` (never changed); `hand` is the card in hand. */
export function dealOpening(
  pile: readonly Card[],
  rng: RngState,
  setup: { readonly knobs: DifficultyKnobs; readonly hand: Card },
): Opening {
  const rest = [...pile];
  const gapDraw = nextInt(rng, COLS);
  let state = gapDraw.state;
  const gap = gapDraw.value;
  const cells = emptyWell();
  const cols = Array.from({ length: COLS }, (_, col) => col).filter((col) => col !== gap);
  for (let row = 0; row < setup.knobs.openingRows; row += 1) {
    let cards = rest.splice(0, cols.length);
    if (row < setup.knobs.preparedRows) {
      rest.unshift(...cards);
      const prepared = preparedRow(rest, state, rankOf(setup.hand));
      cards = prepared.cards;
      state = prepared.rng;
    }
    cols.forEach((col, i) => {
      cells[cellIndex(col, row)] = cardAt(cards, i);
    });
  }
  return { cells, gap, pile: rest, rng: state };
}
