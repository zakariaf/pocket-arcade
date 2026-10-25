// apps/poker-drop/src/levels/poker-drop-describe.ts
// A level start as readable text for the data goldens: the goal, the card in hand and the next
// card, how often a row rises, then the well top row first ('..' empty, else rank and suit).
import { rankOf, suitOf } from '@e07/poker-drop/rules/cards.ts';
import { riseIntervalFor } from '@e07/poker-drop/rules/poker-drop-tuning.ts';
import { COLS, ROWS, cellIndex, isCard } from '@e07/poker-drop/rules/well.ts';

import type { Card, PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';

const RANK_LETTERS = '..23456789TJQKA';
const SUIT_LETTERS = 'shdc';

/** A card as rank and suit letters: 2s, Th, Ac. */
export function cardName(card: Card): string {
  return `${RANK_LETTERS.charAt(rankOf(card))}${SUIT_LETTERS.charAt(suitOf(card))}`;
}

function renderWell(state: PokerDropState): string {
  const rows: string[] = [];
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    const cells = Array.from({ length: COLS }, (_, col) => state.cells[cellIndex(col, row)]);
    rows.push(cells.map((cell) => (isCard(cell) ? cardName(cell) : '..')).join(' '));
  }
  return rows.join('\n');
}

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: PokerDropState): string {
  const rises = riseIntervalFor(state.difficulty, state.drops);
  const header = `goal ${String(state.goal)} hand ${cardName(state.hand)} next ${cardName(state.next)} rises every ${String(rises)}`;
  return [header, renderWell(state)].join('\n');
}
