// packages/game-kit/src/timeline/sample.ts
'worklet';

import { ease } from './track.ts';

import type { Track } from './track.ts';

/** The sampled state of one (channel, entity) pair at a moment of the timeline. */
export type FxEntry = {
  readonly values: readonly number[];
  /** Eased progress 0…1 of the active track. */
  readonly progress: number;
  /** Milliseconds since the active track started, clamped to 0…durationMs. */
  readonly ageMs: number;
};

/** Every animated key of a scene at one elapsed time. */
export type FxSample = {
  readonly elapsedMs: number;
  readonly entries: Readonly<Partial<Record<string, FxEntry>>>;
  /** Linear (uneased) progress 0…1 of each key's active track: 0 before it starts, 1 once it ended. */
  readonly linear: Readonly<Partial<Record<string, number>>>;
};

/** No animation: draw() shows the view's final state. */
export const EMPTY_FX: FxSample = { elapsedMs: 0, entries: {}, linear: {} };

/** Stable key for a (channel, entity) pair, e.g. 'beam:3'. */
export function trackKey(channel: string, entityId: number): string {
  return `${channel}:${String(entityId)}`;
}

/** The uneased share of a track's time that has passed, clamped to 0…1 (1 for a zero-length track). */
function linearAt(track: Track, elapsedMs: number): number {
  if (track.durationMs <= 0) return 1;
  return Math.min(Math.max(elapsedMs - track.startMs, 0), track.durationMs) / track.durationMs;
}

/** Interpolates one track at an elapsed time (clamped to its start and end). */
export function sampleTrack(track: Track, elapsedMs: number): FxEntry {
  const ageMs = Math.min(Math.max(elapsedMs - track.startMs, 0), track.durationMs);
  const linear = track.durationMs > 0 ? ageMs / track.durationMs : 1;
  const progress = ease(track.easing, linear);
  const values: number[] = [];
  for (let i = 0; i < track.from.length; i += 1) {
    const from = track.from[i] ?? 0;
    const to = track.to[i] ?? from;
    values.push(from + (to - from) * progress);
  }
  return { values, progress, ageMs };
}

/** Started tracks beat unstarted ones; the latest started wins; else the earliest unstarted. */
function isBetterTrack(
  candidateStart: number,
  currentStart: number | undefined,
  t: number,
): boolean {
  if (currentStart === undefined) return true;
  const isCandidateStarted = candidateStart <= t;
  const isCurrentStarted = currentStart <= t;
  if (isCandidateStarted !== isCurrentStarted) return isCandidateStarted;
  return isCandidateStarted ? candidateStart >= currentStart : candidateStart < currentStart;
}

/**
 * Samples every key once. Before any track of a key starts, the key holds that
 * track's `from` (so a monster waits in its old cell until its move begins).
 */
export function sampleTimeline(tracks: readonly Track[], elapsedMs: number): FxSample {
  const entries: Partial<Record<string, FxEntry>> = {};
  const linear: Partial<Record<string, number>> = {};
  const activeStart: Partial<Record<string, number>> = {};
  for (const track of tracks) {
    const key = trackKey(track.channel, track.entityId);
    if (isBetterTrack(track.startMs, activeStart[key], elapsedMs)) {
      activeStart[key] = track.startMs;
      entries[key] = sampleTrack(track, elapsedMs);
      linear[key] = linearAt(track, elapsedMs);
    }
  }
  return { elapsedMs, entries, linear };
}

/** Reads one sampled entry; `undefined` means "no track: draw the view's final state". */
export function fxEntry(fx: FxSample, channel: string, entityId: number): FxEntry | undefined {
  return fx.entries[trackKey(channel, entityId)];
}

/**
 * The entry of a key only while its track plays: started and not yet ended by its linear time.
 * Effect layers (flash, glow, burst, shake) draw only then; the eased progress cannot tell, because
 * an out-back track passes 1 early and overshoots before it ends.
 */
export function playingEntry(fx: FxSample, channel: string, entityId: number): FxEntry | undefined {
  const t = fx.linear[trackKey(channel, entityId)];
  return t !== undefined && t > 0 && t < 1 ? fxEntry(fx, channel, entityId) : undefined;
}
