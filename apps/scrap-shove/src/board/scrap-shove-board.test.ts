// apps/scrap-shove/src/board/scrap-shove-board.test.ts
import { Skia } from '@shopify/react-native-skia';

import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';

import { BOARD_PALETTES } from './board-palettes.ts';
import { scrapShoveBoard } from './scrap-shove-board.ts';

const STATE = stateFromText(['n..f', '.#..', '..@.', 'h.#.']);

describe('scrapShoveBoard', () => {
  it('keeps the floor unmirrored in right-to-left languages (a board is a physical space)', () => {
    expect(scrapShoveBoard.isMirroredInRtl).toBe(false);
  });

  it('describes the robots and heaps on the floor for VoiceOver with counted plural values', () => {
    const view = scrapShoveBoard.toView(STATE, { formatNumber: String });
    expect(scrapShoveBoard.describe(view)).toStrictEqual({
      id: 'scrap-shove.board.summary',
      values: { robotsCount: 3, heapsCount: 2 },
    });
  });

  it('points the hint ring at the square a step or shove goes to, and at the player for a wait', () => {
    const targets = [
      { kind: 'step', col: 1, row: 2 },
      { kind: 'shove', col: 1, row: 1 },
      { kind: 'wait' },
    ] as const;
    expect(targets.map((move) => scrapShoveBoard.targetsOfMove?.(STATE, move))).toStrictEqual([
      [{ regionId: 'board', col: 1, row: 2 }],
      [{ regionId: 'board', col: 1, row: 1 }],
      [{ regionId: 'board', col: 2, row: 2 }],
    ]);
  });

  it('builds the arrow and the fast robot fins once, as unit paths', () => {
    const paths = scrapShoveBoard.buildPaths(Skia);
    expect(Object.keys(paths).sort()).toStrictEqual(['arrow', 'finEast', 'finWest']);
    const bounds = Object.values(paths).map((path) => path?.computeTightBounds());
    expect(
      bounds.every((rect) => rect !== undefined && rect.x >= 0 && rect.x + rect.width <= 1),
    ).toBe(true);
  });

  it('gives all four palette sets the same tokens', () => {
    const keys = Object.values(BOARD_PALETTES).map((set) => Object.keys(set).sort().join());
    expect(new Set(keys).size).toBe(1);
  });
});
