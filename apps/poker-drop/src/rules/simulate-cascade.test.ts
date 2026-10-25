// apps/poker-drop/src/rules/simulate-cascade.test.ts
// Simulate-then-replay (realtime-game-loop rule 12): the drop, the rising row and their cascades
// run inside applyMove with the fixed step of 1/120 s, return timed events and stop at maxTicks.
import fc from 'fast-check';

import { STEP_MS } from '@e07/game-kit/timeline/fixed-step.ts';

import { cardOf } from './cards.ts';
import {
  CASCADE,
  burstingLines,
  fallTicks,
  msOf,
  simulateDrop,
  simulateRise,
  wouldOverflow,
} from './simulate-cascade.ts';
import { COLS, ROWS, cellIndex, emptyWell, heightOf, settle } from './well.ts';

import type { Card, Cell, PokerDropEvent } from './poker-drop-types.ts';

/** A card from a short name: rank (2-9, T, J, Q, K, A) then suit (s, h, d, c). */
function card(name: string): Card {
  return cardOf('..23456789TJQKA'.indexOf(name.charAt(0)), 'shdc'.indexOf(name.charAt(1)));
}

/** A well from rows of names, top row first: '..' is empty. */
function wellOf(rowsTopFirst: readonly string[]): Cell[] {
  const cells = emptyWell();
  [...rowsTopFirst].reverse().forEach((text, row) => {
    text.split(' ').forEach((name, col) => {
      cells[cellIndex(col, row)] = name === '..' ? null : card(name);
    });
  });
  return cells;
}

const EMPTY = '.. .. .. .. ..';
const EMPTY_ROWS = [EMPTY, EMPTY, EMPTY, EMPTY];
/** Two prepared rows of two pair beside an empty gap (column 2), the opening of the easiest row. */
const CASCADE_WELL = wellOf([...EMPTY_ROWS, '9s 9d .. Qc Qh', 'Ks Kd .. Jc Jh']);

function kinds(events: readonly PokerDropEvent[]): string[] {
  return events.map((event) => event.kind);
}

/** Every cell a burst names and every row a fall names, to check they stay in the well. */
function placesOf(events: readonly PokerDropEvent[]): { cells: number[]; rows: number[] } {
  const cells = events.flatMap((event) => (event.kind === 'hand-burst' ? event.cells : []));
  const rows = events.flatMap((event) =>
    event.kind === 'cards-fell' ? event.falls.flatMap((fall) => [fall.fromRow, fall.toRow]) : [],
  );
  return { cells, rows };
}

/** True when every fall of the events goes down. */
function fallsGoDown(events: readonly PokerDropEvent[]): boolean {
  return events.every(
    (event) =>
      event.kind !== 'cards-fell' || event.falls.every((fall) => fall.toRow < fall.fromRow),
  );
}

const isInWell = (cell: number): boolean => cell >= 0 && cell < COLS * ROWS;
const isWellRow = (row: number): boolean => row >= 0 && row < ROWS;
const isWholeMs = (event: PokerDropEvent): boolean => Number.isInteger(event.atMs);
const atMsOf = (event: PokerDropEvent): number => event.atMs;
const byNumber = (a: number, b: number): number => a - b;

const cellArb = fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 51 }));
const wellArb = fc
  .array(cellArb, { minLength: COLS * ROWS, maxLength: COLS * ROWS })
  .map((cells) => settle(cells).cells);
const dropArb = fc.record({
  col: fc.integer({ min: 0, max: COLS - 1 }),
  card: fc.integer({ min: 0, max: 51 }),
});

describe('fallTicks', () => {
  it('counts the fixed steps a card needs to fall from rest under gravity', () => {
    expect(fallTicks(0, CASCADE)).toBe(0);
    expect(fallTicks(1, CASCADE)).toBe(20);
    expect(fallTicks(6, CASCADE)).toBe(49);
  });

  it('takes less time per cell for a longer fall, and stops at maxTicks', () => {
    expect(fallTicks(6, CASCADE) / 6).toBeLessThan(fallTicks(1, CASCADE));
    expect(fallTicks(6, { ...CASCADE, maxTicks: 10 })).toBe(10);
  });

  it('turns ticks into whole milliseconds of the 120 Hz step', () => {
    expect(msOf(120)).toBe(1000);
    expect(msOf(1)).toBe(Math.round(STEP_MS));
  });
});

describe('burstingLines', () => {
  it('finds a full row of two pair and bursts its four paired cards, keeping the kicker', () => {
    const cells = wellOf([...EMPTY_ROWS, EMPTY, 'Ks Kd 4c Jc Jh']);
    expect(burstingLines(cells)).toStrictEqual([
      { line: { kind: 'row', cells: [0, 1, 2, 3, 4] }, hand: 'two-pair', cells: [0, 1, 3, 4] },
    ]);
  });

  it('ignores a full line that makes only a pair, and lines with a gap', () => {
    expect(burstingLines(wellOf([...EMPTY_ROWS, EMPTY, 'Ks Kd 4c Jc 2h']))).toStrictEqual([]);
    expect(burstingLines(CASCADE_WELL)).toStrictEqual([]);
  });
});

describe('simulateDrop', () => {
  // spec 13: "any row, column or diagonal that makes a poker hand bursts; cards above fall and may
  // make new hands".
  it('lands the card on the lowest empty cell of its column', () => {
    const { cells, events } = simulateDrop(emptyWell(), { col: 3, card: card('2c') });
    expect(cells[cellIndex(3, 0)]).toBe(card('2c'));
    expect(events).toStrictEqual([
      {
        kind: 'card-dropped',
        card: card('2c'),
        col: 3,
        fromRow: ROWS,
        row: 0,
        atMs: 0,
        landMs: msOf(49),
      },
    ]);
  });

  it('bursts the prepared two pair, drops the row above, and bursts again in a cascade', () => {
    const result = simulateDrop(CASCADE_WELL, { col: 2, card: card('5d') });
    expect(kinds(result.events)).toStrictEqual([
      'card-dropped',
      'hand-burst',
      'cards-fell',
      'hand-burst',
    ]);
    expect(result.hands).toBe(2);
    // two pair scores 20 at step 1, and 20 x 2 at cascade step 2
    expect(result.points).toBe(60);
    expect(result.cells.filter((cell) => cell !== null)).toStrictEqual([card('5d')]);
  });

  it('times every event on the 120 Hz step: a burst when the card lands, falls after the burst', () => {
    const { events, tick } = simulateDrop(CASCADE_WELL, { col: 2, card: card('5d') });
    const land = fallTicks(ROWS, CASCADE);
    const secondBurst = land + CASCADE.burstTicks + fallTicks(1, CASCADE);
    expect(events.map((event) => event.atMs)).toStrictEqual([
      0,
      msOf(land),
      msOf(land + CASCADE.burstTicks),
      msOf(secondBurst),
    ]);
    expect(tick).toBe(secondBurst + CASCADE.burstTicks);
  });

  it('bounds the time of the cascade by maxTicks but still bursts and scores every hand', () => {
    const capped = simulateDrop(
      CASCADE_WELL,
      { col: 2, card: card('5d') },
      { ...CASCADE, maxTicks: 60 },
    );
    expect(kinds(capped.events)).toStrictEqual([
      'card-dropped',
      'hand-burst',
      'cards-fell',
      'hand-burst',
    ]);
    expect(capped.hands).toBe(2);
    expect(capped.points).toBe(60);
    expect(burstingLines(capped.cells)).toStrictEqual([]);
    expect(capped.tick).toBe(60);
    expect(capped.events.every((event) => event.atMs <= msOf(60))).toBe(true);
  });

  describe('properties', () => {
    it('keeps every burst and fall inside the well, times each event, and never changes its input', () => {
      fc.assert(
        fc.property(wellArb, dropArb, (cells, drop) => {
          fc.pre(heightOf(cells, drop.col) < ROWS);
          const copy = [...cells];
          const { events } = simulateDrop(cells, drop);
          const places = placesOf(events);
          expect(cells).toStrictEqual(copy);
          expect(places.cells.every(isInWell)).toBe(true);
          expect(places.rows.every(isWellRow)).toBe(true);
          expect(fallsGoDown(events)).toBe(true);
          expect(events.every(isWholeMs)).toBe(true);
        }),
      );
    });

    it('gives the same events and well for the same well and drop', () => {
      fc.assert(
        fc.property(wellArb, dropArb, (cells, drop) => {
          fc.pre(heightOf(cells, drop.col) < ROWS);
          expect(simulateDrop(cells, drop)).toStrictEqual(simulateDrop(cells, drop));
        }),
      );
    });

    it('leaves no bursting line behind and moves time only forward', () => {
      fc.assert(
        fc.property(wellArb, dropArb, (cells, drop) => {
          fc.pre(heightOf(cells, drop.col) < ROWS);
          const result = simulateDrop(cells, drop);
          const times = result.events.map(atMsOf);
          expect(burstingLines(result.cells)).toStrictEqual([]);
          expect([...times].sort(byNumber)).toStrictEqual(times);
        }),
      );
    });
  });
});

describe('simulateRise', () => {
  const ROW = [card('2s'), card('7h'), card('9d'), card('Jc'), card('4h')];

  it('moves every card up one row and lays the new row at the bottom, timed after the drop', () => {
    const start = {
      cells: wellOf([...EMPTY_ROWS, EMPTY, 'Ks .. .. .. ..']),
      events: [],
      hands: 0,
      points: 0,
      tick: 50,
    };
    const risen = simulateRise(start, ROW);
    expect(risen.cells).toStrictEqual(wellOf([...EMPTY_ROWS, 'Ks .. .. .. ..', '2s 7h 9d Jc 4h']));
    expect(risen.events).toStrictEqual([
      { kind: 'row-rose', cards: ROW, atMs: msOf(50), landMs: msOf(50 + CASCADE.riseTicks) },
    ]);
    expect(risen.tick).toBe(50 + CASCADE.riseTicks);
  });

  it('takes the rise its configured ticks', () => {
    const start = { cells: emptyWell(), events: [], hands: 0, points: 0, tick: 10 };
    expect(simulateRise(start, ROW, { ...CASCADE, riseTicks: 12 }).tick).toBe(22);
  });

  it('bursts the hands the rise makes, like any other', () => {
    const start = {
      cells: wellOf([...EMPTY_ROWS, EMPTY, EMPTY]),
      events: [],
      hands: 0,
      points: 0,
      tick: 0,
    };
    const pairs = [card('8s'), card('8d'), card('3c'), card('Qh'), card('Qs')];
    const risen = simulateRise(start, pairs);
    expect(kinds(risen.events)).toStrictEqual(['row-rose', 'hand-burst']);
    expect(risen.cells.filter((cell) => cell !== null)).toStrictEqual([card('3c')]);
    expect(risen.hands).toBe(1);
  });

  it('bursts the hands of the rising row even when the rise starts at the tick cap', () => {
    const start = { cells: emptyWell(), events: [], hands: 0, points: 0, tick: CASCADE.maxTicks };
    const pairs = [card('8s'), card('8d'), card('3c'), card('Qh'), card('Qs')];
    const risen = simulateRise(start, pairs);
    expect(kinds(risen.events)).toStrictEqual(['row-rose', 'hand-burst']);
    expect(risen.hands).toBe(1);
    expect(burstingLines(risen.cells)).toStrictEqual([]);
    expect(risen.tick).toBe(CASCADE.maxTicks);
  });
});

describe('wouldOverflow', () => {
  it('is true exactly when a column is full, so a rise would push a card out of the well', () => {
    expect(
      wouldOverflow(
        wellOf([
          'Ks .. .. .. ..',
          'Ks .. .. .. ..',
          'Ks .. .. .. ..',
          'Ks .. .. .. ..',
          'Ks .. .. .. ..',
          'Ks .. .. .. ..',
        ]),
      ),
    ).toBe(true);
    expect(wouldOverflow(CASCADE_WELL)).toBe(false);
  });
});
