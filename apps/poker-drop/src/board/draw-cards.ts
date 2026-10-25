// apps/poker-drop/src/board/draw-cards.ts
'worklet';

import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';

import { cellEntity, goneEntity, TURN_ENTITY } from './board-ids.ts';
import { drawCard } from './draw-card.ts';
import { cardFace, isOver, isPlaying, lerpRect, slotAt, valueAt } from './draw-parts.ts';
import { dealRects } from './layout-board.ts';

import type { Frame } from './draw-parts.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

/** More cards than a move can take out of a 30-cell well (the loop over gone entities stops here). */
const MAX_GONE = 64;
/** A landing squashes the card by this share of its height. */
const SQUASH = 0.14;
/** A bursting card grows by this share while it fades; its glow ring reaches this far out. */
const BURST_GROW = 0.2;
const RING_OUT = 0.1;
/** A card lifted out by the continue rises this many cells while it fades. */
const LIFT_CELLS = 0.6;

type Placed = { readonly col: number; readonly row: number };

/**
 * Where the card of `entityId` is: its pos track while it has one, else `still` (a card that sat
 * still, lifted by the rise track while a row rises).
 */
function placeOf(frame: Frame, entityId: number, still: Placed): Placed {
  const pos = fxEntry(frame.fx, 'pos', entityId);
  return pos === undefined ? still : { col: valueAt(pos, 0), row: valueAt(pos, 1) };
}

/**
 * The card's slot, pulled toward the hand slot while it slides out of the hand; null while the card
 * still waits under the well for its rising row (row -1 or below).
 */
function slotOf(frame: Frame, entityId: number, at: Placed): Rect | null {
  if (at.row <= -1) return null;
  const slot = slotAt(frame, at.col, at.row);
  const slide = fxEntry(frame.fx, 'slide', entityId);
  const share = slide === undefined ? 0 : valueAt(slide, 0);
  return share > 0 ? lerpRect(slot, dealRects(frame.layout).hand, share) : slot;
}

/** The card's face, squashed down onto its cell while it lands. */
function faceOf(frame: Frame, entityId: number, slot: Rect): Rect {
  const face = cardFace(slot, 1);
  const land = fxEntry(frame.fx, 'land', entityId);
  if (!isPlaying(land)) return face;
  const squash = valueAt(land, 0) * SQUASH;
  const height = face.height * (1 - squash);
  const width = face.width * (1 + squash / 2);
  return {
    x: face.x - (width - face.width) / 2,
    y: face.y + face.height - height,
    width,
    height,
  };
}

/** Every card still in the well at the end of the move, where it is at this moment. */
export function drawWellCards(canvas: SkCanvas, frame: Frame): void {
  const { view } = frame;
  const riseEntry = fxEntry(frame.fx, 'rise', TURN_ENTITY);
  const rise = riseEntry === undefined ? 0 : valueAt(riseEntry, 0);
  view.cells.forEach((card, index) => {
    if (card < 0) return;
    const entityId = cellEntity(index);
    const still = { col: index % view.cols, row: Math.floor(index / view.cols) + rise };
    const slot = slotOf(frame, entityId, placeOf(frame, entityId, still));
    if (slot === null) return;
    drawCard(canvas, frame, { card, rect: faceOf(frame, entityId, slot), alpha: 1 });
  });
}

type Vanishing = {
  readonly card: number;
  readonly slot: Rect;
  /** 0: a burst; 1: the continue lifts it out. */
  readonly kind: number;
  readonly progress: number;
};

/** A bursting card's glow: a pop-coloured ring that grows and fades around it. */
function drawGlow(
  canvas: SkCanvas,
  frame: Frame,
  at: { readonly face: Rect; readonly progress: number },
): void {
  const { face, progress } = at;
  const out = face.width * RING_OUT * (1 + progress);
  const ring = {
    x: face.x - out,
    y: face.y - out,
    width: face.width + 2 * out,
    height: face.height + 2 * out,
  };
  setPaintColor(frame.kit.stroke, frame.colors.color.burst, 1 - progress);
  frame.kit.stroke.setStrokeWidth(Math.max(2, face.width * 0.12));
  canvas.drawRRect({ rect: ring, rx: face.width * 0.2, ry: face.width * 0.2 }, frame.kit.stroke);
  frame.kit.stroke.setAlphaf(1);
}

/** A burst glows, grows and fades; the continue lifts the card out of the well and fades it. */
function drawVanishing(canvas: SkCanvas, frame: Frame, card: Vanishing): void {
  const { progress, slot } = card;
  if (card.kind === 0) {
    const face = cardFace(slot, 1 + BURST_GROW * progress);
    drawGlow(canvas, frame, { face, progress });
    drawCard(canvas, frame, { card: card.card, rect: face, alpha: 1 - progress });
    return;
  }
  const lifted = { ...slot, y: slot.y - slot.height * LIFT_CELLS * progress };
  drawCard(canvas, frame, { card: card.card, rect: cardFace(lifted, 1), alpha: 1 - progress });
}

/** One card that leaves during the move: whole until its moment, then vanishing, then nothing. */
function drawGoneCard(
  canvas: SkCanvas,
  frame: Frame,
  at: { readonly entityId: number; readonly gone: FxEntry },
): void {
  const { entityId, gone } = at;
  const card = valueAt(gone, 0);
  const still = { col: valueAt(gone, 1), row: valueAt(gone, 2) };
  const slot = isOver(gone) ? null : slotOf(frame, entityId, placeOf(frame, entityId, still));
  if (slot === null) return;
  if (isPlaying(gone)) {
    drawVanishing(canvas, frame, { card, slot, kind: valueAt(gone, 3), progress: gone.progress });
    return;
  }
  drawCard(canvas, frame, { card, rect: faceOf(frame, entityId, slot), alpha: 1 });
}

/** Every card that leaves the well during the move, in the order the events took them. */
export function drawGoneCards(canvas: SkCanvas, frame: Frame): void {
  for (let order = 0; order < MAX_GONE; order += 1) {
    const entityId = goneEntity(order);
    const gone = fxEntry(frame.fx, 'gone', entityId);
    if (gone === undefined) return;
    drawGoneCard(canvas, frame, { entityId, gone });
  }
}
