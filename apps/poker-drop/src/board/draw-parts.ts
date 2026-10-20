// apps/poker-drop/src/board/draw-parts.ts
'worklet';

import { wellCellRect } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { PokerDropView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';

export type Frame = DrawFrame<PokerDropView, BoardToken>;

/** A card face fills this share of its square slot's width and height (a card is upright). */
const CARD_WIDTH = 0.78;
const CARD_HEIGHT = 0.94;

/**
 * An effect that is not a tween of something visible draws only once its track has started and
 * until it ends. Every easing ends exactly at 1, but out-back passes 1 on its way (the badge's
 * pop), so "ended" is progress === 1, never progress >= 1.
 */
export function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress !== 1;
}

/** True once a track has run to its end. */
export function isOver(entry: FxEntry): boolean {
  return entry.ageMs > 0 && entry.progress === 1;
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
