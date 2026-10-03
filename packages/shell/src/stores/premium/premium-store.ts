// packages/shell/src/stores/premium/premium-store.ts
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { useStores } from '@e07/shell/app/stores-context.tsx';

import { premiumReducer } from './premium-reducer.ts';
import { initialPremiumState } from './premium-state.ts';

import type { PremiumAction, PremiumState } from './premium-state.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { StoreApi } from 'zustand/vanilla';

export type PremiumStoreState = PremiumState & {
  readonly dispatch: (action: PremiumAction) => void;
};

export type PremiumStore = StoreApi<PremiumStoreState>;

/**
 * Hydrated once from the save's `premium` section. Reduce -> publish only: the Premium
 * service writes the save through persistPremium before it dispatches.
 */
export function createPremiumStore(save: SaveService): PremiumStore {
  return createStore<PremiumStoreState>()((set, get) => ({
    ...initialPremiumState(save.doc().premium.owned),
    dispatch: (action) => {
      set(premiumReducer(get(), action));
    },
  }));
}

/** Primitives: `usePremiumStore((state) => state.isPremium)`; objects: `useShallow`. */
export function usePremiumStore<TSlice>(selector: (state: PremiumStoreState) => TSlice): TSlice {
  return useStore(useStores().premium, selector);
}
