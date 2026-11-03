// packages/game-kit/src/rng/pick.ts
export function pick<T>(items: readonly T[], seed: number): T | undefined {
  return items[seed % items.length];
}
