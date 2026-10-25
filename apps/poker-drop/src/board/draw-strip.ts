// apps/poker-drop/src/board/draw-strip.ts
'worklet';

import { fxEntry } from '@e07/game-kit/timeline/sample.ts';

import { TURN_ENTITY } from './board-ids.ts';
import { drawCard, drawScaledText } from './draw-card.ts';
import { cardFace, hasEnded, lerpRect } from './draw-parts.ts';
import { dealRects } from './layout-board.ts';

import type { Frame } from './draw-parts.ts';
import type { DealRects } from './layout-board.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

/** The rising-row arrow takes the pill's start, the count its end. */
const ARROW_SHARE = 0.42;

function drawCardIn(
  canvas: SkCanvas,
  frame: Frame,
  at: { readonly card: number; readonly slot: Rect },
): void {
  drawCard(canvas, frame, { card: at.card, rect: cardFace(at.slot, 1), alpha: 1 });
}

/**
 * The card in hand and the next card. While a move plays, the hand slot stays empty (its card is
 * the one dropping) and the next card waits in its slot; when the deal starts it slides into the
 * hand slot and the new next card grows in its place.
 */
function drawDeal(canvas: SkCanvas, frame: Frame, deal: DealRects): void {
  const { view } = frame;
  const entry = fxEntry(frame.fx, 'deal', TURN_ENTITY);
  if (entry === undefined || hasEnded(frame.fx, 'deal', TURN_ENTITY)) {
    drawCardIn(canvas, frame, { card: view.hand, slot: deal.hand });
    drawCardIn(canvas, frame, { card: view.next, slot: deal.next });
    return;
  }
  if (entry.ageMs <= 0) {
    drawCardIn(canvas, frame, { card: view.hand, slot: deal.next });
    return;
  }
  const sliding = lerpRect(deal.next, deal.hand, entry.progress);
  drawCardIn(canvas, frame, { card: view.hand, slot: sliding });
  const grown = cardFace(deal.next, entry.progress);
  drawCard(canvas, frame, { card: view.next, rect: grown, alpha: entry.progress });
}

/** The rising-row arrow at the pill's start (a path from the kit; nothing when it has none). */
function drawArrow(canvas: SkCanvas, frame: Frame, pill: Rect): void {
  const arrow = frame.kit.paths['rise'];
  if (arrow === undefined) return;
  const size = pill.height * 0.62;
  canvas.save();
  canvas.translate(pill.x + pill.width * ARROW_SHARE - size, pill.y + (pill.height - size) / 2);
  canvas.scale(size, size);
  canvas.drawPath(arrow, frame.kit.fill);
  canvas.restore();
}

/**
 * The drops left before the next rising row: an up arrow and the count in the chosen digits, in
 * the warning colour when the next drop raises a row.
 */
function drawRise(canvas: SkCanvas, frame: Frame, pill: Rect): void {
  const { view, kit, colors } = frame;
  const isNext = view.riseDrops <= 1;
  const corner = pill.height / 2;
  kit.fill.setColor(isNext ? colors.color.warn : colors.color.card);
  canvas.drawRRect({ rect: pill, rx: corner, ry: corner }, kit.fill);
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(Math.max(1, pill.height * 0.08));
  canvas.drawRRect({ rect: pill, rx: corner, ry: corner }, kit.stroke);
  kit.fill.setColor(isNext ? colors.color.onWarn : colors.color.rank);
  drawArrow(canvas, frame, pill);
  const font = kit.numberFont;
  if (font === null) return;
  const box = {
    x: pill.x + pill.width * ARROW_SHARE + pill.height * 0.08,
    y: pill.y + pill.height * 0.2,
    width: pill.width * (1 - ARROW_SHARE) - pill.height * 0.3,
    height: pill.height * 0.6,
  };
  drawScaledText(canvas, { text: view.riseText, box }, { font, paint: kit.fill });
}

/** The deal strip: the card in hand, the next card and the rise counter. */
export function drawStrip(canvas: SkCanvas, frame: Frame): void {
  const deal = dealRects(frame.layout);
  drawDeal(canvas, frame, deal);
  drawRise(canvas, frame, deal.rise);
}
