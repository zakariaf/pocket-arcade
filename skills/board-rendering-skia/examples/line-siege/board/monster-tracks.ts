// apps/line-siege/src/board/monster-tracks.ts
// The monster beats of a turn (hit, defeat, march, breach, spawn) for build-timeline.ts. Pure.
import { TUNING } from '@e07/line-siege/rules/line-siege-tuning.ts';

import { heartEntity, kindIndex, TURN_ENTITY } from './board-ids.ts';

import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { LineSiegeEvent } from '@e07/line-siege/rules/line-siege-types.ts';

/** Beat start times of a turn (full motion), so a turn reads as a score. */
export const AT = {
  clear: 140,
  beam: 160,
  hit: 380,
  defeat: 480,
  march: 620,
  spawn: 700,
  tray: 800,
};

/** Reduced motion: half durations, no particles or shake, no overshoot. */
export type Timing = { readonly scale: number; readonly isFull: boolean };
export type EventOf<TKind extends LineSiegeEvent['kind']> = Extract<
  LineSiegeEvent,
  { kind: TKind }
>;
/** Monster facts that later events need (rows for a breaching monster's last walk). */
export type Seen = Map<number, { readonly fromRow: number; readonly toRow: number }>;

/** Timing for a motion setting. */
export function timingFor(motion: Motion): Timing {
  return { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
}

export function hit(event: EventOf<'monster-hit'>, timing: Timing): Track[] {
  const startMs = AT.hit * timing.scale;
  return [
    {
      channel: 'flash',
      entityId: event.monsterId,
      startMs,
      durationMs: 180 * timing.scale,
      easing: 'linear',
      from: [1],
      to: [0],
      cue: { sound: 'hit' },
    },
  ];
}

export function defeated(event: EventOf<'monster-defeated'>, timing: Timing): Track[] {
  const place = [event.lane, event.row, kindIndex(event.monsterKind)];
  const startMs = AT.defeat * timing.scale;
  const vanish: Track = {
    channel: 'vanish',
    entityId: event.monsterId,
    startMs,
    durationMs: 240 * timing.scale,
    easing: 'out-quad',
    from: [...place, 1],
    to: [...place, 0],
    cue: { sound: 'pop', haptic: 'success' },
  };
  const burst: Track = {
    channel: 'burst',
    entityId: event.monsterId,
    startMs,
    durationMs: 600,
    easing: 'linear',
    from: [event.lane, event.row],
    to: [event.lane, event.row],
  };
  return timing.isFull ? [vanish, burst] : [vanish];
}

export function moved(event: EventOf<'monster-moved'>, timing: Timing, seen: Seen): Track[] {
  seen.set(event.monsterId, { fromRow: event.fromRow, toRow: event.toRow });
  const startMs = AT.march * timing.scale;
  return [
    {
      channel: 'row',
      entityId: event.monsterId,
      startMs,
      durationMs: 220 * timing.scale,
      easing: 'in-out-quad',
      from: [event.fromRow],
      to: [event.toRow],
    },
  ];
}

export function breached(event: EventOf<'wall-breached'>, timing: Timing, seen: Seen): Track[] {
  const walk = seen.get(event.monsterId) ?? {
    fromRow: TUNING.laneRows - 1,
    toRow: TUNING.laneRows,
  };
  const kind = kindIndex(event.monsterKind);
  const startMs = AT.march * timing.scale;
  const vanish: Track = {
    channel: 'vanish',
    entityId: event.monsterId,
    startMs,
    durationMs: 260 * timing.scale,
    easing: 'in-quad',
    from: [event.lane, walk.fromRow, kind, 1],
    to: [event.lane, walk.toRow, kind, 0],
    cue: { sound: 'breach', haptic: 'warning' },
  };
  // The heart this breach cost shrinks away on the wall (its slot is empty in the final view).
  const heart: Track = {
    channel: 'heart',
    entityId: heartEntity(event.heartsLeft),
    startMs: startMs + 120 * timing.scale,
    durationMs: 240 * timing.scale,
    easing: 'in-quad',
    from: [1],
    to: [0],
  };
  const shake: Track = {
    channel: 'shake',
    entityId: TURN_ENTITY,
    startMs: startMs + 200,
    durationMs: 200,
    easing: 'linear',
    from: [1],
    to: [0],
  };
  return timing.isFull ? [vanish, heart, shake] : [vanish, heart];
}

export function spawned(event: EventOf<'monster-spawned'>, timing: Timing): Track[] {
  const startMs = AT.spawn * timing.scale;
  return [
    {
      channel: 'spawn',
      entityId: event.monsterId,
      startMs,
      durationMs: 200 * timing.scale,
      easing: timing.isFull ? 'out-back' : 'linear',
      from: [0],
      to: [1],
    },
  ];
}
