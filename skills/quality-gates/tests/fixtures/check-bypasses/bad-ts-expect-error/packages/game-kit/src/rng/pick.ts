// packages/game-kit/src/rng/pick.ts
export function pick(items: readonly number[]): number {
  // @ts-expect-error
  return items[0];
}
