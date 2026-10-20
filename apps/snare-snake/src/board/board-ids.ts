// apps/snare-snake/src/board/board-ids.ts
'worklet';

/** Entity of the one-per-turn tracks (the loop flash, the moves badge pop). */
export const TURN_ENTITY = 0;

/** Entity of the head's slide. */
export const HEAD_ENTITY = 1;

/**
 * Entity id of a cell by its row-major index (a vacated tail cell, a spent segment), shared by
 * buildTimeline (JS thread) and draw (UI thread). A 'worklet' module: draw may only call worklets.
 */
export function cellEntity(index: number): number {
  return 1000 + index;
}

/** Entity id of a critter by its id (its hop, its catch and its burst). */
export function critterEntity(id: number): number {
  return 2000 + id;
}

/** How long a catch's particle burst lives: its track's duration and the particles' life. */
export const BURST_MS = 560;
