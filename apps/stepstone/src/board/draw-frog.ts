// apps/stepstone/src/board/draw-frog.ts
'worklet';

import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { fxEntry, playingEntry } from '@e07/game-kit/timeline/sample.ts';

import { FROG_ENTITY } from './board-ids.ts';

import type { BoardToken } from './board-palettes.ts';
import type { StepstoneView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<StepstoneView, BoardToken>;
type CellBox = (frame: Frame, index: number) => Rect | null;

/** Where the frog is drawn and how big a cell is there. */
export type FrogAt = { readonly x: number; readonly y: number; readonly cell: number };

/** How high the frog rises at the top of a hop, as a share of a cell. */
const HOP_LIFT = 0.45;
const SHAKE = 0.08;

/** Half a shake's period: the frog swings to one side, then the other. */
const SHAKE_HALF_MS = 60;

function centerOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** True while the frog is in the air: a hop track that has not landed yet (moment 0 included). */
export function isAirborne(frame: Frame): boolean {
  const hop = fxEntry(frame.fx, 'hop', FROG_ENTITY);
  return hop !== undefined && hop.progress < 1;
}

/** The sideways offset of a stranded frog: it swings while its track plays, then rests. */
function shakeOf(frame: Frame, cell: number): number {
  const stranded = playingEntry(frame.fx, 'stranded', FROG_ENTITY);
  if (stranded === undefined) return 0;
  const amplitude = pickAt(stranded.values, 0) * cell * SHAKE;
  return Math.floor(stranded.ageMs / SHAKE_HALF_MS) % 2 === 0 ? amplitude : -amplitude;
}

type HopStart = { readonly from: Rect; readonly progress: number };

/** The cell a hop that has not landed yet started from, with its eased progress; else null. */
function hopStart(frame: Frame, cellBox: CellBox): HopStart | null {
  const hop = fxEntry(frame.fx, 'hop', FROG_ENTITY);
  if (hop === undefined || hop.progress >= 1) return null;
  const from = cellBox(frame, pickAt(hop.values, 0));
  return from === null ? null : { from, progress: hop.progress };
}

/**
 * The frog's centre: on its stone at rest; during a hop, between the two cells by the eased progress,
 * lifted on a parabola (4p(1 - p): exact arithmetic, no trigonometry); shaken when stranded.
 */
export function frogCenter(frame: Frame, cellBox: CellBox): FrogAt | null {
  const rest = cellBox(frame, frame.view.frog);
  if (rest === null) return null;
  const target = centerOf(rest);
  const hop = hopStart(frame, cellBox);
  if (hop === null) {
    return { x: target.x + shakeOf(frame, rest.width), y: target.y, cell: rest.width };
  }
  const start = centerOf(hop.from);
  const p = hop.progress;
  const lift = rest.width * HOP_LIFT * 4 * p * (1 - p);
  return {
    x: start.x + (target.x - start.x) * p,
    y: start.y + (target.y - start.y) * p - lift,
    cell: rest.width,
  };
}

/** The frog: an accent dome with an ink edge and two white eyes with ink pupils (a shape, not a dot). */
export function drawFrog(canvas: SkCanvas, frame: Frame, at: FrogAt): void {
  const body = frame.kit.paths['frog'];
  const size = at.cell * 0.62;
  const { fill, stroke } = frame.kit;
  canvas.save();
  canvas.translate(at.x - size / 2, at.y - size / 2);
  canvas.scale(size, size);
  if (body !== undefined) {
    fill.setColor(frame.colors.color.frog);
    canvas.drawPath(body, fill);
    stroke.setColor(frame.colors.color.edge);
    stroke.setStrokeWidth(0.07);
    canvas.drawPath(body, stroke);
  }
  for (const eyeX of [0.3, 0.7]) {
    fill.setColor(frame.colors.color.frogEye);
    canvas.drawCircle(eyeX, 0.3, 0.14, fill);
    canvas.drawCircle(eyeX, 0.3, 0.14, stroke);
    fill.setColor(frame.colors.color.edge);
    canvas.drawCircle(eyeX + 0.02, 0.3, 0.06, fill);
  }
  canvas.restore();
}
