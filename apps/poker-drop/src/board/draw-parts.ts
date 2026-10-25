// apps/poker-drop/src/board/draw-parts.ts
'worklet';

import { trackKey } from '@e07/game-kit/timeline/sample.ts';

import { wellCellRect } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { PokerDropView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry, FxSample } from '@e07/game-kit/timeline/sample.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';

export type Frame = DrawFrame<PokerDropView, BoardToken>;

/** A card face fills this share of its square slot's width and height (a card is upright). */
const CARD_WIDTH = 0.78;
const CARD_HEIGHT = 0.94;

/**
 * True once the key's track has run to its end, by its linear time. An effect that plays only while
 * its track runs uses the kit's playingEntry; neither reads the eased progress, which an out-back
 * track (the badge's pop) passes 1 with long before it ends.
 */
export function hasEnded(fx: FxSample, channel: string, entityId: number): boolean {
  const linear = fx.linear[trackKey(channel, entityId)];
  return linear !== undefined && linear >= 1;
}

/** One sampled value of a track (0 for a value the track does not carry). */
export function valueAt(entry: FxEntry, index: number): number {
  return entry.values[index] ?? 0;
}

/** `share` of the way from `a` to `b`. */
export function lerpRect(a: Rect, b: Rect, share: number): Rect {
  return {
    x: a.x + (b.x - a.x) * share,
    y: a.y + (b.y - a.y) * share,
    width: a.width + (b.width - a.width) * share,
    height: a.height + (b.height - a.height) * share,
  };
}

/** The upright card face inside a square slot, scaled about its centre. */
export function cardFace(slot: Rect, scale: number): Rect {
  const width = slot.width * CARD_WIDTH * scale;
  const height = slot.height * CARD_HEIGHT * scale;
  return {
    x: slot.x + (slot.width - width) / 2,
    y: slot.y + (slot.height - height) / 2,
    width,
    height,
  };
}

/** The square slot of a well position (rows from the bottom; fractional while a card moves). */
export function slotAt(frame: Frame, col: number, row: number): Rect {
  return wellCellRect(frame.layout, { col, row });
}

/** Centre of a well position, with the cell size. */
export function pointAt(
  frame: Frame,
  col: number,
  row: number,
): { readonly x: number; readonly y: number; readonly cell: number } {
  const slot = slotAt(frame, col, row);
  return { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2, cell: slot.width };
}
