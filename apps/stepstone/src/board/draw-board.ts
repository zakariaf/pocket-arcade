// apps/stepstone/src/board/draw-board.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';
import { drawFittedText } from '@e07/shell/game-host/draw-centered-text.ts';

import { cellEntity, TURN_ENTITY } from './board-ids.ts';
import { drawFrog, frogCenter, isAirborne, isPlaying } from './draw-frog.ts';
import { drawGlyph, drawStone } from './draw-stone.ts';

import type { BoardToken } from './board-palettes.ts';
import type { FrogAt } from './draw-frog.ts';
import type { StepstoneView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<StepstoneView, BoardToken>;

const BURST_COUNT = 16;
const RING_INSET = 0.04;
const CORNER = 0.24;
/** Ring widths as a share of a cell: the stones in reach, and the hinted hop (bolder). */
const REACH_WIDTH = 0.05;
const HINT_WIDTH = 0.09;
/** The glyph on the frog's belly: its face as a share of a cell, and how far below the centre. */
const BELLY = 0.44;
const BELLY_DROP = 0.08;

/** The rectangle of a pond cell by its row-major index, or null before the canvas has a size. */
export function cellBox(frame: Frame, index: number): Rect | null {
  const { side } = frame.view;
  const target = { regionId: 'board', col: index % side, row: Math.floor(index / side) };
  return cellRect(frame.layout, target);
}

type Ring = { readonly index: number; readonly token: BoardToken; readonly width: number };

/** A ring around a cell: the stones in reach and the hinted hop. */
function drawRing(canvas: SkCanvas, frame: Frame, ring: Ring): void {
  const rect = cellBox(frame, ring.index);
  if (rect === null) return;
  const by = rect.width * RING_INSET;
  frame.kit.stroke.setColor(frame.colors.color[ring.token]);
  frame.kit.stroke.setStrokeWidth(Math.max(2, rect.width * ring.width));
  const box = {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - 2 * by,
    height: rect.height - 2 * by,
  };
  const corner = rect.width * CORNER;
  canvas.drawRRect({ rect: box, rx: corner, ry: corner }, frame.kit.stroke);
}

/** Particles from the flag while the burst plays (full motion only: reduced has no burst track). */
function drawBurst(canvas: SkCanvas, frame: Frame, flag: Rect): void {
  const burst = fxEntry(frame.fx, 'burst', TURN_ENTITY);
  if (!isPlaying(burst)) return;
  const spec = {
    seed: frame.view.frog * 31 + frame.view.side,
    x: flag.x + flag.width / 2,
    y: flag.y + flag.height / 2,
    count: BURST_COUNT,
    minSpeed: 80,
    maxSpeed: 240,
    gravity: 420,
    lifeMs: 700,
  };
  for (let i = 0; i < spec.count; i += 1) {
    const particle = sampleParticle(spec, i, burst.ageMs);
    setPaintColor(frame.kit.fill, frame.colors.color.glow, particle.alpha);
    canvas.drawCircle(particle.x, particle.y, flag.width * 0.05, frame.kit.fill);
  }
}

/** The frog reached the flag: a fading glow, the hop count above the flag, then particles. */
function drawGoal(canvas: SkCanvas, frame: Frame): void {
  const goal = fxEntry(frame.fx, 'goal', TURN_ENTITY);
  const flag = cellBox(frame, frame.view.frog);
  if (!isPlaying(goal) || flag === null) return;
  const scale = pickAt(goal.values, 0);
  const { fill } = frame.kit;
  setPaintColor(fill, frame.colors.color.glow, 0.5 * (1 - goal.progress));
  canvas.drawCircle(flag.x + flag.width / 2, flag.y + flag.height / 2, flag.width * scale, fill);
  const font = frame.kit.numberFont;
  if (font !== null) {
    // The hop count in a chip above the flag, popping with the glow: it reads over any stone.
    const width = flag.width * 0.8 * scale;
    const height = flag.width * 0.44 * scale;
    const chip = { x: flag.x + (flag.width - width) / 2, y: flag.y - height, width, height };
    fill.setColor(frame.colors.color.background);
    canvas.drawRRect({ rect: chip, rx: height / 2, ry: height / 2 }, fill);
    frame.kit.stroke.setColor(frame.colors.color.label);
    frame.kit.stroke.setStrokeWidth(Math.max(1, flag.width * 0.03));
    canvas.drawRRect({ rect: chip, rx: height / 2, ry: height / 2 }, frame.kit.stroke);
    fill.setColor(frame.colors.color.label);
    drawFittedText(canvas, { text: frame.view.movesText, rect: chip }, { font, paint: fill });
  }
  drawBurst(canvas, frame, flag);
}

/** The reach rings once the frog has landed, then the host's hinted hop (EMPTY_HIGHLIGHT: none). */
function drawRings(canvas: SkCanvas, frame: Frame): void {
  if (!isAirborne(frame)) {
    for (const index of frame.view.reach) {
      drawRing(canvas, frame, { index, token: 'reach', width: REACH_WIDTH });
    }
  }
  for (const target of frame.highlight.hinted) {
    if (target.regionId !== 'board') continue;
    const index = target.row * frame.view.side + target.col;
    drawRing(canvas, frame, { index, token: 'hint', width: HINT_WIDTH });
  }
}

/** The frog wears the hop of the stone it stands on: that glyph on its belly (not while in the air). */
function drawBelly(canvas: SkCanvas, frame: Frame, at: FrogAt): void {
  if (isAirborne(frame)) return;
  const side = at.cell * BELLY;
  const face = {
    x: at.x - side / 2,
    y: at.y - side / 2 + at.cell * BELLY_DROP,
    width: side,
    height: side,
  };
  drawGlyph(canvas, frame, { code: pickAt(frame.view.cells, frame.view.frog), face, scale: 1 });
}

/** Pure worklet: reads only its arguments, allocates no Skia objects, reads no clock. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  for (let i = 0; i < frame.view.cells.length; i += 1) {
    const rect = cellBox(frame, i);
    if (rect === null) continue;
    const sink = fxEntry(frame.fx, 'sink', cellEntity(i));
    const pop = fxEntry(frame.fx, 'pop', cellEntity(i));
    drawStone(canvas, frame, { index: i, rect, sink, pop: isPlaying(pop) ? pop : undefined });
  }
  drawRings(canvas, frame);
  const centre = frogCenter(frame, cellBox);
  if (centre !== null) {
    drawFrog(canvas, frame, centre);
    drawBelly(canvas, frame, centre);
  }
  drawGoal(canvas, frame);
}
