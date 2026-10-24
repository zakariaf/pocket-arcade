// apps/trail-clear/src/board/tile-paths.ts
// JS thread, once per kit: the unit-size (0..1) shapes of a tile's roads and rivers, built with the
// immutable PathBuilder (Skia 2.6+). Every shape is drawn north-based and turned in quarter turns
// clockwise about the tile's middle; houses stay upright, only their place turns.
import { partPath, STUB_END } from './tile-parts.ts';

import type { PartShape } from './tile-parts.ts';
import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

type Point = readonly [number, number];
/** A path as commands: move, line, cubic (two controls and an end), close. */
type Command =
  | { readonly op: 'move' | 'line'; readonly to: Point }
  | { readonly op: 'cubic'; readonly c1: Point; readonly c2: Point; readonly to: Point }
  | { readonly op: 'close' };

const ROAD = 1;
const RIVER = 2;
const DASHES = 0;
/** Band widths as a share of the tile: rivers run wider than roads. */
const WIDTHS: Readonly<Record<number, number>> = { [ROAD]: 0.2, [RIVER]: 0.28 };
/** A cubic Bézier through a quarter circle (control points at this share of the radius). */
const KAPPA = 0.5522847498;
const SHAPE_TURNS: readonly (readonly [PartShape, number])[] = [
  ['stub', 4],
  ['spoke', 4],
  ['straight', 2],
  ['bend', 4],
];
/** The road's centre dashes along a 1-long run: 0.1 long, 0.1 apart, half a gap at each tile edge. */
const RUN_DASHES = [0.05, 0.25, 0.45, 0.65, 0.85] as const;
/** Where a part's straight dashes stop: short of a stub's house, at the middle for a spoke. */
const DASH_END: Readonly<Record<PartShape, number>> = {
  stub: STUB_END - 0.18,
  spoke: 0.5,
  straight: 1,
  bend: 1,
};
/** The same dashes along the bend's centre arc, as Bézier parameter ranges. */
const BEND_DASHES = [
  [0.064, 0.191],
  [0.318, 0.446],
  [0.573, 0.7],
  [0.828, 0.955],
] as const;

/** One quarter turn clockwise about the middle: north goes east. */
function turned([x, y]: Point, turns: number): Point {
  let point: Point = [x, y];
  for (let i = 0; i < turns; i += 1) point = [1 - point[1], point[0]];
  return point;
}

/** A band from the north edge down to `end`, `width` wide, centred. */
function northBand(width: number, end: number): Command[] {
  const [left, right] = [0.5 - width / 2, 0.5 + width / 2];
  return [
    { op: 'move', to: [left, 0] },
    { op: 'line', to: [right, 0] },
    { op: 'line', to: [right, end] },
    { op: 'line', to: [left, end] },
    { op: 'close' },
  ];
}

/** The band of a part, north-based: a stub to its cap, a spoke to the middle, a run, a bend. */
function band(shape: PartShape, width: number): Command[] {
  const [left, right] = [0.5 - width / 2, 0.5 + width / 2];
  if (shape === 'stub') return northBand(width, STUB_END);
  if (shape === 'spoke') return northBand(width, right);
  if (shape === 'straight') return northBand(width, 1);
  // A quarter ring round the north-east corner, from the north edge to the east edge.
  const [outer, inner] = [right, left];
  return [
    { op: 'move', to: [1 - outer, 0] },
    { op: 'cubic', c1: [1 - outer, KAPPA * outer], c2: [1 - KAPPA * outer, outer], to: [1, outer] },
    { op: 'line', to: [1, inner] },
    {
      op: 'cubic',
      c1: [1 - KAPPA * inner, inner],
      c2: [1 - inner, KAPPA * inner],
      to: [1 - inner, 0],
    },
    { op: 'close' },
  ];
}

/** A point of the bend's centre arc (radius 0.5 round the north-east corner) at parameter t. */
function arcAt(t: number): Point {
  const u = 1 - t;
  const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  const half = 0.5;
  const x = a * half + b * half + c * (1 - KAPPA * half) + d;
  const y = b * KAPPA * half + c * half + d * half;
  return [x, y];
}

/** The road's centre dashes of a part, north-based, as open sub-paths. */
function dashes(shape: PartShape): Command[] {
  if (shape === 'bend') {
    return BEND_DASHES.flatMap(([from, to]): Command[] => [
      { op: 'move', to: arcAt(from) },
      { op: 'line', to: arcAt((from + to) / 2) },
      { op: 'line', to: arcAt(to) },
    ]);
  }
  const end = DASH_END[shape];
  return RUN_DASHES.filter((start) => start < end).flatMap((start): Command[] => [
    { op: 'move', to: [0.5, start] },
    { op: 'line', to: [0.5, Math.min(start + 0.1, end)] },
  ]);
}

/** A little house with a pitched roof, upright, centred on the cap of a stub from `side`. */
function house(side: number): Command[] {
  const [cx, cy] = turned([0.5, STUB_END], side);
  const outline: Point[] = [
    [cx, cy - 0.17],
    [cx + 0.17, cy - 0.02],
    [cx + 0.12, cy - 0.02],
    [cx + 0.12, cy + 0.12],
    [cx - 0.12, cy + 0.12],
    [cx - 0.12, cy - 0.02],
    [cx - 0.17, cy - 0.02],
  ];
  return [
    ...outline.map((to, index): Command => ({ op: index === 0 ? 'move' : 'line', to })),
    { op: 'close' },
  ];
}

function built(skia: SkiaApi, commands: readonly Command[], turns: number): SkPath {
  let builder = skia.PathBuilder.Make();
  for (const command of commands) {
    if (command.op === 'close') {
      builder = builder.close();
    } else if (command.op === 'cubic') {
      const [c1, c2, to] = [
        turned(command.c1, turns),
        turned(command.c2, turns),
        turned(command.to, turns),
      ];
      builder = builder.cubicTo(c1[0], c1[1], c2[0], c2[1], to[0], to[1]);
    } else {
      const to = turned(command.to, turns);
      builder = command.op === 'move' ? builder.moveTo(to[0], to[1]) : builder.lineTo(to[0], to[1]);
    }
  }
  return builder.build();
}

/** Every unit path draw() names (tile-parts.ts partPath), each built once. */
export function buildTilePaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  const paths: Record<string, SkPath> = {};
  for (const [shape, count] of SHAPE_TURNS) {
    for (let turn = 0; turn < count; turn += 1) {
      const part = { shape, turn };
      paths[partPath(ROAD, part)] = built(skia, band(shape, WIDTHS[ROAD] ?? 0), turn);
      paths[partPath(RIVER, part)] = built(skia, band(shape, WIDTHS[RIVER] ?? 0), turn);
      paths[partPath(DASHES, part)] = built(skia, dashes(shape), turn);
    }
  }
  for (let side = 0; side < 4; side += 1)
    paths[`house-${String(side)}`] = built(skia, house(side), 0);
  return paths;
}
