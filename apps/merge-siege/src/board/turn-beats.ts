// apps/merge-siege/src/board/turn-beats.ts
// The beats of one turn and the piece track they share (build-timeline.ts, clash-tracks.ts). Pure.
// Full-motion times: the slide, then merges, the march, the enemy at the gate, the next enemy and
// the new tile, so a turn reads in the order the rules resolve it (apply-move.ts).
import { COLS } from '@e07/merge-siege/rules/board-cells.ts';

import type { EasingId, Motion, Track, TrackCue } from '@e07/game-kit/timeline/track.ts';

/** When each beat starts (full motion). */
export const AT = { slide: 0, merge: 160, march: 200, gate: 400, next: 580, spawn: 580 } as const;

/** How long each beat plays (full motion); a burst is particles, so full motion only. */
export const MS = {
  slide: 160,
  vanish: 140,
  merge: 120,
  pop: 200,
  march: 180,
  entry: 180,
  next: 160,
  spawn: 160,
  burst: 500,
  pushBack: 240,
} as const;

/** Reduced motion: half every time, no particles, no overshoot (spec 8.11). */
export type Timing = { readonly scale: number; readonly isFull: boolean };

export function timingFor(motion: Motion): Timing {
  return { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
}

/** A cell's column and row (fractional rows place a piece between two cells). */
export function placeOf(cell: number): readonly [number, number] {
  return [cell % COLS, Math.floor(cell / COLS)];
}

/** [col, row, value, kind, alpha, scale]: what draw() reads from a 'piece' track. */
export type PieceValues = readonly [number, number, number, number, number, number];

export type PieceTween = {
  readonly id: number;
  readonly startMs: number;
  readonly durationMs: number;
  readonly easing: EasingId;
  readonly from: PieceValues;
  readonly to: PieceValues;
};

/** A 'piece' track, scaled to the motion setting, with an optional cue. */
export function pieceTrack(tween: PieceTween, timing: Timing, cue?: TrackCue): Track {
  return {
    channel: 'piece',
    entityId: tween.id,
    startMs: tween.startMs * timing.scale,
    durationMs: tween.durationMs * timing.scale,
    easing: tween.easing,
    from: tween.from,
    to: tween.to,
    ...(cue === undefined ? {} : { cue }),
  };
}

/** The particles of a smash (full motion only: reduced motion gets none). */
export function burstTrack(
  id: number,
  place: { readonly at: readonly [number, number]; readonly startMs: number },
  timing: Timing,
): Track[] {
  if (!timing.isFull) return [];
  const track: Track = {
    channel: 'burst',
    entityId: id,
    startMs: place.startMs,
    durationMs: MS.burst,
    easing: 'linear',
    from: place.at,
    to: place.at,
  };
  return [track];
}
