// apps/toggle-drop/src/board/toggle-drop-board.test.ts
import { create } from '@e07/toggle-drop/rules/create.ts';

import { BOARD_PALETTES } from './board-palettes.ts';
import { toggleDropBoard } from './toggle-drop-board.ts';

import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';

const LATIN = { formatNumber: (value: number) => String(value) };

describe('toggleDropBoard', () => {
  it('describes the board for VoiceOver with the cups still to fill', () => {
    const state = { ...create(1, 0), needs: [0, 2, 0, 1, 1], filled: [0, 1, 0, 1, 0] };
    expect(toggleDropBoard.describe(toggleDropBoard.toView(state, LATIN))).toStrictEqual({
      id: 'toggle-drop.board.summary',
      values: { cupsLeft: 2, cupsCount: 3 },
    });
  });

  // Spec 7.5: a board is a physical space; it never mirrors in fa and ckb.
  it('keeps the board unmirrored in a right-to-left language', () => {
    expect(toggleDropBoard.isMirroredInRtl).toBe(false);
  });

  it('points the hint ring at the column of a drop', () => {
    expect(toggleDropBoard.targetsOfMove?.(create(1, 0), { kind: 'drop', col: 3 })).toStrictEqual([
      { regionId: 'board', col: 3, row: 0 },
    ]);
  });

  it('builds the hopper, cup and check shapes once, at unit size', () => {
    const points: number[] = [];
    const builder = {
      moveTo: (x: number, y: number) => (points.push(x, y), builder),
      lineTo: (x: number, y: number) => (points.push(x, y), builder),
      close: () => builder,
      build: () => ({}),
    };
    // Skia's own member name, built from an entry (object literal keys are camelCase here).
    const pathBuilder = Object.fromEntries([['Make', () => builder]]);
    const skia = { PathBuilder: pathBuilder } as unknown as SkiaApi;
    expect(Object.keys(toggleDropBoard.buildPaths(skia))).toStrictEqual(['hopper', 'cup', 'check']);
    expect(points.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it('gives all four palette sets the same tokens', () => {
    const keys = Object.values(BOARD_PALETTES).map((set) => Object.keys(set).sort().join());
    expect(new Set(keys).size).toBe(1);
  });
});
