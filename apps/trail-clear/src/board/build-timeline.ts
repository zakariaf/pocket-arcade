// apps/trail-clear/src/board/build-timeline.ts
// Pure: the events of one placement (or of the continue) become the short film the board plays.
// The view is always the final state, so the wiped tiles carry their cells in their tracks. Channels:
//   place (cell)  [0.6 → 1]: the placed tile pops in
//   loop  (loop)  [0 → 1]: a loop closed (carries its sound; drawn through the wipe that follows)
//   double (turn) [cell, 0 → cell, 1]: a ring spreads from the placed cell
//   burst (turn)  [cell]: particles from the placed cell (full motion only)
//   wipe  (cell)  [1 → 0, loop, n, e, s, w]: a wiped (or, after a continue, cleared) tile shrinks
//                 away; it carries the tile's edges and the order of the loop that lights it (-1:
//                 none, the continue), because the view no longer holds the tile
//   tray  (slot)  [0 → 1]: the dealt tile grows into each of its tray slots
// Cues: place, loop, double, wipe: the sound bank's board sounds (win and lose belong to run end).
import { distinctTurns, edgesOf } from '@e07/trail-clear/rules/tiles.ts';

import { cellEntity, loopEntity, slotEntity, TURN_ENTITY } from './board-ids.ts';

import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { TrailClearEvent, WipedTile } from '@e07/trail-clear/rules/trail-clear-types.ts';

/** The busiest placement plays within this many milliseconds (full motion). */
export const TURN_BUDGET_MS = 1200;
/** Beat start times in full motion: the tile lands, its loops close, the double rings, tiles go. */
const AT = { loop: 100, loopGap: 80, double: 240, wipe: 300, tray: 160 } as const;
/** Each wiped tile starts this much after the one before it, the whole wipe within WIPE_SPREAD_MS. */
const WIPE_STAGGER_MS = 16;
const WIPE_SPREAD_MS = 240;
/** The board's middle cell: a double without a placement in the events bursts there. */
const MIDDLE_CELL = 12;

/** Reduced motion: half durations, no particles, no overshoot. */
type Timing = { readonly scale: number; readonly isFull: boolean };

type EventOf<TKind extends TrailClearEvent['kind']> = Extract<TrailClearEvent, { kind: TKind }>;

function placed(event: EventOf<'tile-placed'>, timing: Timing): Track[] {
  return [
    {
      channel: 'place',
      entityId: cellEntity(event.cell),
      startMs: 0,
      durationMs: 160 * timing.scale,
      easing: timing.isFull ? 'out-back' : 'linear',
      from: [0.6],
      to: [1],
      cue: { sound: 'place', haptic: 'light' },
    },
  ];
}

function looped(order: number, timing: Timing): Track[] {
  return [
    {
      channel: 'loop',
      entityId: loopEntity(order),
      startMs: (AT.loop + order * AT.loopGap) * timing.scale,
      durationMs: 300 * timing.scale,
      easing: 'out-quad',
      from: [0],
      to: [1],
      cue: { sound: 'loop', haptic: 'success' },
    },
  ];
}

/** A double: a ring spreads from the placed cell, with a particle burst in full motion. */
function doubled(cell: number, timing: Timing): Track[] {
  const at = { entityId: TURN_ENTITY, startMs: AT.double * timing.scale } as const;
  const ring: Track = {
    ...at,
    channel: 'double',
    durationMs: 420 * timing.scale,
    easing: 'out-quad',
    from: [cell, 0],
    to: [cell, 1],
    cue: { sound: 'double', haptic: 'heavy' },
  };
  const burst: Track = {
    ...at,
    channel: 'burst',
    durationMs: 700,
    easing: 'linear',
    from: [cell],
    to: [cell],
  };
  return timing.isFull ? [ring, burst] : [ring];
}

/** The tiles that leave, each on its cell, with the order of the loop it lights with (-1: none). */
type Leaving = {
  readonly cells: readonly number[];
  readonly tiles: readonly WipedTile[];
  readonly loopOf: (cell: number) => number;
};

/** Tiles leave the board: each shrinks away, a little after the one before it. */
function wiped(leaving: Leaving, timing: Timing, after: number): Track[] {
  return leaving.cells.flatMap((cell, at) => {
    const tile = leaving.tiles[at];
    if (tile === undefined) return [];
    const look = [leaving.loopOf(cell), ...edgesOf(tile.kind, tile.turns)];
    return [
      {
        channel: 'wipe',
        entityId: cellEntity(cell),
        startMs: (after + Math.min(at * WIPE_STAGGER_MS, WIPE_SPREAD_MS)) * timing.scale,
        durationMs: 320 * timing.scale,
        easing: timing.isFull ? 'in-quad' : 'linear',
        from: [1, ...look],
        to: [0, ...look],
      },
    ];
  });
}

function dealt(event: EventOf<'tile-dealt'>, timing: Timing): Track[] {
  return distinctTurns(event.tile).map((_turn, slot) => ({
    channel: 'tray',
    entityId: slotEntity(slot),
    startMs: (AT.tray + slot * 50) * timing.scale,
    durationMs: 160 * timing.scale,
    easing: timing.isFull ? 'out-back' : 'linear',
    from: [0],
    to: [1],
  }));
}

type Context = {
  readonly timing: Timing;
  readonly placedCell: number;
  /** The move's closed loops, so each knows its order (road first, then river). */
  readonly loops: readonly EventOf<'loop-closed'>[];
};

function tracksFor(event: TrailClearEvent, context: Context): Track[] {
  const { timing } = context;
  switch (event.kind) {
    case 'tile-placed':
      return placed(event, timing);
    case 'loop-closed':
      return looped(context.loops.indexOf(event), timing);
    case 'double-closed':
      return doubled(context.placedCell, timing);
    case 'tiles-wiped': {
      // A tile in both loops lights with the first (the road).
      const loopOf = (cell: number): number =>
        context.loops.findIndex((loop) => loop.cells.includes(cell));
      const [first, ...rest] = wiped({ ...event, loopOf }, timing, AT.wipe);
      return first === undefined ? [] : [{ ...first, cue: { sound: 'wipe' } }, ...rest];
    }
    case 'rows-cleared':
      // The continue empties the oldest rows silently, with no score.
      return wiped({ ...event, loopOf: () => -1 }, timing, 0);
    case 'tile-dealt':
      return dealt(event, timing);
    case 'score-added':
      return [];
  }
}

/** The cell the move placed its tile on (the continue places none: the middle cell). */
function placedCellOf(events: readonly TrailClearEvent[]): number {
  for (const event of events) if (event.kind === 'tile-placed') return event.cell;
  return MIDDLE_CELL;
}

/** Pure: events → tracks. Reduced motion halves durations and drops particles and overshoot. */
export function buildTimeline(
  events: readonly TrailClearEvent[],
  motion: Motion,
): readonly Track[] {
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  const loops = events.filter(
    (event): event is EventOf<'loop-closed'> => event.kind === 'loop-closed',
  );
  const context: Context = { timing, placedCell: placedCellOf(events), loops };
  return events.flatMap((event) => tracksFor(event, context));
}
