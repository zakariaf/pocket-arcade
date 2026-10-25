// apps/swap-guard/src/board/draw-pieces.ts
'worklet';

import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';

import {
  degreesOf,
  drawUnitPath,
  inset,
  isPlaying,
  rectAt,
  rectBetween,
  scaled,
  stepOf,
} from './board-geometry.ts';
import { BURST_MS, enemyEntity, GUARD_ENTITY } from './board-ids.ts';

import type { BoardToken } from './board-palettes.ts';
import type { SwapGuardView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { Enemy } from '@e07/swap-guard/rules/swap-guard-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<SwapGuardView, BoardToken>;

/** A piece's body fills this share less of its square on every side. */
const BODY_INSET = 0.16;
/** Width of the ink edge, as a share of the square. */
const EDGE = 0.05;
/** The facing arrow: its size and how far from the centre it sits, as shares of the square. */
const ARROW_SIZE = 0.24;
const ARROW_REACH = 0.36;
const BURST_PARTICLES = 16;

/** An enemy as one frame draws it: its square's rect and how large it stands (1 = full). */
type Pose = { readonly rect: Rect; readonly scale: number; readonly enemy: Enemy };

/** The ink edge of a unit path, its width given in points. */
function setUnitEdge(frame: Frame, width: number, alpha: number): void {
  setPaintColor(frame.kit.stroke, frame.colors.color.edge, alpha);
  frame.kit.stroke.setStrokeWidth(Math.max(1, width * EDGE) / width);
}

/**
 * The body tells the kind by shape, never by colour alone: a spear is a triangle pointing where
 * it strikes, an archer a diamond, a brute a broad square. Each has an ink edge.
 */
function drawBody(canvas: SkCanvas, frame: Frame, pose: Pose): Rect {
  const { kit, colors } = frame;
  const body = scaled(inset(pose.rect, BODY_INSET), pose.scale);
  const { kind } = pose.enemy;
  setPaintColor(kit.fill, colors.color.enemy, 1);
  if (kind === 'brute') {
    const corner = body.width * 0.18;
    canvas.drawRRect({ rect: body, rx: corner, ry: corner }, kit.fill);
    setPaintColor(kit.stroke, colors.color.edge, 1);
    kit.stroke.setStrokeWidth(Math.max(1, pose.rect.width * EDGE * 1.6));
    canvas.drawRRect({ rect: body, rx: corner, ry: corner }, kit.stroke);
    return body;
  }
  const path = kit.paths[kind];
  if (path === undefined) return body;
  const degrees = kind === 'spear' ? degreesOf(pose.enemy.facing) : 0;
  drawUnitPath(canvas, { path, rect: body, degrees, paint: kit.fill });
  setUnitEdge(frame, body.width, 1);
  drawUnitPath(canvas, { path, rect: body, degrees, paint: kit.stroke });
  return body;
}

/** Two ink eyes, and for a spear or an archer the arrow of the way it strikes. */
function drawFace(canvas: SkCanvas, frame: Frame, face: Pose & { readonly body: Rect }): void {
  const { kit, colors } = frame;
  const { body } = face;
  const cx = body.x + body.width / 2;
  const cy = body.y + body.height / 2;
  setPaintColor(kit.fill, colors.color.edge, 1);
  const eye = body.width * 0.07;
  canvas.drawCircle(cx - body.width * 0.14, cy + body.height * 0.08, eye, kit.fill);
  canvas.drawCircle(cx + body.width * 0.14, cy + body.height * 0.08, eye, kit.fill);
  const arrow = kit.paths['chevron'];
  if (face.enemy.kind === 'brute' || arrow === undefined) return;
  const { rect } = face;
  const size = rect.width * ARROW_SIZE * face.scale;
  const degrees = degreesOf(face.enemy.facing);
  const reach = rect.width * ARROW_REACH * face.scale;
  const step = stepOf(face.enemy.facing);
  const centre = {
    x: rect.x + rect.width / 2 + step.x * reach,
    y: rect.y + rect.height / 2 + step.y * reach,
  };
  const place = { x: centre.x - size / 2, y: centre.y - size / 2, width: size, height: size };
  drawUnitPath(canvas, { path: arrow, rect: place, degrees, paint: kit.fill });
}

function drawEnemy(canvas: SkCanvas, frame: Frame, pose: Pose): void {
  if (pose.scale <= 0) return;
  const body = drawBody(canvas, frame, pose);
  drawFace(canvas, frame, { ...pose, body });
}

/** Where an enemy stands: mid-slide while its swap plays, else its square. */
function enemyRect(frame: Frame, enemy: Enemy): Rect | null {
  const { view, layout } = frame;
  const slide = fxEntry(frame.fx, 'slide', enemyEntity(enemy.id));
  if (slide !== undefined) return rectBetween(layout, view.size, slide.values);
  return rectAt(layout, view.size, enemy.cell);
}

/** The standing enemies; one the continue gives back grows from nothing. */
export function drawEnemies(canvas: SkCanvas, frame: Frame): void {
  for (const enemy of frame.view.enemies) {
    const rect = enemyRect(frame, enemy);
    const scale = fxEntry(frame.fx, 'rise', enemyEntity(enemy.id))?.values[0] ?? 1;
    if (rect !== null) drawEnemy(canvas, frame, { rect, scale, enemy });
  }
}

/**
 * The enemies this move knocked out: gone from the final state, they shrink away where they stood
 * while their fall plays (at moment 0 they are still whole), and only then.
 */
export function drawFallen(canvas: SkCanvas, frame: Frame): void {
  for (const enemy of frame.view.fallen) {
    const fall = fxEntry(frame.fx, 'fall', enemyEntity(enemy.id));
    const rect = fall === undefined ? null : enemyRect(frame, enemy);
    if (rect !== null) drawEnemy(canvas, frame, { rect, scale: fall?.values[0] ?? 0, enemy });
  }
}

/** The guard: a round body with an ink edge and a crest, mid-slide while its swap plays. */
export function drawGuard(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, kit, colors } = frame;
  const slide = fxEntry(frame.fx, 'guard', GUARD_ENTITY);
  const rect =
    slide === undefined
      ? rectAt(layout, view.size, view.guard)
      : rectBetween(layout, view.size, slide.values);
  if (rect === null) return;
  const body = inset(rect, BODY_INSET * 0.8);
  const cx = body.x + body.width / 2;
  const cy = body.y + body.height / 2;
  setPaintColor(kit.fill, colors.color.guard, 1);
  canvas.drawCircle(cx, cy, body.width / 2, kit.fill);
  setPaintColor(kit.stroke, colors.color.edge, 1);
  kit.stroke.setStrokeWidth(Math.max(1, rect.width * EDGE));
  canvas.drawCircle(cx, cy, body.width / 2, kit.stroke);
  const shield = kit.paths['shield'];
  if (shield === undefined) return;
  const crest = inset(body, 0.24);
  setPaintColor(kit.fill, colors.color.crest, 1);
  drawUnitPath(canvas, { path: shield, rect: crest, degrees: 0, paint: kit.fill });
  setUnitEdge(frame, crest.width, 1);
  drawUnitPath(canvas, { path: shield, rect: crest, degrees: 0, paint: kit.stroke });
}

/** A strike landed on the guard: a ring bursts from it while the hit plays. */
export function drawGuardHit(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, kit, colors } = frame;
  const hit = fxEntry(frame.fx, 'hit', GUARD_ENTITY);
  const rect = isPlaying(hit) ? rectAt(layout, view.size, view.guard) : null;
  if (rect === null || hit === undefined) return;
  const grow = hit.values[0] ?? 0;
  setPaintColor(kit.stroke, colors.color.flash, 1 - grow);
  kit.stroke.setStrokeWidth(Math.max(2, rect.width * 0.1));
  const radius = (rect.width / 2) * (0.7 + grow * 0.6);
  canvas.drawCircle(rect.x + rect.width / 2, rect.y + rect.height / 2, radius, kit.stroke);
}

/** Particles from each knocked-out enemy while its burst plays. */
export function drawBursts(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, fx, kit, colors } = frame;
  for (const enemy of view.fallen) {
    const burst = fxEntry(fx, 'burst', enemyEntity(enemy.id));
    const rect = isPlaying(burst) ? rectAt(layout, view.size, burst.values[0] ?? 0) : null;
    if (rect === null || burst === undefined) continue;
    const spec = {
      seed: enemy.id + 1,
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      count: BURST_PARTICLES,
      minSpeed: 80,
      maxSpeed: 260,
      gravity: 420,
      lifeMs: BURST_MS,
    };
    for (let i = 0; i < BURST_PARTICLES; i += 1) {
      const particle = sampleParticle(spec, i, burst.ageMs);
      setPaintColor(kit.fill, colors.color.enemy, particle.alpha);
      canvas.drawCircle(particle.x, particle.y, rect.width * 0.07, kit.fill);
    }
  }
}
