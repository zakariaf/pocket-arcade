// apps/poker-drop/src/rules/apply-move.ts
import { dealCard } from './cards.ts';
import { listMoves } from './list-moves.ts';
import { knobsFor, riseIntervalFor } from './poker-drop-tuning.ts';
import { msOf, simulateDrop, simulateRise, wouldOverflow } from './simulate-cascade.ts';
import { COLS } from './well.ts';

import type { Dealt } from './cards.ts';
import type { Card, PokerDropMove, PokerDropResult, PokerDropState } from './poker-drop-types.ts';
import type { Cascade } from './simulate-cascade.ts';

/** Deals `count` cards after `from` (shuffling fresh decks as needed). */
function dealCards(from: Dealt, count: number, minRank: number): { cards: Card[]; last: Dealt } {
  const cards: Card[] = [];
  let last = from;
  for (let i = 0; i < count; i += 1) {
    last = dealCard(last.pile, last.rng, minRank);
    cards.push(last.card);
  }
  return { cards, last };
}

/** True when the drop that brings the run to `drops` drops is followed by a rising row. */
export function isRiseDue(difficulty: number, drops: number): boolean {
  return drops % riseIntervalFor(difficulty, drops) === 0;
}

type Rise = { readonly run: Cascade; readonly dealt: Dealt; readonly hasOverflowed: boolean };

/** The rising row after a drop: the well overflows when a column is full, else it rises one row. */
function rise(run: Cascade, dealt: Dealt, minRank: number): Rise {
  if (wouldOverflow(run.cells)) {
    const events = [...run.events, { kind: 'well-overflowed' as const, atMs: msOf(run.tick) }];
    return { run: { ...run, events }, dealt, hasOverflowed: true };
  }
  const row = dealCards(dealt, COLS, minRank);
  const next = { card: dealt.card, pile: row.last.pile, rng: row.last.rng };
  return { run: simulateRise(run, row.cards), dealt: next, hasOverflowed: false };
}

/**
 * Drops the card in hand into the move's column and runs its cascade (simulate-cascade.ts). Every
 * riseEvery drops a new row of cards rises from the bottom and its hands burst too, unless a full
 * column would push a card out of the well, which loses the run. Then the next card is dealt.
 * Pure: the input state is never changed. A move that listMoves does not list throws a RangeError.
 */
export function applyMove(state: PokerDropState, move: PokerDropMove): PokerDropResult {
  if (!listMoves(state).some((legal) => legal.col === move.col)) {
    throw new RangeError(`illegal move ${JSON.stringify(move)}`);
  }
  const minRank = knobsFor(state.difficulty).minRank;
  const drops = state.drops + 1;
  const dropped = simulateDrop(state.cells, { col: move.col, card: state.hand });
  const first = dealCard(state.pile, state.rng, minRank);
  const after: Rise = isRiseDue(state.difficulty, drops)
    ? rise(dropped, first, minRank)
    : { run: dropped, dealt: first, hasOverflowed: false };
  const { run, dealt } = after;
  const dealtEvent = {
    kind: 'card-dealt' as const,
    hand: state.next,
    next: dealt.card,
    atMs: msOf(run.tick),
  };
  return {
    state: {
      ...state,
      cells: run.cells,
      hand: state.next,
      next: dealt.card,
      pile: dealt.pile,
      rng: dealt.rng,
      handsMade: state.handsMade + run.hands,
      score: state.score + run.points,
      drops,
      hasOverflowed: after.hasOverflowed,
    },
    events: [...run.events, dealtEvent],
  };
}
