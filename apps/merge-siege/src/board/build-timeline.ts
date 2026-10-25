// apps/merge-siege/src/board/build-timeline.ts
// Pure: the events of one move become the short film the board plays (turn-beats.ts has the
// times). Channels:
//   piece (per piece id) [col, row, value, kind, alpha, scale]: slides, marches, entries, pops,
//         fades; a value or kind from the view (board-ids.ts) means "as the final view shows it"
//   burst (per enemy id) [col, row]: the particles of a smash (full motion only)
//   next  (NEXT_ENTITY)  [alpha]: the next enemy appears in the gate once the last one entered
import {
  ENEMY_KIND,
  KIND_FROM_VIEW,
  NEXT_ENTITY,
  TILE_KIND,
  VALUE_FROM_VIEW,
} from './board-ids.ts';
import { lostTracks, smashedTracks } from './clash-tracks.ts';
import { AT, MS, pieceTrack, placeOf, timingFor } from './turn-beats.ts';

import type { ClashContext } from './clash-tracks.ts';
import type { Timing } from './turn-beats.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { MergeSiegeEvent, Step } from '@e07/merge-siege/rules/merge-siege-types.ts';

/** Longest a turn may animate; build-timeline.test.ts enforces it. */
export const TURN_BUDGET_MS = 800;

type EventOf<TKind extends MergeSiegeEvent['kind']> = Extract<MergeSiegeEvent, { kind: TKind }>;

/** The turn as the tracks need it: timing, each slid tile's step, the numbers events name. */
type Context = ClashContext & {
  /** A tile's number before the turn changed it, for tiles that merge or are lost. */
  readonly before: ReadonlyMap<number, number>;
};

/** The numbers the events name for tiles that vanish or change (a merge halves to its tiles). */
function numbersBefore(events: readonly MergeSiegeEvent[]): Map<number, number> {
  const before = new Map<number, number>();
  for (const event of events) {
    if (event.kind === 'tiles-lost') {
      for (const loss of event.losses) before.set(loss.id, loss.value);
    }
  }
  for (const event of events) {
    if (event.kind !== 'tiles-merged') continue;
    for (const merge of event.merges) {
      before.set(merge.id, merge.value / 2);
      before.set(merge.intoId, merge.value / 2);
    }
  }
  return before;
}

/** A move of a piece from one cell to another, with its number and kind (or the view's). */
function moveTrack(
  step: Step,
  look: {
    readonly value: number;
    readonly kind: number;
    readonly beat: 'slide' | 'march' | 'pushBack';
  },
  context: Context,
): Track {
  const [fromCol, fromRow] = placeOf(step.from);
  const [toCol, toRow] = placeOf(step.to);
  const startMs = look.beat === 'march' ? AT.march : AT.slide;
  return pieceTrack(
    {
      id: step.id,
      startMs,
      durationMs: MS[look.beat],
      easing: 'in-out-quad',
      from: [fromCol, fromRow, look.value, look.kind, 1, 1],
      to: [toCol, toRow, look.value, look.kind, 1, 1],
    },
    context.timing,
  );
}

function slid(event: EventOf<'tiles-slid'>, context: Context): Track[] {
  return event.steps.map((step, order) => {
    const value = context.before.get(step.id) ?? VALUE_FROM_VIEW;
    const track = moveTrack(step, { value, kind: TILE_KIND, beat: 'slide' }, context);
    return order === 0 ? { ...track, cue: { sound: 'slide' } } : track;
  });
}

/** The tile that merged fades into its partner, which pops with its new number. */
function merged(event: EventOf<'tiles-merged'>, timing: Timing): Track[] {
  return event.merges.flatMap((merge, order) => {
    const [col, row] = placeOf(merge.cell);
    const half = merge.value / 2;
    const pop = timing.isFull ? 1.2 : 1;
    const gone = pieceTrack(
      {
        id: merge.id,
        startMs: AT.merge,
        durationMs: MS.merge,
        easing: 'out-quad',
        from: [col, row, half, TILE_KIND, 1, 1],
        to: [col, row, half, TILE_KIND, 0, 1],
      },
      timing,
    );
    const grown = pieceTrack(
      {
        id: merge.intoId,
        startMs: AT.merge,
        durationMs: MS.pop,
        easing: timing.isFull ? 'out-back' : 'out-quad',
        from: [col, row, merge.value, TILE_KIND, 1, pop],
        to: [col, row, merge.value, TILE_KIND, 1, 1],
      },
      timing,
      order === 0 ? { sound: 'merge', haptic: 'light' } : undefined,
    );
    return [gone, grown];
  });
}

function marched(event: EventOf<'enemies-marched'>, context: Context): Track[] {
  return event.steps.map((step, order) => {
    const look = { value: VALUE_FROM_VIEW, kind: KIND_FROM_VIEW, beat: 'march' } as const;
    const track = moveTrack(step, look, context);
    return order === 0 ? { ...track, cue: { sound: 'march' } } : track;
  });
}

/** The waiting enemy steps down from the gate into the top row. */
function entered(event: EventOf<'enemy-entered'>, timing: Timing): Track[] {
  const [col, row] = placeOf(event.cell);
  const entry = pieceTrack(
    {
      id: event.id,
      startMs: AT.gate,
      durationMs: MS.entry,
      easing: 'out-quad',
      from: [col, row - 1, event.value, ENEMY_KIND, 1, 1],
      to: [col, row, event.value, ENEMY_KIND, 1, 1],
    },
    timing,
    { sound: 'enter' },
  );
  return [entry];
}

/** The new tile grows in its cell, last. */
function spawned(event: EventOf<'tile-spawned'>, timing: Timing): Track[] {
  const [col, row] = placeOf(event.cell);
  const spawn = pieceTrack(
    {
      id: event.id,
      startMs: AT.spawn,
      durationMs: MS.spawn,
      easing: timing.isFull ? 'out-back' : 'out-quad',
      from: [col, row, event.value, TILE_KIND, 0, 0.4],
      to: [col, row, event.value, TILE_KIND, 1, 1],
    },
    timing,
  );
  return [spawn];
}

/** The continue: every enemy one row back up, and the tiles in their way one row down. */
function pushedBack(event: EventOf<'enemies-pushed-back'>, context: Context): Track[] {
  const look = { value: VALUE_FROM_VIEW, kind: KIND_FROM_VIEW, beat: 'pushBack' } as const;
  return event.steps.map((step) => moveTrack(step, look, context));
}

function tracksFor(event: MergeSiegeEvent, context: Context): Track[] {
  switch (event.kind) {
    case 'tiles-slid':
      return slid(event, context);
    case 'tiles-merged':
      return merged(event, context.timing);
    case 'enemies-smashed':
      return smashedTracks(event, context);
    case 'tiles-lost':
      return lostTracks(event, context);
    case 'enemies-marched':
      return marched(event, context);
    case 'enemy-entered':
      return entered(event, context.timing);
    case 'tile-spawned':
      return spawned(event, context.timing);
    case 'enemies-pushed-back':
      return pushedBack(event, context);
    case 'score-added':
      return [];
  }
}

/** An enemy left the gate (it entered, or was smashed stepping in): the next one fades in. */
function nextTracks(events: readonly MergeSiegeEvent[], timing: Timing): Track[] {
  const hasLeftGate = events.some(
    (event) =>
      event.kind === 'enemy-entered' ||
      (event.kind === 'enemies-smashed' && event.phase === 'gate'),
  );
  if (!hasLeftGate) return [];
  const next: Track = {
    channel: 'next',
    entityId: NEXT_ENTITY,
    startMs: AT.next * timing.scale,
    durationMs: MS.next * timing.scale,
    easing: 'out-quad',
    from: [0],
    to: [1],
  };
  return [next];
}

/** Pure: events → tracks. The same events always give the same tracks. */
export function buildTimeline(
  events: readonly MergeSiegeEvent[],
  motion: Motion,
): readonly Track[] {
  const timing = timingFor(motion);
  const tileSteps = new Map<number, Step>();
  for (const event of events) {
    if (event.kind === 'tiles-slid') for (const step of event.steps) tileSteps.set(step.id, step);
  }
  const context: Context = { timing, tileSteps, before: numbersBefore(events) };
  return [...events.flatMap((event) => tracksFor(event, context)), ...nextTracks(events, timing)];
}
