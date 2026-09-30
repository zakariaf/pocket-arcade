// packages/game-kit/src/levels/level-types.ts
export type LevelId = { readonly pack: number; readonly index: number };
export type Scorer = (moves: number) => number;
