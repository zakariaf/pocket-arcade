// apps/jump-chain/src/board/draw-board.ts
'worklet';

import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';
import { drawFittedText } from '@e07/shell/game-host/draw-centered-text.ts';

import { enemyEntity, TURN_ENTITY } from './board-ids.ts';
import {
  ENEMY_RADIUS,
  boardRegion,
  centreOf,
  drawDisc,
  drawEnemy,
  drawPiece,
  peekTop,
} from './draw-parts.ts';
import { PEEK_CELLS } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { Frame, Point } from './draw-parts.ts';
import type { EnemyView, TargetView } from './to-view.ts';
import type { GridRegion, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
import type { Square } from '@e07/jump-chain/rules/jump-chain-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

const DOT_RADIUS = 0.12;
const PATH_WIDTH = 0.08;
const CAPTURE_RADIUS = 0.44;
const HINT_RADIUS = 0.46;
const GHOST_ALPHA = 0.55;
const BADGE_RADIUS = 0.24;
const EDGE_WIDTH = 0.04;
const GLOW_ALPHA = 0.5;
const BURST_COUNT = 10;
/** An enemy further up than this (sliding in from a waiting rank) is hidden under the cover. */
const HIDDEN_ROW = -2;

/** An effect that is not a tween of something visible draws only once its track has started. */
function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress < 1;
}

/** The board's rectangle (rows 0 to the last), mirrored like its squares. */
function boardRect(frame: Frame, region: GridRegion): Rect {
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

/** The checkerboard, the waiting row's lower half above it, and an ink edge round the board. */
function drawSquares(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const { kit, colors, view } = frame;
  for (let row = -1; row < view.rows; row += 1) {
    for (let col = 0; col < view.cols; col += 1) {
      kit.fill.setColor(colors.color[squareToken(frame, { col, row })]);
      canvas.drawRect(squareRect(frame, region, { col, row }), kit.fill);
    }
  }
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(Math.max(1, region.cell * EDGE_WIDTH));
  canvas.drawRect(boardRect(frame, region), kit.stroke);
}

/** A dot on every square a move ends on: where the piece can go. */
function drawTargets(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  for (const target of frame.view.targets) {
    const at = centreOf(frame, target);
    if (at === null) continue;
    drawDisc(canvas, frame, { at, radius: region.cell * DOT_RADIUS, fill: 'target' });
  }
}

/** The target under a finger that is dragging your piece, or null. */
function previewed(frame: Frame): TargetView | null {
  const { pointer } = frame.fx;
  const { piece, targets } = frame.view;
  const from = pointer.dragFrom;
  const hover = pointer.hover;
  if (!pointer.isDown || from === null || hover === null) return null;
  if (from.col !== piece.col || from.row !== piece.row) return null;
  return targets.find((target) => target.col === hover.col && target.row === hover.row) ?? null;
}

/** The chain the finger would play: a line along its landing squares. */
function drawPath(canvas: SkCanvas, frame: Frame, target: TargetView): void {
  const { kit, colors, view } = frame;
  const cell = boardRegion(frame)?.cell ?? 0;
  kit.stroke.setColor(colors.color.path);
  kit.stroke.setStrokeWidth(Math.max(2, cell * PATH_WIDTH));
  let from = centreOf(frame, view.piece);
  for (const square of target.path) {
    const to = centreOf(frame, square);
    if (from !== null && to !== null) canvas.drawLine(from.x, from.y, to.x, to.y, kit.stroke);
    from = to;
  }
}

/** Gold rings on the enemies the previewed chain captures, and the piece's ghost where it ends. */
function drawCaptures(canvas: SkCanvas, frame: Frame, target: TargetView): void {
  const { kit, colors } = frame;
  const cell = boardRegion(frame)?.cell ?? 0;
  kit.stroke.setColor(colors.color.capture);
  kit.stroke.setStrokeWidth(Math.max(2, cell * PATH_WIDTH));
  for (const square of target.captured) {
    const at = centreOf(frame, square);
    if (at !== null) canvas.drawCircle(at.x, at.y, cell * CAPTURE_RADIUS, kit.stroke);
  }
  const end = centreOf(frame, target);
  if (end !== null) drawPiece(canvas, frame, { point: end, alpha: GHOST_ALPHA });
}

/** Where an enemy stands this frame (its march and spawn tracks), or null while it is hidden. */
function enemyAt(frame: Frame, enemy: EnemyView): { point: Point; size: number } | null {
  const entity = enemyEntity(enemy.id);
  const row = fxEntry(frame.fx, 'march', entity)?.values[0] ?? enemy.row;
  const size = fxEntry(frame.fx, 'spawn', entity)?.values[0] ?? 1;
  const point = centreOf(frame, { col: enemy.col, row });
  return point === null || row < HIDDEN_ROW || size <= 0 ? null : { point, size };
}

/** Enemies on the board and waiting above it, with the flash of those that reached your side. */
function drawEnemies(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  for (const enemy of frame.view.enemies) {
    const at = enemyAt(frame, enemy);
    if (at === null) continue;
    drawEnemy(canvas, frame, at);
    const breach = fxEntry(frame.fx, 'breach', enemyEntity(enemy.id));
    if (!isPlaying(breach)) continue;
    const alpha = breach.values[0] ?? 0;
    drawDisc(canvas, frame, { at: at.point, radius: region.cell / 2, fill: 'breach', alpha });
  }
}

/** Jumped enemies are gone from the view: their pop tracks carry the square and the size. */
function drawPops(canvas: SkCanvas, frame: Frame): void {
  for (const key of Object.keys(frame.fx.entries)) {
    if (!key.startsWith('pop:')) continue;
    const [col = 0, row = 0, size = 0] = frame.fx.entries[key]?.values ?? [];
    const point = centreOf(frame, { col, row });
    if (point !== null && size > 0) drawEnemy(canvas, frame, { point, size });
  }
}

/** Particles where an enemy was captured (full motion only: reduced motion has no burst). */
function drawBursts(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const { kit, colors, fx } = frame;
  for (const key of Object.keys(fx.entries)) {
    const burst = fx.entries[key];
    if (!key.startsWith('burst:') || !isPlaying(burst)) continue;
    const [col = 0, row = 0] = burst.values;
    const point = centreOf(frame, { col, row });
    if (point === null) continue;
    const spec = {
      seed: col * 31 + row,
      x: point.x,
      y: point.y,
      count: BURST_COUNT,
      minSpeed: 50,
      maxSpeed: 170,
      gravity: 360,
      lifeMs: 520,
    };
    for (let i = 0; i < spec.count; i += 1) {
      const particle = sampleParticle(spec, i, burst.ageMs);
      setPaintColor(kit.fill, colors.color.capture, particle.alpha);
      canvas.drawCircle(particle.x, particle.y, region.cell * ENEMY_RADIUS * 0.22, kit.fill);
    }
  }
}

/** A rank was cleared: the whole board glows and fades. */
function drawGlow(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const glow = fxEntry(frame.fx, 'clear', TURN_ENTITY);
  if (!isPlaying(glow)) return;
  const { kit, colors } = frame;
  setPaintColor(kit.fill, colors.color.glow, (glow.values[0] ?? 0) * GLOW_ALPHA);
  canvas.drawRect(boardRect(frame, region), kit.fill);
}

/** The host's hinted move: a ring round each hinted square (EMPTY_HIGHLIGHT draws nothing). */
function drawHinted(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const { kit, colors } = frame;
  kit.stroke.setColor(colors.color.hint);
  kit.stroke.setStrokeWidth(Math.max(2, region.cell * PATH_WIDTH));
  for (const target of frame.highlight.hinted) {
    const at = target.regionId === 'board' ? centreOf(frame, target) : null;
    if (at !== null) canvas.drawCircle(at.x, at.y, region.cell * HINT_RADIUS, kit.stroke);
  }
}

/** Moves until the ranks advance, in the waiting row's free corner (hidden once the run is over). */
function drawMarchBadge(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const { kit, view } = frame;
  const font = kit.numberFont;
  const corner = centreOf(frame, { col: view.cols - 1, row: 0 });
  if (view.targets.length === 0 || font === null || corner === null) return;
  const radius = region.cell * BADGE_RADIUS;
  const at = { x: corner.x, y: region.y - (region.cell * PEEK_CELLS) / 2 };
  drawDisc(canvas, frame, { at, radius, fill: 'labelBack', ring: 'label' });
  kit.fill.setColor(frame.colors.color.label);
  const rect = { x: at.x - radius, y: at.y - radius, width: 2 * radius, height: 2 * radius };
  drawFittedText(canvas, { text: view.marchInText, rect }, { font, paint: kit.fill });
}

/** Pure worklet: reads only its arguments, allocates no Skia objects, reads no clock. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  const { colors, kit, layout, view } = frame;
  canvas.drawColor(colors.color.background);
  const region = boardRegion(frame);
  if (region === null) return;
  drawSquares(canvas, frame, region);
  drawTargets(canvas, frame, region);
  const target = previewed(frame);
  if (target !== null) drawPath(canvas, frame, target);
  drawEnemies(canvas, frame, region);
  drawPops(canvas, frame);
  const moving = fxEntry(frame.fx, 'piece', TURN_ENTITY)?.values;
  const piece = centreOf(frame, {
    col: moving?.[0] ?? view.piece.col,
    row: moving?.[1] ?? view.piece.row,
  });
  if (piece !== null) drawPiece(canvas, frame, { point: piece, alpha: 1 });
  if (target !== null) drawCaptures(canvas, frame, target);
  drawBursts(canvas, frame, region);
  // Whatever slides in from a waiting rank further up stays hidden above the peek band.
  kit.fill.setColor(colors.color.background);
  canvas.drawRect({ x: 0, y: 0, width: layout.width, height: peekTop(region) }, kit.fill);
  drawGlow(canvas, frame, region);
  drawHinted(canvas, frame, region);
  drawMarchBadge(canvas, frame, region);
}
