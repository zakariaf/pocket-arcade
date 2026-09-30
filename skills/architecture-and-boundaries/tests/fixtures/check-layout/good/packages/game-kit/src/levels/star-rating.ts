// packages/game-kit/src/levels/star-rating.ts
/** Pure level helpers shared by every game live in game-kit/src/levels/. */
export function starsForMoves(moves: number, par: number): number {
  return moves <= par ? 3 : 1;
}
