// apps/merge-siege/src/board/board-ids.ts
'worklet';

/**
 * Ids and lookups shared by buildTimeline (JS thread) and draw (UI thread). A 'worklet' module:
 * the draw worklet may only call worklets.
 *
 * A 'piece' track's values are [col, row, value, kind, alpha, scale]. A value of VALUE_FROM_VIEW
 * or a kind of KIND_FROM_VIEW means "as the final view shows the piece": the events of a move name
 * the numbers of pieces that vanish or change, not of every piece that moves.
 */

/** Entity of the one 'next' track of a turn (the enemy waiting in the gate fades in). */
export const NEXT_ENTITY = 0;

export const TILE_KIND = 0;
export const ENEMY_KIND = 1;
export const KIND_FROM_VIEW = -1;
export const VALUE_FROM_VIEW = 0;

/** The place of a power of two in the view's digit table (1 → 0, 2 → 1, 1024 → 10). */
export function digitIndex(value: number): number {
  let index = 0;
  for (let power = 1; power < value; power *= 2) index += 1;
  return index;
}

/** A number in the chosen digits, from the table toView localised; '' past the table. */
export function digitsOf(view: { readonly digits: readonly string[] }, value: number): string {
  return view.digits[digitIndex(value)] ?? '';
}
