// apps/snare-snake/src/board/build-timeline.ts
// Pure: the events of one move become the short film the board plays. Channels:
//   head   (head)     [from, to, 0 -> 1]: the head slides from its old cell to its new one
//   tail   (cell)     [1 -> 0]: the cell the tail left (or the head a continue stepped back) fades
//   loop   (turn)     [1 -> 0]: the closed loop flashes (an effect: drawn only while it plays)
//   spent  (cell)     [1 -> 0]: each spent segment fades where it was
//   caught (critter)  [cell, 1 -> 0]: each caught critter shrinks away where it was
//   burst  (critter)  [cell]: particles from a caught critter (full motion only)
//   hop    (critter)  [from, to, 0 -> 1]: a critter hops to its next cell
//   bonus  (turn)     [0.6 -> 1]: the moves badge pops (moves added, or the win's bonus)
// The events carry cell indexes and the timeline knows no grid width, so a slide carries both
// cells and its progress; draw() turns cells into positions with the layout.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { BURST_MS, cellEntity, critterEntity, HEAD_ENTITY, TURN_ENTITY } from './board-ids.ts';

import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { SnareSnakeEvent } from '@e07/snare-snake/rules/snare-snake-types.ts';

/** Longest a turn may animate; build-timeline.test.ts enforces it. */
export const TURN_BUDGET_MS = 1200;
const SLIDE_MS = 140;
const LOOP_MS = 500;
const CATCH_AT_MS = 180;
const HOP_AT_MS = 160;
const BONUS_AT_MS = 520;

/** Reduced motion: half durations, no particles, no overshoot. */
type Timing = { readonly scale: number; readonly isFull: boolean };

type EventOf<TKind extends SnareSnakeEvent['kind']> = Extract<SnareSnakeEvent, { kind: TKind }>;

function slid(event: EventOf<'snake-moved'>, timing: Timing): Track[] {
  const head: Track = {
    channel: 'head',
    entityId: HEAD_ENTITY,
    startMs: 0,
    durationMs: SLIDE_MS * timing.scale,
    easing: 'out-quad',
    from: [event.from, event.to, 0],
    to: [event.from, event.to, 1],
    cue: { sound: 'step' },
  };
  if (event.vacated === null) return [head];
  const tail: Track = {
    channel: 'tail',
    entityId: cellEntity(event.vacated),
    startMs: 0,
    durationMs: SLIDE_MS * timing.scale,
    easing: 'linear',
    from: [1],
    to: [0],
  };
  return [head, tail];
}

/** The loop flashes once; each segment it spent fades where it was. */
function looped(event: EventOf<'loop-closed'>, timing: Timing): Track[] {
  const flash: Track = {
    channel: 'loop',
    entityId: TURN_ENTITY,
    startMs: 0,
    durationMs: LOOP_MS * timing.scale,
    easing: 'in-quad',
    from: [1],
    to: [0],
    cue: { sound: 'loop', haptic: 'light' },
  };
  const spent = event.loop.slice(0, event.spent).map((cell): Track => ({
    channel: 'spent',
    entityId: cellEntity(cell),
    startMs: 100 * timing.scale,
    durationMs: 300 * timing.scale,
    easing: 'in-quad',
    from: [1],
    to: [0],
  }));
  return [flash, ...spent];
}

/** Each caught critter shrinks away where it stood, with a burst in full motion; the first cues. */
function caught(event: EventOf<'critters-caught'>, timing: Timing): Track[] {
  return event.critterIds.flatMap((id, index) => {
    const cell = pickAt(event.cells, index);
    const at = { entityId: critterEntity(id), startMs: CATCH_AT_MS * timing.scale } as const;
    const shrink: Track = {
      ...at,
      channel: 'caught',
      durationMs: 300 * timing.scale,
      easing: 'in-quad',
      from: [cell, 1],
      to: [cell, 0],
      ...(index === 0 ? { cue: { sound: 'catch', haptic: 'success' as const } } : {}),
    };
    const burst: Track = {
      ...at,
      channel: 'burst',
      durationMs: BURST_MS,
      easing: 'linear',
      from: [cell],
      to: [cell],
    };
    return timing.isFull ? [shrink, burst] : [shrink];
  });
}

function hopped(event: EventOf<'critters-moved'>, timing: Timing): Track[] {
  return event.hops.map((hop) => ({
    channel: 'hop',
    entityId: critterEntity(hop.critterId),
    startMs: HOP_AT_MS * timing.scale,
    durationMs: 160 * timing.scale,
    easing: 'out-quad',
    from: [hop.from, hop.to, 0],
    to: [hop.from, hop.to, 1],
  }));
}

/** The moves badge pops: a continue's moves (with its cue) or the win's bonus. */
function popped(timing: Timing, isCued: boolean): Track[] {
  const pop: Track = {
    channel: 'bonus',
    entityId: TURN_ENTITY,
    startMs: (isCued ? 0 : BONUS_AT_MS) * timing.scale,
    durationMs: 500 * timing.scale,
    easing: timing.isFull ? 'out-back' : 'linear',
    from: [0.6],
    to: [1],
  };
  return [isCued ? { ...pop, cue: { sound: 'bonus', haptic: 'medium' } } : pop];
}

function steppedBack(event: EventOf<'snake-stepped-back'>, timing: Timing): Track[] {
  return [
    {
      channel: 'tail',
      entityId: cellEntity(event.from),
      startMs: 0,
      durationMs: 300 * timing.scale,
      easing: 'linear',
      from: [1],
      to: [0],
    },
  ];
}

function tracksFor(event: SnareSnakeEvent, timing: Timing): Track[] {
  switch (event.kind) {
    case 'snake-moved':
      return slid(event, timing);
    case 'loop-closed':
      return looped(event, timing);
    case 'critters-caught':
      return caught(event, timing);
    case 'critters-moved':
      return hopped(event, timing);
    case 'bonus-added':
      return popped(timing, false);
    case 'moves-added':
      return popped(timing, true);
    case 'snake-stepped-back':
      return steppedBack(event, timing);
  }
}

/** Pure: events -> tracks. The same events always give the same tracks. */
export function buildTimeline(
  events: readonly SnareSnakeEvent[],
  motion: Motion,
): readonly Track[] {
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  return events.flatMap((event) => tracksFor(event, timing));
}
