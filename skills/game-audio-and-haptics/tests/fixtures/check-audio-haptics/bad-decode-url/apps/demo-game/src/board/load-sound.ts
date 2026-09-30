// apps/demo-game/src/board/load-sound.ts
export async function load(ctx: { decodeAudioData: (url: string) => Promise<unknown> }): Promise<unknown> {
  return ctx.decodeAudioData('https://example.com/boom.mp3');
}
