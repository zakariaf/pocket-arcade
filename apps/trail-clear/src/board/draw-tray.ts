// apps/trail-clear/src/board/draw-tray.ts
'worklet';
// The tray (the offered tile once per distinct turn) and what a chosen turn would do. Spec 13 risk:
// ""what gets wiped" is hard to read before committing": while a turn is dragged or chosen, a dot
// marks every cell where it fits; over a cell, the ghost tile shows there with a ring on every tile
// the placement would wipe and its points in the chosen digits.

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { drawFittedText } from '@e07/shell/game-host/draw-centered-text.ts';

import { slotEntity } from './board-ids.ts';
import { drawFace, drawRing, inset, INSET, MIN_VISIBLE, scaled, slotOf } from './draw-parts.ts';
import { drawTile } from './draw-tile.ts';
import { trayTileRect, traySlotRect } from './layout-board.ts';

import type { Frame } from './draw-parts.ts';
import type { BoardTarget, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

/** A ghost that does not fit shows this faint; one that fits nearly solid. */
const GHOST_ALPHA = { fits: 0.85, misfit: 0.4 } as const;
const DOT_SHARE = 0.07;

/** The turn being dragged (while a finger holds a tray tile), else the one chosen by a tap. */
function chosenSlot(frame: Frame): number | null {
  const { pointer } = frame.fx;
  const dragged = pointer.isDown ? slotOf(pointer.dragFrom) : null;
  return dragged ?? slotOf(frame.highlight.selected);
}

function boardCell(frame: Frame, index: number): Rect | null {
  const { size } = frame.view;
  return cellRect(frame.layout, {
    regionId: 'board',
    col: index % size,
    row: Math.floor(index / size),
  });
}

/** The points a placement would score, on a small badge in the cell's top end corner. */
function drawPoints(
  canvas: SkCanvas,
  frame: Frame,
  at: { readonly rect: Rect; readonly text: string },
): void {
  const { rect } = at;
  const badge = {
    x: rect.x + rect.width * 0.42,
    y: rect.y + rect.height * 0.06,
    width: rect.width * 0.52,
    height: rect.height * 0.3,
  };
  drawFace(canvas, frame, { rect: badge, token: 'badge' });
  const font = frame.kit.numberFont;
  if (font === null) return;
  frame.kit.fill.setColor(frame.colors.color.number);
  drawFittedText(canvas, { text: at.text, rect: badge }, { font, paint: frame.kit.fill });
}

/**
 * The chosen turn: a dot on every cell it fits; for a tap choice (no finger down) also the points
 * of every placement that would close a loop, so tap-then-tap players see them before the cell tap.
 */
export function drawChoice(canvas: SkCanvas, frame: Frame): void {
  const slot = chosenSlot(frame);
  const masks = slot === null ? undefined : frame.view.wipes[slot];
  if (slot === null || masks === undefined) return;
  const texts = frame.view.pointsText[slot] ?? [];
  const isTapChoice = !frame.fx.pointer.isDown;
  frame.kit.fill.setColor(frame.colors.color.hint);
  masks.forEach((mask, index) => {
    const rect = mask < 0 ? null : boardCell(frame, index);
    if (rect === null) return;
    frame.kit.fill.setColor(frame.colors.color.hint);
    canvas.drawCircle(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width * DOT_SHARE,
      frame.kit.fill,
    );
    const text = texts[index] ?? '';
    if (isTapChoice && text !== '') drawPoints(canvas, frame, { rect, text });
  });
}

/** The tray: one slot per distinct turn; a dealt tile grows in ('tray' track); the chosen slot is ringed. */
export function drawTray(canvas: SkCanvas, frame: Frame): void {
  const selected = slotOf(frame.highlight.selected);
  frame.view.tray.forEach((edges, slot) => {
    const rect = traySlotRect(frame.layout, slot);
    const tile = trayTileRect(frame.layout, slot);
    if (rect === null || tile === null) return;
    drawFace(canvas, frame, { rect: inset(rect, INSET), token: 'tray' });
    if (slot === selected) {
      drawRing(canvas, frame, {
        rect: inset(rect, INSET / 2),
        width: rect.width * 0.05,
        token: 'hint',
      });
    }
    const grow = fxEntry(frame.fx, 'tray', slotEntity(slot))?.values[0] ?? 1;
    if (grow > MIN_VISIBLE) drawTile(canvas, frame, { edges, rect: scaled(tile, grow) });
  });
}

/** The hinted or coached targets (host highlight): a ring on each tray slot and board cell. */
export function drawHinted(canvas: SkCanvas, frame: Frame): void {
  for (const target of frame.highlight.hinted) {
    const slot = slotOf(target);
    const rect = slot === null ? cellRect(frame.layout, target) : traySlotRect(frame.layout, slot);
    if (rect === null) continue;
    drawRing(canvas, frame, {
      rect: inset(rect, INSET / 2),
      width: Math.max(2, rect.width * 0.06),
      token: 'hint',
    });
  }
}

/** The tiles a placement wipes: a ring on each (the placed cell's own ring sits round the ghost). */
function drawWipes(canvas: SkCanvas, frame: Frame, mask: number): void {
  for (let index = 0; index < frame.view.cells.length; index += 1) {
    const rect = (mask >> index) % 2 === 0 ? null : boardCell(frame, index);
    if (rect === null) continue;
    drawRing(canvas, frame, {
      rect: inset(rect, INSET / 2),
      width: Math.max(2, rect.width * 0.07),
      token: 'wipe',
    });
  }
}

type Ghost = {
  readonly slot: number;
  readonly index: number;
  readonly rect: Rect;
  readonly edges: readonly number[];
};

/** The dragged turn and the board cell it hovers, or null while nothing is dragged over the board. */
function ghostOf(frame: Frame): Ghost | null {
  const { pointer } = frame.fx;
  const slot = pointer.isDown ? slotOf(pointer.dragFrom) : null;
  const hover: BoardTarget | null = pointer.hover?.regionId === 'board' ? pointer.hover : null;
  const edges = slot === null ? undefined : frame.view.tray[slot];
  const rect = hover === null ? null : cellRect(frame.layout, hover);
  if (slot === null || hover === null || edges === undefined || rect === null) return null;
  return { slot, index: hover.row * frame.view.size + hover.col, rect, edges };
}

/**
 * While a tray tile is dragged over the board, its ghost sits on the hovered cell. The gesture
 * layer already lifted the pointer (GameBoard.dragLiftPt) and hit-tested the lifted point, so the
 * hovered cell IS the drop cell: no offset is added here.
 */
export function drawGhost(canvas: SkCanvas, frame: Frame): void {
  const ghost = ghostOf(frame);
  if (ghost === null) return;
  const { slot, index, rect, edges } = ghost;
  const mask = frame.view.wipes[slot]?.[index] ?? -1;
  drawTile(canvas, frame, { edges, rect, alpha: mask < 0 ? GHOST_ALPHA.misfit : GHOST_ALPHA.fits });
  if (mask <= 0) return;
  drawWipes(canvas, frame, mask);
  const text = frame.view.pointsText[slot]?.[index] ?? '';
  if (text !== '') drawPoints(canvas, frame, { rect, text });
}
