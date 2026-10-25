// apps/swap-guard/src/board/build-timeline.ts
// Pure: the events of one move become the short film the board plays. Channels:
//   guard     (guard)  [from, to, 0 -> 1]: the guard slides to the square it swapped to
//   slide     (enemy)  [from, to, 0 -> 1]: the enemy it swapped with slides the other way
//   struck    (cell)   [1 -> 0]: the shading of a square the volley strikes fades as it lands
//   flash     (cell)   [0 -> 1]: a glow grows on each struck square (an effect: drawn while it plays)
//   fall      (enemy)  [1 -> 0]: a knocked-out enemy shrinks away where it stood
//   burst     (enemy)  [cell]: particles from a knocked-out enemy (full motion only)
//   hit       (guard)  [0 -> 1]: a ring bursts from the guard a strike landed on (an effect)
//   rise      (enemy)  [0 -> 1]: an enemy the continue gives back stands up again
//   telegraph (turn)   [0 -> 1]: the strikes to come fade in once everything has landed
// The events carry square indexes and the timeline knows no board width, so a slide carries both
// squares and its progress; draw() turns squares into positions with the layout.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { BURST_MS, cellEntity, enemyEntity, GUARD_ENTITY, TURN_ENTITY } from './board-ids.ts';

import type { Motion, Track, TrackCue } from '@e07/game-kit/timeline/track.ts';
import type { SwapGuardEvent } from '@e07/swap-guard/rules/swap-guard-types.ts';

/** Longest a turn may animate; build-timeline.test.ts enforces it. */
export const TURN_BUDGET_MS = 1200;
const SWAP_MS = 220;
const STRIKE_AT_MS = 240;
const STRIKE_MS = 320;
const FALL_AT_MS = 360;
const FALL_MS = 300;
const HIT_MS = 480;
const RISE_MS = 300;
const TELEGRAPH_AT_MS = 700;
const TELEGRAPH_MS = 240;

/** Reduced motion: half durations, no particles, no overshoot. */
type Timing = { readonly scale: number; readonly isFull: boolean };

type EventOf<TKind extends SwapGuardEvent['kind']> = Extract<SwapGuardEvent, { kind: TKind }>;

/** The two pieces trade squares; the telegraph of the new board fades in after `telegraphAtMs`. */
function swapped(
  event: EventOf<'pieces-swapped' | 'swap-reversed'>,
  timing: Timing,
  beat: { readonly cue: TrackCue; readonly telegraphAtMs: number },
): Track[] {
  const slide = { startMs: 0, durationMs: SWAP_MS * timing.scale, easing: 'out-quad' } as const;
  const guard: Track = {
    ...slide,
    channel: 'guard',
    entityId: GUARD_ENTITY,
    from: [event.from, event.to, 0],
    to: [event.from, event.to, 1],
    cue: beat.cue,
  };
  const enemy: Track[] =
    event.enemyId === null
      ? []
      : [
          {
            ...slide,
            channel: 'slide',
            entityId: enemyEntity(event.enemyId),
            from: [event.to, event.from, 0],
            to: [event.to, event.from, 1],
          },
        ];
  const telegraph: Track = {
    channel: 'telegraph',
    entityId: TURN_ENTITY,
    startMs: beat.telegraphAtMs * timing.scale,
    durationMs: TELEGRAPH_MS * timing.scale,
    easing: 'linear',
    from: [0],
    to: [1],
  };
  return [guard, ...enemy, telegraph];
}

/** Every struck square once: its shading fades as a glow grows on it; the first one cues. */
function landed(event: EventOf<'strikes-landed'>, timing: Timing): Track[] {
  const cells = [...new Set(event.strikes.flatMap((strike) => strike.cells))];
  return cells.flatMap((cell, index): Track[] => {
    const at = {
      entityId: cellEntity(cell),
      startMs: STRIKE_AT_MS * timing.scale,
      durationMs: STRIKE_MS * timing.scale,
    } as const;
    const struck: Track = {
      ...at,
      channel: 'struck',
      easing: 'in-quad',
      from: [1],
      to: [0],
      ...(index === 0 ? { cue: { sound: 'strike', haptic: 'light' as const } } : {}),
    };
    return [struck, { ...at, channel: 'flash', easing: 'out-quad', from: [0], to: [1] }];
  });
}

/** Each knocked-out enemy shrinks away, with a burst in full motion; the first one cues. */
function defeated(event: EventOf<'enemies-defeated'>, timing: Timing): Track[] {
  return event.enemyIds.flatMap((id, index) => {
    const at = { entityId: enemyEntity(id), startMs: FALL_AT_MS * timing.scale } as const;
    const fall: Track = {
      ...at,
      channel: 'fall',
      durationMs: FALL_MS * timing.scale,
      easing: 'in-quad',
      from: [1],
      to: [0],
      ...(index === 0 ? { cue: { sound: 'hit', haptic: 'success' as const } } : {}),
    };
    const cell = pickAt(event.cells, index);
    const burst: Track = {
      ...at,
      channel: 'burst',
      durationMs: BURST_MS,
      easing: 'linear',
      from: [cell],
      to: [cell],
    };
    return timing.isFull ? [fall, burst] : [fall];
  });
}

function guardHit(timing: Timing): Track[] {
  return [
    {
      channel: 'hit',
      entityId: GUARD_ENTITY,
      startMs: FALL_AT_MS * timing.scale,
      durationMs: HIT_MS * timing.scale,
      easing: 'out-quad',
      from: [0],
      to: [1],
      cue: { haptic: 'error' },
    },
  ];
}

/** The continue: the swap undone, and every enemy its volley knocked out standing up again. */
function reversed(event: EventOf<'swap-reversed'>, timing: Timing): Track[] {
  const back = swapped(event, timing, {
    cue: { sound: 'swap', haptic: 'medium' },
    telegraphAtMs: STRIKE_AT_MS,
  });
  const rise = event.restoredIds.map((id): Track => ({
    channel: 'rise',
    entityId: enemyEntity(id),
    startMs: 0,
    durationMs: RISE_MS * timing.scale,
    easing: timing.isFull ? 'out-back' : 'linear',
    from: [0],
    to: [1],
  }));
  return [...back, ...rise];
}

function tracksFor(event: SwapGuardEvent, timing: Timing): Track[] {
  switch (event.kind) {
    case 'pieces-swapped':
      return swapped(event, timing, {
        cue: { sound: 'swap', haptic: 'selection' },
        telegraphAtMs: TELEGRAPH_AT_MS,
      });
    case 'strikes-landed':
      return landed(event, timing);
    case 'enemies-defeated':
      return defeated(event, timing);
    case 'guard-hit':
      return guardHit(timing);
    case 'swap-reversed':
      return reversed(event, timing);
  }
}

/** Pure: events -> tracks. The same events always give the same tracks. */
export function buildTimeline(events: readonly SwapGuardEvent[], motion: Motion): readonly Track[] {
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  return events.flatMap((event) => tracksFor(event, timing));
}
