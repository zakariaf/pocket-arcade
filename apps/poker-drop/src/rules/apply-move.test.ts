// apps/poker-drop/src/rules/apply-move.test.ts
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove, isRiseDue } from './apply-move.ts';
import { cardOf } from './cards.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { WELL_FULL, outcome } from './outcome.ts';
import { knobsFor } from './poker-drop-tuning.ts';
import { cellIndex, emptyWell } from './well.ts';

import type {
  Card,
  Cell,
  PokerDropEvent,
  PokerDropResult,
  PokerDropState,
} from './poker-drop-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 40 });
/** Past-tense kebab-case event kinds (naming-conventions: events say what happened). */
const PAST_TENSE = /^[a-z]+(-[a-z]+)*-(dropped|burst|fell|rose|overflowed|dealt|cleared)$/;

function card(name: string): Card {
  return cardOf('..23456789TJQKA'.indexOf(name.charAt(0)), 'shdc'.indexOf(name.charAt(1)));
}

/** The cells with one row set from card names (null for an empty cell). */
function withRow(cells: readonly Cell[], row: number, names: readonly (string | null)[]): Cell[] {
  const out = [...cells];
  names.forEach((name, col) => {
    out[cellIndex(col, row)] = name === null ? null : card(name);
  });
  return out;
}

/** The easiest opening by hand: two prepared rows of two pair beside the empty column 2. */
function prepared(): PokerDropState {
  const bottom = withRow(emptyWell(), 0, ['Ks', 'Kd', null, 'Jc', 'Jh']);
  const cells = withRow(bottom, 1, ['9s', '9d', null, 'Qc', 'Qh']);
  return { ...create(1, 0), cells, hand: card('5d'), next: card('2c'), pile: [card('3c')] };
}

const kinds = (events: readonly PokerDropEvent[]): string[] => events.map((event) => event.kind);
const dropsOf = (state: PokerDropState): number => state.drops;
const indexOf = (_: unknown, index: number): number => index;
const hasThirtyCells = (state: PokerDropState): boolean => state.cells.length === 30;
const isPastTense = (event: PokerDropEvent): boolean => PAST_TENSE.test(event.kind);
const isWholeMs = (event: PokerDropEvent): boolean => Number.isInteger(event.atMs);
const isWon = (state: PokerDropState): boolean => outcome(state).kind === 'won';

/** applyMove for every listed move of a state. */
function applyEveryMove(state: PokerDropState): PokerDropResult[] {
  return listMoves(state).map((move) => applyMove(state, move));
}

/** The last of a run's states (a run always has its start state). */
function lastOf(states: readonly PokerDropState[]): PokerDropState {
  const last = states.at(-1);
  if (last === undefined) throw new Error('a played line has at least its start state');
  return last;
}

/** The last state of a random legal line from (seed, difficulty). */
function played(
  seed: number,
  difficulty: number,
  choices: readonly number[],
): readonly PokerDropState[] {
  return playChoices(RULES, create(seed, difficulty), choices).states;
}

describe('applyMove', () => {
  // spec 13: "Tap a column to drop the next card; any row, column or diagonal that makes a poker
  // hand bursts; cards above fall and may make new hands."
  it('drops the card in hand, bursts the hands in a cascade and deals the next card', () => {
    const { state, events } = applyMove(prepared(), { kind: 'drop-card', col: 2 });
    expect(kinds(events)).toStrictEqual([
      'card-dropped',
      'hand-burst',
      'cards-fell',
      'hand-burst',
      'card-dealt',
    ]);
    expect(state).toMatchObject({
      handsMade: 2,
      score: 60,
      drops: 1,
      hand: card('2c'),
      next: card('3c'),
      pile: [],
    });
  });

  it('lands only the card when the drop makes no hand', () => {
    const { state, events } = applyMove(prepared(), { kind: 'drop-card', col: 0 });
    expect(kinds(events)).toStrictEqual(['card-dropped', 'card-dealt']);
    expect(state.cells[cellIndex(0, 2)]).toBe(card('5d'));
    expect(state).toMatchObject({ handsMade: 0, score: 0, drops: 1 });
  });

  it('times the deal after the cascade ends', () => {
    const { events } = applyMove(prepared(), { kind: 'drop-card', col: 2 });
    const times = events.map((event) => event.atMs);
    expect(times.at(-1)).toBe(Math.max(...times));
  });

  describe('when the rising row is due', () => {
    /** The next card, then a rising row that makes no hand: 2h 4s 6d 7c 9h. */
    const pile = ['3c', '2h', '4s', '6d', '7c', '9h'].map(card);
    const before = { ...prepared(), drops: knobsFor(0).riseEvery - 1, pile };

    it('raises a new row of five cards from the bottom after the drop', () => {
      const { state, events } = applyMove(before, { kind: 'drop-card', col: 0 });
      expect(kinds(events)).toStrictEqual(['card-dropped', 'row-rose', 'card-dealt']);
      expect(state.cells.slice(0, 5)).toStrictEqual(['2h', '4s', '6d', '7c', '9h'].map(card));
      expect(state.cells[cellIndex(0, 3)]).toBe(card('5d'));
      expect(state).toMatchObject({ next: card('3c'), pile: [], hasOverflowed: false });
    });

    it('overflows and loses the run when a column is already full', () => {
      const cells = [...before.cells];
      ['2h', '3d', '4c', '6s', '8h', '9c'].forEach((name, row) => {
        cells[cellIndex(4, row)] = card(name);
      });
      const { state, events } = applyMove({ ...before, cells }, { kind: 'drop-card', col: 0 });
      expect(kinds(events)).toStrictEqual(['card-dropped', 'well-overflowed', 'card-dealt']);
      expect(outcome(state)).toStrictEqual({ kind: 'lost', reasonKey: WELL_FULL });
    });

    it('is due every riseEvery drops of a level row', () => {
      const every = knobsFor(30).riseEvery;
      expect([every - 1, every, 2 * every].map((drops) => isRiseDue(30, drops))).toStrictEqual([
        false,
        true,
        true,
      ]);
    });
  });

  describe('when the move is illegal', () => {
    it('throws for a column outside the well or a full column', () => {
      const start = prepared();
      expect(() => applyMove(start, { kind: 'drop-card', col: 5 })).toThrow(RangeError);
      const cells = start.cells.map((cell, index) => (index % 5 === 0 ? (cell ?? 0) : cell));
      expect(() => applyMove({ ...start, cells }, { kind: 'drop-card', col: 0 })).toThrow(
        RangeError,
      );
    });

    it('throws once the run is won', () => {
      const won = { ...prepared(), handsMade: 6 };
      expect(() => applyMove(won, { kind: 'drop-card', col: 2 })).toThrow(RangeError);
    });
  });

  describe('properties', () => {
    it('replays identically for the same seed, difficulty and move choices', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          expect(played(seed, difficulty, choices)).toStrictEqual(
            played(seed, difficulty, choices),
          );
        }),
      );
    });

    it('accepts every listed move and never changes its input state', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const last = lastOf(played(seed, difficulty, choices));
          const frozen = JSON.stringify(last);
          const results = applyEveryMove(last);
          expect(results).toHaveLength(listMoves(last).length);
          expect(JSON.stringify(last)).toBe(frozen);
        }),
        { numRuns: 60 },
      );
    });

    it('counts one drop per move and never holds more cards than the well has cells', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const states = played(seed, difficulty, choices);
          expect(states.map(dropsOf)).toStrictEqual(states.map(indexOf));
          expect(states.every(hasThirtyCells)).toBe(true);
        }),
        { numRuns: 60 },
      );
    });

    it('names every event in kebab-case past tense with a whole-millisecond time', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, fc.nat(), (seed, difficulty, choice) => {
          const start = create(seed, difficulty);
          const move = listMoves(start)[choice % listMoves(start).length] ?? {
            kind: 'drop-card',
            col: 0,
          };
          const { events } = applyMove(start, move);
          expect(events.every(isPastTense)).toBe(true);
          expect(events.every(isWholeMs)).toBe(true);
        }),
        { numRuns: 60 },
      );
    });

    it('keeps an endless run unwon', () => {
      fc.assert(
        fc.property(seedArb, choicesArb, (seed, choices) => {
          const states = played(seed, ENDLESS_DIFFICULTY, choices);
          expect(states.some(isWon)).toBe(false);
        }),
        { numRuns: 60 },
      );
    });

    it('survives a JSON round trip unchanged (runs are saved as JSON)', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const last = lastOf(played(seed, difficulty, choices));
          expect(JSON.parse(JSON.stringify(last)) as unknown).toStrictEqual(last);
        }),
        { numRuns: 60 },
      );
    });
  });
});
