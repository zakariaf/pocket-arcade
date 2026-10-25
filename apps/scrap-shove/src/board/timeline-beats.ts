// apps/scrap-shove/src/board/timeline-beats.ts
// The beats a turn plays in, shared by build-timeline.ts and crash-tracks.ts: the player's step or
// shove (phase 0), every robot's step (phase 1), the fast robots' second step (phase 2). What a
// phase breaks (crashes, crushes, the catch) happens at the end of that phase.
import type { RobotKindName } from './board-ids.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { Cell, ScrapShoveEvent } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

/** When each phase starts and how long it lasts (full motion): player, robots, fast robots. */
const PHASE_START_MS = [0, 140, 300] as const;
const PHASE_LENGTH_MS = [140, 160, 140] as const;
/** How long a breaking robot, a new heap and the next-step arrows take to fade (full motion). */
export const FADE_MS = 160;

/** Reduced motion: half durations, no particles, no overshoot. */
export type Timing = { readonly scale: number; readonly isFull: boolean };

/** What the pass over a turn's events carries from one event to the next. */
export type Pass = {
  readonly phase: number;
  readonly crashes: number;
  readonly kinds: Readonly<Partial<Record<number, RobotKindName>>>;
  readonly tracks: readonly Track[];
};

export type EventOf<TKind extends ScrapShoveEvent['kind']> = Extract<
  ScrapShoveEvent,
  { kind: TKind }
>;

export function phaseStart(phase: number, timing: Timing): number {
  return (PHASE_START_MS[phase] ?? 0) * timing.scale;
}

export function phaseLength(phase: number, timing: Timing): number {
  return (PHASE_LENGTH_MS[phase] ?? 0) * timing.scale;
}

export function phaseEnd(phase: number, timing: Timing): number {
  return phaseStart(phase, timing) + phaseLength(phase, timing);
}

/** A square as track values. */
export function valuesOf(cell: Cell): number[] {
  return [cell.col, cell.row];
}
