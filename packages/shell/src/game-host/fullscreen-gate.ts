// packages/shell/src/game-host/fullscreen-gate.ts
import { createStore } from 'zustand/vanilla';

import type { GameLifecycle } from '@e07/shell/services/ads/fullscreen-ad.ts';
import type { StoreApi } from 'zustand/vanilla';

type GateState = { readonly isShowing: boolean };

/**
 * The ads layer's GameLifecycle: runFullscreenAd(host.lifecycle, show) suspends the game around
 * a full-screen ad (iOS keeps the app 'active' while one shows, so AppState never tells us).
 * The board host reads it and stops its frame clock and audio while an ad covers the app.
 */
export type FullscreenGate = GameLifecycle & { readonly store: StoreApi<GateState> };

export function createFullscreenGate(): FullscreenGate {
  const store = createStore<GateState>()(() => ({ isShowing: false }));
  return {
    store,
    suspend: () => {
      store.setState({ isShowing: true });
    },
    resume: () => {
      store.setState({ isShowing: false });
    },
  };
}
