// apps/poker-drop/src/rules/poker-drop-evaluate.ts
// How good a Poker Drop position looks to a reasonable player. Lives in rules/ because both the
// bots (testing/) and the level witness (levels/) play with it, and levels may import only rules.
// A person counts the hands made and their points, keeps the well low (a nearly full column is a
// step to losing), and builds lines close to a hand: pairs and same-suit cards in a line that still
// has room.
import { rankOf, suitOf } from './cards.ts';
import { outcome } from './outcome.ts';
import { COLS, ROWS, WELL_LINES, heightOf, isCard } from './well.ts';

import type { Card, PokerDropState } from './poker-drop-types.ts';

/** A won position outranks every playing one; a lost one is below all of them. */
const WON_VALUE = 100_000;
/** Weights: a made hand is worth most, then its points; height and nearly full columns cost. */
const HAND_WEIGHT = 60;
const POINT_WEIGHT = 1;
const HEIGHT_WEIGHT = 2;
const TALL_WEIGHT = 6;
const PAIR_WEIGHT = 5;
const SUIT_WEIGHT = 1;

/** The cards of every line that still has an empty cell (a full line that did not burst is dead). */
function openLineCards(state: PokerDropState): Card[][] {
  return WELL_LINES.flatMap((line) => {
    const cells = line.cells.map((index) => state.cells[index]);
    const cards = cells.filter(isCard);
    return cards.length < cells.length ? [cards] : [];
  });
}

/** How often each value occurs in a list. */
function countsOf(values: readonly number[]): number[] {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.values()];
}

/** Pairs and same-suit cards among a line's cards: the promise of a hand once it fills. */
function linePromise(cards: readonly Card[]): number {
  const pairs = countsOf(cards.map(rankOf)).reduce((sum, count) => sum + count * (count - 1), 0);
  const suited = Math.max(0, ...countsOf(cards.map(suitOf)));
  return pairs * PAIR_WEIGHT + (suited > 1 ? suited * SUIT_WEIGHT : 0);
}

/** The cards in the well, and the columns one card short of full. */
function heightCost(state: PokerDropState): number {
  let cost = 0;
  for (let col = 0; col < COLS; col += 1) {
    const height = heightOf(state.cells, col);
    cost += height * HEIGHT_WEIGHT + (height >= ROWS - 1 ? TALL_WEIGHT : 0);
  }
  return cost;
}

/** How good a position looks to the bots (higher is better). */
export function evaluatePokerDrop(state: PokerDropState): number {
  const result = outcome(state);
  if (result.kind === 'won') return WON_VALUE + result.score;
  if (result.kind === 'lost') return -WON_VALUE;
  const promise = openLineCards(state).reduce((sum, cards) => sum + linePromise(cards), 0);
  const gains = state.handsMade * HAND_WEIGHT + state.score * POINT_WEIGHT + promise;
  return gains - heightCost(state);
}
