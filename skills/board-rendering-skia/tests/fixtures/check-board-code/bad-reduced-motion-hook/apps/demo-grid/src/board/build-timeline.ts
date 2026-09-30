// apps/demo-grid/src/board/build-timeline.ts
import { cellEntity } from './board-ids.ts';

import type { DemoGridEvent } from '@e07/demo-grid/rules/demo-grid-types.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';

/** Longest a turn may animate; build-timeline.test.ts enforces it. */
export const TURN_BUDGET_MS = 1200;
/** Beat start times of a turn (full motion). */
const MOVE_AT_MS = 0;
const REMOVE_AT_MS = 180;

/** Reduced motion: half durations, no particles, no overshoot. */
type Timing = { readonly scale: number; readonly isFull: boolean };

type EventOf<TKind extends DemoGridEvent['kind']> = Extract<DemoGridEvent, { kind: TKind }>;

function filled(event: EventOf<'cell-filled'>, timing: Timing): Track[] {
  return [
    {
      channel: 'pop',
      entityId: cellEntity(event.col, event.row),
      startMs: 0,
      durationMs: 140 * timing.scale,
      easing: timing.isFull ? 'out-back' : 'linear',
      from: [0.6],
      to: [1],
      cue: { sound: 'place', haptic: 'light' },
    },
  ];
}

function moved(event: EventOf<'piece-moved'>, timing: Timing): Track[] {
  const slide = { channel: 'pos', entityId: event.pieceId, startMs: MOVE_AT_MS } as const;
  return [
    {
      ...slide,
      durationMs: 180 * timing.scale,
      easing: 'in-out-quad',
      from: [event.fromCol, event.fromRow],
      to: [event.toCol, event.toRow],
    },
  ];
}

/** A removed piece is gone from the view: its 'gone' track carries col, row and alpha. */
function removed(event: EventOf<'piece-removed'>, timing: Timing): Track[] {
  const at = { entityId: event.pieceId, startMs: REMOVE_AT_MS * timing.scale } as const;
  const gone: Track = {
    ...at,
    channel: 'gone',
    durationMs: 220 * timing.scale,
    easing: 'out-quad',
    from: [event.col, event.row, 1],
    to: [event.col, event.row, 0],
    cue: { sound: 'remove', haptic: 'medium' },
  };
  const burst: Track = {
    ...at,
    channel: 'burst',
    durationMs: 600,
    easing: 'linear',
    from: [event.col, event.row],
    to: [event.col, event.row],
  };
  return timing.isFull ? [gone, burst] : [gone];
}

function tracksFor(event: DemoGridEvent, timing: Timing): Track[] {
  switch (event.kind) {
    case 'cell-filled':
      return filled(event, timing);
    case 'piece-moved':
      return moved(event, timing);
    case 'piece-removed':
      return removed(event, timing);
  }
}

/** Pure: events → tracks. The same events always give the same tracks. */
export function buildTimeline(events: readonly DemoGridEvent[], motion: Motion): readonly Track[] {
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  return events.flatMap((event) => tracksFor(event, timing));
}
