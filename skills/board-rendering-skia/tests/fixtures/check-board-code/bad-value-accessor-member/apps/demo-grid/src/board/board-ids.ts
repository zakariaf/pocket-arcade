// apps/demo-grid/src/board/board-ids.ts
'worklet';

/**
 * Entity id of a cell, shared by buildTimeline (JS thread) and draw (UI thread), so cell tracks
 * never collide with piece ids. A 'worklet' module: the draw worklet may only call worklets.
 */
export function cellEntity(col: number, row: number): number {
  return 1000 + row * 100 + col;
}
