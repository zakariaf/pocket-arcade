// packages/game-kit/src/levels/stars-for-moves.ts
export type StarCount = 1 | 2 | 3;

export function starsForMoves(moves: number, par: number): StarCount {
  if (moves <= par) {
    return 3;
  }
  return moves <= par + 2 ? 2 : 1;
}
