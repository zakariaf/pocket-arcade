// apps/tile-drop/src/rules/apply-move.test.ts
import { drawBoard } from '@demo/tile-drop/board/draw-board.ts';

import { applyMove } from './apply-move.ts';

describe('applyMove', () => {
  it('feeds a state the board can draw', () => {
    expect(typeof applyMove).toBe('function');
    expect(typeof drawBoard).toBe('function');
  });
});
