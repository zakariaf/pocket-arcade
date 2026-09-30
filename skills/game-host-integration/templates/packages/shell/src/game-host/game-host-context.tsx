// packages/shell/src/game-host/game-host-context.tsx
import { createContext, use } from 'react';

import type { GameHost } from '@e07/shell/game-host/game-host.ts';
import type { JSX, ReactNode } from 'react';

const GameHostContext = createContext<GameHost | null>(null);

export type GameHostProviderProps = {
  readonly host: GameHost;
  readonly children: ReactNode;
};

/** The one GameHost, created in the composition root after the save is hydrated. */
export function GameHostProvider({ host, children }: GameHostProviderProps): JSX.Element {
  return <GameHostContext value={host}>{children}</GameHostContext>;
}

/** Returns the game host. A missing provider is a programmer error, so it throws. */
export function useGameHost(): GameHost {
  const host = use(GameHostContext);
  if (host === null) throw new Error('useGameHost() needs a <GameHostProvider> above it');
  return host;
}
