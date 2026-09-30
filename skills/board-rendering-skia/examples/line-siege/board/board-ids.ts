// apps/line-siege/src/board/board-ids.ts
'worklet';

/** Monster kinds by index: timeline tracks carry numbers, draw() turns them back into shapes. */
export const KIND_ORDER = ['normal', 'armoured', 'fast'] as const;

export type MonsterKindName = (typeof KIND_ORDER)[number];

/** Entity of the one-per-turn tracks: the shockwave, the push-back, the shake. */
export const TURN_ENTITY = 0;

/**
 * Entity id of a board cell, shared by buildTimeline (JS thread) and draw (UI thread), so cell
 * tracks never collide with monster ids, lanes or hearts. A 'worklet' module: draw may only call
 * worklets.
 */
export function cellEntity(col: number, row: number): number {
  return 1000 + row * 100 + col;
}

/** Entity of heart slot `index` (0 = the first heart on the wall). */
export function heartEntity(index: number): number {
  return 900 + index;
}

/** The kind of a track's kind index (unknown indexes draw as normal monsters). */
export function kindAt(index: number): MonsterKindName {
  return KIND_ORDER[index] ?? 'normal';
}

/** The index a timeline track stores for a kind. */
export function kindIndex(kind: MonsterKindName): number {
  return KIND_ORDER.indexOf(kind);
}
