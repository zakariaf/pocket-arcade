// apps/swap-guard/src/board/board-ids.ts
'worklet';

/** Entity of the one-per-turn tracks (the telegraph fading in). */
export const TURN_ENTITY = 0;

/** Entity of the guard's slide and its hit ring. */
export const GUARD_ENTITY = 1;

/**
 * Entity id of a square by its row-major index (a strike landing on it), shared by buildTimeline
 * (JS thread) and draw (UI thread). A 'worklet' module: draw may only call worklets.
 */
export function cellEntity(index: number): number {
  return 1000 + index;
}

/** Entity id of an enemy by its id (its slide, its fall, its burst, its return). */
export function enemyEntity(id: number): number {
  return 2000 + id;
}

/** How long a knock-out's particle burst lives: its track's duration and the particles' life. */
export const BURST_MS = 560;
