// packages/shell/src/stores/stats-store.ts
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { useStores } from '@e07/shell/app/stores-context.tsx';
import { statsActionRefreshesBackup, statsReducer } from '@e07/shell/stores/stats-reducer.ts';

import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { StatsAction, StatsState } from '@e07/shell/stores/stats-reducer.ts';
import type { StoreApi } from 'zustand/vanilla';

export type StatsStoreState = StatsState & {
  readonly dispatch: (action: StatsAction) => void;
};

export type StatsStore = StoreApi<StatsStoreState>;

export function statsSliceOf(doc: SaveDoc): StatsState {
  return { stats: doc.stats };
}

/** Thin: reduce -> persist (resets also refresh the backup) -> publish. */
export function createStatsStore(save: SaveService): StatsStore {
  return createStore<StatsStoreState>()((set, get) => ({
    ...statsSliceOf(save.doc()),
    dispatch: (action) => {
      const current = get();
      const next = statsReducer(current, action);
      if (next === current) return;
      const { stats } = next;
      save.update((doc) => ({ ...doc, stats }), {
        refreshBackup: statsActionRefreshesBackup(action),
      });
      set({ stats });
    },
  }));
}

/** Primitives: `useStatsStore(selectGamesPlayed)`; objects and arrays: `useShallow`. */
export function useStatsStore<TSlice>(selector: (state: StatsStoreState) => TSlice): TSlice {
  return useStore(useStores().stats, selector);
}
