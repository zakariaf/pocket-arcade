// apps/poker-drop/src/rules/poker-drop-types.ts
// Poker Drop v1 (spec 13): drop cards into a 5-column well; poker hands in any line burst and
// cascade. A tap on a column drops the card in hand to that column's lowest empty cell; every
// full line of five (row, column, diagonal) whose cards make two pair or better bursts the cards
// that make the hand; the cards above fall, and a fall that makes a new hand bursts again.
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** A card is suit * 13 + (rank - 2): rank 2..14 (14 = ace), suit 0 spades, 1 hearts, 2 diamonds, 3 clubs. */
export type Card = number;

/** A well cell: a card, or null when empty. */
export type Cell = Card | null;

/** Poker hand kinds (weakest first in hand-rank.ts's HAND_KINDS); two pair and better burst. */
export type HandKind =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush';

/** The hand kinds that burst (two pair or better). */
export type BurstingHand = Exclude<HandKind, 'high-card' | 'pair'>;

/** Which way a line runs (for the burst animation and the spoken summary). */
export type LineKind = 'row' | 'column' | 'diagonal';

export type PokerDropState = {
  /** 0..100 as passed to create (clamped); ENDLESS_DIFFICULTY is the endless run. */
  readonly difficulty: number;
  /** wellCols x wellRows, row-major with row 0 at the bottom (index = row * wellCols + col). */
  readonly cells: readonly Cell[];
  /** The card the next tap drops. */
  readonly hand: Card;
  /** The card after it, shown beside the well. */
  readonly next: Card;
  /** The rest of the shuffled deck, drawn from the front; a fresh shuffle when it runs out. */
  readonly pile: readonly Card[];
  /** Hands the level asks for (0 = endless, never won). */
  readonly goal: number;
  readonly handsMade: number;
  readonly score: number;
  readonly drops: number;
  /** A rising row pushed a card past the top: the well is full (the run is lost). */
  readonly hasOverflowed: boolean;
  /** The one continue of the run was used (spec 8.10). */
  readonly hasContinued: boolean;
  readonly rng: RngState;
};

export type PokerDropMove = { readonly kind: 'drop-card'; readonly col: number };

/** One card falling from fromRow to toRow, landing at landMs. */
export type CardFall = {
  readonly card: Card;
  readonly col: number;
  readonly fromRow: number;
  readonly toRow: number;
  readonly landMs: number;
};

/**
 * Past tense, kebab-case, timed (atMs, from the move's start) with every cell, card and row the
 * board and the counters need: the cascade is simulated inside applyMove and replayed.
 */
export type PokerDropEvent =
  | {
      readonly kind: 'card-dropped';
      readonly card: Card;
      readonly col: number;
      readonly fromRow: number;
      readonly row: number;
      readonly atMs: number;
      readonly landMs: number;
    }
  | {
      readonly kind: 'hand-burst';
      /** 1 for the drop's own hands, 2 and more for the cascade's. */
      readonly step: number;
      readonly hand: BurstingHand;
      readonly lineKind: LineKind;
      /** The five cells of the line. */
      readonly line: readonly number[];
      /** The cells that burst: the cards that make the hand. */
      readonly cells: readonly number[];
      readonly cards: readonly Card[];
      /** The hand's points times its step. */
      readonly points: number;
      readonly atMs: number;
    }
  | {
      readonly kind: 'cards-fell';
      readonly step: number;
      readonly falls: readonly CardFall[];
      readonly atMs: number;
    }
  | {
      readonly kind: 'row-rose';
      /** The new bottom row, left to right; every card above moved up one row. */
      readonly cards: readonly Card[];
      readonly atMs: number;
      readonly landMs: number;
    }
  | { readonly kind: 'well-overflowed'; readonly atMs: number }
  | { readonly kind: 'card-dealt'; readonly hand: Card; readonly next: Card; readonly atMs: number }
  | {
      readonly kind: 'top-row-cleared';
      readonly cells: readonly number[];
      readonly cards: readonly Card[];
      readonly atMs: number;
    };

export type PokerDropResult = ApplyResult<PokerDropState, PokerDropEvent>;
