// packages/shell/src/game-host/game-session-store.ts
import { createStore } from 'zustand/vanilla';

/** One store per game session, created by the game host. */
export function createGameSessionStore(): unknown {
  return createStore(() => ({ moves: 0 }));
}
