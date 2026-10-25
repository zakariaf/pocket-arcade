// apps/jump-chain/src/board/draw-parts.ts
'worklet';

import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';

import { PEEK_CELLS } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { JumpChainView } from './to-view.ts';
import type { GridRegion } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

export type Frame = DrawFrame<JumpChainView, BoardToken>;
export type Point = { readonly x: number; readonly y: number };

/** Radii and widths as shares of a square. */
export const ENEMY_RADIUS = 0.34;
export const PIECE_RADIUS = 0.38;
/** A ring is this share of its disc's radius wide. */
const RING_SHARE = 0.22;
const PIECE_EDGE = 0.05;
const CROWN_SIZE = 0.44;
const CROWN_FALLBACK = 0.12;

/** A disc of a token, optionally ringed with another; size scales it (pops and spawns). */
export type Disc = {
  readonly at: Point;
  readonly radius: number;
  readonly fill: BoardToken;
  readonly ring?: BoardToken;
  readonly alpha?: number;
};

/** The board region (the waiting row and the lift strip are not part of it). */
export function boardRegion(frame: Frame): GridRegion | null {
  return frame.layout.regions[0] ?? null;
}

/** Centre of a square; fractional rows and columns place a piece mid-move. */
export function centreOf(
  frame: Frame,
  square: { readonly col: number; readonly row: number },
): Point | null {
  const region = boardRegion(frame);
  if (region === null) return null;
  const x = region.x + (square.col + 0.5) * region.cell;
  return {
    x: frame.layout.isMirrored ? frame.layout.width - x : x,
    y: region.y + (square.row + 0.5) * region.cell,
  };
}

/** The top of the peek band: everything above it is covered with the background. */
export function peekTop(region: GridRegion): number {
  return region.y - region.cell * PEEK_CELLS;
}

export function drawDisc(canvas: SkCanvas, frame: Frame, disc: Disc): void {
  const { kit, colors } = frame;
  const alpha = disc.alpha ?? 1;
  setPaintColor(kit.fill, colors.color[disc.fill], alpha);
  canvas.drawCircle(disc.at.x, disc.at.y, disc.radius, kit.fill);
  if (disc.ring === undefined) return;
  setPaintColor(kit.stroke, colors.color[disc.ring], alpha);
  kit.stroke.setStrokeWidth(Math.max(1, disc.radius * RING_SHARE));
  canvas.drawCircle(disc.at.x, disc.at.y, disc.radius, kit.stroke);
}

/** An enemy: a dark disc in a red ring (the ring tells it apart from your crowned piece). */
export function drawEnemy(
  canvas: SkCanvas,
  frame: Frame,
  at: { readonly point: Point; readonly size: number },
): void {
  const cell = boardRegion(frame)?.cell ?? 0;
  drawDisc(canvas, frame, {
    at: at.point,
    radius: cell * ENEMY_RADIUS * at.size,
    fill: 'enemy',
    ring: 'enemyMark',
  });
}

/** Your piece: a light disc with an ink edge and a crown (it is a king, it jumps every way). */
export function drawPiece(
  canvas: SkCanvas,
  frame: Frame,
  at: { readonly point: Point; readonly alpha: number },
): void {
  const { kit, colors } = frame;
  const cell = boardRegion(frame)?.cell ?? 0;
  const { point, alpha } = at;
  drawDisc(canvas, frame, { at: point, radius: cell * PIECE_RADIUS, fill: 'piece', alpha });
  setPaintColor(kit.stroke, colors.color.edge, alpha);
  kit.stroke.setStrokeWidth(Math.max(1, cell * PIECE_EDGE));
  canvas.drawCircle(point.x, point.y, cell * PIECE_RADIUS, kit.stroke);
  setPaintColor(kit.fill, colors.color.crown, alpha);
  const crown = kit.paths['crown'];
  if (crown === undefined) {
    canvas.drawCircle(point.x, point.y, cell * CROWN_FALLBACK, kit.fill);
  } else {
    const size = cell * CROWN_SIZE;
    canvas.save();
    canvas.translate(point.x - size / 2, point.y - size / 2);
    canvas.scale(size, size);
    canvas.drawPath(crown, kit.fill);
    canvas.restore();
  }
}
