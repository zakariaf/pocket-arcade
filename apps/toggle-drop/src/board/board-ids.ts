// apps/toggle-drop/src/board/board-ids.ts
'worklet';

/**
 * Board units per column and per peg row in the fall's points: the rules' CELL_UNITS, repeated in
 * this 'worklet' module for draw and layout (board-ids.test.ts keeps the two equal).
 */
export const BOARD_UNITS = 120;

/** Entity of the one ball that falls per move (its fall, its fade): dropTracks uses 0 too. */
export const BALL_ENTITY = 0;

/** Columns a board never exceeds; switch entities need no grid width (the events carry none). */
const MAX_COLS = 16;

/**
 * Entity id of a switch by its peg row and column, shared by buildTimeline (JS thread) and draw
 * (UI thread). A 'worklet' module: the draw worklet may only call worklets.
 */
export function switchEntity(row: number, col: number): number {
  return 1000 + row * MAX_COLS + col;
}

/** Entity id of the cup (or gutter) under a column. */
export function cupEntity(col: number): number {
  return 3000 + col;
}
