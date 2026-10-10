// packages/shell/src/stores/restart-store.ts
// The one Shell store that is never saved: the direction reload a screen has started (S2 Continue,
// the S14 "Restart now"), from the tap until the app reloads. The route guards read it, so the
// screen the player is on stays while audio is disposed and the reload starts: without it, S2's
// saved language would mount the tutorial in the old direction for that window. It is also the one
// guard against a second reload: begin() refuses while a restart is pending, whichever screen or
// hook instance taps. A restart that fails lets go of the reload but keeps holding the screen
// (S2 stays, so its Continue tries again, and the tutorial never mounts in the old direction);
// a retry or a cancel (a choice that needs no restart) ends that. It holds two values and no
// rules worth a reducer, and nothing writes the save.
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
  /** The reload under way, from the tap until the app reloads. */
  readonly pendingDirection: RestartDirection | null;
  /** The reload that failed: its screen stays held until a retry or a cancel. */
  readonly failedDirection: RestartDirection | null;
  /** Holds the restart; false (and nothing changes) while another one is already pending. */
  readonly begin: (direction: RestartDirection) => boolean;
  /** The reload failed: a retry may begin, and the screen that started it stays held. */
  readonly fail: () => void;
  /** Lets go of the screen: no reload pending or failed. */
  readonly cancel: () => void;
};

export type RestartStore = StoreApi<RestartState>;

export function createRestartStore(): RestartStore {
  return createStore<RestartState>()((set, get) => ({
    pendingDirection: null,
    failedDirection: null,
    begin: (direction) => {
      if (get().pendingDirection !== null) return false;
      set({ pendingDirection: direction, failedDirection: null });
      return true;
    },
    fail: () => {
      set({ pendingDirection: null, failedDirection: get().pendingDirection });
    },
    cancel: () => {
      set({ pendingDirection: null, failedDirection: null });
    },
  }));
}

/** A restart is pending or failed: the screen that started it stays on screen. */
export function selectIsRestartHeld(state: RestartState): boolean {
  return state.pendingDirection !== null || state.failedDirection !== null;
}

export function selectIsRestartPending(state: RestartState): boolean {
  return state.pendingDirection !== null;
}

export function useRestartStore<TSlice>(selector: (state: RestartState) => TSlice): TSlice {
  return useStore(useStores().restart, selector);
}
