// packages/shell/src/stores/progress-store.ts
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { useStores } from '@e07/shell/app/stores-context.tsx';
import { progressReducer } from '@e07/shell/stores/progress-reducer.ts';

import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { ProgressAction, ProgressState } from '@e07/shell/stores/progress-reducer.ts';
import type { StoreApi } from 'zustand/vanilla';

export type ProgressStoreState = ProgressState & {
  readonly dispatch: (action: ProgressAction) => void;
};

export type ProgressStore = StoreApi<ProgressStoreState>;

/** The sections this store owns, read from a document (at boot and after a cross-section write). */
export function progressSliceOf(doc: SaveDoc): ProgressState {
  const { progress, daily, hints, upsell } = doc;
  return { progress, daily, hints, upsell };
}

/** Thin: reduce -> persist (sync, one transaction) -> publish. Hydrated once at boot. */
export function createProgressStore(save: SaveService): ProgressStore {
  return createStore<ProgressStoreState>()((set, get) => ({
    ...progressSliceOf(save.doc()),
    dispatch: (action) => {
      const current = get();
      const next = progressReducer(current, action);
      if (next === current) return; // nothing changed: no write, no re-render
      const { progress, daily, hints, upsell } = next;
      save.update((doc) => ({ ...doc, progress, daily, hints, upsell }));
      set({ progress, daily, hints, upsell });
    },
  }));
}

/** Primitives: `useProgressStore(selectEndlessBest)`; objects and arrays: `useShallow`. */
export function useProgressStore<TSlice>(selector: (state: ProgressStoreState) => TSlice): TSlice {
  return useStore(useStores().progress, selector);
}
