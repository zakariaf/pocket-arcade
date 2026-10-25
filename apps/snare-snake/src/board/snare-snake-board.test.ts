// apps/snare-snake/src/board/snare-snake-board.test.ts
// Spec 10 BOARD AND CONTROLS: "Declares whether the board mirrors in RTL (default: no)"; spec 7.5:
// a board is a physical space; spec 8.11: VoiceOver gets a short spoken summary of the board.
import { create } from '@e07/snare-snake/rules/create.ts';
import { listMoves } from '@e07/snare-snake/rules/list-moves.ts';
import { targetOf } from '@e07/snare-snake/rules/steering.ts';

import { BOARD_PALETTES } from './board-palettes.ts';
import { snareSnakeBoard } from './snare-snake-board.ts';

const LATIN = { formatNumber: (value: number) => String(value) };

describe('snareSnakeBoard', () => {
  it('keeps the board unmirrored in fa and ckb (a board is a physical space)', () => {
    expect(snareSnakeBoard.isMirroredInRtl).toBe(false);
  });

  it('describes the board for VoiceOver: critters caught of the total and the moves left', () => {
    const view = snareSnakeBoard.toView({ ...create(1, 0), caught: 1, moves: 10 }, LATIN);
    expect(snareSnakeBoard.describe(view)).toStrictEqual({
      id: 'snare-snake.board.summary',
      values: { caught: 1, total: 4, movesLeft: 20 },
    });
  });

  it('gives all four palette sets the same tokens', () => {
    const keys = Object.values(BOARD_PALETTES).map((set) => Object.keys(set).sort().join());
    expect(new Set(keys).size).toBe(1);
  });

  it('names the cell a hinted turn moves the head into, so the host can ring it', () => {
    const state = create(1, 0);
    const [move] = listMoves(state);
    const target = move === undefined ? null : targetOf(state, move.direction);
    expect(target).not.toBeNull();
    expect(move === undefined ? [] : snareSnakeBoard.targetsOfMove?.(state, move)).toStrictEqual([
      {
        regionId: 'board',
        col: (target ?? 0) % state.cols,
        row: Math.floor((target ?? 0) / state.cols),
      },
    ]);
  });

  it('wires the view, the layout and the draw of the board', () => {
    expect(typeof snareSnakeBoard.toView).toBe('function');
    expect(typeof snareSnakeBoard.layout).toBe('function');
    expect(typeof snareSnakeBoard.draw).toBe('function');
    expect(typeof snareSnakeBoard.buildPaths).toBe('function');
  });
});
