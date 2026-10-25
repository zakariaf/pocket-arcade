// apps/trail-clear/src/rules/shipped-levels.ts
// The (seed, difficulty) pairs of the shipped packs. generate-levels.ts proved each pair's first
// board with the witness when it wrote the pack (the level plan generates from drawStart), and the
// levels contract test proves them again, so create() hands them out without a runtime proof.
import pack1 from '@e07/trail-clear/levels/pack-1.json' with { type: 'json' };
import pack2 from '@e07/trail-clear/levels/pack-2.json' with { type: 'json' };
import pack3 from '@e07/trail-clear/levels/pack-3.json' with { type: 'json' };

const keyOf = (seed: number, difficulty: number): string => `${String(seed)}:${String(difficulty)}`;

const SHIPPED: readonly string[] = [...pack1, ...pack2, ...pack3].map((entry) =>
  keyOf(entry.seed, entry.difficulty),
);

/** True for the seed and difficulty of a shipped pack level. */
export function isShippedLevel(seed: number, difficulty: number): boolean {
  return SHIPPED.includes(keyOf(seed, difficulty));
}
