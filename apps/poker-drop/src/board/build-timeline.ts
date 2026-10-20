// apps/poker-drop/src/board/build-timeline.ts
// Pure: the timed events of one move (simulated inside applyMove: simulate-then-replay) become the
// tracks the board plays, at the rules' own moments (halved under Reduce motion). The view is the
// final state, so every card that moved carries its path and every card that left carries its face
// and cell (card-tracks.ts). Channels:
//   pos      (card)  [col, row] -> [col, row]: one segment per drop, fall or rise (rows from the bottom)
//   slide    (card)  [1 -> 0]: the dropped card leaves the hand slot for its column
//   land     (card)  [1 -> 0]: the dropped card's landing squash (cue: drop)
//   gone     (gone)  [card, col, row, kind]: a card bursts (kind 0) or leaves on the continue (kind 1)
//   line     (burst) [col0, row0, col1, row1]: the line of a hand flashes (cue: burst-<hand>)
//   step     (burst) [col, row, step, scale]: the cascade badge pops from step 2 (cue: cascade)
//   burst    (burst) [col, row]: particles from the line's middle (full motion only)
//   rise     (turn)  [-1 -> 0]: every card the events never name rises one row (cue: rise)
//   deal     (turn)  [0 -> 1]: the next card slides into the hand slot
//   overflow (turn)  [1 -> 0]: the well flashes when a rising row overflows it (cue: overflow)
import { handStrength } from '@e07/poker-drop/rules/hand-rank.ts';
import { TUNING } from '@e07/poker-drop/rules/poker-drop-tuning.ts';
import { msOf } from '@e07/poker-drop/rules/simulate-cascade.ts';

import { burstEntity, cellEntity, goneEntity, TURN_ENTITY } from './board-ids.ts';
import { traceCards } from './card-tracks.ts';

import type { CardPath, CardTrace, GoneCard } from './card-tracks.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { PokerDropEvent } from '@e07/poker-drop/rules/poker-drop-types.ts';

/** The busiest drop (a two-step cascade and a rising row with its own hand) plays within this. */
export const TURN_BUDGET_MS = 3000;

const COLS = TUNING.wellCols;
/** A burst lasts until the cards above start to fall (the rules' burstTicks). */
const BURST_MS = msOf(TUNING.burstTicks);
const SLIDE_MS = 120;
const LAND_MS = 160;
const CLEAR_MS = 420;
const PARTICLES_MS = 600;
const BADGE_MS = 640;
const BADGE_DELAY_MS = 80;
const DEAL_MS = 220;
const OVERFLOW_MS = 600;

/** Reduced motion: half the time, no particles, no overshoot and no squash. */
type Timing = { readonly scale: number; readonly isFull: boolean };

type EventOf<TKind extends PokerDropEvent['kind']> = Extract<PokerDropEvent, { kind: TKind }>;
type Burst = EventOf<'hand-burst'>;

function pathTracks(path: CardPath, entityId: number, timing: Timing): Track[] {
  return path.segments.map((segment) => ({
    channel: 'pos',
    entityId,
    startMs: segment.startMs * timing.scale,
    durationMs: (segment.endMs - segment.startMs) * timing.scale,
    easing: segment.easing,
    from: [path.col, segment.fromRow],
    to: [path.col, segment.toRow],
  }));
}

function goneTracks(gone: GoneCard, order: number, timing: Timing): Track[] {
  const entityId = goneEntity(order);
  const isFirstCleared = gone.kind === 1 && order === 0;
  const face = [gone.path.card, gone.path.col, gone.row, gone.kind];
  const vanish: Track = {
    channel: 'gone',
    entityId,
    startMs: gone.atMs * timing.scale,
    durationMs: (gone.kind === 0 ? BURST_MS : CLEAR_MS) * timing.scale,
    easing: 'out-quad',
    from: face,
    to: face,
    ...(isFirstCleared ? { cue: { sound: 'continue', haptic: 'success' as const } } : {}),
  };
  return [...pathTracks(gone.path, entityId, timing), vanish];
}

/** The dropped card's entity: its final cell, or its place among the cards that left. */
function dropEntity(trace: CardTrace, path: CardPath): number {
  const survivor = trace.survivors.find(([, candidate]) => candidate === path);
  if (survivor !== undefined) return cellEntity(survivor[0]);
  return goneEntity(trace.gone.findIndex((gone) => gone.path === path));
}

/** The dropped card leaves the hand slot, then squashes as it lands (the drop sound). */
function dropTracks(trace: CardTrace, timing: Timing): Track[] {
  if (trace.drop === null) return [];
  const entityId = dropEntity(trace, trace.drop.path);
  const squash = timing.isFull ? 1 : 0;
  return [
    {
      channel: 'slide',
      entityId,
      startMs: 0,
      durationMs: SLIDE_MS * timing.scale,
      easing: 'out-quad',
      from: [1],
      to: [0],
    },
    {
      channel: 'land',
      entityId,
      startMs: trace.drop.landMs * timing.scale,
      durationMs: LAND_MS * timing.scale,
      easing: 'out-quad',
      from: [squash],
      to: [0],
      cue: { sound: 'drop', haptic: 'light' },
    },
  ];
}

function cardTracks(events: readonly PokerDropEvent[], timing: Timing): Track[] {
  const trace = traceCards(events);
  return [
    ...trace.survivors.flatMap(([index, path]) => pathTracks(path, cellEntity(index), timing)),
    ...trace.gone.flatMap((gone, order) => goneTracks(gone, order, timing)),
    ...dropTracks(trace, timing),
  ];
}

/** The line's two ends and its middle, as [col, row] pairs. */
function lineEnds(burst: Burst): { readonly ends: number[]; readonly middle: number[] } {
  const first = burst.line[0] ?? 0;
  const last = burst.line.at(-1) ?? first;
  const [c0, r0, c1, r1] = [
    first % COLS,
    Math.floor(first / COLS),
    last % COLS,
    Math.floor(last / COLS),
  ];
  return { ends: [c0, r0, c1, r1], middle: [(c0 + c1) / 2, (r0 + r1) / 2] };
}

/** True when `burst` leads its cascade step: the strongest hand of the step, the first on a tie. */
function leadsStep(bursts: readonly Burst[], burst: Burst): boolean {
  const step = bursts.filter((other) => other.atMs === burst.atMs);
  const best = step.reduce((lead, other) =>
    handStrength(other.hand) > handStrength(lead.hand) ? other : lead,
  );
  return best === burst;
}

type BurstAt = {
  readonly burst: Burst;
  readonly entityId: number;
  readonly startMs: number;
  readonly isLead: boolean;
};

/** The line flash; the step's leading hand carries its sound (a heavier haptic in a cascade). */
function lineTrack(at: BurstAt, ends: readonly number[], timing: Timing): Track {
  const haptic = at.burst.step >= 2 ? ('heavy' as const) : ('medium' as const);
  return {
    channel: 'line',
    entityId: at.entityId,
    startMs: at.startMs,
    durationMs: BURST_MS * timing.scale,
    easing: 'out-quad',
    from: ends,
    to: ends,
    ...(at.isLead ? { cue: { sound: `burst-${at.burst.hand}`, haptic } } : {}),
  };
}

/** The "×2" badge of a cascade step, popping just after the step's hands burst. */
function badgeTrack(at: BurstAt, middle: readonly number[], timing: Timing): Track {
  return {
    channel: 'step',
    entityId: at.entityId,
    startMs: at.startMs + BADGE_DELAY_MS * timing.scale,
    durationMs: BADGE_MS * timing.scale,
    easing: timing.isFull ? 'out-back' : 'linear',
    from: [...middle, at.burst.step, 0.6],
    to: [...middle, at.burst.step, 1],
    cue: { sound: 'cascade' },
  };
}

function burstTracks(bursts: readonly Burst[], timing: Timing): Track[] {
  return bursts.flatMap((burst, order) => {
    const at = {
      burst,
      entityId: burstEntity(order),
      startMs: burst.atMs * timing.scale,
      isLead: leadsStep(bursts, burst),
    };
    const { ends, middle } = lineEnds(burst);
    const particles: Track = {
      channel: 'burst',
      entityId: at.entityId,
      startMs: at.startMs,
      durationMs: PARTICLES_MS,
      easing: 'linear',
      from: middle,
      to: middle,
    };
    return [
      lineTrack(at, ends, timing),
      ...(timing.isFull ? [particles] : []),
      ...(at.isLead && burst.step >= 2 ? [badgeTrack(at, middle, timing)] : []),
    ];
  });
}

function turnTrack(
  event: EventOf<'row-rose' | 'card-dealt' | 'well-overflowed'>,
  timing: Timing,
): Track {
  const startMs = event.atMs * timing.scale;
  switch (event.kind) {
    case 'row-rose':
      return {
        channel: 'rise',
        entityId: TURN_ENTITY,
        startMs,
        durationMs: (event.landMs - event.atMs) * timing.scale,
        easing: 'in-out-quad',
        from: [-1],
        to: [0],
        cue: { sound: 'rise', haptic: 'light' },
      };
    case 'card-dealt':
      return {
        channel: 'deal',
        entityId: TURN_ENTITY,
        startMs,
        durationMs: DEAL_MS * timing.scale,
        easing: 'out-quad',
        from: [0],
        to: [1],
      };
    case 'well-overflowed':
      return {
        channel: 'overflow',
        entityId: TURN_ENTITY,
        startMs,
        durationMs: OVERFLOW_MS * timing.scale,
        easing: 'out-quad',
        from: [1],
        to: [0],
        cue: { sound: 'overflow', haptic: 'warning' },
      };
  }
}

function isBurst(event: PokerDropEvent): event is Burst {
  return event.kind === 'hand-burst';
}

function isTurnEvent(
  event: PokerDropEvent,
): event is EventOf<'row-rose' | 'card-dealt' | 'well-overflowed'> {
  return (
    event.kind === 'row-rose' || event.kind === 'card-dealt' || event.kind === 'well-overflowed'
  );
}

/** Pure: events -> tracks. The same events always give the same tracks. */
export function buildTimeline(events: readonly PokerDropEvent[], motion: Motion): readonly Track[] {
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  return [
    ...cardTracks(events, timing),
    ...burstTracks(events.filter(isBurst), timing),
    ...events.filter(isTurnEvent).map((event) => turnTrack(event, timing)),
  ];
}
