// apps/poker-drop/src/rules/create.ts
import { clampDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { deckOf, shuffled } from './cards.ts';
import { dealOpening } from './opening.ts';
import { knobsFor } from './poker-drop-tuning.ts';

import type { Card, PokerDropState } from './poker-drop-types.ts';

/**
 * Start state from (seed, difficulty 0..100, clamped): the same pair gives the same well, hand and
 * deck on every phone. The deck is shuffled from the seed; the first two cards are the hand and
 * the next card, and the opening rows are dealt from the rest (opening.ts).
 */
export function create(seed: number, difficulty: number): PokerDropState {
  const level = clampDifficulty(difficulty);
  const knobs = knobsFor(level);
  const deck = shuffled(deckOf(knobs.minRank), seedRng(seed));
  const [hand, next, ...pile] = deck.cards as [Card, Card, ...Card[]];
  const opening = dealOpening(pile, deck.rng, { knobs, hand });
  return {
    difficulty: level,
    cells: opening.cells,
    hand,
    next,
    pile: opening.pile,
    goal: knobs.goal,
    handsMade: 0,
    score: 0,
    drops: 0,
    hasOverflowed: false,
    hasContinued: false,
    rng: opening.rng,
  };
}
