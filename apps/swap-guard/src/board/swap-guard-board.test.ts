// apps/swap-guard/src/board/swap-guard-board.test.ts
// Spec 10 BOARD AND CONTROLS: "Declares whether the board mirrors in RTL (default: no)"; spec 7.5:
// a board is a physical space; spec 8.11: VoiceOver gets a short spoken summary of the board.
import { create } from '@e07/swap-guard/rules/create.ts';
import { listMoves } from '@e07/swap-guard/rules/list-moves.ts';

import { BOARD_PALETTES } from './board-palettes.ts';
import { swapGuardBoard } from './swap-guard-board.ts';

import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';

const LATIN = { formatNumber: (value: number) => String(value) };

/** A PathBuilder that records how many shapes are built, enough to call buildPaths. */
function recordingSkia(): { skia: SkiaApi; built: () => number } {
  let built = 0;
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, name) =>
        name === 'build'
          ? () => {
              built += 1;
              return { id: built };
            }
          : () => builder,
    },
  );
  const pathBuilder = Object.fromEntries([['Make', () => builder]]);
  const skia = { PathBuilder: pathBuilder } as unknown as SkiaApi;
  return { skia, built: () => built };
}

describe('swapGuardBoard', () => {
  it('keeps the board unmirrored in fa and ckb (a board is a physical space)', () => {
    expect(swapGuardBoard.isMirroredInRtl).toBe(false);
  });

  it('describes the board for VoiceOver: enemies down of the total and the swaps left', () => {
    const start = create(1, 0);
    const state = { ...start, enemies: start.enemies.slice(1), swaps: 2 };
    const view = swapGuardBoard.toView(state, LATIN);
    expect(swapGuardBoard.describe(view)).toStrictEqual({
      id: 'swap-guard.board.summary',
      values: { defeated: 1, total: start.enemyCount, swapsLeft: start.maxSwaps - 2 },
    });
  });

  it('gives all four palette sets the same tokens', () => {
    const keys = Object.values(BOARD_PALETTES).map((set) => Object.keys(set).sort().join());
    expect(new Set(keys).size).toBe(1);
  });

  it('names the square a hinted swap goes to, so the host can ring it', () => {
    const state = create(1, 0);
    const [move] = listMoves(state);
    expect(move).toBeDefined();
    const cell = move?.cell ?? 0;
    expect(move === undefined ? [] : swapGuardBoard.targetsOfMove?.(state, move)).toStrictEqual([
      { regionId: 'board', col: cell % state.size, row: Math.floor(cell / state.size) },
    ]);
  });

  it('builds its four unit shapes once: the strike arrow, the spear, the archer, the crest', () => {
    const { skia, built } = recordingSkia();
    const paths = swapGuardBoard.buildPaths(skia);
    expect(Object.keys(paths).sort()).toStrictEqual(['archer', 'chevron', 'shield', 'spear']);
    expect(built()).toBe(4);
  });

  it('wires the view, the layout and the draw of the board', () => {
    expect(typeof swapGuardBoard.toView).toBe('function');
    expect(typeof swapGuardBoard.layout).toBe('function');
    expect(typeof swapGuardBoard.draw).toBe('function');
  });
});
