// apps/toggle-drop/src/rules/tutorial-board.test.ts
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { TUTORIAL_START } from './tutorial-board.ts';

describe('TUTORIAL_START', () => {
  // Spec S13: the tutorial opens on a board where every column can be dropped into.
  it('is a fresh 4 x 2 board with three cups, three balls and every column open', () => {
    expect(TUTORIAL_START.pegs).toHaveLength(TUTORIAL_START.cols * TUTORIAL_START.rows);
    expect(TUTORIAL_START.needs.filter((need) => need > 0)).toHaveLength(3);
    expect(TUTORIAL_START.ballsLeft).toBe(3);
    expect(listMoves(TUTORIAL_START)).toHaveLength(4);
    expect(outcome(TUTORIAL_START).kind).toBe('playing');
  });
});
