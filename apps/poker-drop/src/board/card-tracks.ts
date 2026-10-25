// apps/poker-drop/src/board/card-tracks.ts
// Pure, JS thread: follows every card one move touches through its timed events, so the board can
// replay where each card was at every moment. A card the events never name sat still (it only rose
// with the well, which the turn-wide rise track draws); every other card gets one path segment per
// drop, fall or rise, and a card that bursts or leaves on the continue keeps its own path to the
// moment it vanishes. Rows count from the bottom as in the rules (row -1 is below the well, where a
// rising row waits).
import { TUNING } from '@e07/poker-drop/rules/poker-drop-tuning.ts';

import type { EasingId } from '@e07/game-kit/timeline/track.ts';
import type { PokerDropEvent } from '@e07/poker-drop/rules/poker-drop-types.ts';

const COLS = TUNING.wellCols;
const CELLS = TUNING.wellCols * TUNING.wellRows;

/** One straight move of a card down or up its column. */
export type Segment = {
  readonly startMs: number;
  readonly endMs: number;
  readonly fromRow: number;
  readonly toRow: number;
  readonly easing: EasingId;
};

/** A card the move touched: its column (cards never change column) and its segments in order. */
export type CardPath = {
  readonly col: number;
  readonly card: number;
  readonly segments: Segment[];
};

/** A card that left the well: a burst (kind 0) or the continue (kind 1), at `row` and `atMs`. */
export type GoneCard = {
  readonly path: CardPath;
  readonly row: number;
  readonly atMs: number;
  readonly kind: 0 | 1;
};

/** Where every touched card ended: in the well by final cell index, or gone in event order. */
export type CardTrace = {
  readonly survivors: readonly (readonly [number, CardPath])[];
  readonly gone: readonly GoneCard[];
  /** The dropped card's path and its landing, when the move dropped one. */
  readonly drop: { readonly path: CardPath; readonly landMs: number } | null;
};

type Rise = { readonly atMs: number; readonly landMs: number };

type Tracer = {
  /** Touched cards still in the well, by their current cell. */
  readonly board: Map<number, CardPath>;
  /** Cells emptied during the move: a card in two bursting lines bursts once. */
  readonly emptied: Set<number>;
  readonly gone: GoneCard[];
  /** The move's rising row, once it rose (a move raises at most one). */
  readonly rises: Rise[];
  /** The move's dropped card, once it dropped. */
  readonly drops: NonNullable<CardTrace['drop']>[];
};

type EventOf<TKind extends PokerDropEvent['kind']> = Extract<PokerDropEvent, { kind: TKind }>;

const cellOf = (col: number, row: number): number => row * COLS + col;
const rowOf = (index: number): number => Math.floor(index / COLS);

/** The card at `index`: one already followed, else one that sat still (rising with the row, if one rose). */
function takePath(tracer: Tracer, index: number, card: number): CardPath {
  const known = tracer.board.get(index);
  if (known !== undefined) {
    tracer.board.delete(index);
    return known;
  }
  const row = rowOf(index);
  const rise = tracer.rises.at(-1) ?? null;
  const segments: Segment[] =
    rise === null
      ? []
      : [
          {
            startMs: rise.atMs,
            endMs: rise.landMs,
            fromRow: row - 1,
            toRow: row,
            easing: 'in-out-quad',
          },
        ];
  return { col: index % COLS, card, segments };
}

function dropped(tracer: Tracer, event: EventOf<'card-dropped'>): void {
  const path: CardPath = {
    col: event.col,
    card: event.card,
    segments: [
      {
        startMs: event.atMs,
        endMs: event.landMs,
        fromRow: event.fromRow,
        toRow: event.row,
        easing: 'in-quad',
      },
    ],
  };
  tracer.board.set(cellOf(event.col, event.row), path);
  tracer.drops.push({ path, landMs: event.landMs });
}

type Vanish = {
  readonly cells: readonly number[];
  readonly cards: readonly number[];
  readonly atMs: number;
  readonly kind: 0 | 1;
};

function vanished(tracer: Tracer, vanish: Vanish): void {
  vanish.cells.forEach((index, order) => {
    if (tracer.emptied.has(index)) return;
    tracer.emptied.add(index);
    const path = takePath(tracer, index, vanish.cards[order] ?? -1);
    tracer.gone.push({ path, row: rowOf(index), atMs: vanish.atMs, kind: vanish.kind });
  });
}

function fell(tracer: Tracer, event: EventOf<'cards-fell'>): void {
  const moving = event.falls.map((fall) => ({
    fall,
    path: takePath(tracer, cellOf(fall.col, fall.fromRow), fall.card),
  }));
  for (const { fall } of moving) tracer.emptied.add(cellOf(fall.col, fall.fromRow));
  for (const { fall, path } of moving) {
    const to = cellOf(fall.col, fall.toRow);
    path.segments.push({
      startMs: event.atMs,
      endMs: fall.landMs,
      fromRow: fall.fromRow,
      toRow: fall.toRow,
      easing: 'in-quad',
    });
    tracer.emptied.delete(to);
    tracer.board.set(to, path);
  }
}

function rose(tracer: Tracer, event: EventOf<'row-rose'>): void {
  const rise = { atMs: event.atMs, landMs: event.landMs };
  const followed = [...tracer.board.entries()];
  tracer.board.clear();
  for (const [index, path] of followed) {
    const row = rowOf(index);
    path.segments.push({
      startMs: rise.atMs,
      endMs: rise.landMs,
      fromRow: row,
      toRow: row + 1,
      easing: 'in-out-quad',
    });
    tracer.board.set(index + COLS, path);
  }
  const emptied = [...tracer.emptied];
  tracer.emptied.clear();
  for (const index of emptied) if (index + COLS < CELLS) tracer.emptied.add(index + COLS);
  tracer.rises.push(rise);
}

function follow(tracer: Tracer, event: PokerDropEvent): void {
  switch (event.kind) {
    case 'card-dropped':
      dropped(tracer, event);
      return;
    case 'hand-burst':
      vanished(tracer, { cells: event.cells, cards: event.cards, atMs: event.atMs, kind: 0 });
      return;
    case 'cards-fell':
      fell(tracer, event);
      return;
    case 'row-rose':
      rose(tracer, event);
      return;
    case 'top-row-cleared':
      vanished(tracer, { cells: event.cells, cards: event.cards, atMs: event.atMs, kind: 1 });
      return;
    case 'well-overflowed':
    case 'card-dealt':
      return;
  }
}

/** Pure: the path of every card the move's events touch, in event order. */
export function traceCards(events: readonly PokerDropEvent[]): CardTrace {
  const tracer: Tracer = { board: new Map(), emptied: new Set(), gone: [], rises: [], drops: [] };
  for (const event of events) follow(tracer, event);
  return {
    survivors: [...tracer.board.entries()].sort((a, b) => a[0] - b[0]),
    gone: tracer.gone,
    drop: tracer.drops.at(-1) ?? null,
  };
}
