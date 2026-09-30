// apps/tile-drop/src/rules/create.ts
export type TileDropStart = { readonly seed: number; readonly difficulty: number };

/** The rules' start state for a seed and a difficulty. */
export function create(seed: number, difficulty: number): TileDropStart {
  return { seed, difficulty };
}
