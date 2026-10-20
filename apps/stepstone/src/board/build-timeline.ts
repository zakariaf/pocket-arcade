// apps/stepstone/src/board/build-timeline.ts
// Pure: the events of one hop become the short film the board plays. Channels:
//   hop      (frog)        [from, to] cells, held: the frog jumps along an arc by the eased progress
//   sink     (per cell)    [1, code] → [0, code]: the stone the frog left (its kind's code) goes under
//   pop      (per cell)    [0.5 → 1]: the landing stone's glyph grows when its hop kind is new
//   goal     (turn)        [0 → 1]: the flag glows and the hop count pops on it
//   burst    (turn)        particles from the flag (full motion only)
//   stranded (frog)        [1 → 0]: the frog shakes (full motion); reduced motion holds it still
import { cellEntity, FROG_ENTITY, TURN_ENTITY } from './board-ids.ts';
import { CELL_CODE } from './to-view.ts';

import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { StepstoneEvent } from '@e07/stepstone/rules/stepstone-types.ts';

/** Longest a turn may animate; build-timeline.test.ts enforces it. */
export const TURN_BUDGET_MS = 1200;
const HOP_MS = 320;
const SINK_MS = 360;
const LAND_MS = HOP_MS;

/** Reduced motion: half durations, no particles, no shake, no overshoot. */
type Timing = { readonly scale: number; readonly isFull: boolean };

type EventOf<TKind extends StepstoneEvent['kind']> = Extract<StepstoneEvent, { kind: TKind }>;

/**
 * The frog jumps from its stone to the target; the sound and the light tap fire at take-off. The
 * track holds both cells (constant values) and draw places the frog by the eased progress, so the
 * timeline needs no pond geometry.
 */
function stepped(event: EventOf<'player-stepped'>, timing: Timing): Track[] {
  return [
    {
      channel: 'hop',
      entityId: FROG_ENTITY,
      startMs: 0,
      durationMs: HOP_MS * timing.scale,
      easing: 'in-out-quad',
      from: [event.from, event.to],
      to: [event.from, event.to],
      cue: { sound: 'hop', haptic: 'light' },
    },
  ];
}

function sank(event: EventOf<'stone-sank'>, timing: Timing): Track[] {
  return [
    {
      channel: 'sink',
      entityId: cellEntity(event.cell),
      startMs: (HOP_MS / 2) * timing.scale,
      durationMs: SINK_MS * timing.scale,
      easing: 'in-quad',
      from: [1, CELL_CODE[event.stone]],
      to: [0, CELL_CODE[event.stone]],
      cue: { sound: 'sink' },
    },
  ];
}

function changed(event: EventOf<'move-kind-changed'>, timing: Timing): Track[] {
  if (!event.isNewKind) return [];
  return [
    {
      channel: 'pop',
      entityId: cellEntity(event.cell),
      startMs: LAND_MS * timing.scale,
      durationMs: 260 * timing.scale,
      easing: timing.isFull ? 'out-back' : 'linear',
      from: [0.5],
      to: [1],
      cue: { sound: 'kind-change', haptic: 'selection' },
    },
  ];
}

function reached(timing: Timing): Track[] {
  const at = { entityId: TURN_ENTITY, startMs: LAND_MS * timing.scale } as const;
  const goal: Track = {
    ...at,
    channel: 'goal',
    durationMs: 600 * timing.scale,
    easing: timing.isFull ? 'out-back' : 'linear',
    from: [0],
    to: [1],
    cue: { sound: 'win', haptic: 'success' },
  };
  const burst: Track = {
    ...at,
    channel: 'burst',
    durationMs: 700,
    easing: 'linear',
    from: [0],
    to: [1],
  };
  return timing.isFull ? [goal, burst] : [goal];
}

/** No stone in reach: the frog shakes (its amplitude 0 under reduced motion), the stuck cue fires. */
function stranded(timing: Timing): Track[] {
  return [
    {
      channel: 'stranded',
      entityId: FROG_ENTITY,
      startMs: LAND_MS * timing.scale,
      durationMs: 420 * timing.scale,
      easing: 'out-quad',
      from: [timing.isFull ? 1 : 0],
      to: [0],
      cue: { sound: 'stuck', haptic: 'warning' },
    },
  ];
}

function tracksFor(event: StepstoneEvent, timing: Timing): Track[] {
  switch (event.kind) {
    case 'player-stepped':
      return stepped(event, timing);
    case 'stone-sank':
      return sank(event, timing);
    case 'move-kind-changed':
      return changed(event, timing);
    case 'goal-reached':
      return reached(timing);
    case 'frog-stranded':
      return stranded(timing);
  }
}

/** Pure: events → tracks. The same events always give the same tracks. */
export function buildTimeline(events: readonly StepstoneEvent[], motion: Motion): readonly Track[] {
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  return events.flatMap((event) => tracksFor(event, timing));
}
