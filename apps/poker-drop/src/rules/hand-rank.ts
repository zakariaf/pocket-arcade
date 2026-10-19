// apps/poker-drop/src/rules/hand-rank.ts
// The poker value of five cards and which of them make the hand. Two pair and better burst:
// two pair bursts its four paired cards, three of a kind its three, four of a kind its four; a
// straight, flush, full house or straight flush bursts all five. Kickers stay in the well.
import { ACE, rankOf, suitOf } from './cards.ts';

import type { BurstingHand, Card, HandKind } from './poker-drop-types.ts';

/** Every hand kind, weakest first (a higher index beats a lower one). */
export const HAND_KINDS = [
  'high-card',
  'pair',
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
] as const satisfies readonly HandKind[];

/** Four of a kind bursts its four cards and keeps the kicker. */
const QUADS: HandKind = 'four-of-a-kind';

/** A hand's strength: its index in HAND_KINDS. */
export function handStrength(hand: HandKind): number {
  return HAND_KINDS.indexOf(hand);
}

/** The weakest hand that bursts. */
export const WEAKEST_BURST: BurstingHand = 'two-pair';

/** True for two pair and better. */
export function isBurstingHand(hand: HandKind): hand is BurstingHand {
  return handStrength(hand) >= handStrength(WEAKEST_BURST);
}

/** How many cards of each rank (rank -> count), in the order the ranks first appear. */
function rankCounts(cards: readonly Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const card of cards) counts.set(rankOf(card), (counts.get(rankOf(card)) ?? 0) + 1);
  return counts;
}

/** Five different ranks in a run (the ace also plays low: A-2-3-4-5). */
function isStraight(ranks: readonly number[]): boolean {
  const sorted = [...ranks].sort((a, b) => a - b);
  if (new Set(sorted).size !== ranks.length) return false;
  const span = Math.max(...sorted) - Math.min(...sorted);
  const isWheel = sorted.join(',') === `2,3,4,5,${String(ACE)}`;
  return span === ranks.length - 1 || isWheel;
}

/** The kind of hand made only by how many cards share a rank (pairs, sets, quads). */
function groupHand(sizes: readonly number[]): HandKind {
  const most = Math.max(...sizes);
  const pairs = sizes.filter((size) => size === 2).length;
  // Five of one rank (a fresh deck can deal a card again) counts as four of a kind.
  if (most >= 4) return QUADS;
  if (most === 3) return pairs > 0 ? 'full-house' : 'three-of-a-kind';
  if (pairs === 2) return 'two-pair';
  return pairs === 1 ? 'pair' : 'high-card';
}

/** The poker hand of five cards. */
export function handOf(cards: readonly Card[]): HandKind {
  const isFlush = new Set(cards.map(suitOf)).size === 1;
  const isStraightHand = isStraight(cards.map(rankOf));
  if (isStraightHand && isFlush) return 'straight-flush';
  const grouped = groupHand([...rankCounts(cards).values()]);
  if (handStrength(grouped) > handStrength('flush')) return grouped;
  if (isFlush) return 'flush';
  if (isStraightHand) return 'straight';
  return grouped;
}

/** A straight, flush, full house or straight flush is made of every card of the line. */
function isWholeLine(hand: HandKind): boolean {
  return hand !== QUADS && handStrength(hand) >= handStrength('straight');
}

/** The positions (0..4) of the cards that make `hand` among `cards`, in line order. */
export function scoringPositions(cards: readonly Card[], hand: HandKind): number[] {
  if (isWholeLine(hand)) return cards.map((_, index) => index);
  const counts = rankCounts(cards);
  const paired = new Set([...counts].filter(([, count]) => count >= 2).map(([rank]) => rank));
  return cards.flatMap((card, index) => (paired.has(rankOf(card)) ? [index] : []));
}
