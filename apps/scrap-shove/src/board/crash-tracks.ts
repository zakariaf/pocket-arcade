// apps/scrap-shove/src/board/crash-tracks.ts
// Pure: the tracks of what a turn breaks (crashes, crushes, smashed heaps) and of how it ends
// (the catch, the cleared floor, an undo).
import {
  crashEntity,
  heapEntity,
  kindIndex,
  PLAYER_ENTITY,
  robotEntity,
  TURN_ENTITY,
} from './board-ids.ts';
import { FADE_MS, phaseEnd, phaseLength, phaseStart, valuesOf } from './timeline-beats.ts';

import type { RobotKindName } from './board-ids.ts';
import type { EventOf, Pass, Timing } from './timeline-beats.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { Cell } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

const SPARK_MS = 600;
const BADGE_MS = 600;
const CAUGHT_MS = 400;
const GLOW_MS = 400;
const BURST_MS = 700;

/** Where and when a robot broke down, and what it sounded like (only the first of a crash sounds). */
type Breakdown = {
  readonly id: number;
  readonly kind: RobotKindName;
  readonly at: Cell;
  readonly startMs: number;
  readonly cue?: Track['cue'];
};

/** Where and when something broke, and which crash of the turn it was. */
type Spot = { readonly at: Cell; readonly crash: number; readonly startMs: number };

/** A robot that left the view fades where it broke. */
function breakdown(spec: Breakdown, timing: Timing): Track {
  const values = [...valuesOf(spec.at), kindIndex(spec.kind)];
  return {
    channel: 'ghost',
    entityId: robotEntity(spec.id),
    startMs: spec.startMs,
    durationMs: FADE_MS * timing.scale,
    easing: 'out-quad',
    from: [...values, 1],
    to: [...values, 0],
    ...(spec.cue === undefined ? {} : { cue: spec.cue }),
  };
}

/** Sparks fly from a crash (full motion only). */
function sparks(spot: Spot, timing: Timing): Track[] {
  if (!timing.isFull) return [];
  const at = valuesOf(spot.at);
  const { startMs } = spot;
  return [
    {
      channel: 'spark',
      entityId: crashEntity(spot.crash),
      startMs,
      durationMs: SPARK_MS,
      easing: 'linear',
      from: at,
      to: at,
    },
  ];
}

/** A crash of two robots or more shows how many it scrapped. */
function badge(event: EventOf<'robots-crashed'>, spot: Spot, timing: Timing): Track[] {
  const count = event.robotIds.length;
  if (count < 2) return [];
  const values = [...valuesOf(spot.at), count];
  const durationMs = BADGE_MS * timing.scale;
  const { startMs } = spot;
  return [
    {
      channel: 'badge',
      entityId: crashEntity(spot.crash),
      startMs,
      durationMs,
      easing: 'out-quad',
      from: values,
      to: values,
    },
  ];
}

/** Robots that crashed into each other or into a heavy robot leave a new heap, which pops in. */
function newHeap(event: EventOf<'robots-crashed'>, spot: Spot, timing: Timing): Track[] {
  if (event.cause === 'scrap') return [];
  const easing = timing.isFull ? 'out-back' : 'linear';
  const durationMs = FADE_MS * timing.scale;
  const { startMs } = spot;
  return [
    {
      channel: 'appear',
      entityId: heapEntity(event.heapId),
      startMs,
      durationMs,
      easing,
      from: [0],
      to: [1],
    },
  ];
}

/** Robots crashed (into each other, into scrap or into a heavy robot) at the end of the phase. */
export function robotsCrashed(
  event: EventOf<'robots-crashed'>,
  pass: Pass,
  timing: Timing,
): Track[] {
  const spot = { at: event.at, crash: pass.crashes, startMs: phaseEnd(pass.phase, timing) };
  const ghosts = event.robotIds.map((id, order) => {
    const cue = order === 0 ? { cue: { sound: 'crash', haptic: 'medium' as const } } : {};
    const kind = pass.kinds[id] ?? 'normal';
    return breakdown({ id, kind, at: event.at, startMs: spot.startMs, ...cue }, timing);
  });
  return [
    ...ghosts,
    ...newHeap(event, spot, timing),
    ...badge(event, spot, timing),
    ...sparks(spot, timing),
  ];
}

/** A heap landed on a robot: it breaks with a heavier sound and haptic. */
export function robotCrushed(event: EventOf<'robot-crushed'>, pass: Pass, timing: Timing): Track[] {
  const spot = { at: event.at, crash: pass.crashes, startMs: phaseEnd(pass.phase, timing) };
  const cue = { sound: 'crush', haptic: 'heavy' } as const;
  const { robotId: id, robotKind: kind } = event;
  return [
    breakdown({ id, kind, at: event.at, startMs: spot.startMs, cue }, timing),
    ...sparks(spot, timing),
  ];
}

/** A heavy robot smashed a heap it could not shove: the heap fades where it lay. */
export function scrapSmashed(event: EventOf<'scrap-smashed'>, pass: Pass, timing: Timing): Track[] {
  return [
    {
      channel: 'smash',
      entityId: heapEntity(event.heapId),
      startMs: phaseStart(pass.phase, timing),
      durationMs: phaseLength(pass.phase, timing),
      easing: 'in-quad',
      from: [...valuesOf(event.at), 1],
      to: [...valuesOf(event.at), 0],
      cue: { sound: 'smash' },
    },
  ];
}

/** The player was caught at the end of the phase: a red flash on their square. */
export function playerCaught(pass: Pass, timing: Timing): Track[] {
  return [
    {
      channel: 'caught',
      entityId: PLAYER_ENTITY,
      startMs: phaseEnd(pass.phase, timing),
      durationMs: CAUGHT_MS * timing.scale,
      easing: 'out-quad',
      from: [1],
      to: [0],
      cue: { sound: 'lose', haptic: 'error' },
    },
  ];
}

/** The floor is clear: a glow, and a burst of particles in full motion. */
export function floorCleared(pass: Pass, timing: Timing): Track[] {
  const at = { entityId: TURN_ENTITY, startMs: phaseEnd(pass.phase, timing) } as const;
  const glow: Track = {
    ...at,
    channel: 'glow',
    durationMs: GLOW_MS * timing.scale,
    easing: 'out-quad',
    from: [1],
    to: [0],
    cue: { sound: 'win', haptic: 'success' },
  };
  const burst: Track = {
    ...at,
    channel: 'burst',
    durationMs: BURST_MS,
    easing: 'linear',
    from: [0],
    to: [1],
  };
  return timing.isFull ? [glow, burst] : [glow];
}

/** An undo put the last step back: one short blink over the floor. */
export function stepReverted(timing: Timing): Track[] {
  return [
    {
      channel: 'revert',
      entityId: TURN_ENTITY,
      startMs: 0,
      durationMs: GLOW_MS * timing.scale,
      easing: 'out-quad',
      from: [1],
      to: [0],
      cue: { haptic: 'medium' },
    },
  ];
}
