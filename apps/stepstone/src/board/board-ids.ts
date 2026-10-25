// apps/stepstone/src/board/board-ids.ts
'worklet';

/** Entity of the one-per-turn tracks (the goal glow, the burst). */
export const TURN_ENTITY = 0;
/** Entity of the frog's own tracks (the hop, the stranded shake). */
export const FROG_ENTITY = 1;

/**
 * Entity id of a pond cell by its row-major index, shared by buildTimeline (JS thread) and draw (UI
 * thread), so cell tracks never collide with the turn or frog entities. A 'worklet' module: the
 * draw worklet may only call worklets.
 */
export function cellEntity(index: number): number {
  return 1000 + index;
}
