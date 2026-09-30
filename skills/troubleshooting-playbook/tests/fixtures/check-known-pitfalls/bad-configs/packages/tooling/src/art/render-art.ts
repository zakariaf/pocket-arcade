// packages/tooling/src/art/render-art.ts (excerpt)
export async function loadGame(id: string): Promise<unknown> {
  return import(`@e07/${id}/art/game-art.ts`);
}
