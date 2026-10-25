// apps/poker-drop/src/rules/simulate-cascade.ts
// Simulate-then-replay: applyMove runs the drop, the rising row and their cascades here with the
// real-time loop's fixed step (1/120 s) and returns ordinary timed events (atMs). A card falls from
// above the well under gravity; every full line making two pair or better bursts the cards of its
// hand; after the burst the cards above fall, and a fall that makes new hands bursts again
// (cascade step 2, 3, ...) until a step makes no hand. maxTicks bounds the time only: past it every
// further step happens at the cap, so no hand is ever skipped. The game stays turn-based for saves,
// bots and goldens; buildTimeline replays the events on screen.
import { STEP_MS } from '@e07/game-kit/timeline/fixed-step.ts';

import { handOf, isBurstingHand, scoringPositions } from './hand-rank.ts';
import { TUNING } from './poker-drop-tuning.ts';
import { COLS, ROWS, WELL_LINES, cardIn, cellIndex, heightOf, isCard, settle } from './well.ts';

import type { BurstingHand, Card, CardFall, Cell, PokerDropEvent } from './poker-drop-types.ts';
import type { WellLine } from './well.ts';

/** The numbers of the simulated motion: gravity per tick, the burst's and the rise's ticks, the cap. */
export type CascadeConfig = {
  /** Speed gained per tick, in cells per tick (positive). */
  readonly gravity: number;
  /** Ticks a burst takes before the cards above fall. */
  readonly burstTicks: number;
  /** Ticks the well takes to rise one row. */
  readonly riseTicks: number;
  /** Hard cap on one move's time: every event is at or before it (scoring is never cut short). */
  readonly maxTicks: number;
};

/** The tuned motion of every move. */
export const CASCADE: CascadeConfig = {
  gravity: TUNING.gravity,
  burstTicks: TUNING.burstTicks,
  riseTicks: TUNING.riseTicks,
  maxTicks: TUNING.maxTicks,
};

/** Integer milliseconds of a tick on the timeline. */
export function msOf(tick: number): number {
  return Math.round(tick * STEP_MS);
}

/** Ticks a card needs to fall `distance` cells from rest, stepping the fixed step (at most maxTicks). */
export function fallTicks(distance: number, config: CascadeConfig): number {
  let ticks = 0;
  let speed = 0;
  let fallen = 0;
  while (fallen < distance && ticks < config.maxTicks) {
    speed += config.gravity;
    fallen += speed;
    ticks += 1;
  }
  return ticks;
}

/** One line that bursts in a cascade step: the line, its hand and the cells that make the hand. */
export type LineBurst = {
  readonly line: WellLine;
  readonly hand: BurstingHand;
  readonly cells: readonly number[];
};

/** Every full line of the well whose five cards make two pair or better, in WELL_LINES order. */
export function burstingLines(cells: readonly Cell[]): LineBurst[] {
  const bursts: LineBurst[] = [];
  for (const line of WELL_LINES) {
    if (!line.cells.every((index) => isCard(cells[index]))) continue;
    const cards = line.cells.map((index) => cardIn(cells, index));
    const hand = handOf(cards);
    if (!isBurstingHand(hand)) continue;
    const positions = scoringPositions(cards, hand);
    bursts.push({
      line,
      hand,
      cells: line.cells.filter((_, position) => positions.includes(position)),
    });
  }
  return bursts;
}

/** A simulation in progress: the well, the events so far, the hands and points, the current tick. */
export type Cascade = {
  readonly cells: Cell[];
  readonly events: PokerDropEvent[];
  readonly hands: number;
  readonly points: number;
  readonly tick: number;
};

function burstStep(run: Cascade, bursts: readonly LineBurst[], step: number): Cascade {
  const gone = new Set<number>();
  const events = [...run.events];
  let points = 0;
  for (const burst of bursts) {
    const handPoints = TUNING.handPoints[burst.hand] * step;
    events.push({
      kind: 'hand-burst',
      step,
      hand: burst.hand,
      lineKind: burst.line.kind,
      line: burst.line.cells,
      cells: burst.cells,
      cards: burst.cells.map((index) => cardIn(run.cells, index)),
      points: handPoints,
      atMs: msOf(run.tick),
    });
    points += handPoints;
    for (const index of burst.cells) gone.add(index);
  }
  const cells = run.cells.map((card, index) => (gone.has(index) ? null : card));
  return {
    cells,
    events,
    hands: run.hands + bursts.length,
    points: run.points + points,
    tick: run.tick,
  };
}

/** The tick `ticks` after `tick`, never past the cap. */
function later(tick: number, ticks: number, config: CascadeConfig): number {
  return Math.min(tick + ticks, config.maxTicks);
}

function fallStep(run: Cascade, step: number, config: CascadeConfig): Cascade {
  const settled = settle(run.cells);
  let end = run.tick;
  const falls: CardFall[] = settled.moves.map((move) => {
    const land = later(run.tick, fallTicks(move.fromRow - move.toRow, config), config);
    end = Math.max(end, land);
    const card = cardIn(settled.cells, cellIndex(move.col, move.toRow));
    return { card, col: move.col, fromRow: move.fromRow, toRow: move.toRow, landMs: msOf(land) };
  });
  const events: PokerDropEvent[] =
    falls.length > 0
      ? [...run.events, { kind: 'cards-fell', step, falls, atMs: msOf(run.tick) }]
      : run.events;
  return { ...run, cells: settled.cells, events, tick: end };
}

/**
 * Bursts every hand of the well, step after step, until a step makes none. It always ends: every
 * step empties cells. Time stops at maxTicks; the steps after it all happen at the cap.
 */
export function runCascade(start: Cascade, config: CascadeConfig): Cascade {
  let run = start;
  for (let step = 1; ; step += 1) {
    const bursts = burstingLines(run.cells);
    if (bursts.length === 0) return run;
    run = burstStep(run, bursts, step);
    run = fallStep({ ...run, tick: later(run.tick, config.burstTicks, config) }, step, config);
  }
}

/** Drops `card` into column `col` (which must have room) and runs the cascade. Pure. */
export function simulateDrop(
  cells: readonly Cell[],
  drop: { readonly col: number; readonly card: Card },
  config: CascadeConfig = CASCADE,
): Cascade {
  const row = heightOf(cells, drop.col);
  const land = fallTicks(ROWS - row, config);
  const placed = [...cells];
  placed[cellIndex(drop.col, row)] = drop.card;
  const event: PokerDropEvent = {
    kind: 'card-dropped',
    card: drop.card,
    col: drop.col,
    fromRow: ROWS,
    row,
    atMs: 0,
    landMs: msOf(land),
  };
  return runCascade({ cells: placed, events: [event], hands: 0, points: 0, tick: land }, config);
}

/** True when some column is full, so a rising row would push its top card out of the well. */
export function wouldOverflow(cells: readonly Cell[]): boolean {
  for (let col = 0; col < COLS; col += 1) if (heightOf(cells, col) === ROWS) return true;
  return false;
}

/**
 * The well rises one row from `run`'s tick: every card moves up and `cards` (one per column) fill
 * the bottom row; then the new row's hands burst in a cascade. The caller checks wouldOverflow.
 */
export function simulateRise(
  run: Cascade,
  cards: readonly Card[],
  config: CascadeConfig = CASCADE,
): Cascade {
  const risen: Cell[] = [...cards, ...run.cells.slice(0, (ROWS - 1) * COLS)];
  const land = later(run.tick, config.riseTicks, config);
  const event: PokerDropEvent = {
    kind: 'row-rose',
    cards,
    atMs: msOf(run.tick),
    landMs: msOf(land),
  };
  return runCascade({ ...run, cells: risen, events: [...run.events, event], tick: land }, config);
}
