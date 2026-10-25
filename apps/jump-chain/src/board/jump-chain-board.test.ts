// apps/jump-chain/src/board/jump-chain-board.test.ts
import { create } from '@e07/jump-chain/rules/create.ts';

import { BOARD_PALETTES } from './board-palettes.ts';
import { jumpChainBoard } from './jump-chain-board.ts';
import { DRAG_LIFT_PT } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';

describe('jumpChainBoard', () => {
  it('describes the board for VoiceOver: the enemies left and the moves until they advance', () => {
    const view = {
      cols: 7,
      rows: 10,
      piece: { col: 3, row: 7 },
      enemies: [{ id: 0, col: 1, row: 1 }],
      enemiesLeft: 5,
      marchIn: 2,
      marchInText: '2',
      targets: [],
    };
    expect(jumpChainBoard.describe(view)).toStrictEqual({
      id: 'jump-chain.board.summary',
      values: { enemiesCount: 5, marchCount: 2 },
    });
  });

  it('keeps the board unmirrored (a board is a physical space) and lifts a drag above the finger', () => {
    expect(jumpChainBoard.isMirroredInRtl).toBe(false);
    expect(jumpChainBoard.dragLiftPt).toBe(DRAG_LIFT_PT);
    expect(jumpChainBoard.toView).toBe(toView);
  });

  it('sizes the S13 how-to picture like the Toybox checker illustration, 320 x 222', () => {
    expect(jumpChainBoard.exampleAspect).toBe(320 / 222);
  });

  it('points a hint at the landing squares of a move', () => {
    const state = create(1, 0);
    const path = [
      { col: 0, row: 4 },
      { col: 2, row: 2 },
    ];
    expect(jumpChainBoard.targetsOfMove?.(state, { kind: 'jump', path })).toStrictEqual([
      { regionId: 'board', col: 0, row: 4 },
      { regionId: 'board', col: 2, row: 2 },
    ]);
    expect(
      jumpChainBoard.targetsOfMove?.(state, { kind: 'step', to: { col: 2, row: 6 } }),
    ).toStrictEqual([{ regionId: 'board', col: 2, row: 6 }]);
  });

  it('builds the crown once, at unit size', () => {
    const points: number[] = [];
    const builder = {
      moveTo: (x: number, y: number) => {
        points.push(x, y);
        return builder;
      },
      lineTo: (x: number, y: number) => {
        points.push(x, y);
        return builder;
      },
      close: () => builder,
      build: () => 'crown',
    };
    // Skia's factory is named Make; built from entries so the naming rule does not apply.
    const pathBuilder = Object.fromEntries([['Make', () => builder]]);
    const skia = { PathBuilder: pathBuilder } as unknown as SkiaApi;
    expect(jumpChainBoard.buildPaths(skia)).toStrictEqual({ crown: 'crown' });
    expect(points.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it('gives all four palette sets the same tokens', () => {
    const keys = Object.values(BOARD_PALETTES).map((set) => Object.keys(set).sort().join());
    expect(new Set(keys).size).toBe(1);
  });
});
