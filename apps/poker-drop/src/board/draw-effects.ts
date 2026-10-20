// apps/poker-drop/src/board/draw-effects.ts
'worklet';

import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';

import { burstEntity } from './board-ids.ts';
import { drawScaledText } from './draw-card.ts';
import { isPlaying, pointAt, valueAt } from './draw-parts.ts';

import type { Frame } from './draw-parts.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

/** More hands than one move can burst (the loop over burst entities stops at the first missing). */
const MAX_BURSTS = 40;
/** The line flash: a band this share of a cell wide, reaching this far past the end cells. */
const LINE_WIDTH = 0.42;
const LINE_REACH = 0.42;
const LINE_ALPHA = 0.55;
const PARTICLES = 14;
/** The cascade badge's radius as a share of a cell. */
const BADGE_RADIUS = 0.4;

/** A hand's line flashes across its five cards and fades. */
function drawLine(canvas: SkCanvas, frame: Frame, order: number): void {
  const line = fxEntry(frame.fx, 'line', burstEntity(order));
  if (!isPlaying(line)) return;
  const from = pointAt(frame, valueAt(line, 0), valueAt(line, 1));
  const to = pointAt(frame, valueAt(line, 2), valueAt(line, 3));
  // Every line spans five cells, so its length is never 0.
  const length = Math.sqrt((to.x - from.x) * (to.x - from.x) + (to.y - from.y) * (to.y - from.y));
  const reach = (from.cell * LINE_REACH) / Math.max(length, 1);
  const dx = (to.x - from.x) * reach;
  const dy = (to.y - from.y) * reach;
  const { stroke } = frame.kit;
  stroke.setColor(frame.colors.color.burst);
  stroke.setAlphaf(LINE_ALPHA * (1 - line.progress));
  stroke.setStrokeWidth(from.cell * LINE_WIDTH);
  canvas.drawLine(from.x - dx, from.y - dy, to.x + dx, to.y + dy, stroke);
  stroke.setAlphaf(1);
}

/** Particles fly out of the middle of a bursting line (full motion only: reduced has no track). */
function drawParticles(canvas: SkCanvas, frame: Frame, order: number): void {
  const burst = fxEntry(frame.fx, 'burst', burstEntity(order));
  if (!isPlaying(burst)) return;
  const centre = pointAt(frame, valueAt(burst, 0), valueAt(burst, 1));
  const spec = {
    seed: burstEntity(order),
    x: centre.x,
    y: centre.y,
    count: PARTICLES,
    minSpeed: centre.cell * 1.2,
    maxSpeed: centre.cell * 3.6,
    gravity: centre.cell * 6,
    lifeMs: 600,
  };
  const { fill } = frame.kit;
  fill.setColor(frame.colors.color.burst);
  for (let i = 0; i < spec.count; i += 1) {
    const particle = sampleParticle(spec, i, burst.ageMs);
    fill.setAlphaf(particle.alpha);
    canvas.drawCircle(particle.x, particle.y, centre.cell * 0.07, fill);
  }
  fill.setAlphaf(1);
}

/** The cascade badge: "×2" pops over the line that led the second (and every later) step. */
function drawBadge(canvas: SkCanvas, frame: Frame, order: number): void {
  const badge = fxEntry(frame.fx, 'step', burstEntity(order));
  if (!isPlaying(badge)) return;
  const { view, kit, colors } = frame;
  const centre = pointAt(frame, valueAt(badge, 0), valueAt(badge, 1));
  const radius = centre.cell * BADGE_RADIUS * valueAt(badge, 3);
  kit.fill.setColor(colors.color.burst);
  canvas.drawCircle(centre.x, centre.y, radius, kit.fill);
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(Math.max(1.5, radius * 0.1));
  canvas.drawCircle(centre.x, centre.y, radius, kit.stroke);
  const font = kit.numberFont;
  if (font === null) return;
  const step = Math.min(valueAt(badge, 2), view.stepTexts.length - 1);
  const box = {
    x: centre.x - radius * 0.66,
    y: centre.y - radius * 0.4,
    width: radius * 1.32,
    height: radius * 0.8,
  };
  kit.fill.setColor(colors.color.onBurst);
  drawScaledText(canvas, { text: view.stepTexts[step] ?? '', box }, { font, paint: kit.fill });
}

/** How many hands burst during the move (their line tracks are numbered from 0). */
function burstCount(frame: Frame): number {
  let count = 0;
  while (count < MAX_BURSTS && fxEntry(frame.fx, 'line', burstEntity(count)) !== undefined) {
    count += 1;
  }
  return count;
}

/** Every hand that bursts during the move: line flashes and particles, then the cascade badges on top. */
export function drawBursts(canvas: SkCanvas, frame: Frame): void {
  const count = burstCount(frame);
  for (let order = 0; order < count; order += 1) {
    drawLine(canvas, frame, order);
    drawParticles(canvas, frame, order);
  }
  for (let order = 0; order < count; order += 1) drawBadge(canvas, frame, order);
}
