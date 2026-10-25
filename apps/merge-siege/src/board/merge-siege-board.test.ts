// apps/merge-siege/src/board/merge-siege-board.test.ts
// The rendering members of the module: a physical board that never mirrors (spec 7.5), and a
// spoken summary for VoiceOver (spec 8.11: Skia content is invisible to it).
import { create } from '@e07/merge-siege/rules/create.ts';

import { BOARD_PALETTES } from './board-palettes.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { mergeSiegeBoard } from './merge-siege-board.ts';
import { toView } from './to-view.ts';

const LATIN = { formatNumber: (value: number): string => String(value) };

describe('mergeSiegeBoard', () => {
  it('keeps the board unmirrored and wires its view, layout and draw', () => {
    expect(mergeSiegeBoard).toMatchObject({
      isMirroredInRtl: false,
      toView,
      layout: layoutBoard,
      draw: drawBoard,
    });
  });

  it('describes the board for VoiceOver: tiles, the biggest tile and the enemies', () => {
    const view = toView(create(1, 0), LATIN);
    expect(mergeSiegeBoard.describe(view)).toStrictEqual({
      id: 'merge-siege.board.summary',
      values: { tiles: 3, biggest: 4, enemies: 2 },
    });
  });

  it('describes an empty board with a biggest tile of 0', () => {
    const view = toView({ ...create(1, 0), cells: create(1, 0).cells.map(() => null) }, LATIN);
    expect(mergeSiegeBoard.describe(view).values).toStrictEqual({
      tiles: 0,
      biggest: 0,
      enemies: 0,
    });
  });

  it('gives all four palette sets the same tokens', () => {
    const keys = Object.values(BOARD_PALETTES).map((set) => Object.keys(set).sort().join());
    expect(new Set(keys).size).toBe(1);
  });
});
