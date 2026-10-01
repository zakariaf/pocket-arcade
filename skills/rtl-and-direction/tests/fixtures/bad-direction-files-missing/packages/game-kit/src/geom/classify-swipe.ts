// Game rules may name physical sides as data: a swipe left moves pieces left in every language.
export type Swipe = 'left' | 'right' | 'up' | 'down';
export const DELTAS = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 } } as const;

export function classifySwipe(dx: number): Swipe {
  return dx < 0 ? 'left' : 'right';
}
