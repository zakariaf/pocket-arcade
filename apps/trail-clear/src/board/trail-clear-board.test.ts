// apps/trail-clear/src/board/trail-clear-board.test.ts
// Spec 7.5: a board is a physical space and never mirrors in fa and ckb. Spec 8.11: the board is
// one image for VoiceOver with a short spoken summary.
import { create } from '@e07/trail-clear/rules/create.ts';

import { BOARD_PALETTES } from './board-palettes.ts';
import { DRAG_LIFT_PT } from './layout-board.ts';
import { partPath } from './tile-parts.ts';
import { toView } from './to-view.ts';
import { trailClearBoard } from './trail-clear-board.ts';

import type { PartShape } from './tile-parts.ts';
import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';

const OPENING = create(1, 0);
const SHAPE_TURNS: readonly (readonly [PartShape, number])[] = [
  ['stub', 4],
  ['spoke', 4],
  ['straight', 2],
  ['bend', 4],
];

/** A PathBuilder stand-in: each built path is the list of the commands that made it. */
function fakeSkia(): SkiaApi {
  const make = () => {
    const commands: string[] = [];
    const builder = new Proxy(
      {},
      {
        get: (_target, name) =>
          name === 'build'
            ? () => ({ commands })
            : () => {
                commands.push(String(name));
                return builder;
              },
      },
    );
    return builder;
  };
  return { PathBuilder: { Make: make } } as unknown as SkiaApi;
}

/** The commands a fake-built path recorded. */
function commandsOf(path: unknown): string[] {
  if (typeof path !== 'object' || path === null || !('commands' in path)) return [];
  const { commands } = path;
  return Array.isArray(commands) ? commands.map(String) : [];
}

/** Every unit path name the draw code can ask for. */
function namedPaths(): string[] {
  const parts = SHAPE_TURNS.flatMap(([shape, turns]) =>
    Array.from({ length: turns }, (_, turn) => ({ shape, turn })),
  );
  const trails = [1, 2, 0].flatMap((terrain) => parts.map((part) => partPath(terrain, part)));
  return [...trails, 'house-0', 'house-1', 'house-2', 'house-3'];
}

describe('trailClearBoard', () => {
  it('stays unmirrored, and lifts a dragged tile above the finger', () => {
    expect([trailClearBoard.isMirroredInRtl, trailClearBoard.dragLiftPt]).toStrictEqual([
      false,
      DRAG_LIFT_PT,
    ]);
  });

  it('describes the tiles on the board and their loose ends for VoiceOver', () => {
    expect(trailClearBoard.describe(toView(OPENING, { formatNumber: String }))).toStrictEqual({
      id: 'trail-clear.board.summary',
      values: { tilesCount: 2, looseEndsCount: 2 },
    });
  });

  it('counts no loose end on an empty board', () => {
    const empty = toView(
      { ...OPENING, cells: OPENING.cells.map(() => null) },
      { formatNumber: String },
    );
    expect(trailClearBoard.describe(empty).values).toStrictEqual({
      tilesCount: 0,
      looseEndsCount: 0,
    });
  });

  it('points at the tray slot of the move turn and at its cell', () => {
    const move = { kind: 'place-tile' as const, turns: 1, col: 3, row: 2 };
    expect(trailClearBoard.targetsOfMove?.(OPENING, move)).toStrictEqual([
      { regionId: 'tray', col: 1, row: 0 },
      { regionId: 'board', col: 3, row: 2 },
    ]);
    expect(trailClearBoard.targetsOfMove?.({ ...OPENING, offered: null }, move)).toStrictEqual([]);
  });

  it('builds every unit path the draw code names, each from real commands', () => {
    const paths = trailClearBoard.buildPaths(fakeSkia());
    expect(Object.keys(paths).sort()).toStrictEqual(namedPaths().sort());
    const commands = Object.values(paths).map(commandsOf);
    expect(commands.every((list) => list[0] === 'moveTo' && list.length > 1)).toBe(true);
  });

  it('gives all four palette sets the same tokens', () => {
    const keys = Object.values(BOARD_PALETTES).map((set) => Object.keys(set).sort().join());
    expect(new Set(keys).size).toBe(1);
  });
});
