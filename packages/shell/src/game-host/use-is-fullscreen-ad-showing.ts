// packages/shell/src/game-host/use-is-fullscreen-ad-showing.ts
import { useStore } from 'zustand';

import type { FullscreenGate } from './fullscreen-gate.ts';

/** True while a full-screen ad covers the app (pass it to the board's useGameLifecycle). */
export function useIsFullscreenAdShowing(gate: FullscreenGate): boolean {
  return useStore(gate.store, (state) => state.isShowing);
}
