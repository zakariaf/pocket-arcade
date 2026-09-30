// packages/shell/src/stores/settings-store.ts
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { useStores } from '@e07/shell/app/stores-context.tsx';
import { settingsReducer } from '@e07/shell/stores/settings-reducer.ts';

import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SettingsAction, SettingsState } from '@e07/shell/stores/settings-reducer.ts';
import type { StoreApi } from 'zustand/vanilla';

export type SettingsStoreState = SettingsState & {
  readonly dispatch: (action: SettingsAction) => void;
};

export type SettingsStore = StoreApi<SettingsStoreState>;

/** Thin: reduce -> persist (sync, one transaction) -> publish. Hydrated once at boot. */
export function createSettingsStore(save: SaveService): SettingsStore {
  const { settings, firstRun } = save.doc();
  return createStore<SettingsStoreState>()((set, get) => ({
    settings,
    firstRun,
    dispatch: (action) => {
      const next = settingsReducer(get(), action);
      set(next);
      save.update((doc) => ({ ...doc, settings: next.settings, firstRun: next.firstRun }));
    },
  }));
}

/** Primitives: `useSettingsStore(selectThemePreference)`; objects and arrays: `useShallow`. */
export function useSettingsStore<TSlice>(selector: (state: SettingsStoreState) => TSlice): TSlice {
  return useStore(useStores().settings, selector);
}
