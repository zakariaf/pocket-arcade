// apps/stepstone/src/board/draw-stone.ts
'worklet';

import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import type { BoardToken } from './board-palettes.ts';
import type { StepstoneView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<StepstoneView, BoardToken>;

/** The fill of each cell code (CELL_CODE): water and sunk stones draw no stone. */
const STONE_FILL: readonly (BoardToken | null)[] = [
  null,
  null,
  'flag',
  'stoneKing',
  'stoneRook',
  'stoneBishop',
  'stoneKnight',
];
/** The unit glyph path of each cell code (board paths): the hop's shape, or the flag. */
const GLYPH: readonly (string | null)[] = [null, null, 'flag', 'king', 'rook', 'bishop', 'knight'];
const SUNK = 1;
const INSET = 0.1;
const CORNER = 0.26;
const GLYPH_SCALE = 0.46;
/** Glyph strokes in the unit space of a glyph (scaled with it). */
const GLYPH_STROKE = 0.16;
const EDGE = 0.045;

export type StoneAt = {
  readonly index: number;
  readonly rect: Rect;
  /** The sink track of this cell (the stone the frog left going under), if any. */
  readonly sink: FxEntry | undefined;
  /** The pop track of this cell while it plays (a new hop kind landed on), else undefined. */
  readonly pop: FxEntry | undefined;
};

function inset(rect: Rect, share: number): Rect {
  const by = rect.width * share;
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - 2 * by,
    height: rect.height - 2 * by,
  };
}

/** The glyph of a cell code centred on a face, scaled by `scale` (1 at rest); the frog wears it too. */
export function drawGlyph(
  canvas: SkCanvas,
  frame: Frame,
  at: { code: number; face: Rect; scale: number },
): void {
  const name = pickAt(GLYPH, at.code);
  const path = name === null ? undefined : frame.kit.paths[name];
  if (path === undefined) return;
  const size = at.face.width * GLYPH_SCALE * at.scale;
  frame.kit.stroke.setColor(frame.colors.color[at.code === 2 ? 'flagMark' : 'glyph']);
  frame.kit.stroke.setStrokeWidth(GLYPH_STROKE);
  canvas.save();
  canvas.translate(at.face.x + (at.face.width - size) / 2, at.face.y + (at.face.height - size) / 2);
  canvas.scale(size, size);
  canvas.drawPath(path, frame.kit.stroke);
  canvas.restore();
}

/** One stone: a rounded face in its hop's colour with an ink edge and its glyph (shape, not colour alone). */
function drawFace(
  canvas: SkCanvas,
  frame: Frame,
  at: { code: number; rect: Rect; size: number; glyph: number },
): void {
  const token = pickAt(STONE_FILL, at.code);
  if (token === null) return;
  const face = inset(at.rect, INSET + ((1 - at.size) * (1 - 2 * INSET)) / 2);
  const corner = face.width * CORNER;
  frame.kit.fill.setColor(frame.colors.color[token]);
  canvas.drawRRect({ rect: face, rx: corner, ry: corner }, frame.kit.fill);
  frame.kit.stroke.setColor(frame.colors.color.edge);
  frame.kit.stroke.setStrokeWidth(Math.max(1, at.rect.width * EDGE));
  canvas.drawRRect({ rect: face, rx: corner, ry: corner }, frame.kit.stroke);
  drawGlyph(canvas, frame, { code: at.code, face, scale: at.glyph });
}

/** A sunk stone: a ripple ring, and the stone itself shrinking while its sink track plays. */
function drawSunk(canvas: SkCanvas, frame: Frame, at: StoneAt): void {
  frame.kit.stroke.setColor(frame.colors.color.ripple);
  frame.kit.stroke.setStrokeWidth(Math.max(1, at.rect.width * 0.03));
  canvas.drawCircle(
    at.rect.x + at.rect.width / 2,
    at.rect.y + at.rect.height / 2,
    at.rect.width * 0.3,
    frame.kit.stroke,
  );
  if (at.sink === undefined) return;
  const left = pickAt(at.sink.values, 0);
  const code = pickAt(at.sink.values, 1);
  if (left > 0) drawFace(canvas, frame, { code, rect: at.rect, size: left, glyph: 1 });
}

/** Pure worklet: one pond cell from the view and its tracks. */
export function drawStone(canvas: SkCanvas, frame: Frame, at: StoneAt): void {
  const code = pickAt(frame.view.cells, at.index);
  if (code === SUNK) {
    drawSunk(canvas, frame, at);
    return;
  }
  const glyph = at.pop === undefined ? 1 : pickAt(at.pop.values, 0);
  drawFace(canvas, frame, { code, rect: at.rect, size: 1, glyph });
}
