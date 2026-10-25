// apps/snare-snake/src/board/draw-critters.ts
'worklet';

import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';

import { isPlaying, rectAt, rectBetween } from './board-geometry.ts';
import { BURST_MS, critterEntity } from './board-ids.ts';

import type { BoardToken } from './board-palettes.ts';
import type { CritterView, SnareSnakeView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<SnareSnakeView, BoardToken>;

/** A critter as one frame draws it: where, how large (1 = full) and whether it shows its ring. */
type Pose = { readonly rect: Rect; readonly scale: number; readonly isFrozen: boolean };

/** Body radius as a share of the cell; the frost ring sits just outside it. */
const BODY = 0.32;
const RING = 0.45;
const BURST_PARTICLES = 18;

/**
 * A round beetle: the body with its ink edge, the line between its wings and two spots. A frozen
 * critter (the snake is next to it) wears a frost ring, so frozen is told by shape too.
 */
function drawCritter(canvas: SkCanvas, frame: Frame, pose: Pose): void {
  const { kit, colors } = frame;
  const { rect } = pose;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const r = rect.width * BODY * pose.scale;
  kit.fill.setColor(colors.color.critter);
  canvas.drawCircle(cx, cy, r, kit.fill);
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(Math.max(1, rect.width * 0.05));
  canvas.drawCircle(cx, cy, r, kit.stroke);
  kit.stroke.setColor(colors.color.spot);
  canvas.drawLine(cx, cy - r, cx, cy + r, kit.stroke);
  kit.fill.setColor(colors.color.spot);
  canvas.drawCircle(cx - r * 0.48, cy + r * 0.12, r * 0.2, kit.fill);
  canvas.drawCircle(cx + r * 0.48, cy + r * 0.12, r * 0.2, kit.fill);
  if (!pose.isFrozen) return;
  kit.stroke.setColor(colors.color.frost);
  canvas.drawCircle(cx, cy, rect.width * RING, kit.stroke);
}

/** Where a critter stands: mid-hop (lifted on a small arc) while its hop plays, else its cell. */
function standingRect(frame: Frame, critter: CritterView): Rect | null {
  const { view, layout } = frame;
  const hop = fxEntry(frame.fx, 'hop', critterEntity(critter.id));
  if (hop === undefined) return rectAt(layout, view.cols, critter.cell);
  const rect = rectBetween(layout, view.cols, hop.values);
  if (rect === null) return null;
  const t = hop.values[2] ?? 1;
  return { ...rect, y: rect.y - 4 * t * (1 - t) * rect.height * 0.3 };
}

/** The critters still on the board. */
export function drawCritters(canvas: SkCanvas, frame: Frame): void {
  for (const critter of frame.view.critters) {
    const rect = standingRect(frame, critter);
    if (rect !== null) drawCritter(canvas, frame, { rect, scale: 1, isFrozen: critter.isFrozen });
  }
}

/**
 * The critters this move caught: gone from the final view, they shrink away where they stood
 * (at moment 0 they are still whole), and in full motion a burst of particles flies out.
 */
export function drawCaughtCritters(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, fx } = frame;
  for (let id = 0; id < view.total; id += 1) {
    const caught = fxEntry(fx, 'caught', critterEntity(id));
    const scale = caught?.values[1] ?? 0;
    const rect = scale > 0 ? rectAt(layout, view.cols, caught?.values[0] ?? 0) : null;
    if (rect !== null) drawCritter(canvas, frame, { rect, scale, isFrozen: false });
  }
}

/** Particles from each caught critter while its burst plays. */
export function drawBursts(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, fx, kit, colors } = frame;
  for (let id = 0; id < view.total; id += 1) {
    const burst = fxEntry(fx, 'burst', critterEntity(id));
    const rect = isPlaying(burst) ? rectAt(layout, view.cols, burst.values[0] ?? 0) : null;
    if (rect === null || burst === undefined) continue;
    const spec = {
      seed: id + 1,
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
      setPaintColor(kit.fill, colors.color.critter, particle.alpha);
      canvas.drawCircle(particle.x, particle.y, rect.width * 0.08, kit.fill);
    }
  }
}
