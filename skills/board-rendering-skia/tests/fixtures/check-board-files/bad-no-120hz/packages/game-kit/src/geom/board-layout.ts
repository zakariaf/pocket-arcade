// packages/game-kit/src/geom/board-layout.ts
'worklet';

/** Axis-aligned rectangle in canvas points; also accepted by SkCanvas draw calls as-is. */
export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** A rectangular grid of square cells in canvas pixels (unmirrored coordinates). */
export type GridRegion = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
};

/** Pure function of the canvas size. Shared by draw() and hitTest(): they cannot drift. */
export type BoardLayout = {
  readonly width: number;
  readonly height: number;
  /** RTL mirroring for boards that opted in: positions mirror, glyphs never do. */
  readonly isMirrored: boolean;
  readonly regions: readonly GridRegion[];
};

/** A cell of a named region (board, tray, button strip): what hit-testing returns. */
export type BoardTarget = { readonly regionId: string; readonly col: number; readonly row: number };

/** Box to fill and the grid size to fit into it. */
export type FitInput = {
  readonly box: Rect;
  readonly cols: number;
  readonly rows: number;
};

/** Layout before the canvas has a size: no regions, so nothing is hit. */
export const EMPTY_LAYOUT: BoardLayout = { width: 0, height: 0, isMirrored: false, regions: [] };

/** Largest whole-pixel square cell that fits `box`, centred in it. */
export function fitGrid(input: FitInput): Omit<GridRegion, 'id'> {
  const cell = Math.max(
    0,
    Math.floor(Math.min(input.box.width / input.cols, input.box.height / input.rows)),
  );
  return {
    x: input.box.x + Math.floor((input.box.width - cell * input.cols) / 2),
    y: input.box.y + Math.floor((input.box.height - cell * input.rows) / 2),
    cell,
    cols: input.cols,
    rows: input.rows,
  };
}

function findRegion(layout: BoardLayout, regionId: string): GridRegion | undefined {
  return layout.regions.find((region) => region.id === regionId);
}

function mirrorRect(layout: BoardLayout, rect: Rect): Rect {
  return layout.isMirrored ? { ...rect, x: layout.width - rect.x - rect.width } : rect;
}

/** Where to draw a cell. Applies RTL mirroring, so draw code never branches on direction. */
export function cellRect(layout: BoardLayout, target: BoardTarget): Rect | null {
  const region = findRegion(layout, target.regionId);
  if (region === undefined) return null;
  const rect = {
    x: region.x + target.col * region.cell,
    y: region.y + target.row * region.cell,
    width: region.cell,
    height: region.cell,
  };
  return mirrorRect(layout, rect);
}

type Point = { readonly x: number; readonly y: number };
type Probe = { readonly point: Point; readonly slop: number };

/**
 * Hit-tests the region where it is drawn: a mirrored region is mirrored as a rectangle (as
 * cellRect does), so a cell's left edge belongs to that cell in both directions.
 */
function regionHit(layout: BoardLayout, region: GridRegion, probe: Probe): BoardTarget | null {
  const { slop } = probe;
  const { x, y } = probe.point;
  const width = region.cols * region.cell;
  const height = region.rows * region.cell;
  const left = layout.isMirrored ? layout.width - region.x - width : region.x;
  const isInside =
    x >= left - slop &&
    x < left + width + slop &&
    y >= region.y - slop &&
    y < region.y + height + slop;
  if (!isInside || region.cell <= 0) return null;
  const drawnCol = Math.min(region.cols - 1, Math.max(0, Math.floor((x - left) / region.cell)));
  const col = layout.isMirrored ? region.cols - 1 - drawnCol : drawnCol;
  const row = Math.min(region.rows - 1, Math.max(0, Math.floor((y - region.y) / region.cell)));
  return { regionId: region.id, col, row };
}

function firstHit(layout: BoardLayout, point: Point, slop: number): BoardTarget | null {
  for (const region of layout.regions) {
    const hit = regionHit(layout, region, { point, slop });
    if (hit !== null) return hit;
  }
  return null;
}

/**
 * Canvas point → cell. `slop` (px) extends every region so edge taps still land, but a region the
 * point is truly inside always wins over a neighbour reached only through the slop.
 */
export function hitTest(layout: BoardLayout, point: Point, slop = 0): BoardTarget | null {
  const exact = firstHit(layout, point, 0);
  if (exact !== null || slop <= 0) return exact;
  return firstHit(layout, point, slop);
}

/** Structural equality for targets (hover changes are sent to JS only when this is false). */
export function isSameTarget(a: BoardTarget | null, b: BoardTarget | null): boolean {
  if (a === null || b === null) return a === b;
  return a.regionId === b.regionId && a.col === b.col && a.row === b.row;
}
