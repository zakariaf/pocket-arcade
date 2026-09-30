// apps/line-siege/src/board/draw-tray.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';

import { drawBlock, drawPiece, drawRing, inset, INSET } from './draw-parts.ts';
import { traySlotRect } from './layout-board.ts';

import type { Frame } from './draw-parts.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

/** Largest block size in cells, so every tray block fits its slot at one scale. */
const TRAY_GRID = 4;

/** The tray lies in one row (portrait) or one column (wide), so a tray target's slot is col + row. */
function slotOf(target: BoardTarget | null): number | null {
  return target?.regionId === 'tray' ? target.col + target.row : null;
}

/** The three slots; a refilled block grows in ('tray' track); the host's selected slot is ringed. */
export function drawTray(canvas: SkCanvas, frame: Frame): void {
  const { view, colors, kit, fx } = frame;
  const selected = slotOf(frame.highlight.selected);
  view.tray.forEach((offsets, slot) => {
    const rect = traySlotRect(frame.layout, slot);
    if (rect === null) return;
    kit.fill.setColor(colors.color.tray);
    drawBlock(canvas, frame, { rect: inset(rect, INSET) });
    if (slot === selected)
      drawRing(canvas, frame, { rect: inset(rect, INSET / 2), width: rect.width * 0.05 });
    if (offsets.length === 0) return;
    const grow = fxEntry(fx, 'tray', slot)?.values[0] ?? 1;
    const mini = ((rect.width * 0.8) / TRAY_GRID) * grow;
    const start = {
      x: rect.x + rect.width * 0.1,
      y: rect.y + rect.height * 0.1,
      width: mini,
      height: mini,
    };
    kit.fill.setColor(colors.color.block);
    drawPiece(canvas, frame, { offsets, at: start });
  });
}

/** The hinted move (GameBoard.targetsOfMove): its cells as a ghost with an ink ring, its slot ringed. */
export function drawHinted(canvas: SkCanvas, frame: Frame): void {
  for (const target of frame.highlight.hinted) {
    const slot = slotOf(target);
    const rect = slot === null ? cellRect(frame.layout, target) : traySlotRect(frame.layout, slot);
    if (rect === null) continue;
    if (slot === null) {
      frame.kit.fill.setColor(frame.colors.color.ghost);
      drawBlock(canvas, frame, { rect: inset(rect, INSET) });
    } else {
      drawRing(canvas, frame, { rect: inset(rect, INSET / 2), width: rect.width * 0.03 });
    }
  }
}

/**
 * While a tray block is dragged over the board, its ghost sits on the hovered cell. The gesture
 * layer already lifted the pointer (GameBoard.dragLiftPt) and hit-tested the lifted point, so the
 * hovered cell IS the drop cell: no offset is added here.
 */
export function drawGhost(canvas: SkCanvas, frame: Frame): void {
  const { pointer } = frame.fx;
  const slot = slotOf(pointer.dragFrom);
  if (!pointer.isDown || slot === null || pointer.hover?.regionId !== 'board') return;
  const offsets = frame.view.tray[slot] ?? [];
  const anchor = cellRect(frame.layout, pointer.hover);
  if (anchor === null || offsets.length === 0) return;
  frame.kit.fill.setColor(frame.colors.color.ghost);
  drawPiece(canvas, frame, { offsets, at: anchor });
}
