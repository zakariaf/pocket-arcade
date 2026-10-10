// packages/shell/src/stores/restart-store.ts
// The one Shell store that is never saved: the direction reload a screen has started (S2 Continue,
// the S14 "Restart now"), from the tap until the app reloads. The route guards read it, so the
// screen the player is on stays while audio is disposed and the reload starts: without it, S2's
// saved language would mount the tutorial in the old direction for that window. It is also the one
// guard against a second reload: begin() refuses while a restart is pending, whichever screen or
// hook instance taps. A restart that fails cancels it, so the player may try again. It holds one
// value, so it has no reducer, and nothing writes the save.
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { useStores } from '@e07/shell/app/stores-context.tsx';

import type { StoreApi } from 'zustand/vanilla';

/**
 * The layout direction the reload goes to: the same union as i18n's Direction
 * (i18n/languages.ts). The stores land at Shell step 5 and i18n at step 6, so this file cannot
 * import it; the two types stay assignable to each other.
 */
export type RestartDirection = 'ltr' | 'rtl';

export type RestartState = {
  readonly pendingDirection: RestartDirection | null;
  /** Holds the restart; false (and nothing changes) while another one is already pending. */
  readonly begin: (direction: RestartDirection) => boolean;
  readonly cancel: () => void;
};

export type RestartStore = StoreApi<RestartState>;

export function createRestartStore(): RestartStore {
  return createStore<RestartState>()((set, get) => ({
    pendingDirection: null,
    begin: (direction) => {
      if (get().pendingDirection !== null) return false;
      set({ pendingDirection: direction });
      return true;
    },
    cancel: () => {
      set({ pendingDirection: null });
    },
  }));
}

export function selectIsRestartPending(state: RestartState): boolean {
  return state.pendingDirection !== null;
}

export function useRestartStore<TSlice>(selector: (state: RestartState) => TSlice): TSlice {
  return useStore(useStores().restart, selector);
}
