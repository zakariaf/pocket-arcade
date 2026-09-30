// apps/tap-flip/src/board/tap-flip-board.test.ts
import { tapFlipBoard } from './tap-flip-board.ts';
import { BOARD_PALETTES } from './board-palettes.ts';

describe('tapFlipBoard', () => {
  it('describes the board for VoiceOver with a counted plural value', () => {
    const view = { cols: 2, rows: 2, cells: [1, 0, 1, 1], movesLeftText: '4' };
    expect(tapFlipBoard.describe(view)).toStrictEqual({
      id: 'tap-flip.board.summary',
      values: { litCount: 3 },
    });
  });

  it('points the hint ring at the tapped cell of a move', () => {
    const state = { cols: 3, rows: 3, cells: [], moves: 0, maxMoves: 6 };
    expect(
      tapFlipBoard.targetsOfMove?.(state, { kind: 'flip', col: 2, row: 1 }),
    ).toStrictEqual([{ regionId: 'board', col: 2, row: 1 }]);
  });

  it('gives all four palette sets the same tokens', () => {
    const keys = Object.values(BOARD_PALETTES).map((set) => Object.keys(set).sort().join());
    expect(new Set(keys).size).toBe(1);
  });
});
