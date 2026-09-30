// The composition root records every finished level in the ad history in the run-end save.
import { createGameHost } from '@e07/shell/game-host/create-game-host.ts';
import { recordAdLevelEnd } from '@e07/shell/services/ads/ad-history.ts';

export function createShellParts(deps: Parameters<typeof createGameHost>[0]): ReturnType<typeof createGameHost> {
  return createGameHost({ ...deps, extendRunEnd: recordAdLevelEnd });
}
