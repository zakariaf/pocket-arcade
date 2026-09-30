// The composition root builds the game host without extendRunEnd.
import { createGameHost } from '@e07/shell/game-host/create-game-host.ts';

export function createShellParts(deps: Parameters<typeof createGameHost>[0]): ReturnType<typeof createGameHost> {
  return createGameHost({ ...deps });
}
