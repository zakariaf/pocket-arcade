// apps/trail-clear/src/board/board-ids.ts
'worklet';

/** Entity of the one-per-turn tracks: the double's ring and its burst. */
export const TURN_ENTITY = 0;

/**
 * Entity id of a board cell by its row-major index, shared by buildTimeline (JS thread) and draw
 * (UI thread), so cell tracks never collide with the turn, loop or tray entities. A 'worklet'
 * module: the draw worklet may only call worklets.
 */
export function cellEntity(index: number): number {
  return 1000 + index;
}

/** Entity of tray slot `slot` (one slot per distinct turn of the offered tile). */
export function slotEntity(slot: number): number {
  return 100 + slot;
}

/** Entity of the loops one placement closed, in the order the rules report them (road, river). */
export function loopEntity(order: number): number {
  return 10 + order;
}
