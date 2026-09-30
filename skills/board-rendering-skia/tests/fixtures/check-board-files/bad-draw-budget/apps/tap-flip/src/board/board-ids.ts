// apps/tap-flip/src/board/board-ids.ts
'worklet';

/** Entity of the one-per-turn tracks (the clear glow and burst, the bonus label). */
export const TURN_ENTITY = 0;

/**
 * Entity id of a cell by its row-major index, shared by buildTimeline (JS thread) and draw (UI
 * thread), so cell tracks never collide with the turn entity. The events carry cell indexes, so
 * the timeline needs no grid width. A 'worklet' module: the draw worklet may only call worklets.
 */
export function cellEntity(index: number): number {
  return 1000 + index;
}
