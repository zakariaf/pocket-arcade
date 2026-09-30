// apps/__GAME_ID__/src/board/build-timeline.ts
// Pure: the events of one move become the short film the board plays. Channels:
//   flip  (per cell)  [-1 → 1]: the old face turns over (|v| is the height, the sign the face)
//   glow  (turn)      [1 → 0]: the whole board flashes when it goes dark
//   burst (turn)      particles from the board centre (full motion only)
//   bonus (turn)      [0.6 → 1]: the moves-left label pops when a continue adds moves
import { cellEntity, TURN_ENTITY } from './board-ids.ts';

import type { __GAME_PASCAL__Event } from '@e07/__GAME_ID__/rules/__GAME_ID__-types.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';

/** Longest a turn may animate; build-timeline.test.ts enforces it. */
export const TURN_BUDGET_MS = 1200;
/** Beat start times of a turn (full motion): the tapped cell turns first, its neighbours after. */
const NEIGHBOUR_DELAY_MS = 50;
const CLEAR_AT_MS = 320;

/** Reduced motion: half durations, no particles, no overshoot. */
type Timing = { readonly scale: number; readonly isFull: boolean };

type EventOf<TKind extends __GAME_PASCAL__Event['kind']> = Extract<
  __GAME_PASCAL__Event,
  { kind: TKind }
>;

/** Each flipped cell turns over; the first carries the sound and the haptic. */
function flipped(event: EventOf<'cells-flipped'>, timing: Timing): Track[] {
  return event.cells.map((index, order) => ({
    channel: 'flip',
    entityId: cellEntity(index),
    startMs: (order === 0 ? 0 : NEIGHBOUR_DELAY_MS) * timing.scale,
    durationMs: 200 * timing.scale,
    easing: 'in-out-quad',
    from: [-1],
    to: [1],
    ...(order === 0 ? { cue: { sound: 'flip', haptic: 'light' as const } } : {}),
  }));
}

/** The board went dark: a glow over the whole board, plus a particle burst in full motion. */
function cleared(timing: Timing): Track[] {
  const at = { entityId: TURN_ENTITY, startMs: CLEAR_AT_MS * timing.scale } as const;
  const glow: Track = {
    ...at,
    channel: 'glow',
    durationMs: 400 * timing.scale,
    easing: 'out-quad',
    from: [1],
    to: [0],
    cue: { sound: 'clear', haptic: 'success' },
  };
  const burst: Track = { ...at, channel: 'burst', durationMs: 700, easing: 'linear', from: [0], to: [1] };
  return timing.isFull ? [glow, burst] : [glow];
}

/** The continue added moves: the moves-left label pops in the middle of the board. */
function added(timing: Timing): Track[] {
  return [
    {
      channel: 'bonus',
      entityId: TURN_ENTITY,
      startMs: 0,
      durationMs: 600 * timing.scale,
      easing: timing.isFull ? 'out-back' : 'linear',
      from: [0.6],
      to: [1],
      cue: { sound: 'bonus', haptic: 'medium' },
    },
  ];
}

function tracksFor(event: __GAME_PASCAL__Event, timing: Timing): Track[] {
  switch (event.kind) {
    case 'cells-flipped':
      return flipped(event, timing);
    case 'board-cleared':
      return cleared(timing);
    case 'moves-added':
      return added(timing);
  }
}

/** Pure: events → tracks. The same events always give the same tracks. */
export function buildTimeline(
  events: readonly __GAME_PASCAL__Event[],
  motion: Motion,
): readonly Track[] {
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  return events.flatMap((event) => tracksFor(event, timing));
}
