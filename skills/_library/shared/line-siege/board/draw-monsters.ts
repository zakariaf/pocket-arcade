// apps/line-siege/src/board/draw-monsters.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { drawFittedText } from '@e07/shell/game-host/draw-centered-text.ts';

import { kindAt } from './board-ids.ts';
import { isPlaying } from './draw-parts.ts';
import { lanePoint } from './layout-board.ts';

import type { MonsterKindName } from './board-ids.ts';
import type { Frame } from './draw-parts.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

const BURST_COUNT = 14;
/** A monster fills this share of its lane's width and of one lane row's height. */
const MONSTER_WIDTH = 0.84;
const MONSTER_HEIGHT = 0.9;

type Body = {
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
};

type Placed = { readonly lane: number; readonly row: number; readonly size: number };

/** A monster to draw: its kind, where, and its opacity (defeated and breaching ones fade out). */
type Vanishing = { readonly kind: MonsterKindName; readonly body: Body; readonly alpha: number };

/** Where a monster at a (possibly fractional) lane row is drawn, scaled by `size`. */
function bodyAt(frame: Frame, at: Placed): Body | null {
  const point = lanePoint(frame.layout, frame.view, at);
  const top = cellRect(frame.layout, { regionId: 'board', col: at.lane, row: 0 });
  if (point === null || top === null) return null;
  const width = top.width * MONSTER_WIDTH * at.size;
  return { cx: point.x, cy: point.y, width, height: point.step * MONSTER_HEIGHT * at.size };
}

function rectOf(body: Body): { x: number; y: number; width: number; height: number } {
  return {
    x: body.cx - body.width / 2,
    y: body.cy - body.height / 2,
    width: body.width,
    height: body.height,
  };
}

/**
 * The kind is carried by shape as well as colour (colour-blind safe): normal is a pill, armoured a
 * squarer body with a thick ink ring, fast a pill with a chevron pointing at the wall.
 */
function drawBody(canvas: SkCanvas, frame: Frame, monster: Vanishing): void {
  const { kit, colors } = frame;
  const { kind, body, alpha } = monster;
  const rect = rectOf(body);
  const radius = kind === 'armoured' ? body.height * 0.15 : body.height / 2;
  kit.fill.setColor(colors.color[kind]);
  kit.fill.setAlphaf(alpha);
  canvas.drawRRect({ rect, rx: radius, ry: radius }, kit.fill);
  kit.stroke.setColor(colors.color.wall);
  kit.stroke.setAlphaf(alpha);
  kit.stroke.setStrokeWidth(Math.max(1, body.height * (kind === 'armoured' ? 0.14 : 0.05)));
  canvas.drawRRect({ rect, rx: radius, ry: radius }, kit.stroke);
  kit.stroke.setAlphaf(1);
  const arrow = kit.paths['arrow'];
  if (kind === 'fast' && arrow !== undefined) {
    canvas.save();
    canvas.translate(body.cx - body.height / 2, body.cy + body.height * 0.35);
    canvas.scale(body.height, body.height * 0.5);
    canvas.drawPath(arrow, kit.fill);
    canvas.restore();
  }
  kit.fill.setAlphaf(1);
}

/** Health digits fitted into the body: the kit has one number size, and a monster is half a cell. */
function drawHealth(
  canvas: SkCanvas,
  frame: Frame,
  label: { readonly text: string; readonly body: Body },
): void {
  const font = frame.kit.numberFont;
  if (font === null) return;
  frame.kit.fill.setColor(frame.colors.color.number);
  drawFittedText(
    canvas,
    { text: label.text, rect: rectOf(label.body) },
    { font, paint: frame.kit.fill },
  );
}

/** Living monsters: marching rows, spawn growth and the hit flash come from the timeline. */
export function drawMonsters(canvas: SkCanvas, frame: Frame): void {
  const { view, fx, kit } = frame;
  for (const monster of view.monsters) {
    const row = fxEntry(fx, 'row', monster.id)?.values[0] ?? monster.row;
    const size = fxEntry(fx, 'spawn', monster.id)?.values[0] ?? 1;
    const body = bodyAt(frame, { lane: monster.lane, row, size });
    if (body === null || size <= 0) continue;
    drawBody(canvas, frame, { kind: monster.kind, body, alpha: 1 });
    const flash = fxEntry(fx, 'flash', monster.id);
    if (isPlaying(flash)) {
      kit.fill.setColor(frame.colors.color.beam);
      kit.fill.setAlphaf(flash.values[0] ?? 0);
      canvas.drawCircle(body.cx, body.cy, body.height / 2, kit.fill);
      kit.fill.setAlphaf(1);
    }
    drawHealth(canvas, frame, { text: monster.hpText, body });
  }
}

function vanishingAt(frame: Frame, key: string): Vanishing | null {
  if (!key.startsWith('vanish:')) return null;
  const [lane = 0, row = 0, kind = 0, alpha = 0] = frame.fx.entries[key]?.values ?? [];
  const body = bodyAt(frame, { lane, row, size: 1 });
  return body === null || alpha <= 0 ? null : { kind: kindAt(kind), body, alpha };
}

/** Defeated and breaching monsters are gone from the view: their tracks carry lane, row and kind. */
export function drawVanishing(canvas: SkCanvas, frame: Frame): void {
  for (const key of Object.keys(frame.fx.entries)) {
    const monster = vanishingAt(frame, key);
    if (monster === null) continue;
    drawBody(canvas, frame, monster);
  }
}

/** Pop bursts where monsters were defeated (full motion only: reduced motion has no burst track). */
export function drawBursts(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors, fx } = frame;
  for (const key of Object.keys(fx.entries)) {
    const burst = fx.entries[key];
    if (!key.startsWith('burst:') || !isPlaying(burst)) continue;
    const [lane = 0, row = 0] = burst.values;
    const body = bodyAt(frame, { lane, row, size: 1 });
    if (body === null) continue;
    const spec = {
      seed: lane * 31 + row,
      x: body.cx,
      y: body.cy,
      count: BURST_COUNT,
      minSpeed: 50,
      maxSpeed: 180,
      gravity: 380,
      lifeMs: 600,
    };
    kit.fill.setColor(colors.color.beam);
    for (let i = 0; i < spec.count; i += 1) {
      const particle = sampleParticle(spec, i, burst.ageMs);
      kit.fill.setAlphaf(particle.alpha);
      canvas.drawCircle(particle.x, particle.y, body.height * 0.12, kit.fill);
    }
    kit.fill.setAlphaf(1);
  }
}
