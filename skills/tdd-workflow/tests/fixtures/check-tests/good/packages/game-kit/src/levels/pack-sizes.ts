// packages/game-kit/src/levels/pack-sizes.ts: a constants table, covered by the tests that use it.
export const PACK_SIZES = [30, 30, 30] as const;
export type PackSize = (typeof PACK_SIZES)[number];
