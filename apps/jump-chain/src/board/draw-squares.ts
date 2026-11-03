// apps/jump-chain/src/board/draw-squares.ts
'worklet';

import { PEEK_CELLS } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { Frame } from './draw-parts.ts';
import type { GridRegion, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { Square } from '@e07/jump-chain/rules/jump-chain-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

const EDGE_WIDTH = 0.04;

/** The board's rectangle (rows 0 to the last), mirrored like its squares. */
export function boardRect(frame: Frame, region: GridRegion): Rect {
  const width = region.cell * frame.view.cols;
  const x = frame.layout.isMirrored ? frame.layout.width - region.x - width : region.x;
  return { x, y: region.y, width, height: region.cell * frame.view.rows };
}

/** A square's rectangle; the waiting row (-1) shows only its lower half, the peek band. */
function squareRect(frame: Frame, region: GridRegion, square: Square): Rect {
  const { cell } = region;
  const x = region.x + square.col * cell;
  const isPeek = square.row < 0;
  return {
    x: frame.layout.isMirrored ? frame.layout.width - x - cell : x,
    y: isPeek ? region.y - cell * PEEK_CELLS : region.y + square.row * cell,
    width: cell,
    height: isPeek ? cell * PEEK_CELLS : cell,
  };
}

/** Pieces stand on the dark squares; your side's row is tinted, so the line to defend shows. */
function squareToken(frame: Frame, square: Square): BoardToken {
  if (((square.col + square.row) & 1) !== 0) return 'light';
  return square.row === frame.view.rows - 1 ? 'side' : 'dark';
}

/** The squares of one colour in the rows from `fromRow` up to (not including) `toRow`. */
type SquaresOf = {
  readonly region: GridRegion;
  readonly token: BoardToken;
  readonly fromRow: number;
  readonly toRow: number;
};

function fillSquares(canvas: SkCanvas, frame: Frame, squares: SquaresOf): void {
  const { kit, colors, view } = frame;
  kit.fill.setColor(colors.color[squares.token]);
  for (let row = squares.fromRow; row < squares.toRow; row += 1) {
    for (let col = 0; col < view.cols; col += 1) {
      const square = { col, row };
      if (squareToken(frame, square) !== squares.token) continue;
      canvas.drawRect(squareRect(frame, squares.region, square), kit.fill);
    }
  }
}

/**
 * The checkerboard, the waiting row's lower half above it, and an ink edge round the board. The
 * board is one dark fill with only the squares of another colour drawn on it; its edges are whole
 * pixels (layout-board), so this paints what one rectangle per square painted.
 */
export function drawSquares(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const { kit, colors, view } = frame;
  const board = boardRect(frame, region);
  kit.fill.setColor(colors.color.dark);
  canvas.drawRect(board, kit.fill);
  fillSquares(canvas, frame, { region, token: 'dark', fromRow: -1, toRow: 0 });
  fillSquares(canvas, frame, { region, token: 'light', fromRow: -1, toRow: view.rows });
  fillSquares(canvas, frame, { region, token: 'side', fromRow: view.rows - 1, toRow: view.rows });
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(Math.max(1, region.cell * EDGE_WIDTH));
  canvas.drawRect(board, kit.stroke);
}
