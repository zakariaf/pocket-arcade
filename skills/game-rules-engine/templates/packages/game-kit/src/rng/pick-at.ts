// packages/game-kit/src/rng/pick-at.ts — the ONE place that turns noUncheckedIndexedAccess's
// `T | undefined` into `T`, so rules modules stay branch-free and fully coverable.
'worklet';

export function pickAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`index ${String(index)} outside 0..${String(items.length - 1)}`);
  }
  return item;
}
