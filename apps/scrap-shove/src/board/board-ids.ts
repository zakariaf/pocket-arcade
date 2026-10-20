// apps/scrap-shove/src/board/board-ids.ts
'worklet';

/** Entity of the one-per-turn tracks (the clear glow and burst, the arrows, the revert flash). */
export const TURN_ENTITY = 0;
/** Entity of the player's tracks (step, wait pulse, caught flash). */
export const PLAYER_ENTITY = 1;

/** The three robot kinds as numbers, for tracks (track values are numbers). */
export const ROBOT_KIND_NAMES = ['normal', 'fast', 'heavy'] as const;

export type RobotKindName = (typeof ROBOT_KIND_NAMES)[number];

/**
 * Entity ids shared by buildTimeline (JS thread) and draw (UI thread). Robot and heap ids come from
 * the rules (one sequence, so a robot and a heap never share an id), crash ids from the order of
 * the crashes in a turn; each family has its own block so they never collide with the turn entity.
 */
export function robotEntity(robotId: number): number {
  return 1000 + robotId;
}

export function heapEntity(heapId: number): number {
  return 2000 + heapId;
}

export function crashEntity(order: number): number {
  return 3000 + order;
}

/** A robot kind as a track value. */
export function kindIndex(kind: RobotKindName): number {
  return ROBOT_KIND_NAMES.indexOf(kind);
}

/** A track value back to a robot kind (rounded and clamped, so a tween can never miss). */
export function kindAt(index: number): RobotKindName {
  const rounded = Math.round(index);
  if (rounded >= 2) return 'heavy';
  return rounded === 1 ? 'fast' : 'normal';
}
