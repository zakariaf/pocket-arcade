// apps/line-siege/src/rules/list-moves.ts
export function listMoves(count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => index);
}
