// apps/snare-snake/src/board/board-geometry.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import type { BoardLayout, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';

/** The rect of a board cell index (fractional col and row work for a slide between two cells). */
export function rectAt(layout: BoardLayout, cols: number, cell: number): Rect | null {
  return cellRect(layout, { regionId: 'board', col: cell % cols, row: Math.floor(cell / cols) });
}

/** The rect between two cells at progress t (0 = the first cell, 1 = the second). */
export function rectBetween(
  layout: BoardLayout,
  cols: number,
  slide: readonly number[],
): Rect | null {
  const from = rectAt(layout, cols, pickAt(slide, 0));
  const to = rectAt(layout, cols, pickAt(slide, 1));
  if (from === null || to === null) return null;
  const t = pickAt(slide, 2);
  return { ...to, x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/** A rect shrunk by a share of its width on every side. */
export function inset(rect: Rect, share: number): Rect {
  const by = rect.width * share;
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - 2 * by,
    height: rect.height - 2 * by,
  };
}

/** An effect that is not a tween of something visible draws only once its track has started. */
export function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress < 1;
}
