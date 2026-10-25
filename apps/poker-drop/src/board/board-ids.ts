// apps/poker-drop/src/board/board-ids.ts
'worklet';

/** Entity of the one-per-move tracks: the rising row, the deal, the overflow flash. */
export const TURN_ENTITY = 0;

/** A view cell that holds no card. */
export const EMPTY_CELL = -1;

/** The suits in card order (card = suit * 13 + rank - 2): each is a unit path and a colour token. */
export const SUIT_NAMES = ['spade', 'heart', 'diamond', 'club'] as const;

export type SuitName = (typeof SUIT_NAMES)[number];

/**
 * Card indices from 2 to the ace. They are symbols, so they stay Latin in every language and digit
 * setting (spec 7.3 lets a game declare that); the counts the board draws follow the chosen digits.
 */
const RANK_TEXTS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
const RANKS_PER_SUIT = RANK_TEXTS.length;

/**
 * Entity of a card that is still in the well when the move ends, by its final cell index. Shared by
 * buildTimeline (JS thread) and draw (UI thread); a 'worklet' module, as draw may only call worklets.
 */
export function cellEntity(index: number): number {
  return 1000 + index;
}

/** Entity of the `order`-th card that leaves the well during the move (a burst or the continue). */
export function goneEntity(order: number): number {
  return 2000 + order;
}

/** Entity of the `order`-th hand that bursts during the move (its line, badge and particles). */
export function burstEntity(order: number): number {
  return 3000 + order;
}

/** The index printed on a card ('2' to '10', 'J', 'Q', 'K', 'A'); '' for a value that is no card. */
export function rankText(card: number): string {
  return RANK_TEXTS[card % RANKS_PER_SUIT] ?? '';
}

/** The suit of a card, which names both its path and its colour token. */
export function suitName(card: number): SuitName {
  return SUIT_NAMES[Math.floor(card / RANKS_PER_SUIT)] ?? 'spade';
}
