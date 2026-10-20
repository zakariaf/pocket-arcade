// apps/toggle-drop/src/board/build-timeline.ts
// Pure: the events of one move become the short film the board plays. Channels:
//   ball   (entity 0)       [x, y]: the fall, replayed from the simulated points (dropTracks)
//   fade   (entity 0)       [1 → 0]: the ball melts into its cup or the gutter as it lands
//   switch (per switch)     [-s → s]: the lever swings to its new side (s = -1 left, 1 right)
//   catch  (per cup)        [1.3 → 1]: a cup that takes the ball pops
//   miss   (per column)     [1 → 0]: a ball lost in the gutter leaves a short puff
//   burst  (per cup)        particles from a cup that is now full (full motion only)
import { BALL_ENTITY, cupEntity, switchEntity } from './board-ids.ts';
import { dropTracks } from './drop-tracks.ts';

import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { ToggleDropEvent } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

/** Longest a move may animate; build-timeline.test.ts enforces it. */
export const TURN_BUDGET_MS = 1800;
const FADE_MS = 140;
const SWITCH_MS = 160;
const CATCH_MS = 360;
const MISS_MS = 300;
const BURST_MS = 650;

type Timing = { readonly scale: number; readonly isFull: boolean };

type EventOf<TKind extends ToggleDropEvent['kind']> = Extract<ToggleDropEvent, { kind: TKind }>;

/** The lever swings from its old side to the new one; every click is heard. */
function swung(event: EventOf<'switch-flipped'>): Track {
  const to = event.side === 0 ? -1 : 1;
  return {
    channel: 'switch',
    entityId: switchEntity(event.row, event.col),
    startMs: event.atMs,
    durationMs: SWITCH_MS,
    easing: 'out-quad',
    from: [-to],
    to: [to],
    cue: { sound: 'click' },
  };
}

/** The ball lands: it fades out; a cup that takes it pops, a gutter ball leaves a puff. */
function landed(event: EventOf<'ball-landed'>): Track[] {
  const at = { startMs: event.atMs, easing: 'out-quad' as const };
  const fade: Track = {
    ...at,
    channel: 'fade',
    entityId: BALL_ENTITY,
    durationMs: FADE_MS,
    from: [1],
    to: [0],
  };
  const cup = cupEntity(event.col);
  const effect: Track = event.isInCup
    ? {
        ...at,
        channel: 'catch',
        entityId: cup,
        durationMs: CATCH_MS,
        from: [1.3],
        to: [1],
        cue: { sound: 'catch', haptic: 'light' },
      }
    : {
        ...at,
        channel: 'miss',
        entityId: cup,
        durationMs: MISS_MS,
        from: [1],
        to: [0],
        cue: { sound: 'gutter' },
      };
  return [fade, effect];
}

/** A cup is full: its burst of particles and the fuller sound. */
function filled(event: EventOf<'cup-filled'>): Track {
  return {
    channel: 'burst',
    entityId: cupEntity(event.col),
    startMs: event.atMs,
    durationMs: BURST_MS,
    easing: 'linear',
    from: [0],
    to: [1],
    cue: { sound: 'cup', haptic: 'success' },
  };
}

function tracksFor(event: ToggleDropEvent): Track[] {
  switch (event.kind) {
    case 'switch-flipped':
      return [swung(event)];
    case 'ball-landed':
      return landed(event);
    case 'cup-filled':
      return [filled(event)];
    case 'ball-dropped':
    case 'ball-passed':
      return [];
  }
}

/** Reduced motion: half durations and times, and no particles (no track overshoots). */
function paced(track: Track, timing: Timing): Track {
  return {
    ...track,
    startMs: track.startMs * timing.scale,
    durationMs: track.durationMs * timing.scale,
  };
}

/** The first ball track carries the drop sound (one sound per move start). */
function withDropCue(tracks: readonly Track[]): Track[] {
  return tracks.map((track, index) => (index === 0 ? { ...track, cue: { sound: 'drop' } } : track));
}

/** Pure: events → tracks. The same events always give the same tracks. */
export function buildTimeline(
  events: readonly ToggleDropEvent[],
  motion: Motion,
): readonly Track[] {
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  const tracks = [...withDropCue(dropTracks(events)), ...events.flatMap(tracksFor)];
  return tracks
    .filter((track) => timing.isFull || track.channel !== 'burst')
    .map((track) => paced(track, timing));
}
