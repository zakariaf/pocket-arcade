// packages/shell/src/stores/restart-store.ts
// The one Shell store that is never saved: the direction reload a screen has started (S2 Continue,
// the S14 "Restart now"), from the tap until the app reloads. The route guards read it, so the
// screen the player is on stays while audio is disposed and the reload starts: without it, S2's
// saved language would mount the tutorial in the old direction for that window. A restart that
// fails cancels it. It holds one value, so it has no reducer, and nothing writes the save.
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { useStores } from '@e07/shell/app/stores-context.tsx';

import type { StoreApi } from 'zustand/vanilla';

/** The layout direction the reload goes to (i18n's Direction, which lands a Shell step later). */
export type RestartDirection = 'ltr' | 'rtl';

export type RestartState = {
  readonly pendingDirection: RestartDirection | null;
  readonly begin: (direction: RestartDirection) => void;
  readonly cancel: () => void;
};

export type RestartStore = StoreApi<RestartState>;

export function createRestartStore(): RestartStore {
  return createStore<RestartState>()((set) => ({
    pendingDirection: null,
    begin: (direction) => {
      set({ pendingDirection: direction });
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
