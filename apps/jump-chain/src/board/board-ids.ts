// apps/jump-chain/src/board/board-ids.ts
'worklet';

/** Entity of the one-per-turn tracks: the piece's slide and jumps, the clear glow. */
export const TURN_ENTITY = 0;

/**
 * Entity id of an enemy by its id, shared by buildTimeline (JS thread) and draw (UI thread), so an
 * enemy's tracks never collide with the turn entity. A 'worklet' module: the draw worklet may only
 * call worklets.
 */
export function enemyEntity(id: number): number {
  return 1000 + id;
}
