// apps/toggle-drop/src/rules/tutorial-board.ts
import type { ToggleDropState } from './toggle-drop-types.ts';

const COLS = 4;
const ROWS = 2;

/**
 * The tutorial board (S13): 4 columns, 2 peg rows, a switch in column 2 of the top row pointing
 * left and one in column 3 of the bottom row pointing right; cups under columns 1, 2 and 4 need one
 * ball each, and the player has exactly the three balls the script drops. It lives with the rules
 * because a saved tutorial run is parsed by them (toggle-drop-persistence.ts).
 */
export const TUTORIAL_START: ToggleDropState = {
  cols: COLS,
  rows: ROWS,
  pegs: [-1, 0, -1, -1, -1, -1, 1, -1],
  flips: Array.from({ length: COLS * ROWS }, () => 0),
  needs: [1, 1, 0, 1],
  filled: [0, 0, 0, 0],
  ballsLeft: 3,
  drops: 0,
};
