// apps/scrap-shove/src/board/draw-effects.ts
'worklet';

import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';
import { drawFittedText } from '@e07/shell/game-host/draw-centered-text.ts';

import { inset, isPlaying, squareAt } from './board-geometry.ts';
import { PLAYER_ENTITY, TURN_ENTITY } from './board-ids.ts';

import type { Frame } from './board-geometry.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas, SkColor } from '@shopify/react-native-skia';

const SPARK_COUNT = 10;
const BURST_COUNT = 18;
const BADGE_SIZE = 0.46;

/** Particles flying out of one point at an age, in one palette token. */
type Burst = {
  readonly seed: number;
  readonly x: number;
  readonly y: number;
  readonly reach: number;
  readonly count: number;
  readonly ageMs: number;
  readonly color: SkColor;
};

function drawBurst(canvas: SkCanvas, frame: Frame, burst: Burst): void {
  const { reach } = burst;
  const spec = { ...burst, minSpeed: reach, maxSpeed: reach * 3, gravity: reach * 4, lifeMs: 600 };
  for (let i = 0; i < burst.count; i += 1) {
    const particle = sampleParticle(spec, i, burst.ageMs);
    setPaintColor(frame.kit.fill, burst.color, particle.alpha);
    canvas.drawCircle(particle.x, particle.y, reach * 0.06, frame.kit.fill);
  }
}

/** A crash or a crush throws sparks from its square (full motion only: reduced motion has no track). */
function drawSparks(canvas: SkCanvas, frame: Frame): void {
  for (const key of Object.keys(frame.fx.entries)) {
    const entry = frame.fx.entries[key];
    if (!key.startsWith('spark:') || !isPlaying(entry)) continue;
    const square = squareAt(frame.layout, entry.values[0] ?? 0, entry.values[1] ?? 0);
    if (square === null) continue;
    const seed = Number(key.slice('spark:'.length));
    const burst = {
      seed,
      x: square.x + square.width / 2,
      y: square.y + square.height / 2,
      reach: square.width,
      count: SPARK_COUNT,
      ageMs: entry.ageMs,
      color: frame.colors.color.spark,
    };
    drawBurst(canvas, frame, burst);
  }
}

/** How many robots one crash scrapped, on a badge at the corner of its square (chosen digits). */
function drawBadges(canvas: SkCanvas, frame: Frame): void {
  const font = frame.kit.numberFont;
  for (const key of Object.keys(frame.fx.entries)) {
    const entry = frame.fx.entries[key];
    if (!key.startsWith('badge:') || !isPlaying(entry)) continue;
    const [col = 0, row = 0, count = 0] = entry.values;
    const square = squareAt(frame.layout, col, row);
    if (square === null) continue;
    const size = square.width * BADGE_SIZE * (0.7 + 0.3 * entry.progress);
    const cx = square.x + square.width * 0.82;
    const cy = square.y + square.height * 0.18;
    frame.kit.fill.setColor(frame.colors.color.badge);
    canvas.drawCircle(cx, cy, size / 2, frame.kit.fill);
    const text = frame.view.countTexts[Math.round(count)];
    if (font === null || text === undefined) continue;
    frame.kit.fill.setColor(frame.colors.color.label);
    const rect = { x: cx - size / 2, y: cy - size / 2, width: size, height: size };
    drawFittedText(canvas, { text, rect, maxShare: 0.7 }, { font, paint: frame.kit.fill });
  }
}

/** The catch: a red flash on the player's square, then a red ring that stays on the lost board. */
function drawCaught(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors, view } = frame;
  const caught = fxEntry(frame.fx, 'caught', PLAYER_ENTITY);
  const square = squareAt(frame.layout, view.player.col, view.player.row);
  if (!view.isCaught || square === null || (caught !== undefined && caught.ageMs <= 0)) return;
  const ring = inset(square, 0.02);
  const corner = square.width * 0.16;
  if (isPlaying(caught)) {
    setPaintColor(kit.fill, colors.color.danger, (caught.values[0] ?? 0) * 0.5);
    canvas.drawRRect({ rect: ring, rx: corner, ry: corner }, kit.fill);
  }
  kit.stroke.setColor(colors.color.danger);
  kit.stroke.setStrokeWidth(Math.max(2, square.width * 0.08));
  canvas.drawRRect({ rect: ring, rx: corner, ry: corner }, kit.stroke);
}

/** The host's hinted move: a ring around each hinted square (EMPTY_HIGHLIGHT draws nothing). */
function drawHinted(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors } = frame;
  for (const target of frame.highlight.hinted) {
    const square =
      target.regionId === 'board' ? squareAt(frame.layout, target.col, target.row) : null;
    if (square === null) continue;
    const ring = inset(square, 0.05);
    kit.stroke.setColor(colors.color.hint);
    kit.stroke.setStrokeWidth(Math.max(2, square.width * 0.08));
    canvas.drawRRect({ rect: ring, rx: square.width * 0.16, ry: square.width * 0.16 }, kit.stroke);
  }
}

/** A glow over the floor: the clear (glow colour) or an undo (a short hint-coloured blink). */
function drawWash(canvas: SkCanvas, frame: Frame, floor: Rect): void {
  const { kit, colors, fx } = frame;
  const glow = fxEntry(fx, 'glow', TURN_ENTITY);
  const revert = fxEntry(fx, 'revert', TURN_ENTITY);
  const wash = isPlaying(glow) ? { entry: glow, color: colors.color.glow, share: 0.6 } : null;
  const blink = isPlaying(revert) ? { entry: revert, color: colors.color.hint, share: 0.2 } : null;
  const shown = wash ?? blink;
  if (shown === null) return;
  setPaintColor(kit.fill, shown.color, (shown.entry.values[0] ?? 0) * shown.share);
  canvas.drawRRect({ rect: floor, rx: floor.width * 0.03, ry: floor.width * 0.03 }, kit.fill);
}

/** The floor is clear: particles burst from its centre (full motion only). */
function drawClearBurst(canvas: SkCanvas, frame: Frame, floor: Rect): void {
  const burst = fxEntry(frame.fx, 'burst', TURN_ENTITY);
  if (!isPlaying(burst)) return;
  const spec = {
    seed: 7,
    x: floor.x + floor.width / 2,
    y: floor.y + floor.height / 2,
    reach: floor.width / 6,
    count: BURST_COUNT,
    ageMs: burst.ageMs,
    color: frame.colors.color.glow,
  };
  drawBurst(canvas, frame, spec);
}

/** Everything drawn over the pieces: sparks, crash badges, the catch, hints and the floor glows. */
export function drawEffects(canvas: SkCanvas, frame: Frame, floor: Rect): void {
  drawSparks(canvas, frame);
  drawBadges(canvas, frame);
  drawCaught(canvas, frame);
  drawHinted(canvas, frame);
  drawWash(canvas, frame, floor);
  drawClearBurst(canvas, frame, floor);
}
